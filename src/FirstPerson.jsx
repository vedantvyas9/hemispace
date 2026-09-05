import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Pointer-lock first person controller.
 * The camera's forward direction IS the body midline for the neglect model,
 * so this has to feel right before anything else gets built on top of it.
 */
export default function FirstPerson({ spawn, speed = 3.2, onPose }) {
  const { camera, gl } = useThree();
  const keys = useRef({});
  const yaw = useRef(spawn?.yaw ?? 0);
  const pitch = useRef(0);
  const lastEmit = useRef(0);

  useEffect(() => {
    const p = spawn?.position ?? [0, 1.6, 0];
    camera.position.set(p[0], p[1], p[2]);
  }, [camera, spawn]);

  useEffect(() => {
    const el = gl.domElement;
    const onClick = () => el.requestPointerLock?.();
    const onMove = (e) => {
      if (document.pointerLockElement !== el) return;
      yaw.current -= e.movementX * 0.0022;
      pitch.current -= e.movementY * 0.0022;
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current));
    };
    const down = (e) => (keys.current[e.code] = true);
    const up = (e) => (keys.current[e.code] = false);

    el.addEventListener("click", onClick);
    document.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      el.removeEventListener("click", onClick);
      document.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [gl]);

  useFrame((state, dt) => {
    const e = new THREE.Euler(pitch.current, yaw.current, 0, "YXZ");
    camera.quaternion.setFromEuler(e);

    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    fwd.y = 0; right.y = 0; fwd.normalize(); right.normalize();

    const k = keys.current;
    const move = new THREE.Vector3();
    if (k.KeyW || k.ArrowUp) move.add(fwd);
    if (k.KeyS || k.ArrowDown) move.sub(fwd);
    if (k.KeyD || k.ArrowRight) move.add(right);
    if (k.KeyA || k.ArrowLeft) move.sub(right);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      camera.position.add(move);
    }

    // 3 Hz — see CONTRACT.md. Do not raise this.
    const now = state.clock.elapsedTime * 1000;
    if (onPose && now - lastEmit.current > 333) {
      lastEmit.current = now;
      onPose({
        t: Math.round(now),
        yaw: (yaw.current * 180) / Math.PI,
        pitch: (pitch.current * 180) / Math.PI,
      });
    }
  });

  return null;
}
