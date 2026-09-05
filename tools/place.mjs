/**
 * Places the fourteen targets in a new room while preserving the angular
 * layout that worked in the grey placeholder.
 *
 * What made that room good was never its metres — it was the spread of
 * azimuths: seven each side, reaching past 80 degrees, with several behind the
 * participant so the room could not be cleared without turning all the way
 * round. Rooms will change; that distribution should not.
 *
 * Usage:  node tools/place.mjs --halfWidth 8 --halfDepth 9 [--out public/scene.json]
 */
const REFERENCE = [
  { id: "L1", x: -8.5, y: 0.90, z: -1.5 },
  { id: "L2", x: -6.8, y: 1.20, z: -4.5 },
  { id: "L3", x: -4.5, y: 0.80, z: -7.5 },
  { id: "L4", x: -2.6, y: 1.00, z: -9.8 },
  { id: "L5", x: -9.0, y: 1.10, z:  1.5 },
  { id: "L6", x: -6.0, y: 0.90, z:  5.5 },
  { id: "L7", x: -2.5, y: 1.05, z:  7.0 },
  { id: "R1", x:  8.2, y: 0.90, z: -1.8 },
  { id: "R2", x:  6.5, y: 1.15, z: -4.8 },
  { id: "R3", x:  4.2, y: 0.80, z: -7.8 },
  { id: "R4", x:  2.3, y: 1.00, z: -9.9 },
  { id: "R5", x:  9.0, y: 1.05, z:  1.8 },
  { id: "R6", x:  6.2, y: 0.90, z:  5.8 },
  { id: "R7", x:  2.4, y: 1.00, z:  7.2 },
];

const arg = (k, d) => {
  const i = process.argv.indexOf("--" + k);
  return i > -1 ? process.argv[i + 1] : d;
};
const halfWidth = parseFloat(arg("halfWidth", 8));
const halfDepth = parseFloat(arg("halfDepth", 9));
const margin    = parseFloat(arg("margin", 0.85));   // keep off the walls
const out       = arg("out", "public/scene.json");

const REF_HALF_W = 9.0, REF_HALF_D = 9.9;

const targets = REFERENCE.map((t) => {
  const azimuth = Math.atan2(t.x, -t.z);                       // + is right
  const r = Math.hypot(t.x, t.z);
  const refR = Math.hypot(REF_HALF_W * Math.sin(azimuth), REF_HALF_D * Math.cos(azimuth));
  const newR = Math.hypot(halfWidth * Math.sin(azimuth), halfDepth * Math.cos(azimuth));
  const scaled = (r / refR) * newR * margin;                   // same fraction of the way to the wall
  return {
    id: t.id,
    azimuthDeg: +((azimuth * 180) / Math.PI).toFixed(1),
    position: [
      +(Math.sin(azimuth) * scaled).toFixed(2),
      t.y,
      +(-Math.cos(azimuth) * scaled).toFixed(2),
    ],
  };
});

const left = targets.filter((t) => t.azimuthDeg < 0).length;
console.error(`${targets.length} targets — ${left} left, ${targets.length - left} right`);
console.error("azimuths: " + targets.map((t) => t.azimuthDeg).sort((a, b) => a - b).join("  "));
console.log(JSON.stringify(targets, null, 2));
