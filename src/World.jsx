import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SparkRenderer, SplatFileType, SplatMesh } from "@sparkjsdev/spark";

// Mint GLBs may use KHR_draco_mesh_compression; one shared decoder for every load.
useGLTF.setDecoderPath("https://cdn.mint.gg/runtime/draco/gltf/three-0.184.0/");

// Every generated world arrives in its own basis and its own units, so the
// transform is data, not code — it lives in scene.json next to the URLs and is
// tuned by looking at the room rather than by editing a component.
const DEFAULT_TRANSFORM = {
  position: [0, 0, 0],
  rotation: [Math.PI, Math.PI, 0],
  scale: 1,
};

/**
 * The generated room: a RAD splat for what you see, an invisible collider for
 * what the raycaster can hit. Splats carry no scene graph, so nothing can be
 * picked out of them — every interactive object is a real mesh placed inside.
 *
 * `dissolve` fades the whole thing out for the reveal. That is deliberate:
 * a Marble world is captured around eye height and falls apart when viewed
 * from far outside that volume, so the camera never sees it from above.
 */
export function MintWorld({ world, dissolve, onColliderReady }) {
  const { gl } = useThree();
  const spark = useMemo(() => new SparkRenderer({ renderer: gl }), [gl]);
  const splat = useMemo(
    () => new SplatMesh({ url: world.splatUrl, fileType: SplatFileType.RAD, paged: true, raycastable: false }),
    [world.splatUrl],
  );
  const { scene: colliderScene } = useGLTF(world.colliderUrl);
  const opacity = useRef(1);

  useEffect(() => {
    colliderScene.traverse((o) => { o.visible = false; });
    onColliderReady?.(colliderScene);
  }, [colliderScene, onColliderReady]);
  useEffect(() => () => { spark.dispose?.(); splat.dispose?.(); }, [spark, splat]);

  useFrame((_, dt) => {
    const want = dissolve ? 0 : 1;
    opacity.current += (want - opacity.current) * Math.min(1, dt * 1.6);
    if (splat) {
      splat.opacity = opacity.current;
      splat.visible = opacity.current > 0.02;
    }
  });

  const t = { ...DEFAULT_TRANSFORM, ...(world.transform ?? {}) };

  return (
    <>
      <primitive object={spark} />
      <group position={t.position} rotation={t.rotation} scale={t.scale}>
        <primitive object={splat} />
        <primitive object={colliderScene} />
      </group>
    </>
  );
}

/** Fallback room, used while no generated world is configured. */
export function GreyRoom({ dissolve }) {
  const walls = useRef([]);
  const floorRef = useRef();
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 1.6);
    walls.current.forEach((m) => {
      if (!m) return;
      m.material.opacity += ((dissolve ? 0 : 1) - m.material.opacity) * k;
      m.visible = m.material.opacity > 0.01;
    });
    if (floorRef.current)
      floorRef.current.material.opacity += ((dissolve ? 0.25 : 1) - floorRef.current.material.opacity) * k;
  });
  const wall = (i, pos, args, color) => (
    <mesh key={i} ref={(el) => (walls.current[i] = el)} position={pos}>
      <boxGeometry args={args} /><meshStandardMaterial color={color} transparent opacity={1} />
    </mesh>
  );
  return (
    <group>
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]}>
        <planeGeometry args={[16, 20]} />
        <meshStandardMaterial color="#3a4048" transparent opacity={1} />
      </mesh>
      {wall(0, [0, 2.4, -12], [16, 5, 0.2], "#2c323a")}
      {wall(1, [0, 2.4, 8], [16, 5, 0.2], "#2f353d")}
      {wall(2, [-8, 2.4, -2], [0.2, 5, 20], "#333941")}
      {wall(3, [8, 2.4, -2], [0.2, 5, 20], "#333941")}
    </group>
  );
}

/**
 * Highlight lives on its own sphere with its own light, and never touches the
 * model's materials — a generated GLB brings its own, and writing emissive
 * values straight onto them wrecks the asset.
 */
