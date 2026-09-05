import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import FirstPerson from "./FirstPerson";
import Scene from "./Scene";
import { DEFAULTS, meanGazeDeg } from "./neglect";

const RUNS = ["clean", "neglect"];

export default function App() {
  const [scene, setScene] = useState(null);
  const [runIndex, setRunIndex] = useState(0);
  const [found, setFound] = useState(new Set());
  const [poses, setPoses] = useState([]);
  const [phase, setPhase] = useState("intro");   // intro | playing | declare | reveal
  const [results, setResults] = useState([]);
  const guess = useRef("");

  useEffect(() => {
    fetch("/scene.json").then((r) => r.json()).then(setScene);
  }, []);

  const run = RUNS[runIndex];
  const neglect = { ...DEFAULTS, enabled: run === "neglect" };

  function startRun() {
    setFound(new Set());
    setPoses([]);
    setPhase("playing");
  }

  // Pointer lock hides the cursor, so the button is unclickable while playing.
  // Enter is the way out, and we release the lock so the next screen is usable.
  function declare() {
    document.exitPointerLock?.();
    setPhase("declare");
  }

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

  // Never leave the pointer captured on a screen that has controls.
  useEffect(() => {
    if (phase !== "playing") document.exitPointerLock?.();
  }, [phase]);

  function handleFind(id) {
    setFound((prev) => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
  }

  function finish() {
    setResults((r) => [...r, {
      run,
      found: found.size,
      total: scene.targets.length,
      gaze: meanGazeDeg(poses),
      said: Number(guess.current) || null,
    }]);
    guess.current = "";
    if (runIndex === 0) { setRunIndex(1); setPhase("intro"); }
    else setPhase("reveal");
  }

  return (
    <div className="app">
      <Canvas camera={{ fov: 72, near: 0.1, far: 200 }}>
        {scene && (
          <>
            <FirstPerson spawn={scene.spawn} onPose={(p) => setPoses((x) => [...x, p])} />
            <Scene scene={scene} neglect={neglect} found={found} onFind={handleFind} />
          </>
        )}
      </Canvas>

      {phase === "playing" && (
        <>
          <div className="crosshair" />
          <div className="hud">
            <span>Found {found.size}</span>
            <kbd>Enter</kbd>
            <span className="dim">when you're done</span>
          </div>
          <div className="hint">Click to look around · WASD to walk · Esc releases the mouse</div>
        </>
      )}

      {phase === "intro" && (
        <div className="overlay">
          <h1>Hemispace</h1>
          <p>
            There are {scene?.targets.length ?? "several"} objects in this room.
            Click to look around, WASD to walk. Find them all, then press Enter.
          </p>
          <button onClick={startRun}>{runIndex === 0 ? "Start" : "Once more, new room"}</button>
        </div>
      )}

      {phase === "declare" && (
        <div className="overlay">
          <h2>How many did you find?</h2>
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

      {phase === "reveal" && (
        <div className="overlay">
          <h2>What got through</h2>
          <table>
            <thead>
              <tr><th>Run</th><th>Found</th><th>You said</th><th>Mean gaze</th></tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{r.run}</td>
                  <td>{r.found} / {r.total}</td>
                  <td>{r.said ?? "—"}</td>
                  <td>{r.gaze.toFixed(1)}°</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small">You saw everything. This is what registered.</p>
        </div>
      )}
    </div>
  );
}
