import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { attentionWeight } from "./neglect";
import { MintWorld, GreyRoom, Target, resolveTargetId } from "./World";

/**
 * The room and everything findable in it.
 *
 * Finding is a click, not a dwell. The camera no longer turns, so there is no
 * crosshair to hold on something — and a click is what the clinical task
 * actually is: cancellation asks the patient to mark every target they can
 * see on a fixed sheet, and scores the ones left unmarked. Same shape here.
 */
export default function Scene({
  scene, neglect, found, unseen, onFind, onWorldReady,
  reveal = false, dissolve = false,
}) {
  const { camera } = useThree();
  const groupRef = useRef();
  const gridRef = useRef();
  const [restY, setRestY] = useState({});

  /**
   * Drop every object onto whatever is actually underneath it.
   *
   * The generated room has furniture, worktops and shelves, and none of that is
   * known when the positions are authored — a fixed height leaves things
   * hanging in mid-air over a sofa or sunk into a table. So each object is
   * raycast straight down onto the collider and comes to rest on the first real
   * surface it meets, whatever that happens to be.
   */
  const dropOntoSurfaces = useCallback((collider) => {
    if (!collider || !scene) return;
    collider.updateWorldMatrix(true, true);
    const down = new THREE.Raycaster();
    const dir = new THREE.Vector3(0, -1, 0);
    const out = {};
    for (const t of scene.targets) {
      const from = new THREE.Vector3(t.position[0], 2.6, t.position[2]);
      down.set(from, dir);
      down.far = 5;
      const hit = down.intersectObject(collider, true)[0];
      if (hit) out[t.id] = hit.point.y + (t.restOffset ?? 0.02);
    }
    setRestY(out);
    const missed = scene.targets.length - Object.keys(out).length;
    if (missed) console.warn(`[hemispace] ${missed} object(s) found no surface below them`);
  }, [scene]);

  useFrame((_, dt) => {
    if (gridRef.current)
      gridRef.current.material.opacity +=
        ((dissolve ? 0.34 : 0) - gridRef.current.material.opacity) * Math.min(1, dt * 1.6);
  });

  /**
   * A click only registers on something that reached awareness.
   *
   * The threshold is deliberately below where a faded object is still clearly
   * legible on screen, so nobody ends up aiming at something they can plainly
   * see and having it refuse to respond — neglect.js is explicit that this
   * reads as a broken interface rather than as neglect. In round two the
   * left-side objects sit far enough out that their weight is well under this.
   */
  const [hover, setHover] = useState(null);

  /** Attention gate, shared by hovering and clicking. */
  const reaches = useCallback((id) => {
    const t = scene?.targets.find((x) => x.id === id);
    if (!t) return false;
    const pos = new THREE.Vector3(t.position[0], restY[t.id] ?? t.position[1], t.position[2]);
    return attentionWeight(pos, camera, neglect) >= 0.3;
  }, [scene, restY, camera, neglect]);

  // Without this a first-time participant cannot tell a target from the
  // furniture — the room is full of real books and real plants. The cursor is
  // the affordance. It is gated on attention too, so in round two the
  // left-hand objects do not answer the pointer either.
  useEffect(() => {
    document.body.style.cursor = hover ? "pointer" : "";
    return () => { document.body.style.cursor = ""; };
  }, [hover]);

  const handleOver = (e) => {
    if (reveal) return;
    const id = resolveTargetId(e.object);
    if (id && !found.has(id) && reaches(id)) { e.stopPropagation(); setHover(id); }
  };
  const handleOut = () => setHover(null);

  const handleDown = (e) => {
    if (reveal) return;
    const id = resolveTargetId(e.object);
    if (!id || found.has(id)) return;
    const t = scene.targets.find((x) => x.id === id);
    if (!t) return;
    const pos = new THREE.Vector3(
      t.position[0], restY[t.id] ?? t.position[1], t.position[2],
    );
    if (attentionWeight(pos, camera, neglect) < 0.3) return;
    e.stopPropagation();
    setHover(null);
    onFind(id);
  };

  if (!scene) return null;
  const hasWorld = !!scene.world?.splatUrl;

  return (
    <group>
      <ambientLight intensity={hasWorld ? 0.75 : 0.62} />
      <directionalLight position={[4, 10, 2]} intensity={hasWorld ? 1.4 : 1.1} />

      <Suspense fallback={null}>
        {hasWorld
          ? <MintWorld world={scene.world} dissolve={dissolve}
              onColliderReady={dropOntoSurfaces} onReady={onWorldReady} />
          : <GreyRoom dissolve={dissolve} />}
      </Suspense>

      {/* The ground plan the reveal lands on, once the room is gone. */}
      <gridHelper ref={gridRef} args={[26, 26, "#4a6f88", "#2c3b47"]} position={[0, 0.02, -2]}>
        <meshBasicMaterial transparent opacity={0} />
      </gridHelper>

      <group ref={groupRef} onPointerDown={handleDown}
             onPointerOver={handleOver} onPointerOut={handleOut}>
        <Suspense fallback={null}>
          {scene.targets.map((t) => (
            <Target
              key={t.id}
              target={restY[t.id] !== undefined
                ? { ...t, position: [t.position[0], restY[t.id], t.position[2]] }
                : t}
              state={found.has(t.id) ? "found" : unseen?.has(t.id) ? "unseen" : "missed"}
              neglect={neglect}
              hover={hover === t.id}
              reveal={reveal}
            />
          ))}
        </Suspense>
      </group>
    </group>
  );
}
