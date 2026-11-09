// Phone / tablet / desktop layout acceptance (headless Chrome emulation — NOT a real-device test).
// Usage: node tools/test_mobile.mjs [viewportName ...]
import { openPage } from './browser.mjs';
import fs from 'node:fs';
const VP = {
  a360: [360, 800, true], a390: [390, 844, true], a412: [412, 915, true], a430: [430, 932, true],
  ipadP: [820, 1180, true], ipadL: [1180, 820, true], desk: [1920, 1080, false], a412L: [915, 412, true],
};
const only = process.argv.slice(2); const out = {}; fs.mkdirSync('evidence/mobile', { recursive: true });
const shot = (page, n) => page.screenshot({ path: `evidence/mobile/${n}.png` });
for (const [name, [w, h, mobile]] of Object.entries(VP)) {
  if (only.length && !only.includes(name)) continue;
  const { browser, page, consoleLines } = await openPage(process.cwd() + '/v150', 'index.html', { viewport: { width: w, height: h }, mobile });
  const R = { viewport: `${w}x${h}`, checks: {} };
  try {
    await page.waitForFunction(() => window.COS_HUMA_B?.status?.loaded, null, { timeout: 120000 });
    // basic levels passed (as in test_welcome_routes R2) so games and assembly panels can be opened
    await page.evaluate(() => localStorage.setItem('cos_huma_b_intro_v123', JSON.stringify({ 25: { mc: true, tf: true }, 27: { mc: true, tf: true } })));
    await page.reload(); await page.waitForFunction(() => window.COS_HUMA_B?.status?.loaded, null, { timeout: 120000 });
    // welcome
    await page.waitForTimeout(600); await shot(page, `${name}_00_welcome`);
    R.welcome = await page.evaluate(() => ({ noHScroll: document.getElementById('emilyWelcome').scrollWidth <= innerWidth + 1 }));
    await page.click('#emilyWelcomeSkip', { force: true }); await page.waitForTimeout(900);
    const geo = () => page.evaluate(() => {
      const vr = document.querySelector('#view canvas').getBoundingClientRect(); const M = window.COS_HUMA_MOBILE; const f = M.free();
      // projected body box (whole model) in CSS px
      const B = window.COS_HUMA_B; const s = { noHScroll: document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1 };
      const bb = M.bodyBox(); if (bb) Object.assign(s, { body: bb, bodyInFree: bb.top >= vr.top + f.y0 - 4 && bb.bottom <= vr.top + f.y1 + 4 && bb.left >= vr.left + f.x0 - 4 && bb.right <= vr.left + f.x1 + 4, bodyInScreen: bb.top >= vr.top && bb.bottom <= vr.bottom && bb.left >= 0 && bb.right <= innerWidth });
      // UI elements overlapping each other (header buttons, dock buttons)
      const btns = [...document.querySelectorAll('header button, header select, #dock .ctrl, #dock label, #left>section:first-child button')].filter((e) => e.offsetParent && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none').map((e) => ({ id: e.id || e.textContent.trim().slice(0, 14), r: e.getBoundingClientRect() })).filter((x) => x.r.width > 0 && x.r.height > 0 && !(x.r.bottom < 0) && !x.r.top < innerHeight);
      let ov = []; for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) { const a = btns[i].r, b = btns[j].r; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) ov.push(btns[i].id + '|' + btns[j].id); }
      const cut = btns.filter((x) => x.r.left < -1 || x.r.right > innerWidth + 1 || x.r.bottom > innerHeight + 1).map((x) => x.id);
      const small = btns.filter((x) => (x.r.height < 36 || x.r.width < 36) && matchMedia('(pointer:coarse)').matches).map((x) => x.id + ':' + Math.round(x.r.width) + 'x' + Math.round(x.r.height));
      Object.assign(s, { uiOverlaps: ov, uiCut: cut, smallTargets: small, state: { mode: M.labelMode, small: M.state.small, phone: M.state.phone, compact: M.state.compact } });
      return s; });
    const labels = () => page.evaluate(() => window.COS_HUMA_MOBILE.labelReport());
    // default state
    R.default = await geo(); R.defaultLabels = await labels(); await shot(page, `${name}_01_default_p25`);
    // ALL names, page 25 and 27
    await page.evaluate(() => window.COS_HUMA_MOBILE.setLabelMode('all')); await page.waitForTimeout(700);
    R.all25 = { ...(await geo()), labels: await labels() }; await shot(page, `${name}_02_all_p25`);
    await page.click('[data-mode="muscles"]', { force: true }); await page.waitForTimeout(900);
    R.all27 = { ...(await geo()), labels: await labels() }; await shot(page, `${name}_03_all_p27`);
    await page.click('[data-mode="skeleton"]', { force: true }); await page.waitForTimeout(700);
    // tap mode: pick via the list, check info strip + pin caption
    await page.evaluate(() => window.COS_HUMA_MOBILE.setLabelMode('tap')); await page.waitForTimeout(400);
    await page.evaluate(() => { const b = document.getElementById('togglePanel'); b.click(); }); await page.waitForTimeout(400);
    await shot(page, `${name}_04_list_open`);
    R.list = await page.evaluate(() => { const s = document.querySelector('#left>section:nth-child(2)').getBoundingClientRect(); return { top: Math.round(s.top), bottom: Math.round(s.bottom), cols: getComputedStyle(document.getElementById('items')).gridTemplateColumns.split(' ').length }; });
    await page.locator('#items > *').nth(8).click({ force: true }); await page.waitForTimeout(700);
    if (await page.evaluate(() => !document.getElementById('left').classList.contains('list-closed'))) await page.evaluate(() => document.getElementById('togglePanel').click());
    await page.waitForTimeout(500);
    R.tap = await page.evaluate(() => ({ chosenName: document.getElementById('partTitle').textContent, info: document.getElementById('mInfo')?.textContent, pinCaptionVisible: getComputedStyle(document.querySelector('#focusPin span')).display !== 'none' && getComputedStyle(document.getElementById('focusPin')).display !== 'none' }));
    await shot(page, `${name}_05_tap_selected`);
    // hide mode
    await page.evaluate(() => window.COS_HUMA_MOBILE.setLabelMode('hide')); await page.waitForTimeout(400);
    R.hide = await page.evaluate(() => ({ labels: document.querySelectorAll('#calloutLabels .callout').length, namesHidden: document.body.classList.contains('names-hidden') }));
    // reset: camera home + model checksum
    await page.evaluate(() => window.COS_HUMA_MOBILE.setLabelMode('all'));
    await page.evaluate(() => document.getElementById('freeExplode').click()); await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('reset').click()); await page.waitForTimeout(700);
    R.reset = await page.evaluate(() => { const T = window.COS_HUMA_B.v150.TC; return { checksum: T.checksum(), pristine: T.pristine, audit: T.audit().length }; });
    R.afterReset = await geo();
    // 5 languages: header/dock text fits, no mixed fixed Chinese buttons in Catalan
    R.langs = {};
    for (const L of ['ca', 'es', 'zh', 'en', 'fr']) {
      await page.selectOption('#lang', L); await page.waitForTimeout(350);
      R.langs[L] = { ...(await geo()), labels: await labels(), dockText: await page.evaluate(() => [...document.querySelectorAll('#dock .ctrl')].filter((e) => e.offsetParent).map((e) => e.textContent.trim())), menuText: await page.evaluate(() => [...document.querySelectorAll('.headActions .topbtn')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.textContent.trim())) };
      if (L === 'zh' || L === 'fr') await shot(page, `${name}_06_lang_${L}`);
    }
    await page.selectOption('#lang', 'ca'); await page.waitForTimeout(300);
    // panels: quiz (Identifica), basic gate, games, assembly, knowledge
    const panel = async (open, close, tag) => { await page.evaluate(open); await page.waitForTimeout(900); await shot(page, `${name}_07_${tag}`); const g = await geo(); await page.evaluate(close); await page.waitForTimeout(500); return { noHScroll: g.noHScroll, uiOverlaps: g.uiOverlaps.length, cut: g.uiCut }; };
    R.panels = {
      quiz: await panel(() => document.getElementById('quizStart').click(), () => document.getElementById('reset').click(), 'quiz'),
      basic: await panel(() => document.getElementById('basicLaunch').click(), () => document.getElementById('basicClose').click(), 'basic'),
      games: await panel(() => document.getElementById('activitiesBtn').click(), () => { document.getElementById('reset').click(); const a = document.getElementById('activities'); if (a) a.hidden = true; }, 'games'),
      assembly: await panel(() => document.getElementById('assemblyStart').click(), () => document.getElementById('reset').click(), 'assembly'),
      knowledge: await panel(() => document.getElementById('knowledgeBtn').click(), () => { document.getElementById('knowledge').hidden = true; }, 'knowledge'),
    };
    R.final = await page.evaluate(() => { const T = window.COS_HUMA_B.v150.TC; return { checksum: T.checksum(), pristine: T.pristine }; });
  } catch (e) { R.error = String(e).slice(0, 400); await shot(page, `${name}_99_error`).catch(() => {}); }
  R.pageErrors = consoleLines.filter((l) => l.startsWith('[pageerror]'));
  out[name] = R; await browser.close();
  const L = (x) => x ? `${x.shown}/${x.expected} ov${x.overlaps} clip${x.clipped} ui${x.underUI} x${x.crossings} f${x.minFont} sub${x.subColumns}` : '-';
  console.log(name.padEnd(6), R.error ? 'ERROR ' + R.error : '', '| def', R.default?.state?.mode, 'bodyIn', R.default?.bodyInScreen, '| all25', L(R.all25?.labels), 'bodyFree', R.all25?.bodyInFree, '| all27', L(R.all27?.labels), '| tap', R.tap?.chosenName, R.tap?.pinCaptionVisible, '| reset', R.reset?.checksum, R.reset?.pristine, '| hscroll', !R.default?.noHScroll, '| uiOv', R.default?.uiOverlaps?.length, 'cut', R.default?.uiCut?.length, '| err', R.pageErrors.length);
}
const prev = fs.existsSync('evidence/mobile/mobile_acceptance.json') ? JSON.parse(fs.readFileSync('evidence/mobile/mobile_acceptance.json')) : {};
fs.writeFileSync('evidence/mobile/mobile_acceptance.json', JSON.stringify({ ...prev, ...out, when: new Date().toISOString(), note: 'headless Chrome emulation (SwiftShader); not a real Android/iPad test' }, null, 1));
