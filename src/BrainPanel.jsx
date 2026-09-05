/**
 * A schematic of attentional balance — deliberately not an anatomical render.
 *
 * Kinsbourne's opponent-processor account, which is still how this is taught:
 * each hemisphere pushes attention toward the opposite side of space and the
 * two mutually inhibit. The right hemisphere is the stronger one and attends
 * to both sides; the left attends mainly rightward. Damage the right and the
 * left's rightward drive is unopposed, so attention settles to the right and
 * stays there.
 *
 * The needle is driven by the participant's own measured mean gaze, so this
 * panel explains their result rather than illustrating a general idea.
 */
export default function BrainPanel({ meanGazeDeg = 0 }) {
  const clamped = Math.max(-45, Math.min(45, meanGazeDeg));
  const needleX = 300 + (clamped / 45) * 210;

  return (
    <svg className="brain" viewBox="0 0 600 260" role="img"
         aria-label="Schematic of attentional balance between the hemispheres">
      {/* left hemisphere — intact */}
      <path d="M290 30 C230 30 186 62 186 108 C186 154 230 186 290 186 Z"
            fill="#1b2a38" stroke="#3f6f96" strokeWidth="2" />
      <text x="238" y="112" textAnchor="middle" fontSize="13" fill="#8fc1f2" fontWeight="600">LEFT</text>
      <text x="238" y="130" textAnchor="middle" fontSize="10.5" fill="#7a8898">intact</text>

      {/* right hemisphere — lesioned */}
      <path d="M310 30 C370 30 414 62 414 108 C414 154 370 186 310 186 Z"
            fill="#1e1a1a" stroke="#6b4034" strokeWidth="2" />
      <circle cx="372" cy="88" r="26" fill="#3a1d16" stroke="#8a4a33" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="362" y="120" textAnchor="middle" fontSize="13" fill="#e08356" fontWeight="600">RIGHT</text>
      <text x="362" y="138" textAnchor="middle" fontSize="10.5" fill="#8a5a48">lesion</text>
      <text x="372" y="60" textAnchor="middle" fontSize="9" fill="#8a5a48">TPJ</text>

      {/* the drives */}
      <g>
        <path d="M300 205 L470 205" stroke="#69a8e8" strokeWidth="3" strokeLinecap="round" />
        <path d="M462 199 L474 205 L462 211 Z" fill="#69a8e8" />
        <text x="386" y="196" textAnchor="middle" fontSize="10.5" fill="#69a8e8">left hemisphere pushes right — unopposed</text>

        <path d="M300 232 L150 232" stroke="#5a4038" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" opacity="0.7" />
        <path d="M158 226 L146 232 L158 238 Z" fill="#5a4038" opacity="0.7" />
        <text x="228" y="223" textAnchor="middle" fontSize="10.5" fill="#7a5a4c">right hemisphere pushed left — gone</text>
      </g>

      {/* net attention vector, driven by the measured result */}
      <line x1="90" y1="18" x2="510" y2="18" stroke="#25303b" strokeWidth="1" />
      <line x1="300" y1="10" x2="300" y2="26" stroke="#4a5764" strokeWidth="1" />
      <text x="300" y="8" textAnchor="middle" fontSize="9" fill="#7a8898">body midline</text>
      <line x1={needleX} y1="6" x2={needleX} y2="30" stroke="#f0883e" strokeWidth="3" strokeLinecap="round" />
      <text x={needleX} y="46" textAnchor="middle" fontSize="11.5" fill="#f0883e" fontWeight="600">
        {meanGazeDeg > 0 ? "+" : ""}{meanGazeDeg.toFixed(1)}°
      </text>
    </svg>
  );
}