function Glow({ state, reveal, y, radius }) {
  const ref = useRef();
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const m = ref.current.material;
    let want = 0;
    if (state === "found") want = 0.95;
    else if (state === "unseen") { if (reveal) { t.current = Math.min(1, t.current + dt / 1.4); want = 0.85 * t.current; } }
    else want = reveal ? 0.5 : 0.28;
    m.emissiveIntensity += (want - m.emissiveIntensity) * Math.min(1, dt * 5);
    const c = state === "found" ? "#4ea87a" : state === "unseen" ? "#e0703c" : "#ffb26b";
    m.color.lerp(new THREE.Color(c), Math.min(1, dt * 5));
    m.emissive.lerp(new THREE.Color(c), Math.min(1, dt * 5));
    ref.current.visible = m.emissiveIntensity > 0.02;
    ref.current.children[0] && (ref.current.children[0].intensity = m.emissiveIntensity * 2.2);
  });
  return (
    <mesh ref={ref} position={[0, y, 0]}>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial color="#ffb26b" emissive="#ffb26b" emissiveIntensity={0} transparent opacity={0.9} />
      <pointLight color="#ffb26b" intensity={0} distance={3} />
    </mesh>
  );
}

function Model({ target, state, reveal }) {
  const { scene } = useGLTF(target.url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const groupRef = useRef();
  const scale = target.scale ?? 1;
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    const hidden = state === "unseen" && !reveal;
    groupRef.current.visible = !hidden;
    if (reveal && state === "unseen")
      groupRef.current.position.y = Math.sin(performance.now() / 400) * 0.05;
  });
  return (
    <group ref={groupRef}>
      <group scale={scale}><primitive object={cloned} /></group>
      <Glow state={state} reveal={reveal} y={scale * 1.6} radius={scale * 0.45} />
    </group>
  );
}

function Box({ target, state, reveal }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (!ref.current) return;
    const m = ref.current.material;
    const hidden = state === "unseen" && !reveal;
    m.opacity += ((hidden ? 0 : 1) - m.opacity) * Math.min(1, dt * 5);
    ref.current.visible = m.opacity > 0.01;
    const c = state === "found" ? "#4ea87a" : state === "unseen" ? "#e0703c" : "#c9803f";
    m.color.lerp(new THREE.Color(c), Math.min(1, dt * 5));
    m.emissive.lerp(new THREE.Color(c), Math.min(1, dt * 5));
    m.emissiveIntensity += ((state === "found" ? 0.95 : 0.3) - m.emissiveIntensity) * Math.min(1, dt * 5);
    if (reveal && state === "unseen") ref.current.position.y = Math.sin(performance.now() / 400) * 0.06;
  });
  return (
    <mesh ref={ref} scale={target.scale ?? 1}>
      <boxGeometry args={[0.42, 0.42, 0.42]} />
      <meshStandardMaterial color="#c9803f" emissive="#ffb26b" emissiveIntensity={0.3} transparent opacity={1} />
    </mesh>
  );
}

/**
 * A model that has not been downloaded yet, or that fails to parse, must never
 * take the scene down with it. Anything that goes wrong falls back to the
 * placeholder box, so the demo always has something findable in that spot.
 */
class ModelBoundary extends Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) {
    if (!ModelBoundary.warned?.has(this.props.url)) {
      (ModelBoundary.warned ??= new Set()).add(this.props.url);
      console.warn("[hemispace] falling back to a box for", this.props.url, err?.message ?? err);
    }
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function Target({ target, state, reveal }) {
  const box = <Box target={target} state={state} reveal={reveal} />;
  return (
    <group position={target.position} userData={{ id: target.id }}>
      {target.url ? (
        <ModelBoundary url={target.url} fallback={box}>
          <Suspense fallback={box}>
            <Model target={target} state={state} reveal={reveal} />
          </Suspense>
        </ModelBoundary>
      ) : box}
    </group>
  );
}

/** GLB meshes nest several levels deep, so the id has to be found by walking up. */
export function resolveTargetId(object) {
  let o = object;
  while (o) {
    if (o.userData?.id) return o.userData.id;
    o = o.parent;
  }
  return null;
}
