import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The camera for "See it happen", which no longer moves.
 *
 * Turning was doing two jobs and doing both badly. It made the room big, which
 * needed a soft ceiling on head rotation in round two — a stage trick the
 * neglect model itself disowns, since a real patient can turn anywhere they
 * like and simply does not think to. And it cost a splat re-sort on every
 * frame, which is where the lag came from.
 *
 * A fixed field is also closer to the bedside test. Line bisection and the
 * cancellation tasks (Albert's, star cancellation) are all static: the sheet
 * does not move, and the patient leaves the left half unmarked. That is the
 * thing being demonstrated, and it never required walking around.
 *
 * Left and right are therefore screen sides, not world sides — see
 * `azimuthDeg` in neglect.js, which is already measured against the camera.
 */
export default function FixedCamera({ spawn }) {
  const { camera } = useThree();

  useEffect(() => {
    const p = spawn?.position ?? [0, 1.6, 0];
    camera.position.set(p[0], p[1], p[2]);
    camera.quaternion.setFromEuler(
      new THREE.Euler(spawn?.pitch ?? 0, spawn?.yaw ?? 0, 0, "YXZ"),
    );
    camera.updateMatrixWorld(true);
  }, [camera, spawn]);

  return null;
}
