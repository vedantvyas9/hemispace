import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import FirstPerson from "./FirstPerson";
import Scene from "./Scene";
import Extinction, { scoreExtinction } from "./Extinction";
import { DEFAULTS, meanGazeDeg, leftDwellFraction } from "./neglect";

const SEARCH_SECONDS = 25;
const CLEAN = { ...DEFAULTS, enabled: false };

export default function App() {
  const [scene, setScene] = useState(null);
  const [phase, setPhase] = useState("intro");  // intro | search | declare | extIntro | ext | reveal
  const [found, setFound] = useState(new Set());
  const [poses, setPoses] = useState([]);
  const [left, setLeft] = useState(SEARCH_SECONDS);
  const [locked, setLocked] = useState(false);
  const [search, setSearch] = useState(null);
  const [ext, setExt] = useState(null);
  const canvasRef = useRef(null);
  const guess = useRef(0);

  useEffect(() => { fetch("/scene.json").then((r) => r.json()).then(setScene); }, []);

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

  useEffect(() => { if (phase !== "search") document.exitPointerLock?.(); }, [phase]);

  useEffect(() => {
    if (phase !== "search" || !locked) return;
    const id = setInterval(() => {
      setLeft((s) => { if (s <= 1) { clearInterval(id); endSearch(); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, locked]);

  useEffect(() => {
    const onKey = (e) => {
      if (phase === "search" && (e.code === "Enter" || e.code === "NumpadEnter")) {
        e.preventDefault(); endSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  useEffect(() => { guess.current = found.size; }, [found]);

  function startSearch() { setFound(new Set()); setPoses([]); setLeft(SEARCH_SECONDS); setPhase("search"); }
  function endSearch() { document.exitPointerLock?.(); setPhase("declare"); }

  function submitSearch() {
    setSearch({
      found: found.size,
      total: scene.targets.length,
      said: Number(guess.current),
      gaze: meanGazeDeg(poses),
      leftPct: leftDwellFraction(poses) * 100,
    });
    setPhase("extIntro");
  }

  const score = ext ? scoreExtinction(ext) : null;

  return (
    <div className="app">
      <Canvas
        camera={{ fov: 72, near: 0.1, far: 200 }}
        onCreated={({ gl }) => (canvasRef.current = gl.domElement)}
      >
        {scene && (
          <>
            <FirstPerson
              spawn={scene.spawn}
              neglect={CLEAN}
              // Only while searching. Emitting at 3Hz for the whole session
              // re-rendered App constantly and broke the flash timers.
              onPose={(p) => { if (phase === "search") setPoses((x) => [...x, p]); }}
            />
            <Scene scene={scene} neglect={CLEAN} found={found} onFind={(id) =>
              setFound((prev) => { const n = new Set(prev); n.add(id); return n; })} />
          </>
        )}
      </Canvas>

      {phase === "search" && !locked && (
        <div className="overlay grab" onClick={grabPointer}>
          <h2>Click to look around</h2>
          <p>The timer is paused until you do.</p>
        </div>
      )}

      {phase === "search" && locked && (
        <>
          <div className="crosshair" />
          <div className="hud">
            <span className={left <= 8 ? "urgent" : ""}>{left}s</span>
            <span className="sep" />
            <span>Found {found.size}</span>
            <kbd>Enter</kbd>
          </div>
          <div className="hint">Click to look around · WASD to walk · Enter when you're done</div>
        </>
      )}

      {phase === "intro" && (
        <div className="overlay">
          <h1>Hemispace</h1>
          <p>
            First, a warm-up. There are objects all around this room — behind you too.
            You have {SEARCH_SECONDS} seconds to find as many as you can.
          </p>
          <button onClick={() => { startSearch(); setTimeout(grabPointer, 450); }}>Start</button>
        </div>
      )}

      {phase === "declare" && (
        <div className="overlay">
          <h2>How many were in the room?</h2>
          <input
            type="number" defaultValue={found.size}
            onChange={(e) => (guess.current = e.target.value)}
            onKeyDown={(e) => e.code === "Enter" && submitSearch()}
            autoFocus
          />
          <button onClick={submitSearch}>Continue</button>
        </div>
      )}

      {phase === "extIntro" && search && (
        <div className="overlay">
          <h2>You found {search.found} of {search.total}</h2>
          <p>
            Your eyes work, and this room holds no secrets from you. Hold on to that,
            because the next part takes twenty seconds.
          </p>
          <p>
            Keep your eyes on the cross in the middle. Dots will flash at the edges —
            on the left, on the right, or on both sides at once. After each flash,
            say where you saw it.
          </p>
          <button onClick={() => setPhase("ext")}>I'm ready</button>
        </div>
      )}

      {phase === "ext" && (
        <Extinction onDone={(rows) => { setExt(rows); setPhase("reveal"); }} />
      )}

      {phase === "reveal" && score && search && (
        <div className="overlay wide">
          <h2>Your eyes are fine</h2>
          <div className="bars">
            <div className="bar-row">
              <span className="bar-label">Left flash, on its own</span>
              <div className="bar"><i style={{ width: score.leftAlone + "%", background: "#4ea87a" }} /></div>
              <span className="bar-val">{score.leftAlone}%</span>
            </div>
            <div className="bar-row">
              <span className="bar-label">Left flash, with something on the right</span>
              <div className="bar"><i style={{ width: score.leftCompeting + "%", background: "#f0883e" }} /></div>
              <span className="bar-val">{score.leftCompeting}%</span>
            </div>
            <div className="bar-row">
              <span className="bar-label">Right flash, on its own</span>
              <div className="bar"><i style={{ width: score.rightAlone + "%", background: "#4ea87a" }} /></div>
              <span className="bar-val">{score.rightAlone}%</span>
            </div>
          </div>

          <p className="verdict">
            You caught <b>{score.leftAlone}%</b> of left-side flashes when they appeared alone,
            and <b>{score.leftCompeting}%</b> when something appeared on the right at the same
            moment. Same eye. Same spot on the screen. Same brightness.
          </p>
          <p className="small">
            This is <b>extinction</b>, and it is a standard bedside test for hemispatial
            neglect after a right-hemisphere stroke. Every left flash you just saw was
            identical, and every one of them was really on your screen — including the ones
            you missed. Nothing was removed. A brighter neighbour simply won, and the loser
            never reached you. That is the whole condition, in one hundred milliseconds.
          </p>
          <button onClick={() => { setExt(null); setSearch(null); setPhase("intro"); }}>
            Run it again
          </button>
        </div>
      )}
    </div>
  );
}
