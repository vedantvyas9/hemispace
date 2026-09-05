import { useRef, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { attentionWeight, extinguished, dwellMs, azimuthDeg } from "./neglect";

/** Placeholder room. Track B swaps this for the Marble splat + collider. */
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

function Target({ target, found, weight, suppressed }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (!ref.current) return;
    const m = ref.current.material;
    const wantEmissive = found ? 0.9 : suppressed ? 0 : weight > 0.55 ? 0.35 : 0;
    m.emissiveIntensity += (wantEmissive - m.emissiveIntensity) * Math.min(1, dt * 8);
  });
  return (
    <mesh ref={ref} position={target.position} scale={target.scale ?? 1}>
      <boxGeometry args={[0.36, 0.36, 0.36]} />
      <meshStandardMaterial
        color={found ? "#4ea87a" : "#c9803f"}
        emissive={found ? "#4ea87a" : "#ffb26b"}
        emissiveIntensity={0}
      />
    </mesh>
  );
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
    const hitId = hits.length ? hits[0].object.parent?.userData?.id ?? hits[0].object.userData?.id : null;

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
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 8, 2]} intensity={1.1} />
      <Room />
      <group ref={groupRef}>
        {scene.targets.map((t) => (
          <group key={t.id} userData={{ id: t.id }}>
            <Target
              target={t}
              found={found.has(t.id)}
              weight={w[t.id] ?? 1}
              suppressed={gone.has(t.id)}
            />
          </group>
        ))}
      </group>
    </group>
  );
}
