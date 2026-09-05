import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import FirstPerson from "./FirstPerson";
import Scene from "./Scene";
import { RevealCamera, GazeFan } from "./Reveal3D";
import BrainPanel from "./BrainPanel";
import { DEFAULTS, meanGazeDeg, leftDwellFraction } from "./neglect";

const SECONDS = 25;
const CLEAN = { ...DEFAULTS, enabled: false };
const EMPTY = new Set();

export default function App() {
  const [scene, setScene] = useState(null);
  const [phase, setPhase] = useState("intro");   // intro | run | declare | intro2 | reveal
  const [round, setRound] = useState(1);
  const [found, setFound] = useState(new Set());
  const [poses, setPoses] = useState([]);
  const [left, setLeft] = useState(SECONDS);
  const [locked, setLocked] = useState(false);
  const [results, setResults] = useState([]);
  const [revealStep, setRevealStep] = useState(0);
  const canvasRef = useRef(null);

  useEffect(() => { fetch("/scene.json").then((r) => r.json()).then(setScene); }, []);

  // Round two: the left half of the room is simply not part of their world.
  const hidden = (round === 2 && scene && phase !== "reveal")
    ? new Set(scene.targets.filter((t) => t.position[0] < 0).map((t) => t.id))
    : EMPTY;

  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  function grabPointer() {
    const el = canvasRef.current;
    if (!el || document.pointerLockElement === el) return;
    try {
      const r = el.requestPointerLock?.();
      if (r && r.catch) r.catch(() => setTimeout(() => el.requestPointerLock?.(), 400));
    } catch { setTimeout(() => el.requestPointerLock?.(), 400); }
  }
  useEffect(() => { if (phase !== "run") document.exitPointerLock?.(); }, [phase]);

  useEffect(() => {
    if (phase !== "run" || !locked) return;
    const id = setInterval(() => {
      setLeft((s) => { if (s <= 1) { clearInterval(id); endRun(); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, locked]);

  useEffect(() => {
    const onKey = (e) => {
      if (phase === "run" && (e.code === "Enter" || e.code === "NumpadEnter")) { e.preventDefault(); endRun(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // Staged reveal so the audience gets one idea at a time.
  useEffect(() => {
    if (phase !== "reveal") return;
    const ts = [
      setTimeout(() => setRevealStep(1), 2800),   // camera has landed, room gone
      setTimeout(() => setRevealStep(2), 5000),   // where they looked
      setTimeout(() => setRevealStep(3), 7200),   // what was there all along
      setTimeout(() => setRevealStep(4), 10400),  // why
    ];
    return () => ts.forEach(clearTimeout);
  }, [phase]);

  function startRun() { setFound(new Set()); setPoses([]); setLeft(SECONDS); setPhase("run"); }
  function endRun() { document.exitPointerLock?.(); setPhase("declare"); }

  function next() {
    const visible = scene.targets.length - hidden.size;
    setResults((r) => [...r, {
      round, found: found.size, visible, total: scene.targets.length,
      gaze: meanGazeDeg(poses), leftPct: leftDwellFraction(poses) * 100,
      poses: poses.slice(),
    }]);
    if (round === 1) { setRound(2); setPhase("intro2"); }
    else { setRevealStep(0); setPhase("reveal"); }
  }

  const r1 = results[0], r2 = results[1];

  return (
    <div className="app">
      <Canvas
        camera={{ fov: 72, near: 0.1, far: 300 }}
        onCreated={({ gl }) => (canvasRef.current = gl.domElement)}
      >
        {scene && (
          <>
            {phase !== "reveal" && (
              <FirstPerson
                spawn={scene.spawn}
                neglect={CLEAN}
                onPose={(p) => { if (phase === "run") setPoses((x) => [...x, p]); }}
              />
            )}
            <RevealCamera active={phase === "reveal"} />
            <Scene
              scene={scene}
              hidden={hidden}
              found={found}
              onFind={(id) => setFound((prev) => { const n = new Set(prev); n.add(id); return n; })}
              reveal={phase === "reveal" && revealStep >= 3}
              dissolve={phase === "reveal"}
            />
            {phase === "reveal" && revealStep >= 2 && r2 && (
              <GazeFan poses={r2.poses} />
            )}
          </>
        )}
      </Canvas>

      {phase === "run" && !locked && (
        <div className="overlay grab" onClick={grabPointer}>
          <h2>Click to look around</h2><p>The timer is paused until you do.</p>
        </div>
      )}

      {phase === "run" && locked && (
        <>
          <div className="crosshair" />
          <div className="hud">
            <span className={left <= 8 ? "urgent" : ""}>{left}s</span>
            <span className="sep" /><span>Found {found.size}</span><kbd>Enter</kbd>
          </div>
          <div className="hint">Click to look around · WASD to walk · Enter when you're done</div>
        </>
      )}

      {phase === "intro" && (
        <div className="overlay">
          <h1>Hemispace</h1>
          <p>There are objects all around this room, behind you too. You have {SECONDS} seconds
             to find as many as you can.</p>
          <button onClick={() => { startRun(); setTimeout(grabPointer, 450); }}>Start</button>
        </div>
      )}

      {phase === "intro2" && (
        <div className="overlay">
          <h2>Found {r1?.found} of {r1?.total}</h2>
          <p>Once more, a different room. Same {SECONDS} seconds.</p>
          <button onClick={() => { startRun(); setTimeout(grabPointer, 450); }}>Go</button>
        </div>
      )}

      {phase === "declare" && (
        <div className="overlay">
          <h2>Did you get them all?</h2>
          <p>You found {found.size}.</p>
          <button onClick={next}>{round === 1 ? "Continue" : "I'm done"}</button>
        </div>
      )}

      {phase === "reveal" && (
        <div className="reveal-ui">
          {revealStep === 0 && <div className="cap"><h2>Let's look at that room again.</h2></div>}
          {revealStep === 1 && <div className="cap"><h2>You found {r2?.found}. You were sure that was all of them.</h2></div>}
          {revealStep === 2 && (
            <div className="cap">
              <h2>Here is where you looked.</h2>
              <p>You spent {r2?.leftPct.toFixed(0)}% of your time facing the left half of the room.</p>
            </div>
          )}
          {revealStep === 3 && (
            <div className="cap">
              <h2>These were there the whole time.</h2>
              <p>
                Nothing was hidden and nothing was dark. For {SECONDS} seconds the left half
                of this room was not part of your world — and you never once wondered
                what was over there.
              </p>
            </div>
          )}
          {revealStep >= 4 && (
            <div className="cap final">
              <BrainPanel meanGazeDeg={r2?.gaze ?? 0} />
              <h2>Why it happens</h2>
              <p>
                Your two hemispheres normally push attention in opposite directions and
                cancel each other out. Damage the right one and the left keeps pushing
                rightward with nothing to oppose it. Attention settles to the right and
                stays there — which is where your own gaze ended up.
              </p>
              <p className="small">
                Schematic, not anatomy. Hemispatial neglect affects around 60% of patients
                in the first weeks after a right-hemisphere stroke, and roughly one in
                twelve never recovers. They are not blind. Nobody has told them.
              </p>
              <button onClick={() => { setResults([]); setRound(1); setRevealStep(0); setPhase("intro"); }}>
                Run it again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
