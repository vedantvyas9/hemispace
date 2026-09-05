import * as THREE from "three";

/**
 * The attention model. Everything about neglect lives in this file.
 * Nothing else in the codebase should decide whether something is "seen".
 *
 * Three properties the literature demands, and why:
 *
 * 1. GRADED, NOT CLIPPED. Attention falls away progressively into the left.
 *    A hard boundary models hemianopia (a field cut), which is a different
 *    condition, and the 2007 JNER occlusion simulation failed validation
 *    precisely because of this.
 *
 * 2. NON-MONOTONIC. The good side is not merely spared, it is favoured —
 *    reaction times actually improve slightly in the right periphery. This
 *    is an interhemispheric imbalance, not a one-sided loss.
 *
 * 3. ANCHORED TO THE BODY, NOT THE SCREEN. The bias is computed against the
 *    camera's forward direction, so it follows the participant when they
 *    turn. That is the single property separating neglect from hemianopia.
 */

const _v = new THREE.Vector3();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();

export const DEFAULTS = {
  enabled: false,
  midlineShift: 18,   // deg. Where attention has already halved. Severity knob.
  spread: 16,         // deg. How abruptly it falls away. Smaller = sharper.
  rightBoost: 0.12,   // Over-allocation to the ipsilesional side.
  floor: 0.04,        // Never exactly zero — the input is not actually gone.
  allocentric: 0,     // 0 = purely egocentric, 1 = purely object-centred.
  leftGain: 0.72,     // Turning left is effortful. See lookGain() below.
};

/**
 * Signed horizontal angle of a world point relative to where the camera
 * is facing. Negative is the participant's left, positive their right.
 */
export function azimuthDeg(worldPos, camera) {
  _v.copy(worldPos).sub(camera.position);
  _f.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _r.set(1, 0, 0).applyQuaternion(camera.quaternion);
  _v.y = 0; _f.y = 0; _r.y = 0;
  if (_v.lengthSq() < 1e-8) return 0;
  _v.normalize(); _f.normalize(); _r.normalize();
  return (Math.atan2(_v.dot(_r), _v.dot(_f)) * 180) / Math.PI;
}

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * How much attention this object receives right now. 1 = full, 0 = none.
 * Track A wires this into three things and nothing else:
 *   - whether the object highlights at all
 *   - how long the crosshair must dwell before it registers
 *   - the extinction rule below
 */
export function attentionWeight(worldPos, camera, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (!o.enabled) return 1;

  const a = azimuthDeg(worldPos, camera);

  // Logistic falloff. At a = -midlineShift the weight is exactly 0.5.
  let w = 1 / (1 + Math.exp(-(a + o.midlineShift) / o.spread));

  // The ipsilesional side is favoured, not merely spared.
  const peripheral = clamp01((a - 10) / 40);
  w *= 1 + o.rightBoost * peripheral;

  return clamp01(Math.max(o.floor, w));
}

/**
 * Object-centred (allocentric) neglect: the left half of each object fades,
 * wherever that object happens to sit. Genuinely dissociable from the
 * egocentric bias — in one 50-patient cohort, 11 had egocentric only,
 * 4 allocentric only, and just 1 had both. Blend with `allocentric`.
 */
export function objectHalfWeight(localX, halfWidth, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (!o.enabled || o.allocentric <= 0 || halfWidth <= 0) return 1;
  const n = clamp01((localX / halfWidth + 1) / 2);      // 0 = left edge, 1 = right
  return 1 - o.allocentric * (1 - n) * 0.85;
}

/**
 * EXTINCTION — the strongest mechanic you have, because it maps onto a real
 * bedside test (double simultaneous stimulation: the examiner wiggles one
 * finger, then both; the patient reports only the right one).
 *
 * A single left-side target is detected normally. Add a competing target on
 * the right at the same moment and the left one never reaches awareness.
 *
 * Pass the candidates currently in view. Returns the ids that are suppressed.
 */
export function extinguished(candidates, camera, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (!o.enabled || candidates.length < 2) return new Set();

  const scored = candidates.map((c) => ({ id: c.id, a: azimuthDeg(c.position, camera) }));
  const strongestRight = Math.max(...scored.map((s) => s.a));
  if (strongestRight <= 0) return new Set();   // nothing competing on the good side

  const out = new Set();
  for (const s of scored) {
    if (s.a < 0 && strongestRight - s.a > 15) out.add(s.id);
  }
  return out;
}

/**
 * Dwell before an object registers.
 *
 * Kept deliberately small and nearly flat across the field. An earlier version
 * made left-side objects expensive to register, and it produced the wrong
 * subjective experience entirely: participants reported seeing an object,
 * aiming at it, and having it refuse to respond. That is a broken interface,
 * not neglect. A real patient who does orient to a left-side object perceives
 * it normally — the deficit is that they never orient there.
 *
 * So misses must come from not looking, never from looking and failing.
 * The lever that produces them is lookGain() below.
 *
 * Second playtest still reported a lag on the left, so this is now flat:
 * identical everywhere, no attention term at all. Any perceptible difference
 * in responsiveness reads as a bug and costs more than it buys.
 */
export function dwellMs() {
  return 150;   // flat, everywhere, always
}

/**
 * DIRECTIONAL HYPOKINESIA — the honest lever.
 *
 * Patients are slower to initiate movement toward the neglected side, even
 * with the unaffected hand, even when they can see the target perfectly well.
 * It dissociates from the visual deficit and is a documented component of the
 * syndrome in its own right.
 *
 * Here it means turning left is very slightly heavier than turning right.
 * Individually each movement is imperceptible; across a whole search it adds
 * up to genuinely under-exploring the left side, which is exactly what we
 * want the participant to do without ever noticing they did it.
 */
export function lookGain(movementX, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (!o.enabled) return 1;
  return movementX < 0 ? o.leftGain : 1;   // movementX < 0 turns the view left
}

/**
 * Fraction of the run spent facing left of the body midline. More robust than
 * the mean when someone spins, and immediately legible to a non-specialist:
 * "you spent 11% of your time looking at half the room."
 */
export function leftDwellFraction(poses) {
  if (poses.length < 2) return 0;
  let left = 0, total = 0;
  for (let i = 1; i < poses.length; i++) {
    const dt = Math.max(0, poses[i].t - poses[i - 1].t);
    total += dt;
    if (poses[i].yaw < 0) left += dt;
  }
  return total > 0 ? left / total : 0;
}

/**
 * The published severity metric: mean horizontal gaze position in degrees,
 * weighted by dwell time. Video-oculography studies in right-hemisphere
 * stroke patients report roughly -14 deg to +14 deg, and a rightward-shifted
 * mean correlates with the Catherine Bergego Scale.
 *
 * On a flat screen this is camera yaw, not eye position — say so if asked.
 */
export function meanGazeDeg(poses) {
  if (!poses.length) return 0;
  let num = 0, den = 0;
  for (let i = 1; i < poses.length; i++) {
    const dt = Math.max(0, poses[i].t - poses[i - 1].t);
    num += poses[i].yaw * dt;
    den += dt;
  }
  return den > 0 ? num / den : poses[poses.length - 1].yaw;
}
