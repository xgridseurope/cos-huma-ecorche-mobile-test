/* v1.5.0 welcome: X-ray magnifier game. Never auto-starts lessons, games or the camera,
   and never touches the 3D model. Buttons only route to existing entries. */
(() => {
  const el = document.getElementById('emilyWelcome'); if (!el) return;
  const $ = (id) => document.getElementById(id);
  const T = {
    ca: { t: ['Què hi ha', 'dins', 'teu?'], sub: 'Mou la lupa de raigs X pel cos i troba els <strong>6 ossos amagats</strong>!', count: 'Ossos trobats: {n} de 6', choose: 'O tria una aventura:', chooseAll: 'Ara tria una aventura:', start: 'Mou la lupa pel cos!', found: 'Has trobat: {x}!', search: 'Continua buscant…', all: 'Genial! Has trobat tots els ossos!', cards: [['Explora en 3D', 'Gira l’esquelet i mira’l de prop'], ['Reptes', 'Endevina el nom de cada os'], ['Jocs', 'Aprèn jugant']], skip: 'Salta la introducció', aria: 'Una nena pinta una endevinalla a la paret. Amb la lupa de raigs X es veu el seu esquelet.' },
    es: { t: ['¿Qué hay', 'dentro', 'de ti?'], sub: '¡Mueve la lupa de rayos X por el cuerpo y encuentra los <strong>6 huesos escondidos</strong>!', count: 'Huesos encontrados: {n} de 6', choose: 'O elige una aventura:', chooseAll: 'Ahora elige una aventura:', start: '¡Mueve la lupa por el cuerpo!', found: '¡Has encontrado: {x}!', search: 'Sigue buscando…', all: '¡Genial! ¡Has encontrado todos los huesos!', cards: [['Explora en 3D', 'Gira el esqueleto y míralo de cerca'], ['Retos', 'Adivina el nombre de cada hueso'], ['Juegos', 'Aprende jugando']], skip: 'Saltar la introducción', aria: 'Una niña pinta una adivinanza en la pared. Con la lupa de rayos X se ve su esqueleto.' },
    zh: { t: ['你的身体', '里面', '有什么？'], sub: '用 X 光放大镜在身体上移动，找出 <strong>6 块藏起来的骨头</strong>！', count: '已找到骨头：{n} / 6', choose: '或者选一个冒险：', chooseAll: '现在选一个冒险吧：', start: '移动放大镜看看！', found: '找到了：{x}！', search: '继续找…', all: '太棒了！6 块骨头全部找到！', cards: [['3D 探索', '旋转骨骼，近距离观察'], ['闯关挑战', '说出每块骨头的名字'], ['学习游戏', '边玩边学']], skip: '跳过开场', aria: '一个小女孩在墙上画谜语。用 X 光放大镜可以看到她的骨骼。' },
    en: { t: ['What’s', 'inside', 'you?'], sub: 'Move the X-ray magnifier over the body and find the <strong>6 hidden bones</strong>!', count: 'Bones found: {n} of 6', choose: 'Or pick an adventure:', chooseAll: 'Now pick an adventure:', start: 'Move the magnifier over the body!', found: 'You found: {x}!', search: 'Keep looking…', all: 'Great! You found all the bones!', cards: [['Explore in 3D', 'Turn the skeleton and look closely'], ['Challenges', 'Guess the name of each bone'], ['Games', 'Learn by playing']], skip: 'Skip the intro', aria: 'A girl paints a riddle on the wall. The X-ray magnifier shows her skeleton.' },
    fr: { t: ['Qu’y a-t-il', 'dans', 'ton corps ?'], sub: 'Déplace la loupe à rayons X sur le corps et trouve les <strong>6 os cachés</strong> !', count: 'Os trouvés : {n} sur 6', choose: 'Ou choisis une aventure :', chooseAll: 'Maintenant, choisis une aventure :', start: 'Déplace la loupe sur le corps !', found: 'Tu as trouvé : {x} !', search: 'Continue à chercher…', all: 'Bravo ! Tu as trouvé tous les os !', cards: [['Explorer en 3D', 'Tourne le squelette et regarde de près'], ['Défis', 'Devine le nom de chaque os'], ['Jeux', 'Apprendre en jouant']], skip: 'Passer l’introduction', aria: 'Une fille peint une devinette sur le mur. La loupe à rayons X montre son squelette.' },
  };
  // Textbook (Catalan) names. Back view: the patella and rib fronts are not visible from behind.
  const BONES = [
    { id: 'crani', name: 'crani', pts: [[143, 163]] },
    { id: 'columna', name: 'columna vertebral', pts: [[155, 330], [152, 250]] },
    { id: 'omoplat', name: 'omòplat', pts: [[128, 262], [184, 260]] },
    { id: 'humer', name: 'húmer', pts: [[96, 290], [214, 192]] },
    { id: 'pelvis', name: 'pelvis', pts: [[159, 412]] },
    { id: 'femur', name: 'fèmur', pts: [[140, 470], [181, 470]] },
  ];
  const OFF = [300, 120], R = 74;
  const st = { x: 460, y: 380, touched: false, found: new Set(), current: null, answer: false, t: 0, raf: 0, dismissed: false };
  const tx = () => T[$('lang')?.value] || T.ca;
  // phones: the riddle wall + bone hunt folds behind one button (progress shown on it)
  const RIDDLE = { ca: '🔍 Joc: troba els ossos amagats', es: '🔍 Juego: encuentra los huesos escondidos', zh: '🔍 小游戏：找出藏起来的骨头', en: '🔍 Game: find the hidden bones', fr: '🔍 Jeu : trouve les os cachés' };
  $('ewRiddleToggle').addEventListener('click', () => { const o = !el.classList.contains('ew-riddle-open'); el.classList.toggle('ew-riddle-open', o); $('ewRiddleToggle').setAttribute('aria-expanded', String(o)); render(); });

  function drawLens() {
    const { x, y } = st, r = 56;
    $('ewLensClip').setAttribute('cx', x); $('ewLensClip').setAttribute('cy', y);
    $('ewRing').setAttribute('cx', x); $('ewRing').setAttribute('cy', y);
    for (const id of ['ewH1', 'ewH2']) { const l = $(id); l.setAttribute('x1', x + 55); l.setAttribute('y1', y + 55); l.setAttribute('x2', x + 92); l.setAttribute('y2', y + 92); }
    $('ewGlare').setAttribute('d', `M${(x - r * 0.8).toFixed(1)} ${(y - r * 0.2).toFixed(1)} A${r} ${r} 0 0 1 ${(x - r * 0.2).toFixed(1)} ${(y - r * 0.8).toFixed(1)}`);
  }
  function render() {
    const t = tx(), n = st.found.size, all = n === BONES.length;
    const sep = ($('lang')?.value === 'zh') ? '' : ' ', h = $('emilyWelcomeTitle'), acc = document.createElement('span');
    acc.className = 'ew-accent'; acc.textContent = t.t[1];
    h.replaceChildren(document.createTextNode(t.t[0] + sep), acc, document.createTextNode(sep + t.t[2]));
    $('emilyWelcomeSubtitle').innerHTML = t.sub;
    $('ewCount').textContent = t.count.replace('{n}', n);
    $('ewChips').replaceChildren(...BONES.map((b) => { const s = document.createElement('span'); const on = st.found.has(b.id); s.className = 'ew-chip' + (on ? ' on' : ''); s.textContent = on ? b.name : '?'; return s; }));
    $('ewChoose').textContent = all ? t.chooseAll : t.choose;
    [1, 2, 3].forEach((i) => { $('ewC' + i + 't').textContent = t.cards[i - 1][0]; $('ewC' + i + 's').textContent = t.cards[i - 1][1]; });
    $('emilyWelcomeExplore').classList.toggle('pulse', all);
    $('emilyWelcomeSkip').textContent = t.skip;
    { const open = el.classList.contains('ew-riddle-open'); $('ewRiddleToggle').textContent = `${RIDDLE[$('lang')?.value] || RIDDLE.ca} · ${n}/6 ${open ? '▴' : '▾'}`; }
    $('ewStage').setAttribute('aria-label', t.aria);
    $('ewMsg').textContent = all ? t.all : st.touched && st.current ? t.found.replace('{x}', st.current) : st.touched ? t.search : t.start;
    $('ewAnswer').textContent = st.answer ? 'Resposta: la planta del peu!' : 'Resposta?';
    $('ewAnswer').setAttribute('aria-pressed', String(st.answer));
  }
  function idle() {
    st.raf = 0; if (st.dismissed || st.touched) return;
    st.t += 0.035; st.x = 458 + 60 * Math.sin(st.t); st.y = 480 + 220 * Math.sin(st.t * 0.62); drawLens();
    st.raf = requestAnimationFrame(idle);
  }
  function move(e) {
    const r = $('ewStage').getBoundingClientRect(); if (!r.width) return;
    st.x = Math.max(30, Math.min(880, (e.clientX - r.left) / r.width * 910));
    st.y = Math.max(30, Math.min(750, (e.clientY - r.top) / r.height * 780));
    st.touched = true;
    let hit = null;
    for (const b of BONES) for (const p of b.pts) { const d = Math.hypot(p[0] + OFF[0] - st.x, p[1] + OFF[1] - st.y); if (d < 40 && (!hit || d < hit.d)) hit = { b, d }; }
    if (hit) st.found.add(hit.b.id);
    st.current = hit ? hit.b.name : null;
    drawLens(); render();
  }
  function dismiss() {
    if (st.dismissed) return; st.dismissed = true;
    cancelAnimationFrame(st.raf); el.hidden = true; el.setAttribute('aria-hidden', 'true');
  }
  $('ewStage').addEventListener('pointermove', move);
  $('ewStage').addEventListener('pointerdown', move);
  $('ewAnswer').addEventListener('click', () => { st.answer = !st.answer; render(); });
  $('emilyWelcomeExplore').addEventListener('click', dismiss);
  $('emilyWelcomeSkip').addEventListener('click', dismiss);
  $('emilyWelcomeLearn').addEventListener('click', () => { dismiss(); $('basicLaunch')?.click(); });
  $('emilyWelcomeGames').addEventListener('click', () => { dismiss(); $('activitiesBtn')?.click(); });
  $('lang')?.addEventListener('change', render);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') dismiss(); });
  window.COS_HUMA_WELCOME = { dismiss, get state() { return { found: [...st.found], answer: st.answer, dismissed: st.dismissed }; } };
  drawLens(); render(); st.raf = requestAnimationFrame(idle);
})();
