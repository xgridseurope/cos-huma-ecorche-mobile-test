/* ===== COS HUMA Écorché B v1.5.0 — phone & tablet layout (2026-11-09) =====================
   UI only. This module never writes mesh positions, the region registry, the textbook mapping
   or the TransformController. It moves the CAMERA (distance + view offset) and lays out labels.
   Layout model, reused from cos-huma-test v0.7 (M1.1, "21 labels x 6 states x 3 viewports"):
   two label columns beside the body, stacked by the anchor's screen y and pushed back up when
   they run past the bottom; the camera fit leaves the label columns free so names never sit on
   the body. New here: measured column widths, font steps, 2-line wrap, extra sub-columns when a
   column is taller than the free band (landscape phones), and a self-check report. */
const M_SMALL = () => innerWidth <= 1050;                     // below this the desktop callouts never ran
const M_PHONE = () => Math.min(innerWidth, innerHeight) < 600;
const M_COMPACT_HEAD = () => innerWidth < 1100;
const M_TXT = {
  ca: { all: 'Totes les etiquetes', tap: 'Toca per identificar', hide: 'Amaga les etiquetes', allS: 'Totes', tapS: 'Toca', hideS: 'Amagades', labels: 'Etiquetes', list: 'Llista', more: 'Més', menu: 'Menú', tapHint: 'Toca una part del cos per veure el nom.', hiddenHint: 'Noms amagats: toca una part per il·luminar-la.', read: '📖 Text del llibre', parts: 'parts', bone: 'Os', muscle: 'Múscul', regions: { head: 'Cap', trunk: 'Tronc', armLeft: 'Braç esquerre', armRight: 'Braç dret', legLeft: 'Cama esquerra', legRight: 'Cama dreta', arms: 'Braços', legs: 'Cames' } },
  es: { all: 'Todas las etiquetas', tap: 'Toca para identificar', hide: 'Ocultar etiquetas', allS: 'Todas', tapS: 'Toca', hideS: 'Ocultas', labels: 'Etiquetas', list: 'Lista', more: 'Más', menu: 'Menú', tapHint: 'Toca una parte del cuerpo para ver su nombre.', hiddenHint: 'Nombres ocultos: toca una parte para iluminarla.', read: '📖 Texto del libro', parts: 'partes', bone: 'Hueso', muscle: 'Músculo', regions: { head: 'Cabeza', trunk: 'Tronco', armLeft: 'Brazo izquierdo', armRight: 'Brazo derecho', legLeft: 'Pierna izquierda', legRight: 'Pierna derecha', arms: 'Brazos', legs: 'Piernas' } },
  zh: { all: '全部名称', tap: '点击显示', hide: '隐藏名称', allS: '全部', tapS: '点击', hideS: '隐藏', labels: '标签', list: '列表', more: '更多', menu: '菜单', tapHint: '点身体的某个部位，看它的名字。', hiddenHint: '名称已隐藏：点部位会高亮。', read: '📖 课本内容', parts: '个部分', bone: '骨骼', muscle: '肌肉', regions: { head: '头部', trunk: '躯干', armLeft: '左臂', armRight: '右臂', legLeft: '左腿', legRight: '右腿', arms: '双臂', legs: '双腿' } },
  en: { all: 'All names', tap: 'Tap to identify', hide: 'Hide names', allS: 'All', tapS: 'Tap', hideS: 'Hidden', labels: 'Labels', list: 'List', more: 'More', menu: 'Menu', tapHint: 'Tap a part of the body to see its name.', hiddenHint: 'Names hidden: tap a part to light it up.', read: '📖 Textbook text', parts: 'parts', bone: 'Bone', muscle: 'Muscle', regions: { head: 'Head', trunk: 'Trunk', armLeft: 'Left arm', armRight: 'Right arm', legLeft: 'Left leg', legRight: 'Right leg', arms: 'Arms', legs: 'Legs' } },
  fr: { all: 'Tous les noms', tap: 'Touche pour identifier', hide: 'Cacher les noms', allS: 'Tous', tapS: 'Touche', hideS: 'Cachés', labels: 'Étiquettes', list: 'Liste', more: 'Plus', menu: 'Menu', tapHint: 'Touche une partie du corps pour voir son nom.', hiddenHint: 'Noms cachés : touche une partie pour l’éclairer.', read: '📖 Texte du livre', parts: 'parties', bone: 'Os', muscle: 'Muscle', regions: { head: 'Tête', trunk: 'Tronc', armLeft: 'Bras gauche', armRight: 'Bras droit', legLeft: 'Jambe gauche', legRight: 'Jambe droite', arms: 'Bras', legs: 'Jambes' } },
};
const mT = () => M_TXT[lang] || M_TXT.ca;
const MOB = { labelMode: null, userPicked: false, homed: false, lastHomeKey: '', report: null, view: null };
const M_ICON = { all: '🏷️', tap: '👆', hide: '🙈' };

