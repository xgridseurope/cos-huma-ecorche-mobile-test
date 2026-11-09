// ===== v1.5.0 Phase 2 · Gesture Recognizer =====
// Pure function of one hand's landmarks. No DOM, no camera, no 3D: it only names the pose.
// Uses MediaPipe world landmarks (metres, hand-centred) when present, so the result does not
// depend on the camera aspect ratio or on how far the hand is from the camera.
// Landmarks: 0 wrist · thumb 1-4 · index 5-8 · middle 9-12 · ring 13-16 · pinky 17-20.
export const POSES = ['open', 'fist', 'pinch', 'neutral'];
export const RECOGNIZER_VERSION = 'r2';

// Thresholds. Straightness = |MCP→TIP| / (|MCP→PIP| + |PIP→DIP| + |DIP→TIP|):
// 1.0 for a straight finger, ~0.3 for a finger folded into a fist. It uses long distances,
// so it is far less sensitive to landmark jitter than joint angles on 1–2 cm phalanges.
export const TH = {
  extended: 0.87,     // finger counts as straight above this straightness
  openMin: 0.78,      // an open hand: ≥3 straight fingers and none below this
  openMean: 0.92,     // ...and a mean straightness above this (separates it from a relaxed hand)
  curled: 0.62,       // finger counts as curled below this straightness (between = half bent)
  pinchEnter: 0.30,   // thumb-tip–index-tip distance / palm length to enter pinch
  pinchExit: 0.42,    // ...and to leave it (hysteresis)
  openThumbGap: 0.45, // an open hand keeps thumb and index apart
  openSpread: 0.33,   // r2: an open hand has spread fingers (mean adjacent fingertip gap / palm);
                      //     a relaxed hand is nearly as straight but its fingers lie together (device 4080: rest p50 0.26)
  pinchImgEnter: 0.18, // r2: thumb-tip–index-tip distance / palm length, measured on the IMAGE landmarks.
  pinchImgExit: 0.24,  //     World landmarks put touching tips 0.5–0.9 palm apart (device 4080), the image does not.
  pinchTipContact: 0.70, // r2: the thumb must be nearer the index TIP than the index DIP/PIP (ratio of the two);
                         //     a relaxed thumb lies against the side of the index (device 4080: pinch p90 0.56, rest p50 0.70)
};

const sub = (a, b) => [a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
function angle(a, b) { const la = len(a), lb = len(b); if (!la || !lb) return 0; let c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb); c = Math.max(-1, Math.min(1, c)); return Math.acos(c) * 180 / Math.PI; }
const dist = (p, i, j) => len(sub(p[i], p[j]));

// image landmarks are normalised to width/height; correct the aspect ratio before measuring
function fromImage(pts, aspect) { return pts.map((p) => ({ x: p.x * aspect, y: p.y, z: (p.z || 0) * aspect })); }

export function fingerStraightness(p) {
  return [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]].map(([m, pi, d, t]) => {
    const chain = len(sub(p[pi], p[m])) + len(sub(p[d], p[pi])) + len(sub(p[t], p[d]));
    return chain > 0 ? len(sub(p[t], p[m])) / chain : 0;
  });
}
// joint bends in degrees (diagnostics only)
export function fingerBends(p) {
  const f = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
  return f.map(([m, pi, d, t]) => angle(sub(p[pi], p[m]), sub(p[d], p[pi])) + angle(sub(p[d], p[pi]), sub(p[t], p[d])));
}

