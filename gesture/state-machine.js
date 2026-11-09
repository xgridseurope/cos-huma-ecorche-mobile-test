// ===== v1.5.0 Phase 2 · Gesture State Machine =====
// Turns a noisy per-frame pose stream into rare, deliberate commands.
//   IDLE ──(same pose for ≥ confirmFrames AND ≥ confirmMs)──▶ FIRED: emits ONE command
//   FIRED ──(another pose for ≥ releaseFrames frames, or hand lost ≥ releaseMs)──▶ IDLE
// A pose held for 10 s therefore fires exactly once. A new pose must itself be confirmed
// (confirmFrames + confirmMs) and never fires sooner than cooldownMs after the last command.
// sm2: pinch must be held pinchConfirmMs (400 ms) before GRAB_START; a relaxed thumb brushing the
// index flickers for 1–3 frames (device 4080), a deliberate pinch is held.
// Pinch is a held gesture: GRAB_START once, GRAB_MOVE while held, GRAB_END when released or lost.
// Commands are intents only. Phase 2 logs them; it never touches the 3D model.
export const SM_VERSION = 'sm2';
export const DEFAULTS = { confirmFrames: 4, confirmMs: 250, pinchConfirmMs: 400, releaseFrames: 3, pinchReleaseFrames: 2, releaseMs: 300, cooldownMs: 700, minConfidence: 0.5 };
const COMMAND = { open: 'EXPLODE', fist: 'RESTORE' };

export class GestureStateMachine {
  constructor(opts = {}) { this.o = { ...DEFAULTS, ...opts }; this.reset(); }
  reset() {
    this.state = 'IDLE'; this.candidate = null; this.since = 0; this.count = 0;
    this.fired = null; this.lastCommandAt = -Infinity; this.lostSince = null; this.grabbing = false; this.away = 0;
  }
  // frame: { t: ms, pose: 'open'|'fist'|'pinch'|'neutral'|null (null = no hand), confidence, point?: {x,y} }
  // returns array of commands emitted on this frame: { type, t, pose? , point? }
  step(frame) {
    const out = [], o = this.o, t = frame.t;
    // ---- hand lost
    if (!frame.pose) {
      if (this.lostSince === null) this.lostSince = t;
      if (t - this.lostSince >= o.releaseMs) {
        if (this.grabbing) { out.push({ type: 'GRAB_END', t, reason: 'lost' }); this.grabbing = false; this.lastCommandAt = t; }
        this.state = 'IDLE'; this.fired = null; this.candidate = null; this.count = 0;
      }
      return out;
    }
    this.lostSince = null;
    const pose = frame.confidence >= o.minConfidence ? frame.pose : 'neutral';
    // ---- release from a fired pose
    // A single flickering frame never counts as a release: the hand must be away from the
    // fired pose for releaseFrames consecutive frames (pinch: pinchReleaseFrames).
    if (this.state === 'FIRED') {
      if (pose === this.fired) {
        this.away = 0;
        if (this.fired === 'pinch') out.push({ type: 'GRAB_MOVE', t, point: frame.point });
        return out;
      }
      this.away++;
      const need = this.fired === 'pinch' ? o.pinchReleaseFrames : o.releaseFrames;
      if (this.away < need) return out;
      if (this.fired === 'pinch') { out.push({ type: 'GRAB_END', t, reason: 'released' }); this.grabbing = false; this.lastCommandAt = t; }
      this.state = 'IDLE'; this.fired = null; this.away = 0;
    }
    // ---- confirm a new pose
    if (pose === 'neutral') { this.candidate = null; this.count = 0; return out; }
    if (pose !== this.candidate) { this.candidate = pose; this.since = t; this.count = 1; return out; }
    this.count++;
    if (this.count >= o.confirmFrames && t - this.since >= (pose === 'pinch' ? o.pinchConfirmMs : o.confirmMs) && t - this.lastCommandAt >= o.cooldownMs) {
      this.state = 'FIRED'; this.fired = pose; this.candidate = null; this.count = 0;
      if (pose === 'pinch') { this.grabbing = true; out.push({ type: 'GRAB_START', t, point: frame.point }); }
      else { out.push({ type: COMMAND[pose], t, pose }); this.lastCommandAt = t; }
    }
    return out;
  }
}
