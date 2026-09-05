import { useMemo, useRef, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { dwellMs } from "./neglect";
import { MintWorld, GreyRoom, Target, resolveTargetId } from "./World";

export default function Scene({ scene, hidden, found, onFind, reveal = false, dissolve = false }) {
  const { camera } = useThree();
  const dwell = useRef({ id: null, ms: 0 });
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const centre = useMemo(() => new THREE.Vector2(0, 0), []);
  const groupRef = useRef();
  const gridRef = useRef();

  useFrame((_, dt) => {
    if (gridRef.current)
      gridRef.current.material.opacity +=
        ((dissolve ? 0.34 : 0) - gridRef.current.material.opacity) * Math.min(1, dt * 1.6);

    if (!scene || reveal) return;
    ray.setFromCamera(centre, camera);
    const hits = groupRef.current ? ray.intersectObjects(groupRef.current.children, true) : [];
    const hitId = hits.length ? resolveTargetId(hits[0].object) : null;
    if (!hitId || found.has(hitId) || hidden.has(hitId)) { dwell.current = { id: null, ms: 0 }; return; }
    if (dwell.current.id !== hitId) dwell.current = { id: hitId, ms: 0 };
    dwell.current.ms += dt * 1000;
    if (dwell.current.ms >= dwellMs()) { dwell.current = { id: null, ms: 0 }; onFind(hitId); }
  });

  if (!scene) return null;
  const hasWorld = !!scene.world?.splatUrl;

  return (
    <group>
      <ambientLight intensity={hasWorld ? 0.75 : 0.62} />
      <directionalLight position={[4, 10, 2]} intensity={hasWorld ? 1.4 : 1.1} />

      <Suspense fallback={null}>
        {hasWorld
          ? <MintWorld world={scene.world} dissolve={dissolve} />
          : <GreyRoom dissolve={dissolve} />}
      </Suspense>

      {/* The ground plan the reveal lands on, once the room is gone. */}
      <gridHelper ref={gridRef} args={[26, 26, "#4a6f88", "#2c3b47"]} position={[0, 0.02, -2]}>
        <meshBasicMaterial transparent opacity={0} />
      </gridHelper>

      <group ref={groupRef}>
        <Suspense fallback={null}>
          {scene.targets.map((t) => (
            <Target
              key={t.id}
              target={t}
              state={found.has(t.id) ? "found" : hidden.has(t.id) ? "unseen" : "missed"}
              reveal={reveal}
            />
          ))}
        </Suspense>
      </group>
    </group>
  );
}
