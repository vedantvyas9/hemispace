import { useState } from "react";

/**
 * The bit that stands in for someone standing next to you.
 *
 * It explains the task and nothing else. What happens in round two is the
 * whole point of the piece and has to arrive as a surprise, so this says
 * "you will do it twice" and stops there — no hint that anything changes,
 * because a participant who is watching for a trick will find it, and then
 * there is nothing left to reveal.
 */
const STEPS = [
  {
    title: "One room. One view.",
    body: "You are standing still. You cannot walk and you cannot turn — everything you have to find is already in front of you.",
    art: (
      <svg viewBox="0 0 120 72" className="guide-art" aria-hidden="true">
        <rect x="6" y="10" width="108" height="52" rx="4" fill="#141b23" stroke="#2c3b47" />
        <circle cx="60" cy="36" r="7" fill="none" stroke="#69a8e8" strokeWidth="1.6" />
        <circle cx="60" cy="36" r="2.2" fill="#69a8e8" />
        <path d="M34 36 H20 M86 36 H100" stroke="#3a4a58" strokeWidth="1.4" strokeDasharray="3 3" />
        <path d="M24 30 l-5 6 5 6 M96 30 l5 6 -5 6" fill="none" stroke="#5a4038" strokeWidth="1.4" />
        <path d="M14 20 L106 56" stroke="#6b4034" strokeWidth="1.6" opacity=".85" />
      </svg>
    ),
  },
  {
    title: "Six things are in the room.",
    body: "Click each one you spot. It turns green when it has counted. They are hidden in plain sight, sitting where you would actually leave them.",
    list: true,
    art: (
      <svg viewBox="0 0 120 72" className="guide-art" aria-hidden="true">
        <circle cx="48" cy="36" r="13" fill="#1c2a22" stroke="#4ea87a" strokeWidth="1.6" />
        <circle cx="48" cy="36" r="20" fill="none" stroke="#4ea87a" strokeWidth="1" opacity=".45">
          <animate attributeName="r" values="14;22;14" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values=".55;0;.55" dur="2.2s" repeatCount="indefinite" />
        </circle>
        <path d="M72 30 l0 20 5-5 4 9 4-2 -4-8 7-1 z" fill="#e6edf3" stroke="#0d1117" strokeWidth="1" />
      </svg>
    ),
  },
  {
    title: "You will do it twice.",
    body: "Twenty seconds each time, the same room and the same view. Afterwards we will look at what happened.",
    art: (
      <svg viewBox="0 0 120 72" className="guide-art" aria-hidden="true">
        <rect x="10" y="18" width="44" height="36" rx="3" fill="#141b23" stroke="#2c3b47" />
        <rect x="66" y="18" width="44" height="36" rx="3" fill="#141b23" stroke="#2c3b47" />
        <text x="32" y="41" textAnchor="middle" fontSize="15" fill="#69a8e8" fontWeight="700">1</text>
        <text x="88" y="41" textAnchor="middle" fontSize="15" fill="#69a8e8" fontWeight="700">2</text>
        <path d="M56 36 H64" stroke="#3a4a58" strokeWidth="1.4" />
        <path d="M61 33 l4 3 -4 3" fill="none" stroke="#3a4a58" strokeWidth="1.4" />
      </svg>
    ),
  },
];

export default function Guide({ seconds, ready, targets, onStart, onExit }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="overlay guide">
      <div className="guide-card">
        {step.art}
        <h2>{step.title}</h2>
        <p>{step.body.replace("Twenty seconds", `${seconds} seconds`)}</p>

        {/* Named from scene.json rather than written out here, so the room and
            the briefing cannot drift apart. Without this a first-time
            participant has no way to tell a target from the furniture. */}
        {step.list && targets?.length > 0 && (
          <ul className="guide-list">
            {targets.map((t) => (
              <li key={t.id}>{t.label ?? "an object"}</li>
            ))}
          </ul>
        )}

        <div className="guide-dots" role="tablist" aria-label="Steps">
          {STEPS.map((s, n) => (
            <button
              key={s.title}
              className={`guide-dot ${n === i ? "on" : ""}`}
              aria-label={`Step ${n + 1}`}
              aria-selected={n === i}
              role="tab"
              onClick={() => setI(n)}
            />
          ))}
        </div>

        <div className="row">
          {last ? (
            <button onClick={onStart} disabled={!ready}>
              {ready ? "I'm ready" : "Loading the room…"}
            </button>
          ) : (
            <button onClick={() => setI(i + 1)}>Next</button>
          )}
          <button className="link" onClick={last ? onExit : () => setI(STEPS.length - 1)}>
            {last ? "Back" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}
