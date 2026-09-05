import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";

const BRAIN_URL = "/assets/mint/brain/brain.glb";

/**
 * The brain at the end, as an object rather than a diagram.
 *
 * Kinsbourne's opponent-processor account, which is still how this is taught:
 * each hemisphere pushes attention toward the opposite side of space and the
 * two mutually inhibit. The right hemisphere is the stronger one and attends
 * to both sides; the left attends mainly rightward. Damage the right and the
 * left's rightward drive is unopposed, so attention settles to the right.
 *
 * Shown from behind the person, so their damaged right hemisphere is on the
 * same side of the screen as the half of the room they kept searching — and
 * the neglected half is on the other. Damage one side, lose the other, and
 * you can see both at once.
 *
 * It does not spin. A rotating brain looks better for about two seconds and
 * then costs the only thing the shot has to say — which hemisphere is which.
 * It rocks a few degrees instead, enough to read as solid.
 */
function Brain({ lesionSign = 1 }) {
  const { scene } = useGLTF(BRAIN_URL);
  const ref = useRef();

  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      // Tint one hemisphere in the shader rather than splitting the mesh: the
      // model is a single watertight brain, and cutting it would show a
      // hollow interior along the midline.
      o.material.onBeforeCompile = (sh) => {
        sh.uniforms.uSign = { value: lesionSign };
        sh.vertexShader = `varying vec3 vLocalPos;\n${sh.vertexShader}`.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n  vLocalPos = position;",
        );
        sh.fragmentShader = `uniform float uSign;\nvarying vec3 vLocalPos;\n${sh.fragmentShader}`.replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
           float side = smoothstep(0.005, 0.075, vLocalPos.x * uSign);
           vec3 hurt = gl_FragColor.rgb * vec3(0.82, 0.36, 0.28);
           gl_FragColor.rgb = mix(gl_FragColor.rgb, hurt, side * 0.8);`,
        );
      };
      o.material.needsUpdate = true;
    });
    return c;
  }, [scene, lesionSign]);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.5) * 0.16;
  });

  const s = lesionSign;

  return (
    <group ref={ref} rotation={[-0.42, 0, 0]} scale={2.5}>
      <primitive object={model} />

      {/* The lesion: posterior and lateral on the damaged side, roughly where
          the temporoparietal junction sits. Neglect follows damage here far
          more reliably than it follows damage to primary visual cortex —
          which is the whole point, and why these people are not blind. */}
      <Lesion position={[0.4 * s, 0.06, 0.14]} />

      <Label position={[0.52 * s, 0.20, 0.10]} align={s > 0 ? "left" : "right"}
             title="Right hemisphere" note="the stroke" tone="hurt" />
      <Label position={[-0.52 * s, 0.20, 0.10]} align={s > 0 ? "right" : "left"}
             title="Left hemisphere" note="intact" tone="ok" />
      <Label position={[0.40 * s, -0.22, 0.20]} align={s > 0 ? "left" : "right"}
             title="TPJ" note="where neglect comes from" tone="dim" />
    </group>
  );
}

/** A soft pulsing marker sitting on the surface of the damaged hemisphere. */
function Lesion({ position }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 1.9);
    ref.current.material.opacity = 0.3 + 0.35 * p;
    ref.current.scale.setScalar(1 + 0.09 * p);
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.15, 24, 24]} />
      <meshBasicMaterial color="#ff6a3d" transparent opacity={0.45} depthWrite={false} />
    </mesh>
  );
}

/** A leader dot with a caption, anchored to a point on the model. */
function Label({ position, title, note, tone, align }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshBasicMaterial color={tone === "hurt" ? "#ff8a5c" : tone === "ok" ? "#8fc1f2" : "#9aa7b4"} />
      </mesh>
      {/* No distanceFactor: the callouts stay at a fixed screen size so they
          keep the same weight as the caption below and never outgrow the
          panel as the model rocks. */}
      <Html zIndexRange={[10, 0]}
            style={{ pointerEvents: "none", transform: `translate(${align === "left" ? "10px" : "calc(-100% - 10px)"}, -50%)` }}>
        <div className={`brain-label ${tone}`}>
          <b>{title}</b>
          <span>{note}</span>
        </div>
      </Html>
    </group>
  );
}

export default function BrainPanel({ meanGazeDeg = 0, lesionSign = 1 }) {
  const clamped = Math.max(-45, Math.min(45, meanGazeDeg));
  const pct = 50 + (clamped / 45) * 46;

  return (
    <div className="brain3d">
      <Canvas camera={{ position: [0, 0.35, 4.9], fov: 42 }} dpr={[1, 2]}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 5, 4]} intensity={1.5} />
        <directionalLight position={[-4, 1, -2]} intensity={0.5} color="#7fb0e8" />
        <Suspense fallback={null}>
          <Brain lesionSign={lesionSign} />
        </Suspense>
      </Canvas>

      <div className="brain-scale" aria-hidden="true">
        <span className="brain-side">left</span>
        <div className="brain-track">
          <span className="brain-mid" />
          <span className="brain-needle" style={{ left: `${pct}%` }} />
        </div>
        <span className="brain-side">right</span>
      </div>
      <p className="brain-read">
        <b>{meanGazeDeg > 0 ? "+" : ""}{meanGazeDeg.toFixed(1)}°</b>
        <span> — where the things you marked actually were</span>
      </p>
    </div>
  );
}

useGLTF.preload(BRAIN_URL);
