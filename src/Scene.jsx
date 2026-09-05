import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { dwellMs } from "./neglect";

/**
 * The room dissolves during the reveal. This is a narrative choice as much as
 * a practical one: a Gaussian splat world from World Labs is captured from
 * roughly eye height and falls apart when viewed from far outside that
 * volume, so flying a camera 26m above it would show artefacts and holes.
 * Fading it out instead turns that constraint into the transition — you leave
 * the person's world and enter the data — and the gaze fan reads far better
 * against a clean ground than against a photographed floor.
 */
function Room({ dissolve }) {
  const walls = useRef([]);
  const floorRef = useRef();
  const gridRef = useRef();

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 1.6);
    walls.current.forEach((m) => {
      if (!m) return;
      m.material.opacity += ((dissolve ? 0 : 1) - m.material.opacity) * k;
      m.visible = m.material.opacity > 0.01;
    });
    if (floorRef.current)
      floorRef.current.material.opacity += ((dissolve ? 0.25 : 1) - floorRef.current.material.opacity) * k;
    if (gridRef.current)
      gridRef.current.material.opacity += ((dissolve ? 0.32 : 0) - gridRef.current.material.opacity) * k;
  });

  const wall = (i, pos, args, color) => (
    <mesh key={i} ref={(el) => (walls.current[i] = el)} position={pos}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} transparent opacity={1} />
    </mesh>
  );

  return (
    <group>
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -4]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#3a4048" transparent opacity={1} />
      </mesh>
      <gridHelper ref={gridRef} args={[24, 24, "#4a6f88", "#2c3b47"]} position={[0, 0.02, -4]}>
        <meshBasicMaterial transparent opacity={0} />
      </gridHelper>
      {wall(0, [0, 3, -16], [24, 6, 0.2], "#2c323a")}
      {wall(1, [0, 3, 8], [24, 6, 0.2], "#2f353d")}
      {wall(2, [-12, 3, -4], [0.2, 6, 24], "#333941")}
      {wall(3, [12, 3, -4], [0.2, 6, 24], "#333941")}
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

export default function Scene({ scene, hidden, found, onFind, reveal = false, dissolve = false }) {
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
      <Room dissolve={dissolve} />
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
