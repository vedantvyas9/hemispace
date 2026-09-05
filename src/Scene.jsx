import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { dwellMs } from "./neglect";

function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -4]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#3a4048" />
      </mesh>
      <mesh position={[0, 3, -16]}><boxGeometry args={[24, 6, 0.2]} /><meshStandardMaterial color="#2c323a" /></mesh>
      <mesh position={[0, 3, 8]}><boxGeometry args={[24, 6, 0.2]} /><meshStandardMaterial color="#2f353d" /></mesh>
      <mesh position={[-12, 3, -4]}><boxGeometry args={[0.2, 6, 24]} /><meshStandardMaterial color="#333941" /></mesh>
      <mesh position={[12, 3, -4]}><boxGeometry args={[0.2, 6, 24]} /><meshStandardMaterial color="#333941" /></mesh>
    </group>
  );
}

function Target({ target, state, reveal }) {
  const ref = useRef();
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const m = ref.current.material;
    let wantOpacity = 1, wantEmissive = 0.3, wantColor = "#c9803f";

    if (state === "found") { wantEmissive = 0.95; wantColor = "#4ea87a"; }
    else if (state === "unseen") {
      // Was never in their world during the run; fades up during the reveal.
      wantColor = "#e0703c";
      if (reveal) { t.current = Math.min(1, t.current + dt / 1.4); wantOpacity = t.current; wantEmissive = 0.75 * t.current; }
      else { wantOpacity = 0; wantEmissive = 0; }
    } else if (state === "missed") { wantColor = "#e0703c"; wantEmissive = reveal ? 0.6 : 0.3; }

    m.opacity += (wantOpacity - m.opacity) * Math.min(1, dt * 5);
    m.emissiveIntensity += (wantEmissive - m.emissiveIntensity) * Math.min(1, dt * 5);
    m.color.lerp(new THREE.Color(wantColor), Math.min(1, dt * 5));
    m.emissive.lerp(new THREE.Color(wantColor), Math.min(1, dt * 5));
    ref.current.visible = m.opacity > 0.01;
    if (reveal && state === "unseen") ref.current.position.y = target.position[1] + Math.sin(performance.now() / 400) * 0.06;
  });
  return (
    <mesh ref={ref} position={target.position} scale={target.scale ?? 1}>
      <boxGeometry args={[0.42, 0.42, 0.42]} />
      <meshStandardMaterial color="#c9803f" emissive="#ffb26b" emissiveIntensity={0.3} transparent opacity={1} />
    </mesh>
  );
}

export default function Scene({ scene, hidden, found, onFind, reveal = false }) {
  const { camera } = useThree();
  const dwell = useRef({ id: null, ms: 0 });
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const centre = useMemo(() => new THREE.Vector2(0, 0), []);
  const groupRef = useRef();

  useFrame((_, dt) => {
    if (!scene || reveal) return;
    ray.setFromCamera(centre, camera);
    const hits = groupRef.current ? ray.intersectObjects(groupRef.current.children, true) : [];
    const hitId = hits.length ? hits[0].object.parent?.userData?.id ?? null : null;
    if (!hitId || found.has(hitId) || hidden.has(hitId)) { dwell.current = { id: null, ms: 0 }; return; }
    if (dwell.current.id !== hitId) dwell.current = { id: hitId, ms: 0 };
    dwell.current.ms += dt * 1000;
    if (dwell.current.ms >= dwellMs()) { dwell.current = { id: null, ms: 0 }; onFind(hitId); }
  });

  if (!scene) return null;
  return (
    <group>
      <ambientLight intensity={0.62} />
      <directionalLight position={[4, 10, 2]} intensity={1.1} />
      <Room />
      <group ref={groupRef}>
        {scene.targets.map((t) => {
          const state = found.has(t.id) ? "found" : hidden.has(t.id) ? "unseen" : "missed";
          return (
            <group key={t.id} userData={{ id: t.id }}>
              <Target target={t} state={state} reveal={reveal} />
            </group>
          );
        })}
      </group>
    </group>
  );
}
