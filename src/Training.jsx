import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import FirstPerson from "./FirstPerson";
import { DEFAULTS, azimuthDeg } from "./neglect";

/**
 * VISUAL SCANNING TRAINING.
 *
 * This is what clinicians actually do for neglect, and it is built the way
 * they do it:
 *
 *  - LEFT ANCHORING. A cue on the far left has to be found before the target
 *    appears, training the habit of beginning a scan on the neglected side
 *    instead of settling on the right.
 *  - GRADED ECCENTRICITY. Targets start near the midline and move further out
 *    only as the person keeps up, so practice happens at the edge of ability
 *    rather than in failure.
 *  - CUE FADING. Early sessions point at where to look; the pointer is
 *    withdrawn as reach improves, so the habit has to become internal.
 *
 * Honest framing, and it belongs in the pitch: the Cochrane review finds the
 * effectiveness of neglect rehabilitation unproven, and even prism adaptation
 * shows no significant effect on the functional scale. This is structured
 * practice built on the standard approach. It is not a treatment claim.
 */

const CLEAN = { ...DEFAULTS, enabled: false };
const TRIALS = 20;
const TIMEOUT_MS = 6500;
const RADIUS = 9;
const KEY = "hemispace.training.v1";

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function saveSession(s) {
  try {
    const all = loadSessions(); all.push(s);
    localStorage.setItem(KEY, JSON.stringify(all.slice(-40)));
  } catch {}
}

function cueLevel(ecc) {
  if (ecc < 70) return "arrow";     // pointed at
  if (ecc < 115) return "flash";    // a glint, then nothing
  return "none";                    // unaided
}

function TrainingScene({ trial, onHit, onAzimuth }) {
  const { camera } = useThree();
  const ref = useRef();
  const anchorRef = useRef();
  const dwell = useRef(0);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const centre = useMemo(() => new THREE.Vector2(0, 0), []);

  const pos = useMemo(() => {
    if (!trial) return null;
    const a = (trial.azimuth * Math.PI) / 180;
    return new THREE.Vector3(Math.sin(a) * RADIUS, 1.15, -Math.cos(a) * RADIUS);
  }, [trial]);

  const anchorPos = useMemo(() => {
    const a = (-140 * Math.PI) / 180;
    return new THREE.Vector3(Math.sin(a) * RADIUS, 1.5, -Math.cos(a) * RADIUS);
  }, []);

  useFrame((_, dt) => {
    onAzimuth(-((Math.atan2(
      new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).x,
      -new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).z
    ) * 180) / Math.PI));

    if (anchorRef.current) {
      const seen = Math.abs(azimuthDeg(anchorPos, camera)) < 26;
      const m = anchorRef.current.material;
      m.emissiveIntensity += ((trial?.stage === "anchor" ? (seen ? 1.4 : 0.75) : 0) - m.emissiveIntensity) * Math.min(1, dt * 6);
      anchorRef.current.visible = m.emissiveIntensity > 0.02;
      if (trial?.stage === "anchor" && seen) onHit("anchor");
    }

    if (!ref.current || trial?.stage !== "target") { dwell.current = 0; return; }
    ray.setFromCamera(centre, camera);
    const hit = ray.intersectObject(ref.current, false);
    if (!hit.length) { dwell.current = 0; return; }
    dwell.current += dt * 1000;
    if (dwell.current > 130) { dwell.current = 0; onHit("target"); }
  });

  return (
    <group>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 10, 2]} intensity={1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[16, 48]} />
        <meshStandardMaterial color="#333a43" />
      </mesh>
      <gridHelper args={[32, 32, "#43606f", "#2b343d"]} position={[0, 0.02, 0]} />

      {/* the left anchor */}
      <mesh ref={anchorRef} position={anchorPos}>
        <boxGeometry args={[0.28, 2.4, 0.28]} />
        <meshStandardMaterial color="#4ea8d8" emissive="#7fd0f5" emissiveIntensity={0} />
      </mesh>

      {pos && trial?.stage === "target" && (
        <mesh ref={ref} position={pos}>
          <sphereGeometry args={[0.42, 24, 24]} />
          <meshStandardMaterial color="#e8a33c" emissive="#ffc26b" emissiveIntensity={0.85} />
        </mesh>
      )}
    </group>
  );
}

