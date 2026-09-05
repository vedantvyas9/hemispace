import { useRef, useMemo, useState, useEffect, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SparkRenderer, SplatFileType, SplatMesh } from "@sparkjsdev/spark";
import { attentionWeight, extinguished, dwellMs, azimuthDeg } from "./neglect";

// Mint GLBs may use KHR_draco_mesh_compression; one shared decoder for every load.
useGLTF.setDecoderPath("https://cdn.mint.gg/runtime/draco/gltf/three-0.184.0/");

/** Placeholder room, used only if scene.json has no generated world yet. */
function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -4]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#3a4048" />
      </mesh>
      <mesh position={[0, 3, -14]}>
        <boxGeometry args={[24, 6, 0.2]} />
        <meshStandardMaterial color="#2c323a" />
      </mesh>
      <mesh position={[-10, 3, -4]}>
        <boxGeometry args={[0.2, 6, 24]} />
        <meshStandardMaterial color="#333941" />
      </mesh>
      <mesh position={[10, 3, -4]}>
        <boxGeometry args={[0.2, 6, 24]} />
        <meshStandardMaterial color="#333941" />
      </mesh>
    </group>
  );
}

// Rotation corrects the World Labs source basis (mint-world-splats.md default).
// Scale is calibrated per-asset, not the pipeline default: this room's raw
// collider measures ~3.2m x 1.6m x 19m, so the documented default 2.5x blew it
// out to a 48m cavern. 1.6x keeps a plausible ~2.6m ceiling and ~30m length.
const WORLD_POSITION = [0, 1.5, 0];
const WORLD_ROTATION = [Math.PI, Math.PI, 0];
const WORLD_SCALE = 1.6;

/** Generated Marble/World Labs room: RAD splat + invisible physics collider. */
function MintWorld({ world }) {
  const { gl } = useThree();
  const spark = useMemo(() => new SparkRenderer({ renderer: gl }), [gl]);
  const splat = useMemo(
    () => new SplatMesh({ url: world.splatUrl, fileType: SplatFileType.RAD, paged: true, raycastable: false }),
    [world.splatUrl],
  );
  const { scene: colliderScene } = useGLTF(world.colliderUrl);

  useEffect(() => {
    colliderScene.traverse((o) => { o.visible = false; });
  }, [colliderScene]);

  useEffect(() => () => {
    spark.dispose?.();
    splat.dispose?.();
  }, [spark, splat]);

  return (
    <>
      <primitive object={spark} />
      <group position={WORLD_POSITION} rotation={WORLD_ROTATION} scale={WORLD_SCALE}>
        <primitive object={splat} />
        <primitive object={colliderScene} />
      </group>
    </>
  );
}

/** Non-destructive attention/found indicator. Never touches the model's own materials. */
function TargetGlow({ found, weight, suppressed, y, radius, color }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (!ref.current) return;
    const m = ref.current.material;
    const wantEmissive = found ? 0.9 : suppressed ? 0 : weight > 0.55 ? 0.35 : 0;
    m.emissiveIntensity += (wantEmissive - m.emissiveIntensity) * Math.min(1, dt * 8);
  });
  return (
    <mesh ref={ref} position={[0, y, 0]}>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0} transparent opacity={0.95} />
      <pointLight color={color} intensity={2} distance={2.5} />
    </mesh>
  );
}

function TargetModel({ target, found, weight, suppressed }) {
  const { scene } = useGLTF(target.url);
  const scale = target.scale ?? 1;
  return (
    <>
      <group scale={scale}>
        <primitive object={scene} />
      </group>
      <TargetGlow
        found={found} weight={weight} suppressed={suppressed}
        y={scale * 1.6} radius={scale * 0.4}
        color={found ? "#4ea87a" : "#ffb26b"}
      />
    </>
  );
}

function TargetBox({ target, found, weight, suppressed }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (!ref.current) return;
    const m = ref.current.material;
    const wantEmissive = found ? 0.9 : suppressed ? 0 : weight > 0.55 ? 0.35 : 0;
    m.emissiveIntensity += (wantEmissive - m.emissiveIntensity) * Math.min(1, dt * 8);
  });
  return (
    <mesh ref={ref} scale={target.scale ?? 1}>
      <boxGeometry args={[0.36, 0.36, 0.36]} />
      <meshStandardMaterial
        color={found ? "#4ea87a" : "#c9803f"}
        emissive={found ? "#4ea87a" : "#ffb26b"}
        emissiveIntensity={0}
      />
    </mesh>
  );
}

/** url: null means Track A draws a placeholder box (see CONTRACT.md). */
function Target({ target, found, weight, suppressed }) {
  return (
    <group position={target.position}>
      {target.url
        ? <TargetModel target={target} found={found} weight={weight} suppressed={suppressed} />
        : <TargetBox target={target} found={found} weight={weight} suppressed={suppressed} />}
    </group>
  );
}

function resolveTargetId(object) {
  let o = object;
  while (o) {
    if (o.userData?.id) return o.userData.id;
    o = o.parent;
  }
  return null;
}

export default function Scene({ scene, neglect, onFind, found }) {
  const { camera } = useThree();
  const dwell = useRef({ id: null, ms: 0 });
  const [weights, setWeights] = useState({});
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const centre = useMemo(() => new THREE.Vector2(0, 0), []);
  const groupRef = useRef();

  useFrame((_, dt) => {
    if (!scene) return;

    const w = {};
    for (const t of scene.targets) {
      w[t.id] = attentionWeight(new THREE.Vector3(...t.position), camera, neglect);
    }

    // Which targets are roughly in front of the participant right now?
    const inView = scene.targets.filter(
      (t) => Math.abs(azimuthDeg(new THREE.Vector3(...t.position), camera)) < 55
    );
    const gone = extinguished(
      inView.map((t) => ({ id: t.id, position: new THREE.Vector3(...t.position) })),
      camera,
      neglect
    );
    setWeights({ w, gone });

    // Crosshair raycast, then dwell.
    ray.setFromCamera(centre, camera);
    const hits = groupRef.current ? ray.intersectObjects(groupRef.current.children, true) : [];
    const hitId = hits.length ? resolveTargetId(hits[0].object) : null;

    if (!hitId || found.has(hitId) || gone.has(hitId)) {
      dwell.current = { id: null, ms: 0 };
      return;
    }
    if (dwell.current.id !== hitId) dwell.current = { id: hitId, ms: 0 };
    dwell.current.ms += dt * 1000;
    if (dwell.current.ms >= dwellMs(w[hitId] ?? 1)) {
      dwell.current = { id: null, ms: 0 };
      onFind(hitId, azimuthDeg(new THREE.Vector3(...scene.targets.find((t) => t.id === hitId).position), camera));
    }
  });

  if (!scene) return null;
  const w = weights.w ?? {};
  const gone = weights.gone ?? new Set();

  return (
    <group>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 8, 2]} intensity={1.6} />
      <Suspense fallback={null}>
        {scene.world?.splatUrl ? <MintWorld world={scene.world} /> : <Room />}
      </Suspense>
      <group ref={groupRef}>
        {scene.targets.map((t) => (
          <group key={t.id} userData={{ id: t.id }}>
            <Suspense fallback={null}>
              <Target
                target={t}
                found={found.has(t.id)}
                weight={w[t.id] ?? 1}
                suppressed={gone.has(t.id)}
              />
            </Suspense>
          </group>
        ))}
      </group>
    </group>
  );
}
