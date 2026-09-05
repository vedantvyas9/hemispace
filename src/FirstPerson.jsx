import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lookGain, pullRad, limitGain } from "./neglect";

/**
 * Pointer-lock first person controller.
 * The camera's forward direction IS the body midline for the neglect model,
 * so this has to feel right before anything else gets built on top of it.
 */
export default function FirstPerson({
  spawn, speed = 3.2, onPose, neglect, yawLimits = null,
  sensitivity = 0.0022, centerSignal,
}) {
  const { camera, gl } = useThree();
  const keys = useRef({});
  const yaw = useRef(spawn?.yaw ?? 0);
  const pitch = useRef(0);
  const lastEmit = useRef(0);
  const neglectRef = useRef(neglect);
  neglectRef.current = neglect;
  const limitsRef = useRef(yawLimits);
  limitsRef.current = yawLimits;
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;
  const lastMove = useRef(0);

  // Imperative re-center, used by scanning practice: every trial has to start
  // from the same forward-facing position, or a lucky camera angle left over
  // from the last trial lets someone skip the scan entirely.
  useEffect(() => {
    if (centerSignal === undefined) return;
    yaw.current = spawn?.yaw ?? 0;
    pitch.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerSignal]);

  useEffect(() => {
    const p = spawn?.position ?? [0, 1.6, 0];
    camera.position.set(p[0], p[1], p[2]);
  }, [camera, spawn]);

  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e) => {
      if (document.pointerLockElement !== el) return;
      const g = lookGain(e.movementX, neglectRef.current)
             * limitGain(yaw.current, e.movementX, limitsRef.current);
      yaw.current -= e.movementX * sensitivityRef.current * g;
      lastMove.current = performance.now();
      // Wrap to [-PI, PI]. Without this the metric drifts to nonsense
      // as soon as someone spins more than once.
      if (yaw.current > Math.PI) yaw.current -= 2 * Math.PI;
      if (yaw.current < -Math.PI) yaw.current += 2 * Math.PI;
      pitch.current -= e.movementY * sensitivityRef.current;
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current));
    };
    const down = (e) => (keys.current[e.code] = true);
    const up = (e) => (keys.current[e.code] = false);

    document.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      document.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [gl]);

  useFrame((state, dt) => {
    // The pull only shows itself when the participant is not actively turning.
    const idle = performance.now() - lastMove.current > 220;
    yaw.current += pullRad(yaw.current, dt, idle, neglectRef.current);
    if (yaw.current > Math.PI) yaw.current -= 2 * Math.PI;
    if (yaw.current < -Math.PI) yaw.current += 2 * Math.PI;

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
