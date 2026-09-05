import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import FirstPerson from "./FirstPerson";
import Scene from "./Scene";
import { DEFAULTS, meanGazeDeg, leftDwellFraction } from "./neglect";

const RUNS = ["clean", "neglect"];
const RUN_SECONDS = 35;

export default function App() {
  const [scene, setScene] = useState(null);
  const [runIndex, setRunIndex] = useState(0);
  const [found, setFound] = useState(new Set());
  const [poses, setPoses] = useState([]);
  const [phase, setPhase] = useState("intro");
  const [results, setResults] = useState([]);
  const [left, setLeft] = useState(RUN_SECONDS);
  const [locked, setLocked] = useState(false);
  const canvasRef = useRef(null);
  const guess = useRef(0);

  // Browsers refuse a new pointer lock for about a second after one is
  // released. Requesting it straight away fails silently, which left the
  // second run unplayable while the clock kept running.
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

  useEffect(() => {
    fetch("/scene.json").then((r) => r.json()).then(setScene);
  }, []);

  const run = RUNS[runIndex];
  const neglect = { ...DEFAULTS, enabled: run === "neglect" };

  function startRun() {
    setFound(new Set());
    setPoses([]);
    setLeft(RUN_SECONDS);
    setPhase("playing");
  }

  function declare() {
    document.exitPointerLock?.();
    setPhase("declare");
  }

  // The clock is what makes this a search, not an audit. Real patients stop
  // early because the room feels finished; a healthy participant with
  // unlimited time will simply grind until they have everything.
  useEffect(() => {
    if (phase !== "playing" || !locked) return;   // the clock waits for control
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) { clearInterval(id); declare(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, locked]);

  useEffect(() => {
    const onKey = (e) => {
      if (phase === "playing" && (e.code === "Enter" || e.code === "NumpadEnter")) {
        e.preventDefault();
        declare();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") document.exitPointerLock?.();
  }, [phase]);

  useEffect(() => { guess.current = found.size; }, [found]);

  function handleFind(id) {
    setFound((prev) => { const n = new Set(prev); n.add(id); return n; });
  }

  function finish() {
    const missed = scene.targets.filter((t) => !found.has(t.id)).map((t) => t.id);
    setResults((r) => [...r, {
      run,
      found: found.size,
      total: scene.targets.length,
      missed,
      gaze: meanGazeDeg(poses),
      leftPct: leftDwellFraction(poses) * 100,
      said: Number(guess.current),
    }]);
    if (runIndex === 0) { setRunIndex(1); setPhase("intro"); }
    else setPhase("reveal");
  }

  const clean = results[0], neg = results[1];

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
              neglect={neglect}
              onPose={(p) => setPoses((x) => [...x, p])}
            />
            <Scene scene={scene} neglect={neglect} found={found} onFind={handleFind} />
          </>
        )}
      </Canvas>

      {phase === "playing" && !locked && (
        <div className="overlay grab" onClick={grabPointer}>
          <h2>Click to look around</h2>
          <p>The timer is paused until you do.</p>
        </div>
      )}

      {phase === "playing" && locked && (
        <>
          <div className="crosshair" />
          <div className="hud">
            <span className={left <= 10 ? "urgent" : ""}>{left}s</span>
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
            There are objects hidden around this room. You have {RUN_SECONDS} seconds
            to find as many as you can. Click to look around, WASD to walk.
          </p>
          <button onClick={() => { startRun(); setTimeout(grabPointer, 450); }}>
            {runIndex === 0 ? "Start" : "Once more, new room"}
          </button>
        </div>
      )}

      {phase === "declare" && (
        <div className="overlay">
          <h2>How many were in the room?</h2>
          <p>Your best guess — not how many you found.</p>
          <input
            type="number"
            defaultValue={found.size}
            onChange={(e) => (guess.current = e.target.value)}
            onKeyDown={(e) => e.code === "Enter" && finish()}
            autoFocus
          />
          <button onClick={finish}>That's my answer</button>
        </div>
      )}

      {phase === "reveal" && clean && neg && (
        <div className="overlay wide">
          <h2>What got through</h2>
          <table>
            <thead>
              <tr><th>Run</th><th>Found</th><th>You said</th><th>Mean gaze</th><th>Time facing left</th></tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className={r.run === "neglect" ? "row-neg" : ""}>
                  <td>{r.run === "clean" ? "First room" : "Second room"}</td>
                  <td>{r.found} / {r.total}</td>
                  <td>{r.said || "—"}</td>
                  <td>{r.gaze.toFixed(1)}°</td>
                  <td>{r.leftPct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="verdict">
            {neg.found < clean.found ? (
              <>You missed <b>{clean.found - neg.found}</b> in the second room, and told us
              there were <b>{neg.said}</b>. Nothing was hidden and nothing was dark.
              Your attention simply stopped going left.</>
            ) : (
              <>You found them all — but you spent <b>{clean.leftPct.toFixed(0)}%</b> of the
              first room facing left and only <b>{neg.leftPct.toFixed(0)}%</b> of the second.
              Nobody asked you to look left less. You just did.</>
            )}
          </p>
          <p className="small">You saw all of it. This is what registered.</p>
          <button onClick={() => { setResults([]); setRunIndex(0); setPhase("intro"); }}>
            Run it again
          </button>
        </div>
      )}
    </div>
  );
}
