import { useEffect, useRef, useState } from "react";

/**
 * DOUBLE SIMULTANEOUS STIMULATION.
 *
 * The bedside test: the examiner holds both hands in the periphery while the
 * patient fixates their nose, and wiggles a finger on the left, on the right,
 * or on both at once. A patient with extinction reports the left one perfectly
 * when it is alone, and does not see it at all when something appears on the
 * right at the same moment.
 *
 * This is the one part of the syndrome that can be honestly reproduced in a
 * healthy participant, because 180ms is faster than any compensation strategy.
 * There is nothing to sweep, nothing to check, no way to try harder.
 */

const FLASH_MS = 180;
const GAP_MIN = 700;
const GAP_JITTER = 700;

function buildTrials() {
  const t = [
    ...Array(6).fill("left"),
    ...Array(6).fill("right"),
    ...Array(8).fill("both"),
  ].map((type, i) => ({ id: i, type }));
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

export default function Extinction({ neglect, onDone }) {
  const [trials] = useState(buildTrials);
  const [i, setI] = useState(0);
  const [flash, setFlash] = useState(null);      // { left, right }
  const [awaiting, setAwaiting] = useState(false);
  const results = useRef([]);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (i >= trials.length) { onDone(results.current); return; }
    const trial = trials[i];

    // Under neglect, a left stimulus presented at the same moment as a right
    // one never reaches awareness. We remove it from the display, and say so
    // plainly afterwards — the participant cannot tell the difference between
    // "removed" and "unattended", which is exactly the lesson.
    const suppressed = neglect && trial.type === "both" && Math.random() < 0.85;
    const shown = {
      left: (trial.type === "left" || trial.type === "both") && !suppressed,
      right: trial.type === "right" || trial.type === "both",
    };

    const gap = GAP_MIN + Math.random() * GAP_JITTER;
    const a = setTimeout(() => {
      setFlash(shown);
      const b = setTimeout(() => { setFlash(null); setAwaiting(true); }, FLASH_MS);
      timers.current.push(b);
    }, gap);
    timers.current.push(a);
    return () => { clearTimeout(a); };
  }, [i, trials, neglect, onDone]);

  function respond(answer) {
    if (!awaiting) return;
    const trial = trials[i];
    results.current.push({ type: trial.type, answer });
    setAwaiting(false);
    setI((n) => n + 1);
  }

  useEffect(() => {
    const onKey = (e) => {
      if (!awaiting) return;
      if (e.code === "ArrowLeft") respond("left");
      else if (e.code === "ArrowRight") respond("right");
      else if (e.code === "ArrowUp" || e.code === "KeyB") respond("both");
      else if (e.code === "ArrowDown" || e.code === "KeyN") respond("none");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [awaiting, i]);

  return (
    <div className="ext">
      <div className="ext-count">{i + 1} / {trials.length}</div>
      <div className="ext-field">
        <div className={"ext-dot left" + (flash?.left ? " on" : "")} />
        <div className="ext-fix">+</div>
        <div className={"ext-dot right" + (flash?.right ? " on" : "")} />
      </div>
      {awaiting ? (
        <div className="ext-answer">
          <p>Where did it appear?</p>
          <div className="ext-buttons">
            <button onClick={() => respond("left")}>Left <kbd>←</kbd></button>
            <button onClick={() => respond("both")}>Both <kbd>↑</kbd></button>
            <button onClick={() => respond("right")}>Right <kbd>→</kbd></button>
            <button className="ghost" onClick={() => respond("none")}>Nothing <kbd>↓</kbd></button>
          </div>
        </div>
      ) : (
        <p className="ext-hold">Keep your eyes on the cross</p>
      )}
    </div>
  );
}

/** Detection of the left stimulus, alone versus in competition. */
export function scoreExtinction(rows) {
  const sawLeft = (a) => a === "left" || a === "both";
  const alone = rows.filter((r) => r.type === "left");
  const compet = rows.filter((r) => r.type === "both");
  const right = rows.filter((r) => r.type === "right");
  const pct = (arr, f) => (arr.length ? Math.round((arr.filter(f).length / arr.length) * 100) : 0);
  return {
    leftAlone: pct(alone, (r) => sawLeft(r.answer)),
    leftCompeting: pct(compet, (r) => sawLeft(r.answer)),
    rightAlone: pct(right, (r) => r.answer === "right" || r.answer === "both"),
    n: rows.length,
  };
}