// ---------- label modes ------------------------------------------------------------------
// all  = every textbook label beside the body (desktop behaviour, now also on small screens)
// tap  = no labels; tapping a part shows its name on the pin and in the info strip
// hide = no names anywhere (self-test / memory); tapping still highlights
function mSetLabelMode(m, byUser) {
  MOB.labelMode = m; if (byUser) MOB.userPicked = true;
  showCallouts = m === 'all';
  document.body.classList.toggle('names-hidden', m === 'hide');
  document.body.classList.toggle('lbl-all', m === 'all');
  document.body.classList.toggle('lbl-tap', m === 'tap');
  mLabelText(); mHome(false); mInfo(); requestDraw();
}
function mLabelText() {
  const t = mT(), m = MOB.labelMode || 'all';
  const b = $('#toggleLabels'); if (b) { b.textContent = `${M_ICON[m]} ${t.labels}: ${t[m + 'S']}`; b.setAttribute('aria-pressed', String(m === 'all')); b.title = `${t.all} → ${t.tap} → ${t.hide}`; }
  const d = $('#mDockLabels'); if (d) { d.textContent = `${M_ICON[m]} ${t[m + 'S']}`; d.title = t[m]; d.setAttribute('aria-label', `${t.labels}: ${t[m]}`); }
  const l = $('#mDockList'); if (l) l.textContent = '☰ ' + t.list;
  const r = $('#mDockReset'); if (r) r.textContent = '↺';
  if (r) r.setAttribute('aria-label', $('#reset')?.textContent || 'Reset');
  const mo = $('#mDockMore'); if (mo) mo.textContent = '⋯ ' + t.more;
  const mm = $('#mMenuBtn'); if (mm) mm.setAttribute('aria-label', t.menu);
}
const M_NEXT = { all: 'tap', tap: 'hide', hide: 'all' };
$('#toggleLabels').onclick = () => mSetLabelMode(M_NEXT[MOB.labelMode || 'all'], true);