// hand: { world?: [21 {x,y,z}], image?: [21 {x,y,z}], aspect?: number }
// prev: previous pose of the same hand (for hysteresis)
export function classify(hand, prev = 'neutral') {
  const p = hand.world && hand.world.length === 21 ? hand.world : fromImage(hand.image, hand.aspect || 4 / 3);
  const palm = Math.max(dist(p, 0, 9), 1e-6);
  const bends = fingerBends(p), straight = fingerStraightness(p);
  const ext = straight.map((v) => v > TH.extended), curl = straight.map((v) => v < TH.curled);
  const nExt = ext.filter(Boolean).length, nCurl = curl.filter(Boolean).length;
  const worldRatio = dist(p, 4, 8) / palm;
  // r2: thumb–index contact is judged on the image landmarks when present (aspect-corrected 2D)
  let tipContact = 0, pinchRatio = worldRatio, enter = TH.pinchEnter, exit = TH.pinchExit;
  if (hand.image && hand.image.length === 21) {
    const a = hand.aspect || 4 / 3, d2 = (i, j) => Math.hypot((hand.image[i].x - hand.image[j].x) * a, hand.image[i].y - hand.image[j].y);
    const palm2 = Math.max(d2(0, 9), 1e-6);
    pinchRatio = d2(4, 8) / palm2; enter = TH.pinchImgEnter; exit = TH.pinchImgExit;
    tipContact = d2(4, 8) / Math.max(Math.min(d2(4, 7), d2(4, 6)), 1e-6);
  }
  const spread = (dist(p, 8, 12) + dist(p, 12, 16) + dist(p, 16, 20)) / 3 / palm;
  const pinchLimit = prev === 'pinch' ? exit : enter;
  let pose = 'neutral';
  // Pinch = thumb tip on index tip while the hand is NOT a fist (v1.4.0 confused the two: a fist
  // also brings the thumb close to the index). r2: the other fingers may be relaxed, not only straight.
  if (pinchRatio < pinchLimit && tipContact < TH.pinchTipContact && !curl[0] && nCurl < 3) pose = 'pinch';
  if (pose === 'neutral' && nCurl >= 3 && curl[0]) pose = 'fist';
  const meanStraight = straight.reduce((x, y) => x + y, 0) / 4;
  if (pose === 'neutral' && nExt >= 3 && Math.min(...straight) > TH.openMin && meanStraight > TH.openMean && worldRatio > TH.openThumbGap && spread > TH.openSpread) pose = 'open';
  // confidence: how far the deciding measurements are from their thresholds (0..1)
  const margin = pose === 'open' ? (Math.min(...straight) - TH.openMin) / (1 - TH.openMin) * 0.5
    : pose === 'fist' ? Math.min(...straight.slice(0, 3).map((v) => (TH.curled - v) / TH.curled))
    : pose === 'pinch' ? (pinchLimit - pinchRatio) / pinchLimit : 0;
  return { pose, confidence: Math.max(0, Math.min(1, 0.5 + margin)), features: { straight: straight.map((v) => +v.toFixed(2)), bends: bends.map((b) => Math.round(b)), pinchRatio: +pinchRatio.toFixed(3), spread: +spread.toFixed(3), nExt, nCurl } };
}

// MediaPipe handedness may refer to a mirrored or a non-mirrored picture depending on the
// version and the input. Never assume: the calibration step measures it on the device.
export function resolveHand(label, swap) {
  if (!swap) return label;
  return label === 'Left' ? 'Right' : label === 'Right' ? 'Left' : label;
}

// Exponential smoothing of landmarks over consecutive frames of the same hand. Real MediaPipe
// jitter is largest on small, distant hands (children); smoothing halves it at ~1 frame of lag.
export class LandmarkSmoother {
  constructor(alpha = 0.5) { this.alpha = alpha; this.prev = null; }
  reset() { this.prev = null; }
  push(pts) {
    if (!pts) { this.prev = null; return null; }
    if (!this.prev || this.prev.length !== pts.length) { this.prev = pts.map((p) => ({ x: p.x, y: p.y, z: p.z || 0 })); return this.prev; }
    const a = this.alpha;
    this.prev = pts.map((p, i) => ({ x: a * p.x + (1 - a) * this.prev[i].x, y: a * p.y + (1 - a) * this.prev[i].y, z: a * (p.z || 0) + (1 - a) * this.prev[i].z }));
    return this.prev;
  }
}
