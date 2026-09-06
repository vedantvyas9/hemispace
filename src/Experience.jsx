import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import FixedCamera from "./FixedCamera";
import Guide from "./Guide";
import Scene from "./Scene";
import BrainPanel from "./BrainPanel";
import { DEFAULTS } from "./neglect";

const SECONDS = 20;
const CLEAN = { ...DEFAULTS, enabled: false };
const NEGLECT = { ...DEFAULTS, enabled: true };
const EMPTY = new Set();

/**
 * Where a target sits in the participant's field, in degrees, negative left.
 *
 * The camera never moves, so this is fixed data and can be worked out from
 * scene.json alone. It replaces the old `position[0] < 0` test, which asked
 * which half of the *world* something was in — fine only while the spawn
 * happened to face -z. What matters clinically is which half of the *field*
 * it falls in, so that is what gets measured.
 */
function fieldAzimuth(target, spawn) {
  const p = spawn?.position ?? [0, 1.6, 0];
  const dx = target.position[0] - p[0];
  const dz = target.position[2] - p[2];
  const world = (Math.atan2(dx, -dz) * 180) / Math.PI;
  const yaw = ((spawn?.yaw ?? 0) * 180) / Math.PI;
  let a = world + yaw;
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
}

/**
 * Jump straight to a phase with ?phase=reveal.
 *
 * The reveal is the last thing in a five-minute sequence, which made every
 * tweak to it cost two full rounds to see. It is worth being able to open it
 * directly — for anyone working on the timing or the framing, and for showing
 * the ending on its own.
 */
function fromUrl() {
  if (typeof location === "undefined") return null;
  const p = new URLSearchParams(location.search).get("phase");
  return p === "reveal" || p === "declare" || p === "intro2" ? p : null;
}

