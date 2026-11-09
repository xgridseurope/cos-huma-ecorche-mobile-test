"""Build COS HUMA Écorché B v1.5.0 (phase 1) from the untouched v1.4.0 file.
Every edit is an exact, single-occurrence replacement so the diff is reviewable."""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'v150/index.v140.orig.html'
OUT = ROOT / 'v150/index.html'

def strip_exports(js):
    return re.sub(r'^export (const|class|function)', r'\1', js, flags=re.M)

html = SRC.read_text(encoding='utf-8')
registry = strip_exports((ROOT / 'src/anatomy-registry.js').read_text(encoding='utf-8'))
controller = strip_exports((ROOT / 'src/transform-controller.js').read_text(encoding='utf-8'))
glue = (ROOT / 'src/app-v150.js').read_text(encoding='utf-8')

edits = []
def rep(old, new, where='html'):
    global html
    n = html.count(old)
    if n != 1:
        sys.exit(f'EDIT FAILED ({n} matches): {old[:90]!r}')
    html = html.replace(old, new)
    edits.append(old[:70].replace('\n', ' '))

# ---- version labels
rep('<h1>COS HUMÀ · Écorché B v1.4.0</h1>', '<h1>COS HUMÀ · Écorché B v1.5.0</h1>')

# ---- phase 1: camera / MediaPipe disconnected (button hidden, module code removed below)
rep('<button class="topbtn" id="handCameraButton" type="button" aria-pressed="false">',
    '<button class="topbtn" id="handCameraButton" type="button" aria-pressed="false" hidden style="display:none">')

# ---- free exploration buttons in the dock
rep('<button class="ctrl" id="front">', '<button class="ctrl" id="freeExplode">✋ Separa</button><button class="ctrl" id="freeRestore">✊ Uneix</button><button class="ctrl" id="front">')

# ---- assembly: all transform writes go through the controller
rep('function restoreAssemblyPositions(){for(const [o,pos] of assemblyOriginal){o.position.copy(pos);o.updateMatrixWorld(true);}assemblyOriginal.clear();assemblyMeshes=[];assemblyDelta.set(0,0,0);clearAssemblyGraphics();requestDraw();}',
    "function restoreAssemblyPositions(){if(TC.baseline)TC.clear('assembly');assemblyMeshes=[];assemblyDelta.set(0,0,0);clearAssemblyGraphics();requestDraw();}")
rep('function moveAssembly(delta){assemblyDelta.copy(delta);for(const m of assemblyMeshes){const orig=assemblyOriginal.get(m);m.parent.updateWorldMatrix(true,false);assemblyMat3.setFromMatrix4(m.parent.matrixWorld).invert();m.position.copy(orig).add(assemblyVec.copy(delta).applyMatrix3(assemblyMat3));m.updateMatrixWorld(true);}requestDraw();}',
    "function moveAssembly(delta){assemblyDelta.copy(delta);TC.setMeshesOffset('assembly',assemblyMeshes,delta);requestDraw();}")
rep('for(const m of assemblyMeshes){assemblyOriginal.set(m,m.position.clone());bbox.expandByObject(m);}',
    'for(const m of assemblyMeshes){bbox.expandByObject(m);}')

# ---- textbook mapping decision 2026-11-08: p.25 does not label the sacrum -> not an answer for any label
rep("['columna vertebral',/^(atlas|axis|sacrum|.* (cervical|thoracic|lumbar) vertebra)$/i]", "['columna vertebral',/^(atlas|axis|.* (cervical|thoracic|lumbar) vertebra)$/i]")
rep("['pelvis',/^(left|right) hip bone$|^sacrum$/i]", "['pelvis',/^(left|right) hip bone$/i]")

# ---- every mode entry / exit goes through resetAll()
rep('function startQuiz(){\n if(assemblyOn)endAssembly();', "function startQuiz(){\n TC.resetAll('quiz');\n if(assemblyOn)endAssembly();")
rep('function exitQuiz(){quizOn=false;', "function exitQuiz(){TC.resetAll('quiz-exit');quizOn=false;")
rep('function setMode(m){\n if(assemblyOn)endAssembly();', "function setMode(m){\n if(TC.baseline)TC.resetAll('display-mode');\n if(assemblyOn)endAssembly();")
rep("function beginAssembly(m='a'){if(!loadOK)return;", "function beginAssembly(m='a'){if(!loadOK)return;TC.resetAll('assembly');")
rep('function endAssembly(){if(!assemblyOn)return;', "function endAssembly(){if(!assemblyOn)return;TC.resetAll('assembly-exit');")
rep('function gameStart(type){if(!loadOK)return;', "function gameStart(type){if(!loadOK)return;TC.resetAll('game');")
rep('function gameStop(){if(!gameOn)return;', "function gameStop(){if(!gameOn)return;TC.resetAll('game-exit');")
rep('function applyBasicFocus(req){', "function applyBasicFocus(req){\n if(loadOK&&TC.baseline)TC.resetAll('basic');")
rep("$('#reset').onclick=()=>{", "$('#reset').onclick=()=>{TC.resetAll('reset-button');")

# ---- registry + controller attach right after a model is installed
rep(' if(quizOn)exitQuiz();loadOK=true;chosen=-1;setMode(', ' v150Attach();\n if(quizOn)exitQuiz();loadOK=true;chosen=-1;setMode(')