export default function Training({ onExit }) {
  const [phase, setPhase] = useState("intro");   // intro | play | summary
  const [ecc, setEcc] = useState(45);
  const [trial, setTrial] = useState(null);
  const [n, setN] = useState(0);
  const [hits, setHits] = useState([]);
  const [locked, setLocked] = useState(false);
  const [cueOn, setCueOn] = useState(false);
  const [heading, setHeading] = useState(0);
  const canvasRef = useRef(null);
  const streak = useRef({ up: 0, down: 0 });
  const started = useRef(0);
  const sessions = useMemo(loadSessions, [phase]);

  useEffect(() => {
    const c = () => setLocked(!!document.pointerLockElement);
    document.addEventListener("pointerlockchange", c);
    return () => document.removeEventListener("pointerlockchange", c);
  }, []);
  function grab() {
    const el = canvasRef.current;
    if (!el || document.pointerLockElement === el) return;
    try { const r = el.requestPointerLock?.(); if (r?.catch) r.catch(() => setTimeout(() => el.requestPointerLock?.(), 400)); }
    catch { setTimeout(() => el.requestPointerLock?.(), 400); }
  }
  useEffect(() => { if (phase !== "play") document.exitPointerLock?.(); }, [phase]);

  function nextTrial(nextEcc = ecc) {
    if (n >= TRIALS) { finish(); return; }
    // Two thirds on the neglected side. That is the side being trained.
    const left = Math.random() < 0.66;
    const mag = 18 + Math.random() * (nextEcc - 18);
    setTrial({ azimuth: left ? -mag : mag, stage: "anchor", left });
    setCueOn(cueLevel(nextEcc) !== "none");
    started.current = performance.now();
  }

  function handleHit(what) {
    if (!trial) return;
    if (what === "anchor" && trial.stage === "anchor") {
      setTrial((t) => ({ ...t, stage: "target" }));
      started.current = performance.now();
      if (cueLevel(ecc) === "flash") setTimeout(() => setCueOn(false), 550);
      return;
    }
    if (what === "target" && trial.stage === "target") record(true);
  }

  function record(ok) {
    const ms = performance.now() - started.current;
    setHits((h) => [...h, { left: trial.left, azimuth: trial.azimuth, ok, ms }]);
    const s = streak.current;
    let e = ecc;
    if (ok && ms < 3200) { s.up++; s.down = 0; if (s.up >= 3) { e = Math.min(165, ecc + 12); s.up = 0; } }
    else if (!ok) { s.down++; s.up = 0; if (s.down >= 2) { e = Math.max(30, ecc - 12); s.down = 0; } }
    setEcc(e);
    setN((v) => v + 1);
    setTrial(null);
    setTimeout(() => nextTrial(e), 350);
  }

  // Timeout guard
  useEffect(() => {
    if (phase !== "play" || !trial) return;
    const id = setTimeout(() => record(false), TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [trial, phase]);

  useEffect(() => { if (phase === "play" && n === 0 && !trial) nextTrial(); }, [phase]);

  function finish() {
    const left = hits.filter((h) => h.left && h.ok);
    const right = hits.filter((h) => !h.left && h.ok);
    const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x.ms, 0) / a.length) : null);
    const reached = hits.filter((h) => h.left && h.ok).reduce((m, h) => Math.max(m, -h.azimuth), 0);
    saveSession({ t: Date.now(), hits: hits.filter((h) => h.ok).length, trials: hits.length,
                  leftMs: avg(left), rightMs: avg(right), reached: Math.round(reached), ecc });
    setPhase("summary");
  }

  const left = hits.filter((h) => h.left && h.ok);
  const right = hits.filter((h) => !h.left && h.ok);
  const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x.ms, 0) / a.length) : null);
  const reached = Math.round(hits.filter((h) => h.left && h.ok).reduce((m, h) => Math.max(m, -h.azimuth), 0));

  return (
    <div className="app">
      <Canvas camera={{ fov: 74, near: 0.1, far: 200 }} onCreated={({ gl }) => (canvasRef.current = gl.domElement)}>
        <FirstPerson spawn={{ position: [0, 1.6, 0], yaw: 0 }} neglect={CLEAN} />
        <TrainingScene trial={phase === "play" ? trial : null} onHit={handleHit} onAzimuth={setHeading} />
      </Canvas>

      {phase === "play" && !locked && (
        <div className="overlay grab" onClick={grab}><h2>Click to look around</h2></div>
      )}

      {phase === "play" && locked && (
        <>
          <div className="crosshair" />
          <div className="hud">
            <span>{n} / {TRIALS}</span><span className="sep" />
            <span>Reach {Math.round(ecc)}°</span>
          </div>
          {trial?.stage === "anchor" && (
            <div className="tcue">
              {cueOn ? <span className="arrow">←</span> : null}
              <span>Find the blue post on your left</span>
            </div>
          )}
          {trial?.stage === "target" && <div className="tcue"><span>Now find the light</span></div>}
        </>
      )}

      {phase === "intro" && (
        <div className="overlay">
          <h1>Scanning practice</h1>
          <p>
            Each round begins on your left. Find the blue post, then find the light that
            appears. The lights move further out as you keep up, and the arrow pointing
            you left is taken away as your reach grows.
          </p>
          <p className="small">
            Based on visual scanning training, the standard clinical approach. Practice and
            awareness only — not a treatment.
          </p>
          <div className="row">
            <button onClick={() => { setPhase("play"); setTimeout(grab, 450); }}>Begin</button>
            <button className="link" onClick={onExit}>Back</button>
          </div>
        </div>
      )}

      {phase === "summary" && (
        <div className="overlay wide">
          <h2>{hits.filter((h) => h.ok).length} of {hits.length}</h2>
          <div className="bars">
            <div className="bar-row">
              <span className="bar-label">Time to find, left side</span>
              <div className="bar"><i style={{ width: Math.min(100, (avg(left) || 0) / 45) + "%", background: "#f0883e" }} /></div>
              <span className="bar-val">{avg(left) ? (avg(left) / 1000).toFixed(1) + "s" : "—"}</span>
            </div>
            <div className="bar-row">
              <span className="bar-label">Time to find, right side</span>
              <div className="bar"><i style={{ width: Math.min(100, (avg(right) || 0) / 45) + "%", background: "#4ea87a" }} /></div>
              <span className="bar-val">{avg(right) ? (avg(right) / 1000).toFixed(1) + "s" : "—"}</span>
            </div>
          </div>
          <p className="verdict">
            You reached <b>{reached}°</b> into your left side today, and your current
            practice range is <b>{Math.round(ecc)}°</b>.
          </p>
          {sessions.length > 1 && <Progress sessions={sessions} />}
          <div className="row">
            <button onClick={() => { setHits([]); setN(0); setTrial(null); setPhase("play"); setTimeout(grab, 450); }}>
              Another session
            </button>
            <button className="link" onClick={onExit}>Back to menu</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Progress({ sessions }) {
  const W = 520, H = 130, PL = 34, PB = 22;
  const vals = sessions.map((s) => s.reached || 0);
  const max = Math.max(90, ...vals);
  const pts = vals.map((v, i) => [
    PL + (vals.length === 1 ? 0 : (i / (vals.length - 1)) * (W - PL - 12)),
    12 + (1 - v / max) * (H - PB - 12),
  ]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <div className="prog">
      <div className="prog-t">How far left you have reached, session by session</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        <line x1={PL} y1={H - PB} x2={W - 12} y2={H - PB} stroke="#25303b" />
        <text x={PL - 8} y="18" textAnchor="end" fontSize="10" fill="#7a8898">{max}°</text>
        <text x={PL - 8} y={H - PB} textAnchor="end" fontSize="10" fill="#7a8898">0°</text>
        <path d={d} fill="none" stroke="#69a8e8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="#69a8e8" />)}
      </svg>
    </div>
  );
}