export default function Experience({ onExit }) {
  const jump = useMemo(fromUrl, []);
  const [scene, setScene] = useState(null);
  const [phase, setPhase] = useState(jump ?? "intro");   // intro | run | declare | intro2 | reveal
  const [round, setRound] = useState(jump ? 2 : 1);
  const [found, setFound] = useState(new Set());
  const [left, setLeft] = useState(SECONDS);
  const [results, setResults] = useState([]);
  const [revealStep, setRevealStep] = useState(0);
  const [worldReady, setWorldReady] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => { fetch("/scene.json").then((r) => r.json()).then(setScene); }, []);

  // A jumped-to reveal has no rounds behind it, so it gets a plausible pair:
  // everything found the first time, only the right-hand half the second.
  useEffect(() => {
    if (!jump || !scene || results.length) return;
    const missed = scene.targets
      .filter((t) => fieldAzimuth(t, scene.spawn) < 0)
      .map((t) => t.id);
    setResults([
      { round: 1, found: scene.targets.length, total: scene.targets.length, missed: [] },
      { round: 2, found: scene.targets.length - missed.length, total: scene.targets.length, missed },
    ]);
  }, [jump, scene, results.length]);

  const neglect = round === 2 && phase !== "reveal" ? NEGLECT : CLEAN;

  // The left half of the field, which round two never brings to awareness.
  const unseen = useMemo(() => {
    if (!scene || round !== 2) return EMPTY;
    return new Set(
      scene.targets
        .filter((t) => fieldAzimuth(t, scene.spawn) < 0)
        .map((t) => t.id),
    );
  }, [scene, round]);

  useEffect(() => {
    if (phase !== "run") return;
    timerRef.current = setInterval(() => {
      setLeft((s) => { if (s <= 1) { clearInterval(timerRef.current); endRun(); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

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
    // Step 2 is the whole point — the missed objects lighting up — so it gets
    // room to land instead of the 3.2s it had.
    const ts = [
      setTimeout(() => setRevealStep(1), 2800),
      setTimeout(() => setRevealStep(2), 5400),
      setTimeout(() => setRevealStep(3), 13500),
    ];
    return () => ts.forEach(clearTimeout);
  }, [phase]);

  function startRun() { setFound(new Set()); setLeft(SECONDS); setPhase("run"); }
  function endRun() { clearInterval(timerRef.current); setPhase("declare"); }

  function next() {
    const reachable = scene.targets.length - unseen.size;
    setResults((r) => [...r, {
      round, found: found.size, reachable, total: scene.targets.length,
      missed: scene.targets.filter((t) => !found.has(t.id)).map((t) => t.id),
    }]);
    if (round === 1) { setRound(2); setPhase("intro2"); }
    else { setRevealStep(0); setPhase("reveal"); }
  }

  const r1 = results[0], r2 = results[1];
  const leftCount = unseen.size;

  /**
   * Where their attention actually landed, in degrees of visual field.
   *
   * There is no gaze to measure any more — the camera never moves — so the
   * old mean-gaze figure would have been invented. This is the same thing the
   * clinical version scores: the spatial centre of the targets they marked.
   * Mark only the right-hand ones and it sits well to the right, which is the
   * claim the panel underneath it is making.
   */
  const attentionDeg = useMemo(() => {
    if (!scene || !r2) return 0;
    const hit = scene.targets.filter((t) => !r2.missed.includes(t.id));
    const pool = hit.length ? hit : scene.targets.filter((t) => !unseen.has(t.id));
    if (!pool.length) return 0;
    return pool.reduce((a, t) => a + fieldAzimuth(t, scene.spawn), 0) / pool.length;
  }, [scene, r2, unseen]);

  return (
    <div className="app">
      <Canvas
        camera={{ fov: 72, near: 0.1, far: 300 }}
        onCreated={({ gl, scene: s, camera }) => { window.__hemi = { gl, scene: s, camera }; }}
      >
        {scene && (
          <>
            {/* The camera does not move for the reveal either.
                It used to lift out over the room, which meant the room had to
                dissolve — a Marble capture is shot at eye height and has
                nothing to page from above, so the ending was a bird's-eye view
                of an empty grid, and the cut read as the render breaking.
                Staying put is also the stronger beat: the same room, the same
                view they just told you they had finished searching, and two
                objects lighting up in it that were never there for them. */}
            <FixedCamera spawn={scene.spawn} />
            <Scene
              scene={scene}
              neglect={neglect}
              found={found}
              unseen={phase === "reveal" ? unseen : EMPTY}
              onFind={(id) => setFound((prev) => { const n = new Set(prev); n.add(id); return n; })}
              onWorldReady={() => setWorldReady(true)}
              reveal={phase === "reveal" && revealStep >= 2}
              /* The room used to dissolve here, because the reveal camera sat
                 17m up and a Marble capture falls apart that far outside the
                 volume it was shot in. From 4m, just behind where the
                 participant stood, it holds — and keeping it is the point:
                 they need to recognise the room they just failed to search. */
              dissolve={false}
            />
          </>
        )}
      </Canvas>

      {/* The neglected half, drawn. Graded rather than cut off: attention falls
          away toward the left instead of stopping at a line, and a hard edge
          would depict hemianopia, which is a different condition. You can see
          straight through it — that is the point. */}
      {phase === "run" && round === 2 && <div className="neglect-veil" aria-hidden="true" />}

      {phase === "run" && (
        <>
          {round === 2 && (
            <div className="veil-note">Your left — seen, but not attended</div>
          )}
          <div className="hud">
            <span className={left <= 6 ? "urgent" : ""}>{left}s</span>
            <span className="sep" /><span>Found {found.size}</span><kbd>Enter</kbd>
          </div>
          <div className="hint">Click everything you can see · Enter when you're done</div>
        </>
      )}

      {phase === "intro" && (
        <Guide seconds={SECONDS} ready={worldReady} targets={scene?.targets}
               onStart={startRun} onExit={onExit} />
      )}

      {phase === "intro2" && (
        <div className="overlay">
          <h2>Found {r1?.found} of {r1?.total}</h2>
          <p>
            Now do it again as someone whose right hemisphere has been damaged
            by a stroke. Their eyes work perfectly. What they cannot do is pay
            attention to the left — so the left of your view is shaded, and what
            is under the shading will not register no matter how hard you look.
          </p>
          <p className="small">
            That is the difference that matters. It is not blindness. The
            information arrives and never reaches them.
          </p>
          <button onClick={startRun} disabled={!worldReady}>
            {worldReady ? "Go" : "Loading the room…"}
          </button>
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
          {revealStep === 1 && (
            <div className="cap">
              <h2>You found {r2?.found} of {r2?.total}.</h2>
              <p>Every one of them on the side you could still attend to.</p>
            </div>
          )}
          {revealStep === 2 && (
            <div className="cap">
              <h2>These were there the whole time.</h2>
              <p>
                {leftCount} object{leftCount === 1 ? "" : "s"} on the left of your view.
                You could see them. You were told exactly where they were. And the
                shading still won — which is the closest this can get to what a patient
                lives with, except that nobody hands them the shading, or tells them it
                is there.
              </p>
            </div>
          )}
          {revealStep >= 3 && (
            <div className="cap final">
              <BrainPanel meanGazeDeg={attentionDeg} />
              <h2>Why it happens</h2>
              <p>
                Your two hemispheres normally push attention in opposite directions and
                cancel each other out. Damage the right one and the left keeps pushing
                rightward with nothing to oppose it. Attention settles to the right and
                stays there.
              </p>
              <p className="small">
                Schematic, not anatomy. Hemispatial neglect affects around 60% of patients
                in the first weeks after a right-hemisphere stroke, and roughly one in
                twelve never recovers. They are not blind. Nobody has told them.
              </p>
              <div className="row">
                <button onClick={() => { setResults([]); setRound(1); setRevealStep(0); setPhase("intro"); }}>
                  Run it again
                </button>
                <button className="link" onClick={onExit}>Back to menu</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