# ---- module: insert core code after imports, glue before the loader call, drop gesture module
imports_end = "import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';"
rep(imports_end, imports_end + '\n' + registry + '\n' + controller)
loader_call = 'try{resize();translateUI();const gltf=await getModel();installModel(gltf);}catch(e){failed(String(e));console.error(e);}'
rep(loader_call, glue + '\n' + loader_call)

start = html.index('// v1.3.0 hand-gesture module, loaded only after an explicit camera click.')
end = html.index("$('#lang').addEventListener('change',hcTranslate);hcTranslate();", start) + len("$('#lang').addEventListener('change',hcTranslate);hcTranslate();")
removed = html[start:end]
html = html[:start] + "// v1.5.0 phase 1: the v1.3/1.4 MediaPipe gesture module is removed from this build.\n" \
    "window.COS_HUMA_B.v150={TC,get registry(){return REG;},get entries(){return REG_ENTRIES;},interaction,freeExplode,freeRestore,freeGrip,selftest:v150SelfTest};\n" \
    "{const q=new URLSearchParams(location.search);if(q.has('selftest')&&loadOK){v150SelfTest(+(q.get('seed')||20261108),+(q.get('steps')||500),+(q.get('cycles')||100)).catch(e=>{console.error(e);window.__selftest={passed:false,error:String(e)};});}}\n" + html[end:]
edits.append(f'removed gesture module ({removed.count(chr(10))} lines)')

# ---- welcome page (2026-11-08): riddle wall + X-ray magnifier; no auto-dismiss, no 3D access
import base64
W = ROOT / 'src/welcome'
a = html.index('<section id="emilyWelcome"'); b = html.index('</section>', a) + len('</section>')
old_welcome = html[a:b]
wall_uri = 'data:image/jpeg;base64,' + base64.b64encode((W / 'wall_riddle.jpg').read_bytes()).decode()
new_welcome = (W / 'welcome.html').read_text(encoding='utf-8').replace('__WALL_DATA_URI__', wall_uri).replace('__SKELETON__', (W / 'skeleton.svgfrag').read_text(encoding='utf-8'))
rep(old_welcome, new_welcome)
sa = html.index('/* EMILY welcome: never auto-start lessons, games, or camera. */'); sb = html.index('</script>', sa)
old_js = html[sa:sb]
rep(old_js, (W / 'welcome.js').read_text(encoding='utf-8'))
last_style = html.rindex('</style>', 0, html.index('<body'))
html = html[:last_style] + (W / 'welcome.css').read_text(encoding='utf-8') + html[last_style:]
edits.append('welcome css appended')
# ---- phone & tablet layout (2026-11-09): UI only. Camera framing + labels + compact controls.
#      No mesh, registry, textbook mapping or TransformController change (checked below).
M = ROOT / 'src/mobile'
last_style = html.rindex('</style>', 0, html.index('<body'))
html = html[:last_style] + (M / 'mobile.css').read_text(encoding='utf-8') + html[last_style:]
edits.append('mobile css appended')
rep("focusPin.classList.toggle('no-caption',showCallouts && innerWidth>1050)", "focusPin.classList.toggle('no-caption',showCallouts)")
rep("if(!showCallouts||innerWidth<=1050)return;", "if(!showCallouts)return;if(innerWidth<=1050){mLayoutCallouts(rect,w,h);return;}")
rep("+': '+(showCallouts?'ON':'OFF');renderItems();", "+': '+(showCallouts?'ON':'OFF');try{mLabelText();mInfo();}catch(e){}renderItems();")
rep("setMode(currentPage===25?'skeleton':'muscles');if(basicFocusPending)queueMicrotask", "setMode(currentPage===25?'skeleton':'muscles');mBox=null;mLayout();mHome(true);if(basicFocusPending)queueMicrotask")
rep("clearCloseUp();controls.target.set(0,.85,0);camera.position.set(0,1,3.9);controls.update();pickRecord(-1);", "clearCloseUp();mHome(true);pickRecord(-1);")
rep(" controls.target.set(0,.85,0);camera.position.set(0,1,3.9);\n camera.lookAt(controls.target);controls.update();requestDraw();", " mHome(true);\n camera.lookAt(controls.target);controls.update();requestDraw();")
mobile_js = (M / 'mobile.js').read_text(encoding='utf-8')
rep(loader_call, mobile_js + '\n' + loader_call)
rep('</head>', '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@500;700;800&display=swap" rel="stylesheet">\n</head>')

# ---- sanity: nothing outside the controller writes mesh positions any more
module = html[html.index('<script type="module">'):]
module = module[:module.index('</script>')]
writers = [m.group(0) for m in re.finditer(r'\b(o|m|mesh)\.position\.(copy|add|set|fromArray)\(', module)]
ctrl_writers = controller.count('m.position.copy(') + controller.count('m.position.fromArray(')
print('mesh position writers in module:', len(writers), '(controller-owned:', ctrl_writers, ')')
if len(writers) != ctrl_writers:
    sys.exit('Found mesh position writers outside the TransformController')

OUT.write_text(html, encoding='utf-8')
print('edits:', len(edits))
for e in edits: print('  -', e)
print('wrote', OUT, len(html), 'bytes')