// ---------- measured label column width (used by the camera fit and the layout) ------------
const mCanvas = document.createElement('canvas').getContext('2d');
function mFontPx() { const w = Math.min(innerWidth, 1.4 * innerHeight); return w >= 760 ? 14 : w >= 400 ? 12 : 11; }
function mColW() {
  if (!M_SMALL() || MOB.labelMode !== 'all') return 0;
  const fs = mFontPx(); mCanvas.font = `700 ${fs}px Nunito, system-ui, sans-serif`;
  let widest = 0; getRecords().forEach((_, i) => { widest = Math.max(widest, mCanvas.measureText(displayName(i)).width); });
  // portrait: narrow columns, long names wrap onto 2 lines; landscape phones: wide columns, short height
  const cap = Math.round(innerWidth * (innerWidth > innerHeight ? (M_PHONE() ? 0.34 : 0.2) : M_PHONE() ? 0.25 : 0.2));
  // how many sub-columns a side will need in the free height (landscape phones); widen the column for them
  const perSide = Math.ceil(getRecords().length / 2) + 1, rowH = fs * 1.2 + 12;
  const bandH = Math.max(120, innerHeight - (($('header')?.offsetHeight) || 55) - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-h')) || 96) - 70);
  const need = innerWidth > innerHeight ? Math.max(1, Math.ceil(perSide * rowH / bandH)) : 1;
  return Math.min(need * (Math.ceil(widest) + 20) + (need - 1) * 4, Math.max(cap, 74));
}

// ---------- free area for the body (CSS px, relative to the canvas) ------------------------
function mFree() {
  const vr = renderer.domElement.getBoundingClientRect(); const W = vr.width, H = vr.height;
  let top = 6, bottom = H - 6;
  const vis = (el) => el && el.offsetParent !== null && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  const tr = $('#left>section:first-child'); if (M_SMALL() && vis(tr)) top = Math.max(top, tr.getBoundingClientRect().bottom - vr.top + 8);
  const det = $('#detail'); if (M_SMALL() && vis(det)) bottom = Math.min(bottom, (det.dataset.collapsedTop ? +det.dataset.collapsedTop : det.getBoundingClientRect().top) - vr.top - 8);
  // an open learning panel (bottom sheet) also limits the free area, unless folded
  if (M_SMALL()) for (const id of ['#quizPanel', '#activities', '#assemblyPanel']) { const p = $(id); if (vis(p) && !p.hidden && !p.classList.contains('m-min')) bottom = Math.min(bottom, p.getBoundingClientRect().top - vr.top - 8); }
  const col = mColW(); const side = col ? col + 10 : 10;
  return { W, H, x0: side, x1: W - side, y0: top, y1: bottom, col };
}

// ---------- camera home view: whole body inside the free area ------------------------------
// Only the camera moves (distance, target, view offset). Mesh transforms are untouched.
let mBox = null;
function mModelBox() { if (!mBox && root) { mBox = new THREE.Box3().setFromObject(root); } return mBox; }
function mApplyViewOffset() {
  const vr = renderer.domElement.getBoundingClientRect();
  if (!M_SMALL() || !MOB.view) { if (camera.view && camera.view.enabled) { camera.clearViewOffset(); } return; }
  const W = Math.round(vr.width), H = Math.round(vr.height);
  camera.setViewOffset(W, H, Math.round(W / 2 - MOB.view.cx), Math.round(H / 2 - MOB.view.cy), W, H);
}
function mHome(force) {
  if (!M_SMALL()) { MOB.view = null; mApplyViewOffset(); if (force) { controls.target.set(0, .85, 0); camera.position.set(0, 1, 3.9); controls.update(); } requestDraw(); return; }
  if (!loadOK || !root) return;
  const f = mFree(), b = mModelBox(); if (!b || f.x1 - f.x0 < 60 || f.y1 - f.y0 < 80) return;
  const size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const fw = f.x1 - f.x0, fh = f.y1 - f.y0;
  const dH = size.y * f.H / (2 * tan * fh), dW = Math.max(size.x, size.z) * f.H / (2 * tan * fw);
  const d = Math.max(dH, dW) * 1.03 + size.z / 2;
  MOB.view = { cx: (f.x0 + f.x1) / 2, cy: (f.y0 + f.y1) / 2 };
  const key = [Math.round(f.W), Math.round(f.H), Math.round(f.x0), Math.round(f.y0), Math.round(f.y1)].join(',');
  // inside a learning mode the mode owns the camera (game zoom, assembly view): never re-home there
  const busy = /\b(quiz-active|activity-active|assembly-active|basic-question-active)\b/.test(document.body.className);
  if (busy && !force) { mViewOnly(); return; }
  if (force || !MOB.homed || key !== MOB.lastHomeKey) {
    // keep the current turn (front/back) but restore distance and centre
    const dir = camera.position.clone().sub(controls.target); dir.y = 0; if (dir.lengthSq() < 1e-8 || force) dir.set(0, 0, 1); dir.normalize();
    controls.target.copy(c); camera.position.copy(c).addScaledVector(dir, d);
    controls.minDistance = Math.min(controls.minDistance, d * .25); controls.maxDistance = Math.max(controls.maxDistance, d * 2.2);
    MOB.homed = true; MOB.lastHomeKey = key; MOB.homeDist = d;
  }
  mApplyViewOffset(); camera.updateProjectionMatrix(); controls.update(); requestDraw();
}

// ---------- small-screen labels -----------------------------------------------------------
const M_NS = 'http://www.w3.org/2000/svg';
function mPillClass(i) { return 'callout ' + (currentPage === 25 ? (i < 2 ? 'cap' : [2, 3, 4, 5, 6, 7].includes(i) ? '' : 'ext') : (i < 2 ? 'cap' : [2, 3, 4, 5, 6, 7, 8].includes(i) ? '' : 'ext')) + (chosen === i ? ' selected' : ''); }
function mLayoutCallouts(rect, w, h) {
  const f = mFree(); const col = f.col; if (!col) return;
  const vr = renderer.domElement.getBoundingClientRect();   // overlays share the canvas box exactly
  for (const el of [calloutLabels, calloutLines]) { el.style.top = vr.top + 'px'; el.style.height = vr.height + 'px'; }
  const band = { top: Math.max(4, f.y0 - 2), bottom: f.y1 };
  const groups = { L: [], R: [] };
  getRecords().forEach((_, i) => { const a = bestAnchor(recordHits(i)); if (!a) return; groups[leftGroup.has(i) ? 'L' : 'R'].push({ i, x: a.x, y: a.y }); });
  calloutLines.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const placed = [];
  let fs = mFontPx();
  // build pills once, then try font steps until every column fits the band
  const make = (e, side) => { const p = document.createElement('button'); p.type = 'button'; p.className = mPillClass(e.i) + ' m-pill'; p.textContent = displayName(e.i); p.setAttribute('aria-label', displayName(e.i)); p.onclick = () => pickRecord(e.i); p.dataset.side = side; calloutLabels.appendChild(p); e.el = p; };
  for (const s of ['L', 'R']) for (const e of groups[s].sort((a, b) => a.y - b.y)) make(e, s);
  const all = [...groups.L, ...groups.R];
  let sub = 1, gap = 3;
  for (let attempt = 0; attempt < 8; attempt++) {
    for (const e of all) { e.el.style.fontSize = fs + 'px'; e.el.style.maxWidth = Math.floor((col - 4 * (sub - 1)) / sub) + 'px'; }
    const tall = Math.max(...['L', 'R'].map((s) => groups[s].reduce((t, e) => t + e.el.offsetHeight + gap, 0)));
    if (tall / sub <= band.bottom - band.top || attempt === 7) break;
    if (fs > 10) fs -= 1; else { sub += 1; }
  }
  for (const side of ['L', 'R']) {
    const g = groups[side];
    for (let k = 0; k < sub; k++) {
      // k = 0 is the column nearest the body; items alternate so each sub-column covers the whole height
      const part = g.filter((_, j) => j % sub === k);
      // spread each sub-column over the band, in anchor order (lines stay roughly parallel)
      let prev = band.top - gap;
      for (const e of part) { const hh = e.el.offsetHeight; e.ly = Math.max(band.top, e.y - hh / 2, prev + gap); prev = e.ly + hh; }
      const excess = prev - band.bottom; if (excess > 0) { let lim = band.bottom; for (let j = part.length - 1; j >= 0; j--) { const e = part[j]; e.ly = Math.min(e.ly, lim - e.el.offsetHeight); lim = e.ly - gap; } }
      const cw = Math.floor((col - 4 * (sub - 1)) / sub);
      for (const e of part) {
        const pw = e.el.offsetWidth, ph = e.el.offsetHeight;
        const kk = sub - 1 - k; // outermost slot index from the screen edge
        const slot = side === 'L' ? 6 + kk * (cw + 4) : w - 6 - (kk + 1) * (cw + 4) + 4;
        const bx = side === 'L' ? slot + cw - pw : slot;
        e.el.style.left = bx + 'px'; e.el.style.top = e.ly + 'px';
        const ex = side === 'L' ? bx + pw : bx, ey = e.ly + ph / 2;
        const line = document.createElementNS(M_NS, 'line'); line.setAttribute('x1', e.x); line.setAttribute('y1', e.y); line.setAttribute('x2', ex); line.setAttribute('y2', ey); calloutLines.appendChild(line);
        const dot = document.createElementNS(M_NS, 'circle'); dot.setAttribute('cx', e.x); dot.setAttribute('cy', e.y); dot.setAttribute('r', chosen === e.i ? 5 : 2.7); calloutLines.appendChild(dot);
        placed.push({ i: e.i, side, x: bx, y: e.ly, w: pw, h: ph, ax: e.x, ay: e.y, ex, ey, fs, sub });
      }
    }
  }
  MOB.report = { placed, band, col, fs, sub, w, h };
}

// ---------- self-check: overlaps, clipping, crossings, collisions with UI (honest numbers) --
function mSeg(a, b, c, d) { const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; }
function mLabelReport() {
  const vr = renderer.domElement.getBoundingClientRect();
  const pills = [...calloutLabels.querySelectorAll('.callout')].map((p) => { const r = p.getBoundingClientRect(); return { i: p.textContent, l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  const expected = getRecords().length;
  let overlaps = 0; for (let a = 0; a < pills.length; a++) for (let b = a + 1; b < pills.length; b++) { const p = pills[a], q = pills[b]; if (p.l < q.r - 1 && q.l < p.r - 1 && p.t < q.b - 1 && q.t < p.b - 1) overlaps++; }
  const clipped = pills.filter((p) => p.l < 0 || p.t < vr.top - 1 || p.r > innerWidth || p.b > vr.bottom + 1).length;
  const ui = ['#dock', '#detail', '#left>section:first-child', 'header'].map((s) => $(s)).filter((e) => e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden').map((e) => e.getBoundingClientRect());
  const underUI = pills.filter((p) => ui.some((u) => p.l < u.right && u.left < p.r && p.t < u.bottom && u.top < p.b)).length;
  const lines = [...calloutLines.querySelectorAll('line')].map((l) => ({ a: { x: +l.getAttribute('x1'), y: +l.getAttribute('y1') }, b: { x: +l.getAttribute('x2'), y: +l.getAttribute('y2') } }));
  let crossings = 0; for (let a = 0; a < lines.length; a++) for (let b = a + 1; b < lines.length; b++) if (mSeg(lines[a].a, lines[a].b, lines[b].a, lines[b].b)) crossings++;
  const minFont = Math.min(...[...calloutLabels.querySelectorAll('.callout')].map((p) => parseFloat(getComputedStyle(p).fontSize)));
  return { mode: MOB.labelMode, page: currentPage, expected, shown: pills.length, overlaps, clipped, underUI, crossings, minFont: Number.isFinite(minFont) ? minFont : null, subColumns: MOB.report?.sub ?? null, colW: mColW() };
}

// ---------- info strip (small screens): name · region · tissue, tap to expand ------------
function mRegionText(hits) {
  const t = mT(); if (!hits.length || !REG) return '';
  const set = new Set(hits.map((o) => REG.regionOf.get(meshKey(o))).filter(Boolean));
  const out = []; if (set.has('armLeft') && set.has('armRight')) { out.push(t.regions.arms); set.delete('armLeft'); set.delete('armRight'); }
  if (set.has('legLeft') && set.has('legRight')) { out.push(t.regions.legs); set.delete('legLeft'); set.delete('legRight'); }
  for (const r of ['head', 'trunk', 'armLeft', 'armRight', 'legLeft', 'legRight']) if (set.has(r)) out.push(t.regions[r]);
  return out.join(' · ');
}
function mInfo() {
  const box = $('#mInfo'); if (!box) return; const t = mT();
  if (chosen < 0) { box.textContent = MOB.labelMode === 'hide' ? t.hiddenHint : t.tapHint; $('#detail').classList.remove('m-has-pick'); return; }
  const hits = recordHits(chosen); const tissue = currentPage === 25 ? t.bone : t.muscle;
  box.textContent = [mRegionText(hits), tissue, hits.length ? `${hits.length} ${t.parts}` : ''].filter(Boolean).join(' · ');
  $('#detail').classList.add('m-has-pick');
  $('#mRead').textContent = t.read;
}

// ---------- compact chrome: header menu, dock buttons, info strip -------------------------
function mBuildChrome() {
  // header: brand line + menu button (language select moves next to it on compact screens)
  const brand = $('.brand'); if (brand && !$('#mBrand')) { const s = document.createElement('span'); s.id = 'mBrand'; s.innerHTML = 'COS HUMÀ <small>· by <b>EMILY</b></small>'; brand.appendChild(s); }
  const head = $('header'); if (head && !$('#mHeadRight')) { const r = document.createElement('div'); r.id = 'mHeadRight'; r.innerHTML = '<button class="topbtn" id="mMenuBtn" type="button" aria-expanded="false" aria-controls="mMenuPanel">⋯</button>'; head.appendChild(r); }
  $('#mMenuBtn').onclick = (e) => { e.stopPropagation(); const open = !document.body.classList.contains('m-menu-open'); document.body.classList.toggle('m-menu-open', open); $('#mMenuBtn').setAttribute('aria-expanded', String(open)); };
  $('.headActions').id = 'mMenuPanel';
  $('.headActions').addEventListener('click', (e) => { if (e.target.closest('button')) { document.body.classList.remove('m-menu-open'); $('#mMenuBtn').setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('pointerdown', (e) => { if (document.body.classList.contains('m-menu-open') && !e.target.closest('.headActions,#mMenuBtn')) { document.body.classList.remove('m-menu-open'); $('#mMenuBtn').setAttribute('aria-expanded', 'false'); } });
  // dock: labels mode, list, reset, more (the less used tools fold into "more" on phones)
  const dock = $('#dock');
  const add = (id, cls) => { if ($('#' + id)) return $('#' + id); const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'ctrl m-only ' + (cls || ''); dock.appendChild(b); return b; };
  add('mDockLabels').onclick = () => $('#toggleLabels').click();
  add('mDockList').onclick = () => { $('#togglePanel').click(); };
  add('mDockReset').onclick = () => $('#reset').click();
  add('mDockMore').onclick = () => { const o = !dock.classList.contains('m-more-open'); dock.classList.toggle('m-more-open', o); $('#mDockMore').setAttribute('aria-expanded', String(o)); mHome(false); };
  for (const s of ['[data-mode="both"]', '#zoomSelection', '#freeExplode', '#freeRestore', '#xrayWrap']) $(s)?.classList.add('m-fold');
  // info strip inside #detail
  const det = $('#detail');
  if (!$('#mInfo')) {
    const i = document.createElement('div'); i.id = 'mInfo'; i.className = 'mini'; det.insertBefore(i, $('#partSubtitle'));
    const x = document.createElement('button'); x.type = 'button'; x.id = 'mExpand'; x.className = 'm-expand'; x.setAttribute('aria-expanded', 'false'); x.textContent = '⌃'; det.appendChild(x);
    const r = document.createElement('button'); r.type = 'button'; r.id = 'mRead'; r.className = 'ctrl m-read'; det.appendChild(r);
    x.onclick = () => { const o = !det.classList.contains('m-open'); det.classList.toggle('m-open', o); x.setAttribute('aria-expanded', String(o)); x.textContent = o ? '⌄' : '⌃'; };
    r.onclick = () => $('#knowledgeBtn').click();
  }
  for (const host of [$('.headActions'), $('#detail')]) { if (!host.querySelector('.m-credit')) { const c = $('#footer').cloneNode(true); c.removeAttribute('id'); c.className = 'm-credit'; host.appendChild(c); } }
  // learning panels on small screens: a ⌄ button folds the panel to its title so the lit part is visible
  for (const id of ['quizPanel', 'activities', 'assemblyPanel']) {
    const pnl = $('#' + id); if (!pnl || pnl.querySelector('.m-min-btn')) continue;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'm-min-btn'; b.textContent = '⌄'; b.setAttribute('aria-expanded', 'true');
    b.onclick = () => { const m = !pnl.classList.contains('m-min'); pnl.classList.toggle('m-min', m); b.textContent = m ? '⌃' : '⌄'; b.setAttribute('aria-expanded', String(!m)); };
    pnl.prepend(b);
  }
  // list drawer: picking a name closes the drawer so the lit part is visible (phones)
  $('#items').addEventListener('click', () => { if (M_PHONE() && listOpen) setTimeout(() => $('#togglePanel').click(), 120); });
}
function mLayout() {
  const compact = M_COMPACT_HEAD();
  document.body.classList.toggle('m-compact', compact);
  document.body.classList.toggle('m-small', M_SMALL());
  document.body.classList.toggle('m-phone', M_PHONE());
  document.body.classList.toggle('m-land', innerWidth > innerHeight);
  // language select sits in the header bar on compact screens, in the action row otherwise
  const lang = $('#lang'), lab = $('label[for="lang"]'), right = $('#mHeadRight');
  if (compact && lang.parentElement !== right) { right.insertBefore(lang, $('#mMenuBtn')); if (lab) right.insertBefore(lab, lang); }
  if (!compact && lang.parentElement === right) { const ha = $('.headActions'); if (lab) ha.insertBefore(lab, ha.firstChild); ha.insertBefore(lang, lab ? lab.nextSibling : ha.firstChild); document.body.classList.remove('m-menu-open'); }
  if (!MOB.userPicked) mSetLabelMode(M_PHONE() && innerWidth < innerHeight ? 'tap' : 'all', false);
  // sizes first (the info strip sits on --dock-h), then read the strip position
  document.documentElement.style.setProperty('--dock-h', Math.round($('#dock').getBoundingClientRect().height) + 'px');
  document.documentElement.style.setProperty('--head-h', Math.round($('header').getBoundingClientRect().height) + 'px');
  const det = $('#detail'); delete det.dataset.collapsedTop;
  if (M_SMALL() && !det.classList.contains('m-open')) det.dataset.collapsedTop = String(det.getBoundingClientRect().top);
  if (!M_SMALL()) for (const el of [calloutLabels, calloutLines]) { el.style.top = ''; el.style.height = ''; }
  resize();
}
// load failure or ?dev: the manual GLB loader becomes visible again
if (new URLSearchParams(location.search).has('dev')) document.body.classList.add('m-dev');
{ const _failed = failed; failed = (...a) => { document.body.classList.add('m-load-failed'); return _failed(...a); }; }
{ const _pick = pickRecord; pickRecord = (...a) => { const r = _pick(...a); mInfo(); return r; }; }
mBuildChrome(); mLayout();
{ let rq = 0, lastOrient = innerWidth > innerHeight; const relayout = () => { rq = 0; const o = innerWidth > innerHeight; mLayout(); mHome(o !== lastOrient); lastOrient = o; };
  addEventListener('resize', () => { if (!rq) rq = requestAnimationFrame(relayout); });
  $('#lang').addEventListener('change', () => requestAnimationFrame(() => { mLayout(); mHome(false); }));   // longer words can wrap the dock
  if (window.visualViewport) visualViewport.addEventListener('resize', () => { if (!rq) rq = requestAnimationFrame(relayout); });
  new ResizeObserver(() => { if (!rq) rq = requestAnimationFrame(relayout); }).observe($('#dock')); }
function mBodyBox() { // screen box (CSS px, viewport coords) of all visible meshes
  const vr = renderer.domElement.getBoundingClientRect(); const bx = new THREE.Box3(), v = new THREE.Vector3(); let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
  for (const o of objects) { if (!o.visible) continue; let p = o, vis = true; while (p) { if (p.visible === false) { vis = false; break; } p = p.parent; } if (!vis) continue;
    bx.setFromObject(o); for (let k = 0; k < 8; k++) { v.set(k & 1 ? bx.max.x : bx.min.x, k & 2 ? bx.max.y : bx.min.y, k & 4 ? bx.max.z : bx.min.z).project(camera); const x = vr.left + (v.x * .5 + .5) * vr.width, y = vr.top + (-v.y * .5 + .5) * vr.height; l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); } }
  return { left: Math.round(l), top: Math.round(t), right: Math.round(r), bottom: Math.round(b) };
}
// panels opening/closing: only the view centre follows (no distance, rotation or model change)
function mViewOnly() { if (!M_SMALL() || !loadOK) return;
  const f = mFree(); if (f.y1 - f.y0 < 60) return; MOB.view = { cx: (f.x0 + f.x1) / 2, cy: (f.y0 + f.y1) / 2 }; mApplyViewOffset(); camera.updateProjectionMatrix(); requestDraw(); }
{ let q = 0; const mo = new MutationObserver(() => { if (!q) q = requestAnimationFrame(() => { q = 0; mViewOnly(); }); });
  for (const id of ['#quizPanel', '#activities', '#assemblyPanel']) { const p = $(id); if (p) mo.observe(p, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] }); }
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] }); }
window.COS_HUMA_MOBILE = { cam: () => ({ pos: camera.position.toArray().map((v) => +v.toFixed(3)), target: controls.target.toArray().map((v) => +v.toFixed(3)), view: camera.view && camera.view.enabled ? [camera.view.offsetX, camera.view.offsetY, camera.view.fullWidth, camera.view.fullHeight] : null, near: camera.near, far: camera.far, box: mModelBox() && [mModelBox().min.toArray().map((v) => +v.toFixed(3)), mModelBox().max.toArray().map((v) => +v.toFixed(3))] }), bodyBox: mBodyBox, setLabelMode: (m) => mSetLabelMode(m, true), get labelMode() { return MOB.labelMode; }, labelReport: mLabelReport, home: () => mHome(true), free: mFree, get state() { return { ...MOB, small: M_SMALL(), phone: M_PHONE(), compact: M_COMPACT_HEAD() }; } };
