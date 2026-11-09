// ===== v1.5.0 Phase 2 · Gesture Pipeline =====
// One pipeline for live camera frames AND for replaying a recording, so a device recording can
// be re-run offline and must give the same poses and commands.
// Input per frame:  { t, hands: [{ raw: 'Left'|'Right', score, world: [[x,y,z]×21], image?: [[x,y,z]×21] }] }
// Output per frame: { t, hands: [{ label, raw, pose, confidence, features }], primary, commands: [...] }
// No 3D access of any kind.
import { classify, resolveHand, LandmarkSmoother, RECOGNIZER_VERSION, TH } from './recognizer.js';
import { GestureStateMachine, SM_VERSION, DEFAULTS } from './state-machine.js';

export const PIPELINE_VERSION = 'p2';
const toPts = (arr) => arr.map((q) => ({ x: q[0], y: q[1], z: q[2] }));

export class GesturePipeline {
  constructor({ swap = false, oneHand = true, smoothing = 0.5, aspect = 4 / 3, sm = {} } = {}) {
    this.opts = { swap, oneHand, smoothing, aspect };
    this.imgSmoothers = { Left: new LandmarkSmoother(smoothing), Right: new LandmarkSmoother(smoothing) };
    this.sm = new GestureStateMachine(sm);
    this.smoothers = { Left: new LandmarkSmoother(smoothing), Right: new LandmarkSmoother(smoothing) };
    this.prevPose = { Left: 'neutral', Right: 'neutral' };
    this.primaryLabel = null;
  }
  get versions() { return { pipeline: PIPELINE_VERSION, recognizer: RECOGNIZER_VERSION, stateMachine: SM_VERSION, thresholds: { ...TH }, smDefaults: { ...DEFAULTS, ...this.sm.o }, opts: { ...this.opts } }; }
  setSwap(swap) { this.opts.swap = swap; this.reset(); }
  // Test protocol only: at the start of each scored window the state machine is released and
  // re-armed, so a pose already held during the prep countdown fires inside the window (or, in a
  // rest trial, shows up as the misfire it is) instead of being logged before performStart.
  // Landmark smoothing is kept. Live use never calls this. Replay calls it at the same instant.
  rearm() { this.sm.reset(); }
  reset() { this.sm.reset(); for (const s of [...Object.values(this.smoothers), ...Object.values(this.imgSmoothers)]) s.reset(); this.prevPose = { Left: 'neutral', Right: 'neutral' }; this.primaryLabel = null; }

  process(frame) {
    const seen = new Set(), hands = [];
    for (const h of frame.hands || []) {
      const label = resolveHand(h.raw, this.opts.swap);
      if (seen.has(label)) continue; seen.add(label);           // two detections with one label: keep the first
      const sm = this.smoothers[label] || (this.smoothers[label] = new LandmarkSmoother(this.opts.smoothing));
      const world = sm.push(toPts(h.world));
      const ism = this.imgSmoothers[label] || (this.imgSmoothers[label] = new LandmarkSmoother(this.opts.smoothing));
      const image = h.image && h.image.length === 21 ? ism.push(toPts(h.image)) : null;
      const r = classify({ world, image, aspect: this.opts.aspect }, this.prevPose[label] || 'neutral');
      this.prevPose[label] = r.pose;
      const tip = h.image ? { x: 1 - h.image[8][0], y: h.image[8][1] } : null;  // mirrored screen point of the index tip
      hands.push({ label, raw: h.raw, score: h.score, pose: r.pose, confidence: r.confidence, features: r.features, point: tip });
    }
    for (const k of Object.keys(this.smoothers)) if (!seen.has(k)) { this.smoothers[k].reset(); this.imgSmoothers[k]?.reset(); this.prevPose[k] = 'neutral'; }
    // One-hand mode: whichever single hand is visible drives the commands. With two hands visible,
    // keep the hand that was already driving; never switch mid-gesture.
    let primary = null;
    if (hands.length === 1) primary = hands[0];
    else if (hands.length > 1) primary = hands.find((h) => h.label === this.primaryLabel) || (this.opts.oneHand ? hands.reduce((a, b) => ((b.score || 0) > (a.score || 0) ? b : a)) : hands.find((h) => h.label === 'Left') || hands[0]);
    if (primary && this.primaryLabel && primary.label !== this.primaryLabel) this.sm.reset();
    this.primaryLabel = primary ? primary.label : this.primaryLabel;
    const commands = this.sm.step({ t: frame.t, pose: primary ? primary.pose : null, confidence: primary ? primary.confidence : 0, point: primary ? primary.point : null });
    return { t: frame.t, hands, primary: primary ? primary.label : null, commands, smState: this.sm.state };
  }
}

// ---- trial scoring shared by the lab page and the offline replay tool
export const EXPECTED = { open: ['EXPLODE'], fist: ['RESTORE'], pinch: ['GRAB_START'], rest: [] };
export function scoreTrials(trials) {
  const per = {}, confusion = {};
  const add = (k, f) => { per[k] ??= { n: 0, ok: 0, missed: 0, wrong: 0, extra: 0, latencies: [] }; f(per[k]); };
  for (const tr of trials) {
    const cmds = tr.commands.filter((c) => c.type !== 'GRAB_MOVE' && c.type !== 'GRAB_END' && c.t >= tr.performStart && c.t <= tr.performEnd + 600);
    const want = EXPECTED[tr.expected];
    add(tr.expected, (s) => {
      s.n++;
      if (tr.expected === 'rest') { if (cmds.length) s.wrong++; else s.ok++; return; }
      const right = cmds.filter((c) => c.type === want[0]), other = cmds.filter((c) => c.type !== want[0]);
      if (right.length === 1 && !other.length) { s.ok++; s.latencies.push(Math.round(right[0].t - tr.performStart)); }
      else if (!right.length && !other.length) s.missed++;
      else if (other.length) s.wrong++;
      else s.extra++;
    });
    // frame-level: the second half of the perform window, primary hand pose vs expected
    const mid = tr.performStart + (tr.performEnd - tr.performStart) / 2;
    confusion[tr.expected] ??= { open: 0, fist: 0, pinch: 0, neutral: 0, none: 0 };
    for (const f of tr.outputs) if (f.t >= mid && f.t <= tr.performEnd) {
      const p = f.hands.find((h) => h.label === f.primary)?.pose || 'none';
      confusion[tr.expected][p]++;
    }
  }
  const pct = (a, b) => (b ? +(a / b * 100).toFixed(1) : null);
  const summary = Object.fromEntries(Object.entries(per).map(([k, s]) => [k, k === 'rest'
    ? { trials: s.n, falseTriggerRate: pct(s.wrong, s.n) }
    : { trials: s.n, successRate: pct(s.ok, s.n), missRate: pct(s.missed, s.n), misfireRate: pct(s.wrong, s.n), duplicateRate: pct(s.extra, s.n), medianLatencyMs: s.latencies.length ? s.latencies.sort((x, y) => x - y)[Math.floor(s.latencies.length / 2)] : null }]));
  const frameAccuracy = Object.fromEntries(Object.entries(confusion).map(([k, c]) => {
    const tot = Object.values(c).reduce((x, y) => x + y, 0), want = k === 'rest' ? 'neutral' : k;
    return [k, { frames: tot, correct: pct(c[want], tot), confusion: c }];
  }));
  return { summary, frameAccuracy };
}
