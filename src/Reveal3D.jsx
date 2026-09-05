import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Lifts the camera out of the participant's head and back over the objects.
 *
 * The framing is derived from where the targets actually are rather than
 * hardcoded. A fixed [0, 17, 8] was tuned for an older layout spread over ten
 * metres; against a single field of view everything sits within about four,
 * and the objects came out as nine-pixel specks in the middle of an empty
 * grid — which is fatal, because the whole point of this shot is seeing the
 * ones on the left light up.
 *
 * It pulls back along the line from the cluster through where the participant
 * stood, so their left is still screen-left and they can recognise the scene
 * they were just looking at.
 */
export function RevealCamera({ active, targets, spawn }) {
  const { camera } = useThree();
  const t = useRef(0);
  const start = useRef(null);

  const { target, lookAt } = useMemo(() => {
    const pts = (targets ?? []).map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    if (!pts.length)
      return { target: new THREE.Vector3(0, 5, -4), lookAt: new THREE.Vector3(0, 0.5, 0) };

    const box = new THREE.Box3().setFromPoints(pts);
    const centre = box.getCenter(new THREE.Vector3());
    const spread = Math.max(box.getSize(new THREE.Vector3()).length(), 1.5);
    const eye = new THREE.Vector3(spawn?.position?.[0] ?? 0, 0, spawn?.position?.[2] ?? 0);
    const back = new THREE.Vector3().subVectors(eye, centre);
    back.y = 0;
    if (back.lengthSq() < 1e-4) back.set(0, 0, -1);
    back.normalize().multiplyScalar(spread * 0.75);

    return {
      target: new THREE.Vector3(centre.x + back.x, centre.y + spread * 0.85, centre.z + back.z),
      lookAt: centre.clone(),
    };
  }, [targets, spawn]);

  useFrame((_, dt) => {
    if (!active) return;
    if (!start.current) {
      start.current = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
      camera.fov = 60; camera.updateProjectionMatrix();
    }
    t.current = Math.min(1, t.current + dt / 2.6);
    const e = 1 - Math.pow(1 - t.current, 3);          // ease out cubic
    camera.position.lerpVectors(start.current.pos, target, e);

    const m = new THREE.Matrix4().lookAt(camera.position, lookAt, new THREE.Vector3(0, 1, 0));
    const want = new THREE.Quaternion().setFromRotationMatrix(m);
    camera.quaternion.slerpQuaternions(start.current.quat, want, e);
  });
  return null;
}

/**
 * Where the participant actually looked, drawn on the floor.
 * Each wedge is 6 degrees of heading; its opacity is how long they spent
 * facing that way. The gap is the argument.
 */
export function GazeFan({ poses, origin = [0, 0.06, 0], radius = 8 }) {
  const geo = useMemo(() => {
    const BINS = 60, bin = new Array(BINS).fill(0);
    for (let i = 1; i < poses.length; i++) {
      const dt = Math.max(0, poses[i].t - poses[i - 1].t);
      let deg = poses[i].yaw % 360; if (deg < 0) deg += 360;
      bin[Math.floor(deg / 6) % BINS] += dt;
    }
    const max = Math.max(...bin, 1);
    const pos = [], col = [];
    const c = new THREE.Color();
    for (let b = 0; b < BINS; b++) {
      const w = bin[b] / max;
      if (w < 0.02) continue;
      // yaw is positive-left, and the camera looks down -Z at yaw 0
      const a0 = ((b * 6) * Math.PI) / 180, a1 = (((b + 1) * 6) * Math.PI) / 180;
      const p = (a) => [Math.sin(-a) * radius, 0, -Math.cos(-a) * radius];
      const [x0, , z0] = p(a0), [x1, , z1] = p(a1);
      pos.push(0, 0, 0, x0, 0, z0, x1, 0, z1);
      c.setHSL(0.47, 0.55, 0.28 + 0.32 * w);
      for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, [poses, radius]);

  return (
    <mesh geometry={geo} position={origin}>
      <meshBasicMaterial vertexColors transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}
