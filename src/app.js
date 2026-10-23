// ===== app =====
const SETS = DATA.map(s => s.set);
const CASES = [], BYID = {}, BYSET = {};
DATA.forEach(S => { BYSET[S.set] = []; S.groups.forEach(G => G.cases.forEach(C => {
  const id = S.set + '|' + G.name + '|' + C.name;
  const gl = S.set === 'PBL' ? '下段 ' + G.name : G.name;
  const nl = S.set === 'PBL' ? '上段 ' + C.name : C.name;
  const c = { id, set: S.set, group: G.name, gl, nl, name: C.name, full: S.set + ' ' + gl + ' ' + nl,
    algs: C.algs, my: C.my || [], mylab: C.mylab || [], mynote: C.mynote || [],
    state: C.state.split('').map(Number), flat: parseAlg(C.algs[0] || C.my[0]).flat };
  CASES.push(c); BYID[id] = c; BYSET[S.set].push(c);
})); });
const SET_DESC = {
  'PBL':'上下の段の入れ替え（Ortega / Varasano）。グループは下段、ケースは上段の形です。', 'CLL':'下段完成の状態から 1 手順で完成させます。',
  'EG-1':'下段が隣接入れ替えの状態から 1 手順で完成させます。', 'EG-2':'下段が対角入れ替えの状態から 1 手順で完成させます。',
  'LEG-1':'下段に隣接入れ替えを含むケースです。', 'TCLL+':'下段の 1 隅がねじれた状態（+）から 1 手順で完成させます。',
  'TCLL-':'下段の 1 隅がねじれた状態（−）から 1 手順で完成させます。', 'TEG2+':'下段の 1 隅がねじれ（+）、さらに対角入れ替えの状態から 1 手順で完成させます。',
  'LTEG1+':'あなたの手順表の LTEG1+ シートから作ったセットです（手順のある 39 ケース）。', 'BTEG1-':'あなたの手順表の BTEG1- シートから作ったセットです（手順のある 35 ケース）。'
};
for (let i=1;i<=9;i++) SET_DESC['LS-'+i] = '下段の 1 隅を上段に残した状態から 1 手順で完成させます（LS-' + i + '）。';

// ---------- storage ----------
const P = 'tt2.';
function load(k, d) { try { const v = localStorage.getItem(P + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {} }
const SCHEME0 = { U:'yellow', F:'green', R:'orange', D:'white', L:'red', B:'blue' };
const DEF = { practice:'time', statKind:'time', mode:'random', slow:false, slowTh:3, minLen:9, colorMax:5, metric:'avg', filter:[], statSet:'CLL', listView:false, reveal:false, scheme:SCHEME0 };
let settings = Object.assign({}, DEF, load('settings', {}));
settings.scheme = Object.assign({}, SCHEME0);
if (!['avg','r5'].includes(settings.metric)) settings.metric = 'avg';
if (!Array.isArray(settings.filter)) settings.filter = [];
settings.filter = settings.filter.filter(s => SETS.includes(s));
const visibleSets = () => settings.filter.length ? SETS.filter(s => settings.filter.includes(s)) : SETS;
if (!SETS.includes(settings.statSet)) settings.statSet = 'CLL';
let sel = new Set((load('sel', null) || BYSET['CLL'].map(c => c.id)).filter(id => BYID[id]));
let presets = load('presets', {});            // name -> [ids]
let lastPreset = load('curPreset', '');
let custom = load('custom', {});               // id -> [alg]
let stats = load('stats', {});                 // id -> {n,sum,best,worst,last}
let statsAuf = load('statsAuf', {});           // id -> {n,ok,s,r:[1/0],t:[ms],u:{AUF:[出題,正解]}}
let useAlg = load('useAlg', {});               // id -> AUF クイズで使う手順（normAlg のキー）
let openGroups = new Set(load('openGroups', []));
const saveSettings = () => save('settings', settings);
const saveSel = () => save('sel', [...sel]);
const savePresets = () => { save('presets', presets); save('curPreset', lastPreset); };

// ---------- colours & diagrams ----------
const PALETTE = [['white','白'],['yellow','黄'],['green','緑'],['blue','青'],['red','赤'],['orange','橙'],['purple','紫'],['pink','桃'],['grey','灰']];
const HEX = { yellow:'#FEFE00', white:'#f4f4f4', green:'#12a150', red:'#e0251f', blue:'#1f63e0', orange:'#ff8a00', purple:'#8b48d6', pink:'#ff7eb6', grey:'#9aa0a6' };
const JA = Object.fromEntries(PALETTE);
const FACE_ORDER = ['U','R','F','D','L','B']; // index = sticker colour value
const FACE_LAB = [['U','U面'],['F','F面'],['R','R面'],['D','D面'],['L','L面'],['B','B面']];
const scheme = () => FACE_ORDER.map(f => settings.scheme[f]);
const LAYER = {
  U: { face:[0,1,2,3], back:[21,20], left:[16,17], right:[5,4], front:[8,9] },
  D: { face:[14,15,12,13], back:[23,22], left:[18,19], right:[7,6], front:[10,11] }
};
function layerG(s, L, ox, sch) {
  const col = i => HEX[sch[s[i]]];
  const st = (x,y,w,h,i) => `<rect x="${x+ox}" y="${y}" width="${w}" height="${h}" rx="3" fill="${col(i)}" stroke="#14151c" stroke-width="1"/>`;
  let g = `<rect x="${ox+14}" y="14" width="72" height="72" rx="5" fill="#0b0c10"/>`;
  L.face.forEach((i,k) => { g += st(17 + (k%2)*34, 17 + Math.floor(k/2)*34, 32, 32, i); });
  L.back.forEach((i,k) => { g += st(18 + k*34, 2, 30, 10, i); });
  L.front.forEach((i,k) => { g += st(18 + k*34, 88, 30, 10, i); });
  L.left.forEach((i,k) => { g += st(2, 18 + k*34, 10, 30, i); });
  L.right.forEach((i,k) => { g += st(88, 18 + k*34, 10, 30, i); });
  return g;
}
// ---------- ケース図: VisualCube（visualcube.api.cubing.net）の plan 図 ----------
// 上段は状態そのもの、下段は「下段を上から透かして見た形」を fd で組み立てて描かせる。
// 画像が読めない環境（外部画像を止めているページなど）では、VisualCube と同じ座標・色で描いた SVG に置き換える。
const VC_BASE = 'https://visualcube.api.cubing.net/visualcube.php?fmt=png&size=240&pzl=2&view=plan&bg=t&sch=yogwrb&fd=';
const VC_HEX = { u:'#FEFE00', r:'#FFA100', f:'#00D800', d:'#FFFFFF', l:'#EE0000', b:'#0000F2', n:'#404040' };
const fdTop = s => s.map(v => 'urfdlb'[v]).join('');
function fdBottom(s) { const f = Array(24).fill('n'); const m = [[0,14],[1,15],[2,12],[3,13],[4,6],[5,7],[8,10],[9,11],[16,18],[17,19],[20,22],[21,23]];
  m.forEach(([to, from]) => { f[to] = 'urfdlb'[s[from]]; }); return f.join(''); }
// VisualCube の plan 図（2x2, dist 5, viewBox -0.9〜0.9）の座標。sr-visualizer の計算と同じ
const VC_FACE = [[[-0.5139,-0.5139],[-0.0417,-0.5139],[-0.0417,-0.0417],[-0.5139,-0.0417]],[[0.0417,-0.5139],[0.5139,-0.5139],[0.5139,-0.0417],[0.0417,-0.0417]],
  [[-0.5139,0.0417],[-0.0417,0.0417],[-0.0417,0.5139],[-0.5139,0.5139]],[[0.0417,0.0417],[0.5139,0.0417],[0.5139,0.5139],[0.0417,0.5139]]];
const VC_SIDE = { 4:[[0.5539,0.5389],[0.5539,0.0167],[0.7017,0.0167],[0.7017,0.4867]], 5:[[0.5539,-0.015],[0.5539,-0.5372],[0.7017,-0.485],[0.7017,-0.015]],
  8:[[-0.5389,0.5539],[-0.0167,0.5539],[-0.0167,0.7017],[-0.4867,0.7017]], 9:[[0.015,0.5539],[0.5372,0.5539],[0.485,0.7017],[0.015,0.7017]],
  16:[[-0.5539,-0.5389],[-0.5539,-0.0167],[-0.7017,-0.0167],[-0.7017,-0.4867]], 17:[[-0.5539,0.015],[-0.5539,0.5372],[-0.7017,0.485],[-0.7017,0.015]],
  20:[[0.5389,-0.5539],[0.0167,-0.5539],[0.0167,-0.7017],[0.4867,-0.7017]], 21:[[-0.015,-0.5539],[-0.5372,-0.5539],[-0.485,-0.7017],[-0.015,-0.7017]] };
const vcPoly = (pts, fill, sw) => `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${fill}"${sw ? ` stroke="#000" stroke-width="${sw}" stroke-linejoin="round"` : ''}/>`;
function vcReplica(fd, cls) {
  let g = `<polygon points="-0.5222,-0.5222 0.5222,-0.5222 0.5222,0.5222 -0.5222,0.5222" fill="#000" stroke="#000" stroke-width="0.1" stroke-linejoin="round"/>`;
  VC_FACE.forEach((p, k) => { g += vcPoly(p, VC_HEX[fd[k]]); });
  for (const k in VC_SIDE) g += vcPoly(VC_SIDE[k], VC_HEX[fd[k]], 0.02);
  return `<svg class="vc vcr ${cls}" viewBox="-0.9 -0.9 1.8 1.8" data-fd="${fd}" aria-hidden="true">${g}</svg>`;
}
let vcBlocked = false;
const vcImg = (fd, cls) => vcBlocked ? vcReplica(fd, cls) : `<img class="vc ${cls}" src="${VC_BASE}${fd}" alt="" loading="lazy" decoding="async" data-fd="${fd}">`;
function vcFallbackAll() { document.querySelectorAll('img.vc').forEach(im => { im.outerHTML = vcReplica(im.dataset.fd, im.classList.contains('b') ? 'b' : 't'); }); }
if (typeof document !== 'undefined') document.addEventListener('error', e => { const t = e.target;
  if (t && t.tagName === 'IMG' && t.classList.contains('vc')) { vcBlocked = true; vcFallbackAll(); } }, true);
function cubeSvg(s) { return `<span class="cube">${vcImg(fdTop(s), 't')}${vcImg(fdBottom(s), 'b')}</span>`; }
// AUF クイズ用: 上段の図の外側に、下段の側面のマスを並べる（座標は上の図と同じ単位）。右に下段（上から透視）
function aufSvg(s) {
  const L = 0.76, H = 0.89, sq = (x0, y0, x1, y1, i) => `<rect x="${Math.min(x0,x1)}" y="${Math.min(y0,y1)}" width="${Math.abs(x1-x0)}" height="${Math.abs(y1-y0)}" rx="0.02" fill="${VC_HEX['urfdlb'[s[i]]]}" stroke="#000" stroke-width="0.02"/>`;
  let ring = '';
  ring += sq(L, 0.0167, H, 0.5389, 6) + sq(L, -0.5372, H, -0.015, 7);       // 右（手前・奥）
  ring += sq(-0.5389, L, -0.0167, H, 10) + sq(0.015, L, 0.5372, H, 11);     // 前（左・右）
  ring += sq(-L, -0.5389, -H, -0.0167, 18) + sq(-L, 0.015, -H, 0.5372, 19); // 左（奥・手前）
  ring += sq(0.0167, -L, 0.5389, -H, 22) + sq(-0.5372, -L, -0.015, -H, 23); // 奥（右・左）
  return `<div class="aufwrap"><div class="aufbox"><svg class="ring" viewBox="-1 -1 2 2" aria-hidden="true">${ring}</svg><div class="center">${vcImg(fdTop(s), 't')}</div>`
    + `<div class="lab">上段（外側のマスは下段の側面）</div></div>`
    + `<div class="aufbot">${vcImg(fdBottom(s), 'b')}<div class="lab">下段（上から透視）</div></div></div>`;
}
const holdText = () => `上 <b>${JA[settings.scheme.U]}</b>・前 <b>${JA[settings.scheme.F]}</b> で持って回す`;

// ---------- stats ----------
function addStat(id, ms) { const s = stats[id] || (stats[id] = { n:0, sum:0, best:null, worst:null, last:[] });
  s.n++; s.sum += ms; s.best = s.best == null ? ms : Math.min(s.best, ms); s.worst = s.worst == null ? ms : Math.max(s.worst, ms);
  s.last.push(ms); if (s.last.length > 12) s.last.shift(); save('stats', stats); }
function removeStat(id, ms) { const s = stats[id]; if (!s) return; s.n--; s.sum -= ms; const i = s.last.lastIndexOf(ms); if (i >= 0) s.last.splice(i, 1);
  if (s.n <= 0) delete stats[id];
  else { if (s.best === ms) s.best = s.last.length ? Math.min(...s.last) : null; if (s.worst === ms) s.worst = s.last.length ? Math.max(...s.last) : null; }
  save('stats', stats); }
const recent5 = e => { if (!e || !e.last || !e.last.length) return null; const l = e.last.slice(-5); return l.reduce((a,b)=>a+b,0) / l.length; };
const avg5 = id => recent5(stats[id]);
const fmt = ms => ms == null ? '—' : (ms/1000).toFixed(2);
function tcol(ms) { const M = settings.colorMax; const t = Math.max(0, Math.min(M, ms/1000)); return `hsl(${Math.round(120*(1-t/M))} 85% 58%)`; }

// ---------- questions ----------
const rng = Math.random;
function dblHomeY(T) { for (let c=0;c<4;c++){ const s = applyMove(T,'y',c); const k = CSTK[6].map(j=>s[j]); if (k[0]===3 && k[1]===5 && k[2]===4) return c; } return -1; }
function buildQuestion(c) {
  for (let tries = 0; tries < 8; tries++) {
    let T = applyMove(c.state, 'U', Math.floor(rng()*4)), sol;
    const cy = dblHomeY(T);
    if (cy >= 0) { T = applyMove(T, 'y', cy); sol = solveExact(T, URF_MOVES, 14, rng, 300000, settings.minLen); }
    else { T = applyMove(T, 'y', Math.floor(rng()*4)); sol = solveExact(T, ALL_MOVES, 16, rng, 2000000, settings.minLen); }
    if (!sol) continue;
    const q = { id: c.id, scramble: fmtSeq(invSeq(sol)), T, len: sol.length };
    if (verifyQuestion(q)) return q;
  }
  return null;
}
// 出題のたびに検算: スクランブル → 目標状態、同じ面の連続なし、そのケースの手順で解けること
function verifyQuestion(q) { const p = parseAlg(q.scramble); if (!p) return false;
  const s = applySeq(p.flat); if (s.join() !== q.T.join()) return false;
  for (let i=1;i<p.flat.length;i++) if (p.flat[i].f === p.flat[i-1].f) return false;
  return !!solvesCase(BYID[q.id].flat, s); }
const selectedIds = () => CASES.filter(c => sel.has(c.id)).map(c => c.id);
const aufT5 = id => { const e = statsAuf[id]; return e && e.t.length ? e.t.slice(-5).reduce((x,y) => x+y, 0) / Math.min(5, e.t.length) : null; };
const isSlow = id => {
  if (settings.practice === 'auf') { const e = statsAuf[id]; if (!e || !e.r.length) return true; if (e.r.slice(-5).includes(0)) return true; return aufT5(id) > settings.slowTh * 1000; }
  const a = avg5(id); return a == null || a > settings.slowTh * 1000; };
const slowPool = () => selectedIds().filter(isSlow);
const activeIds = () => settings.slow ? slowPool() : selectedIds();
let lastStraight = null, queue = [], recapTotal = 0, recapRound = 0;
function shuffle(a) { a = a.slice(); for (let i=a.length-1;i>0;i--){ const j = Math.floor(rng()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }
function resetQueues() { lastStraight = null; queue = []; recapTotal = 0; recapRound = 0; }
function nextCaseId() {
  const ids = activeIds(); if (!ids.length) return null;
  if (settings.mode === 'straight') { const i = ids.indexOf(lastStraight); lastStraight = ids[(i + 1) % ids.length]; return lastStraight; }
  if (settings.mode === 'recap') { queue = queue.filter(id => ids.includes(id));
    if (!queue.length) { if (recapRound > 0) toast('一周しました（' + recapTotal + ' ケース）。もう一周します'); queue = shuffle(ids); recapTotal = ids.length; recapRound++; }
    return queue.shift(); }
  return ids[Math.floor(rng() * ids.length)];
}

// ---------- helpers ----------
const el = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
let toastT = 0;
function toast(msg) { const t = el('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }
function show(s) { el('scr-auf').classList.toggle('on', s === 'auf'); el('scr-sel').classList.toggle('on', s === 'sel'); el('scr-run').classList.toggle('on', s === 'run'); el('scr-stat').classList.toggle('on', s === 'stat'); window.scrollTo(0, 0); }
const normAlg = a => { const p = parseAlg(a); return p ? p.raw.map(fmtMove).join(' ') : a.replace(/\s+/g, ' ').trim(); }; // U2' と U2 なども同じ手順として扱う
// 並び: マイ手順（取り込んだ手順表）→ 自作（このブラウザで登録）→ 表の手順。同じ手順は 1 回だけ
const algsOf = c => { const out = [], seen = new Set();
  const push = (a, o) => { const k = normAlg(a); if (seen.has(k)) return; seen.add(k); out.push(Object.assign({ a }, o)); };
  c.my.forEach(a => push(a, { my:true })); (custom[c.id] || []).forEach((a, ci) => push(a, { mine:true, ci })); c.algs.forEach(a => push(a, {}));
  return out; };
const tagOf = x => x.mine ? '<span class="tagc">自作</span>' : '';
const myInfo = c => [c.mylab.length ? 'あなたの表: ' + c.mylab.join(' / ') : '', c.mynote.length ? 'メモ: ' + c.mynote.join(' / ') : ''].filter(Boolean).join(' ・ ');
// 2 回押すと実行するボタン（confirm() が使えない環境向け）
function twoStep(btn, label, fn) {
  if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.classList.remove('warn'); btn.textContent = btn.dataset.orig; fn(); return; }
  btn.dataset.orig = btn.textContent; btn.dataset.armed = '1'; btn.classList.add('warn'); btn.textContent = label;
  setTimeout(() => { if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.classList.remove('warn'); btn.textContent = btn.dataset.orig; } }, 3000);
}

// ---------- 選択画面 ----------
function renderSetGrid(boxId, cur, onPick, countFn) {
  const box = el(boxId); box.innerHTML = '';
  SETS.forEach(s => { const b = document.createElement('button'); b.type = 'button'; const n = countFn(s);
    b.className = n ? 'has' : ''; b.setAttribute('aria-pressed', cur === s);
    b.innerHTML = `<span>${esc(s)}</span><span class="c">${n} / ${BYSET[s].length}</span>`;
    b.onclick = () => onPick(s); box.appendChild(b); });
}
function renderFilter() {
  const box = el('setgrid'); box.innerHTML = '';
  const mk = (label, count, pressed, fn, cls) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls || '';
    b.setAttribute('aria-pressed', pressed); b.innerHTML = `<span>${esc(label)}</span><span class="c">${count}</span>`; b.onclick = fn; box.appendChild(b); };
  mk('すべて', `${sel.size} / ${CASES.length}`, !settings.filter.length, () => { settings.filter = []; saveSettings(); buildSelection(); }, 'all' + (sel.size ? ' has' : ''));
  SETS.forEach(s => { const n = BYSET[s].filter(c => sel.has(c.id)).length;
    mk(s, `${n} / ${BYSET[s].length}`, settings.filter.includes(s), () => {
      const f = new Set(settings.filter); f.has(s) ? f.delete(s) : f.add(s);
      settings.filter = SETS.filter(x => f.has(x)); saveSettings(); buildSelection(); }, n ? 'has' : ''); });
  el('filtinfo').textContent = settings.filter.length ? `（${settings.filter.length} セットを表示中・複数選べます）` : '（複数選べます）';
}
function groupSection(key, label, ids, toggleAll) {
  const sec = document.createElement('section'); sec.className = 'gsec' + (openGroups.has(key) ? ' open' : '');
  sec.dataset.ids = JSON.stringify(ids);
  const head = document.createElement('div'); head.className = 'ghead';
  head.innerHTML = `<span class="caret">▶</span><span class="gname">${esc(label)}</span>`;
  head.onclick = e => { if (e.target.closest('.mini')) return; sec.classList.toggle('open');
    sec.classList.contains('open') ? openGroups.add(key) : openGroups.delete(key); save('openGroups', [...openGroups]); };
  const btn = document.createElement('button'); btn.className = 'mini'; btn.type = 'button'; btn.textContent = 'この群を全選択'; btn.onclick = toggleAll;
  head.appendChild(btn);
  const cnt = document.createElement('span'); cnt.className = 'gcount'; head.appendChild(cnt);
  const body = document.createElement('div'); body.className = 'gbody';
  sec.appendChild(head); sec.appendChild(body);
  return { sec, body };
}
function buildSelection() {
  renderFilter();
  const root = el('setsec'); root.innerHTML = '';
  visibleSets().forEach(set => {
    const tt = document.createElement('div'); tt.className = 'secttl';
    tt.innerHTML = `<span class="st">${esc(set)}</span><span class="sn" data-setn="${esc(set)}"></span><span class="sp"></span>`;
    const mk = (txt, fn) => { const b = document.createElement('button'); b.className = 'mini'; b.type = 'button'; b.textContent = txt; b.onclick = fn; tt.appendChild(b); };
    mk(set + ' 全選択', () => { BYSET[set].forEach(c => sel.add(c.id)); sync(); });
    mk(set + ' 全解除', () => { BYSET[set].forEach(c => sel.delete(c.id)); sync(); });
    const sd = document.createElement('div'); sd.className = 'sd'; sd.textContent = SET_DESC[set] || ''; tt.appendChild(sd);
    root.appendChild(tt);
    DATA.find(d => d.set === set).groups.forEach(G => {
      const list = BYSET[set].filter(c => c.group === G.name), ids = list.map(c => c.id);
      const { sec, body } = groupSection(set + '|' + G.name, list[0].gl, ids, () => { const all = ids.every(x => sel.has(x)); ids.forEach(x => all ? sel.delete(x) : sel.add(x)); sync(); });
      const grid = document.createElement('div'); grid.className = settings.listView ? 'olist' : 'cases';
      list.forEach(c => grid.appendChild(settings.listView ? caseRow(c) : caseTile(c)));
      body.appendChild(grid); root.appendChild(sec);
    });
  });
  el('vlist').setAttribute('aria-pressed', settings.listView);
  sync();
}
function caseTile(c) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'cs'; b.dataset.id = c.id;
  b.innerHTML = cubeSvg(c.state) + `<div class="lb">${esc(c.nl)}</div>`;
  b.title = algsOf(c)[0].a;
  b.onclick = () => { sel.has(c.id) ? sel.delete(c.id) : sel.add(c.id); sync(); };
  return b;
}
function caseRow(c) {
  const row = document.createElement('div'); row.className = 'orow'; row.dataset.oid = c.id;
  const pk = document.createElement('button'); pk.type = 'button'; pk.className = 'opick';
  pk.innerHTML = `<span class="fig">${cubeSvg(c.state)}</span><span class="an">${esc(c.nl)}</span>`;
  pk.onclick = () => { sel.has(c.id) ? sel.delete(c.id) : sel.add(c.id); sync(); };
  const box = document.createElement('div'); box.className = 'oalgs';
  algsOf(c).forEach((x, i) => {
    const d = document.createElement('div'); d.className = 'oalg' + (i === 0 ? ' first' : '') + (usedAlg(c).a === x.a ? ' used' : '');
    d.innerHTML = tagOf(x) + `<span>${esc(x.a)}</span>`; d.title = 'AUF クイズでこの手順を使う';
    d.onclick = e => { if (e.target.closest('button')) return; if (!aufValid(c, x).length) { toast('この手順は下段を上にして回すため、AUF クイズでは使えません'); return; } if (i === 0) delete useAlg[c.id]; else useAlg[c.id] = normAlg(x.a); save('useAlg', useAlg); row.replaceWith(caseRow(c)); syncRows(); };
    if (x.mine) { const del = document.createElement('button'); del.type = 'button'; del.className = 'mini'; del.textContent = '削除';
      del.onclick = () => { custom[c.id].splice(x.ci, 1); if (!custom[c.id].length) delete custom[c.id]; save('custom', custom); row.replaceWith(caseRow(c)); syncRows(); };
      d.appendChild(del); }
    box.appendChild(d);
  });
  const eb = document.createElement('button'); eb.type = 'button'; eb.className = 'ebtn'; eb.textContent = '自作の手順…';
  eb.onclick = () => editCustom(c, box, row); box.appendChild(eb);
  row.appendChild(pk); row.appendChild(box);
  row.setAttribute('aria-selected', sel.has(c.id));
  return row;
}
function editCustom(c, box, row) {
  if (box.querySelector('.zform')) return;
  const f = document.createElement('div'); f.className = 'zform';
  f.innerHTML = `<div class="hint">このケースを解く自分の手順を入れてください。前後の U と持ち替えを含めて解けるかを確かめてから登録します。使える記号: R U F D L B（2 と '）、x y z、r u f など。</div>
    <input type="text" placeholder="例: R U R' U R U2 R'" aria-label="自作の手順"><div class="fr"><button class="mini" type="button" data-k="ok">登録</button><button class="mini" type="button" data-k="no">やめる</button></div><div class="err"></div>`;
  box.appendChild(f); const inp = f.querySelector('input'); inp.focus();
  const go = () => { const msg = addCustomAlg(c.id, inp.value); if (msg) { f.querySelector('.err').textContent = msg; return; } toast('自作の手順を登録しました'); row.replaceWith(caseRow(c)); syncRows(); };
  f.querySelector('[data-k=ok]').onclick = go; f.querySelector('[data-k=no]').onclick = () => f.remove();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
}
function addCustomAlg(id, text) {
  const c = BYID[id]; const p = parseAlg(text); text = text.trim().replace(/\s+/g, ' ');
  if (!p || !p.flat.length) return '手順として読めませんでした。';
  if (!solvesCase(p.flat, c.state)) return 'この手順ではこのケースが解けません（前後の U・持ち替えも試しました）。';
  custom[id] = custom[id] || []; if (!custom[id].includes(text)) custom[id].unshift(text); save('custom', custom); return '';
}
function syncRows() {
  document.querySelectorAll('#setsec button.cs[data-id]').forEach(b => b.setAttribute('aria-pressed', sel.has(b.dataset.id)));
  document.querySelectorAll('#setsec .orow').forEach(r => r.setAttribute('aria-selected', sel.has(r.dataset.oid)));
  document.querySelectorAll('#setsec .gsec').forEach(sec => { const ids = JSON.parse(sec.dataset.ids);
    sec.querySelector('.gcount').textContent = `${ids.filter(x => sel.has(x)).length} / ${ids.length}`; });
}
function syncSlow() {
  const ids = selectedIds(), n = slowPool().length, fresh = ids.filter(id => avg5(id) == null).length;
  el('slowon').setAttribute('aria-pressed', settings.slow); el('slowtog').setAttribute('aria-pressed', settings.slow);
  el('slowinfo').textContent = settings.practice === 'auf'
    ? (() => { const f2 = ids.filter(id => !statsAuf[id] || !statsAuf[id].r.length).length; return `選択中 ${ids.length} 件のうち ${n} 件が対象です（直近5回に間違いがある、または直近5回の平均回答時間が ${settings.slowTh} 秒超 ${n - f2} 件 ＋ 記録なし ${f2} 件）。`; })()
    : `選択中 ${ids.length} 件のうち ${n} 件が対象です（直近5回の平均が ${settings.slowTh} 秒超 ${n - fresh} 件 ＋ 記録なし ${fresh} 件）。`;
  if (el('aslowtog')) el('aslowtog').setAttribute('aria-pressed', settings.slow);
  el('go').disabled = !canStart();
}
const canStart = () => activeIds().length > 0;
function sync() {
  syncRows();
  document.querySelectorAll('[data-setn]').forEach(sp => { const s = sp.dataset.setn; sp.textContent = `${BYSET[s].filter(c => sel.has(c.id)).length} / ${BYSET[s].length}`; });
  renderFilter();
  const parts = SETS.map(s => [s, BYSET[s].filter(c => sel.has(c.id)).length]).filter(x => x[1]);
  el('selcount').innerHTML = `<b>${sel.size}</b> ケース` + (parts.length ? `<span style="font-size:11.5px">（${parts.map(([s,n]) => esc(s) + ' ' + n).join(' · ')}）</span>` : '');
  syncSlow(); saveSel(); resetQueues();
}

// ---------- プリセット ----------
function renderPresets() {
  const box = el('plist'); box.innerHTML = '';
  Object.keys(presets).forEach(name => {
    const ids = presets[name];
    const d = document.createElement('div'); d.className = 'pitem';
    const pn = document.createElement('span'); pn.className = 'pn'; pn.textContent = name;
    const pc = document.createElement('span'); pc.className = 'pc';
    const by = SETS.map(s => [s, ids.filter(id => BYID[id] && BYID[id].set === s).length]).filter(x => x[1]);
    pc.textContent = by.map(([s,n]) => `${s} ${n}`).join(' · ') || '0';
    d.appendChild(pn); d.appendChild(pc);
    const mk = (txt, fn) => { const b = document.createElement('button'); b.className = 'mini'; b.type = 'button'; b.textContent = txt; b.onclick = e => fn(e.currentTarget); d.appendChild(b); };
    mk('読込', () => { sel = new Set(ids.filter(id => BYID[id])); lastPreset = name; target = name; savePresets(); buildSelection(); toast(`「${name}」を読み込みました`); });
    mk('追加', () => { ids.forEach(id => BYID[id] && sel.add(id)); sync(); toast('選択に追加しました'); });
    mk('上書き', () => { if (!sel.size) return toast('ケースが選択されていません'); presets[name] = [...sel]; savePresets(); renderPresets(); toast('上書きしました'); });
    mk('削除', b => twoStep(b, 'もう一度で削除', () => { delete presets[name]; if (lastPreset === name) lastPreset = ''; savePresets(); renderPresets(); toast(`「${name}」を削除しました`); }));
    box.appendChild(d);
  });
  el('pempty').textContent = Object.keys(presets).length ? '' : 'まだありません。ケースを選んで名前を付けて保存すると、次回から呼び出せます。';
}

// ---------- 書き出し・取り込み ----------
function exportData() {
  return JSON.stringify({ app:'2x2-trainer', version:2, exportedAt:new Date().toISOString(), presets, lastPreset, custom, stats, statsAuf, useAlg,
    settings: Object.assign({}, settings, { selection:[...sel] }) }, null, 1);
}
let pending = null;
function inspect(text) {
  let o; try { o = JSON.parse(text); } catch (e) { return { err:'JSON として読めませんでした' }; }
  if (!o || typeof o !== 'object') return { err:'中身を読み取れませんでした' };
  const out = { presets:{}, custom:{}, stats:null, settings:null, dropped:0, algBad:0 };
  if (o.presets && typeof o.presets === 'object') for (const [k,v] of Object.entries(o.presets)) { if (!Array.isArray(v)) continue;
    const ok = v.filter(id => BYID[id]); out.dropped += v.length - ok.length; if (ok.length) out.presets[k.slice(0,40)] = ok; }
  if (o.custom && typeof o.custom === 'object') for (const [k,v] of Object.entries(o.custom)) { if (!BYID[k] || !Array.isArray(v)) { out.algBad++; continue; }
    const ok = v.filter(a => { const p = parseAlg(a); return p && p.flat.length && solvesCase(p.flat, BYID[k].state); }); out.algBad += v.length - ok.length; if (ok.length) out.custom[k] = ok; }
  if (o.stats && typeof o.stats === 'object') { const s = {}; for (const [k,e] of Object.entries(o.stats)) if (BYID[k] && e && typeof e.n === 'number' && typeof e.sum === 'number') s[k] = { n:e.n, sum:e.sum, best:e.best ?? null, worst:e.worst ?? e.best ?? null, last:Array.isArray(e.last) ? e.last.slice(-12) : [] };
    if (Object.keys(s).length) out.stats = s; }
  if (o.statsAuf && typeof o.statsAuf === 'object') { const s = {}; for (const [k,e] of Object.entries(o.statsAuf)) if (BYID[k] && e && typeof e.n === 'number')
    s[k] = { n:e.n, ok:+e.ok||0, s:+e.s||0, r:Array.isArray(e.r) ? e.r.slice(-12) : [], t:Array.isArray(e.t) ? e.t.slice(-12) : [], u:(e.u && typeof e.u === 'object') ? e.u : {} };
    if (Object.keys(s).length) out.statsAuf = s; }
  if (o.useAlg && typeof o.useAlg === 'object') { out.useAlg = {}; for (const [k,v] of Object.entries(o.useAlg)) if (BYID[k] && typeof v === 'string') out.useAlg[k] = v; }
  if (o.settings && typeof o.settings === 'object') out.settings = o.settings;
  if (!Object.keys(out.presets).length && !Object.keys(out.custom).length && !out.stats && !out.statsAuf && !out.settings) return { err:'取り込めるデータが見つかりませんでした' };
  return out;
}
function showImport(text) {
  const d = inspect(text); if (d.err) { toast(d.err); return; }
  pending = d; el('pastepanel').classList.remove('on');
  const parts = [`プリセット ${Object.keys(d.presets).length} 件`, `自作手順 ${Object.keys(d.custom).length} ケース分`, `統計 ${d.stats ? Object.keys(d.stats).length : 0} ケース分`, `AUF の統計 ${d.statsAuf ? Object.keys(d.statsAuf).length : 0} ケース分`, d.settings ? '選択状態・設定あり' : '選択状態・設定なし'];
  if (d.dropped) parts.push(`無効なケース ${d.dropped} 件は除外`); if (d.algBad) parts.push(`検証に通らない手順 ${d.algBad} 件は除外`);
  el('impsum').textContent = 'このデータの中身: ' + parts.join(' / ');
  el('imp-presets').disabled = !Object.keys(d.presets).length; el('imp-custom').disabled = !Object.keys(d.custom).length;
  el('imp-stats').disabled = !d.stats && !d.statsAuf; el('imp-replace').disabled = !d.stats && !d.statsAuf; el('imp-settings').disabled = !d.settings;
  ['imp-presets','imp-custom','imp-stats'].forEach(i => { el(i).checked = !el(i).disabled; });
  el('imppanel').classList.add('on');
}
function runImport() {
  if (!pending) return; const d = pending;
  const opt = { presets:el('imp-presets').checked, custom:el('imp-custom').checked, stats:el('imp-stats').checked, replace:el('imp-replace').checked, settings:el('imp-settings').checked };
  const msg = [];
  if (opt.presets) { let a = 0, m = 0; for (const [k,v] of Object.entries(d.presets)) { if (presets[k]) { presets[k] = [...new Set(presets[k].concat(v))]; m++; } else { presets[k] = v; a++; } } savePresets(); if (a) msg.push(`プリセット ${a} 件追加`); if (m) msg.push(`${m} 件に統合`); }
  if (opt.custom) { for (const [k,v] of Object.entries(d.custom)) custom[k] = [...new Set((custom[k] || []).concat(v))]; save('custom', custom); msg.push(`自作手順 ${Object.keys(d.custom).length} ケース`); }
  if (opt.stats && d.stats) { if (opt.replace) stats = {};
    for (const [k,e] of Object.entries(d.stats)) { const s = stats[k];
      if (!s) stats[k] = e; else { s.n += e.n; s.sum += e.sum; s.best = [s.best, e.best].filter(v => v != null).reduce((a,b) => Math.min(a,b), Infinity); if (s.best === Infinity) s.best = null;
        s.worst = [s.worst, e.worst].filter(v => v != null).reduce((a,b) => Math.max(a,b), -Infinity); if (s.worst === -Infinity) s.worst = null; s.last = s.last.concat(e.last).slice(-12); } }
    save('stats', stats); msg.push(`統計 ${Object.keys(d.stats).length} ケース`); }
  if (opt.stats && d.statsAuf) { if (opt.replace) statsAuf = {};
    for (const [k,e] of Object.entries(d.statsAuf)) { const s = statsAuf[k];
      if (!s) statsAuf[k] = e; else { s.n += e.n; s.ok += e.ok; s.s += e.s; s.r = s.r.concat(e.r).slice(-12); s.t = s.t.concat(e.t).slice(-12);
        for (const [u,v] of Object.entries(e.u)) { const x = s.u[u] || (s.u[u] = [0,0]); x[0] += +v[0]||0; x[1] += +v[1]||0; } } }
    save('statsAuf', statsAuf); msg.push(`AUF の統計 ${Object.keys(d.statsAuf).length} ケース`); }
  if (opt.custom && d.useAlg) { Object.assign(useAlg, d.useAlg); save('useAlg', useAlg); }
  if (opt.settings && d.settings) { const s2 = d.settings;
    if (Array.isArray(s2.selection)) sel = new Set(s2.selection.filter(id => BYID[id]));
    for (const k of Object.keys(DEF)) if (s2[k] !== undefined && typeof s2[k] === typeof DEF[k]) settings[k] = k === 'scheme' ? Object.assign({}, SCHEME0, s2[k]) : s2[k];
    settings.scheme = Object.assign({}, SCHEME0); if (!Array.isArray(settings.filter)) settings.filter = []; saveSettings(); saveSel(); msg.push('設定を復元'); }
  pending = null; el('imppanel').classList.remove('on');
  initControls(); renderPresets(); buildSelection();
  toast(msg.length ? msg.join(' / ') : '取り込むものを選んでください');
}

// ---------- 練習 ----------
let practicing = false, cur = null, nextQ = null, prev = null, times = [], prefetchT = 0, state = 'idle', holdT = 0, t0 = 0, raf = 0;
const HOLD = 350, HINT = '長押し（スペース / 画面タッチ）→ 離してスタート、もう一度でストップ（Esc で取り消し）';
function makeQ() { const id = nextCaseId(); return id ? buildQuestion(BYID[id]) : null; }
function newScramble() {
  cur = nextQ || makeQ(); nextQ = null; paintScramble(); renderRunStats();
  clearTimeout(prefetchT); prefetchT = setTimeout(() => { if (practicing && !nextQ && state !== 'running') nextQ = makeQ(); }, 60);
}
function paintScramble() {
  if (!cur) { el('scramble').innerHTML = `<span class="cs-sm">${settings.slow ? 'Slow の対象になるケースがありません。しきい値を下げるか、Slow をオフにしてください' : 'ケースが選ばれていません'}</span>`; return; }
  const c = BYID[cur.id];
  el('scramble').innerHTML = esc(cur.scramble) + `<span class="cs-sm">${holdText()} ・ ${cur.len} 手${settings.reveal ? ` ・ <span class="nmr">${esc(c.full)}</span>` : ''}</span>`;
}
function startRun() {
  if (!canStart()) return;
  const go = () => { practicing = true; resetQueues(); times = []; prev = null; state = 'idle'; nextQ = null;
    el('timer').className = 'timer'; el('tval').textContent = '0.00'; el('thint').textContent = HINT; syncRunControls();
    show('run'); newScramble(); renderPrev(); };
  if (DIST) return go();
  show('run'); el('scramble').innerHTML = ''; el('thint').textContent = 'スクランブル用の表を準備しています…';
  setTimeout(() => { buildTable(); go(); }, 40);
}
function syncRunControls() {
  document.querySelectorAll('#mode button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === settings.mode));
  el('slowtog').setAttribute('aria-pressed', settings.slow); el('reveal').setAttribute('aria-pressed', settings.reveal);
}
function paint() { el('tval').textContent = ((performance.now() - t0)/1000).toFixed(2); raf = requestAnimationFrame(paint); }
function holdStart() {
  if (state === 'running') { stop(); return; }
  if (state !== 'idle' || !cur) return;
  state = 'hold'; el('timer').className = 'timer hold';
  holdT = setTimeout(() => { state = 'ready'; el('timer').className = 'timer ready'; el('tval').textContent = '0.00'; }, HOLD);
}
function holdEnd() {
  if (state === 'hold') { clearTimeout(holdT); state = 'idle'; el('timer').className = 'timer'; return; }
  if (state === 'ready') { state = 'running'; el('timer').className = 'timer'; t0 = performance.now(); raf = requestAnimationFrame(paint); }
}
function stop() {
  if (state !== 'running') return;
  cancelAnimationFrame(raf); state = 'idle';
  const ms = Math.round(performance.now() - t0); el('tval').textContent = fmt(ms);
  addStat(cur.id, ms); times.push({ ms, q:cur, n: times.length + 1 }); prev = times[times.length - 1];
  newScramble(); renderPrev();
}
function cancelTiming() { if (state === 'running' || state === 'hold' || state === 'ready') { clearTimeout(holdT); cancelAnimationFrame(raf); state = 'idle'; el('timer').className = 'timer'; el('tval').textContent = '0.00'; toast('取り消しました'); } }
function avgOf(n) { if (times.length < n) return null; const a = times.slice(-n).map(x => x.ms).sort((x,y) => x-y).slice(1,-1); return a.reduce((s,x) => s+x, 0) / a.length; }
function renderRunStats() {
  const ms = times.map(x => x.ms);
  el('k-n').textContent = ms.length; el('k-last').textContent = ms.length ? fmt(ms[ms.length-1]) : '—';
  el('k-best').textContent = ms.length ? fmt(Math.min(...ms)) : '—'; el('k-worst').textContent = ms.length ? fmt(Math.max(...ms)) : '—';
  el('k-mean').textContent = ms.length ? fmt(ms.reduce((a,b) => a+b, 0) / ms.length) : '—';
  el('k-ao5').textContent = fmt(avgOf(5)); el('k-ao12').textContent = fmt(avgOf(12));
  const showProg = settings.mode === 'recap' && recapTotal; el('row-prog').style.display = showProg ? 'flex' : 'none';
  if (showProg) el('k-prog').textContent = `${queue.length + (cur ? 1 : 0)} / ${recapTotal}`;
  el('row-slow').style.display = settings.slow ? 'flex' : 'none';
  if (settings.slow) el('k-slow').textContent = `${slowPool().length} / ${selectedIds().length}`;
  const box = el('times'); box.innerHTML = '';
  times.slice().reverse().slice(0, 100).forEach(t => { const c = BYID[t.q.id];
    const d = document.createElement('div'); d.className = 'trow' + (prev && prev.n === t.n ? ' on' : '');
    d.innerHTML = `<span class="c">${t.n}. ${esc(c.set + ' ' + c.gl + ' ' + c.nl)}</span><span class="t">${fmt(t.ms)}</span>`;
    d.onclick = () => { prev = t; renderPrev(); renderRunStats(); }; box.appendChild(d); });
}
let target = null;
function renderTargets() {
  const s = el('ptarget'); if (!s) return; s.innerHTML = '';
  Object.keys(presets).forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = `${n} (${presets[n].length})`; s.appendChild(o); });
  const o = document.createElement('option'); o.value = '__new__'; o.textContent = '＋ 新しいプリセット'; s.appendChild(o);
  if (!target && lastPreset && presets[lastPreset]) target = lastPreset;
  if (!(target && presets[target])) target = Object.keys(presets)[0] || '__new__';
  s.value = target;
  const inp = !!(prev && presets[target] && presets[target].includes(prev.q.id));
  if (el('pdel')) { el('pdel').disabled = !inp; el('pdel').title = inp ? 'このプリセットから外す（d）' : 'このプリセットには登録されていません'; }
}
function addPrevToPreset(btn) {
  if (!prev) return toast('まだ記録がありません');
  let name = target;
  if (name === '__new__' || !name) { let i = 1; name = '苦手ケース'; while (presets[name]) name = '苦手ケース ' + (++i); presets[name] = []; target = name; }
  const id = prev.q.id;
  if (presets[name].includes(id)) return toast(`「${name}」に登録済みです`);
  presets[name].push(id); lastPreset = name; savePresets(); renderPresets(); renderTargets();
  toast(`${BYID[id].full} を「${name}」に追加`);
  if (btn) { const t = btn.textContent; btn.textContent = '追加しました'; btn.classList.add('done'); setTimeout(() => { btn.textContent = t; btn.classList.remove('done'); }, 1200); }
}
function removePrevFromPreset(btn) {
  if (!prev) return toast('まだ記録がありません');
  if (!presets[target]) return toast('プリセットを選んでください');
  const i = presets[target].indexOf(prev.q.id); if (i < 0) return toast(`「${target}」に登録されていません`);
  presets[target].splice(i, 1); savePresets(); renderPresets(); renderTargets(); toast(`${BYID[prev.q.id].full} を「${target}」から削除`);
  if (btn) { const t = btn.textContent; btn.textContent = '削除しました'; setTimeout(() => { btn.textContent = t; }, 1200); }
}
function renderPrev() {
  if (!prev) { el('prev').innerHTML = `<div class="sc" style="color:var(--mute);grid-column:1/5">1本目を計測すると、ここに直前のケースと手順が出ます</div>`; return; }
  const c = BYID[prev.q.id], list = algsOf(c);
  const sol = list.slice(0, 4).map((x, i) => `<span class="${i ? 'alt' : ''}">${tagOf(x)}${tagOf(x) ? ' ' : ''}${esc(x.a)}</span>`).join('')
    + (list.length > 4 ? `<span class="alt">ほか ${list.length - 4} 本</span>` : '');
  el('prev').innerHTML =
      `<div class="pfig">${cubeSvg(c.state)}</div>`
    + `<div class="nm">直前: ${esc(c.set)} ${esc(c.gl)} / <b>${esc(c.nl)}</b></div>`
    + `<div class="tm">${fmt(prev.ms)}</div>`
    + `<div class="sc">${esc(prev.q.scramble)}</div>`
    + `<div class="zsol">${sol}</div>`
    + `<div class="add"><select id="ptarget" title="追加先 / 削除元"></select><button class="addbtn" id="padd" type="button" title="このプリセットに追加（p）">★ 追加</button><button class="addbtn del" id="pdel" type="button" title="このプリセットから外す（d）">✕ 外す</button></div>`;
  renderTargets();
  el('ptarget').onchange = e => { target = e.target.value; renderTargets(); };
  el('padd').onclick = e => addPrevToPreset(e.currentTarget);
  el('pdel').onclick = e => removePrevFromPreset(e.currentTarget);
}

// ---------- 統計画面 ----------
function agg(list) {
  let n = 0, s = 0, b = null, w = null, rs = 0, rc = 0;
  for (const e of list) { if (!e) continue; n += e.n; s += e.sum;
    if (e.best != null && (b === null || e.best < b)) b = e.best; if (e.worst != null && (w === null || e.worst > w)) w = e.worst;
    const r = recent5(e); if (r !== null) { rs += r; rc++; } }
  return { n, s, b, w, avg: n ? s/n : null, r5: rc ? rs/rc : null };
}
function statRow(label, a, fig) {
  const d = document.createElement('div'); d.className = 'strow';
  const v = a[settings.metric]; const col = v === null ? 'var(--mute)' : tcol(v);
  const pct = v === null ? 0 : Math.max(4, Math.min(100, (v/1000) / settings.colorMax * 100));
  d.innerHTML = (fig ? `<div class="fig">${fig}</div>` : '') + `<div class="nmx">${esc(label)}</div>`
    + `<div class="bar"><i style="width:${pct}%;background:${col}"></i></div><div class="nx">${a.n || '-'}</div>`
    + `<div class="av" style="color:${col}">${v === null ? '—' : fmt(v)}</div>`;
  return d;
}
function groupBlock(box, label, rows) {
  const ga = agg(rows.map(r => r.e));
  const sec = document.createElement('section'); sec.className = 'stgrp';
  const head = document.createElement('div'); head.className = 'stghead';
  const gv = ga[settings.metric], col = gv === null ? 'var(--mute)' : tcol(gv);
  head.innerHTML = `<span class="caret">▶</span><span class="gname">${esc(label)}</span><span class="nx">${ga.n || '-'}</span><span class="av" style="color:${col}">${gv === null ? '—' : fmt(gv)}</span>`;
  head.onclick = () => sec.classList.toggle('open');
  const bd = document.createElement('div'); bd.className = 'body';
  rows.forEach(r => bd.appendChild(statRow(r.label, agg([r.e]), r.fig)));
  sec.appendChild(head); sec.appendChild(bd); box.appendChild(sec);
}
function renderStatScreen() {
  el('statsub').textContent = `手順セットごとに集計します。タイムの色は 0 秒に近いほど緑、${settings.colorMax} 秒に近いほど赤、${settings.colorMax} 秒以上は赤で表示します（ケース選択画面で変えられます）。`;
  const box = el('statbody'); box.innerHTML = '';
  const ks = document.createElement('div'); ks.className = 'seg'; ks.style.marginBottom = '10px';
  [['time','タイム計測'],['auf','AUF']].forEach(([k, lab]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = lab;
    b.setAttribute('aria-pressed', settings.statKind === k); b.onclick = () => { settings.statKind = k; saveSettings(); renderStatScreen(); }; ks.appendChild(b); });
  box.appendChild(ks);
  const AK = settings.statKind === 'auf', ST = AK ? statsAuf : stats;
  const sg = document.createElement('div'); sg.className = 'setgrid'; sg.id = 'statsets'; box.appendChild(sg);
  renderSetGrid('statsets', settings.statSet, s => { settings.statSet = s; saveSettings(); renderStatScreen(); }, s => BYSET[s].filter(c => ST[c.id]).length);
  if (AK) { el('statsub').textContent = '手順セットごとに集計します。AUF は正答率の色で、100% が緑、50% 以下が赤です。'; renderAufStats(box); return; }
  const set = settings.statSet, cs = BYSET[set];
  const A = agg(cs.map(c => stats[c.id])); const tried = cs.filter(c => stats[c.id]).length;
  const g = document.createElement('div'); g.className = 'sumgrid';
  [['総ソルブ', A.n], ['合計時間', A.n ? (A.s/1000/60).toFixed(1) + '分' : '—'], ['全体平均', fmt(A.avg)], ['直近5平均', fmt(A.r5)], ['ベスト', fmt(A.b)], ['ワースト', fmt(A.w)], ['練習済みケース', tried + ' / ' + cs.length]]
    .forEach(([k, v]) => { const b = document.createElement('div'); b.className = 'sumbox'; b.innerHTML = `<div class="v">${v}</div><div class="k">${k}</div>`; g.appendChild(b); });
  box.appendChild(g);
  const seg = document.createElement('div'); seg.className = 'seg'; seg.style.marginTop = '12px';
  [['avg','全体平均'],['r5','直近5回の平均']].forEach(([k, lab]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = lab;
    b.setAttribute('aria-pressed', settings.metric === k); b.onclick = () => { settings.metric = k; saveSettings(); renderStatScreen(); }; seg.appendChild(b); });
  box.appendChild(seg);
  if (!tried) { const p = document.createElement('p'); p.className = 'sub'; p.style.marginTop = '16px'; p.textContent = `${set} はまだ記録がありません。練習するとここに集計されます。`; box.appendChild(p); return; }
  const mlab = settings.metric === 'avg' ? '全体平均' : '直近5回の平均';
  const h2 = document.createElement('div'); h2.className = 'sect2'; h2.textContent = `${set} 群ごと（${mlab}）`; box.appendChild(h2);
  DATA.find(d => d.set === set).groups.forEach(G => {
    const list = cs.filter(c => c.group === G.name);
    groupBlock(box, list[0].gl, list.map(c => ({ label:c.nl, e:stats[c.id], fig:cubeSvg(c.state) })));
  });
  const val = e => settings.metric === 'avg' ? e.sum/e.n : recent5(e);
  const slow = cs.filter(c => stats[c.id] && stats[c.id].n).sort((a,b) => val(stats[b.id]) - val(stats[a.id])).slice(0, 10);
  const t = document.createElement('div'); t.className = 'sect2'; t.textContent = mlab + 'が遅いケース 上位10'; box.appendChild(t);
  const w = document.createElement('div'); w.className = 'stgrp'; const b2 = document.createElement('div'); b2.style.padding = '4px 10px';
  slow.forEach(c => b2.appendChild(statRow(c.gl + ' / ' + c.nl, agg([stats[c.id]]), cubeSvg(c.state)))); w.appendChild(b2); box.appendChild(w);
}
let statFrom = 'sel';

// ---------- AUF クイズ ----------
/* 「使う手順」を回したあと、最後に必要な AUF を当てる。
   手順を回して AUF u を回すとそろう開始状態を、そろった状態から逆にたどって作る（持ち替えを含む手順でもそのまま正しい）。
   そろった状態の向きは 24 通りのうち、開始状態の下段が白になるものを選ぶ。 */
const PRACTICE = [['time','タイム計測'],['auf','AUF']];
const PINFO = { time:'スクランブルを回して、タイマーで計ります。',
  auf:'選んだケースの図を出し、「使う手順」（既定は一覧の 1 本目。「手順も表示」で手順を押すと切り替えられます）を回したあとに必要な AUF（U\'・なし・U・U2）を当てるクイズです。手順の途中で持ち替えるときは、最後に上を黄に持ち直したときの AUF が答えです。タイマーは使いません。' };
const AUF_ORDER = ["U'", '', 'U', 'U2'];
const AUF_LABEL = { "U'":"U'", '':'なし', 'U':'U', 'U2':'U2' };
const aufK = u => u === 'U' ? 1 : u === 'U2' ? 2 : u === "U'" ? 3 : 0;
function usedAlg(c) { const list = algsOf(c); const k = useAlg[c.id]; return (k && list.find(x => normAlg(x.a) === k)) || list[0]; }
function aufStart(raw, u, c) {
  // 手順のあと、上を黄に持ち直して u を回すとそろう状態 = 「U を u だけずらした完成状態」をどれかの向きに回したもの。
  // そのうち、下段がこのケースと同じく白で、しかもこのケースになっているものを選ぶ。なければ null（その AUF はこのケースでは出ない）
  const inv = invSeq(raw), base = applyMove(SOLVED, 'U', (4 - aufK(u)) % 4); let best = null, bs = -1;
  let need = 0; for (let i=12;i<16;i++) if (c.state[i] === 3) need++;
  for (const R of ROTS) { const X = applySeq(inv, applyPerm(base, R.perm));
    let w = 0, m = 0; for (let i=12;i<16;i++) if (X[i] === 3) w++;
    if (w < need || !solvesCase(c.flat, X)) continue;
    for (let i=0;i<24;i++) if (X[i] === (i>>2)) m++;
    if (m > bs) { bs = m; best = X; } }
  return best;
}
const aufValidCache = new Map();
// このケースとこの手順で実際に出てくる AUF（EG などは、最後の AUF によって別のケースになるものがある）
function aufValid(c, alg) { const k = c.id + '\n' + alg.a; if (aufValidCache.has(k)) return aufValidCache.get(k);
  const raw = parseAlg(alg.a).raw; const v = AUF_ORDER.filter(u => aufStart(raw, u, c)); aufValidCache.set(k, v); return v; }
// 手順のあとの状態 t を、上を黄（下を白）に持ち直して見たとき、そろえるのに必要な AUF
function aufNeeded(t) { const vs = new Set();
  for (const G of ROTS) { const s = applyPerm(t, G.perm); if (s[12] !== 3 || s[13] !== 3 || s[14] !== 3 || s[15] !== 3) continue;
    AUF_ORDER.forEach(v => { if (isSolvedAny(applyMove(s, 'U', aufK(v)))) vs.add(v); }); }
  return [...vs]; }
function makeAufQuestion(c) { let alg = usedAlg(c); if (!aufValid(c, alg).length) alg = algsOf(c).find(y => aufValid(c, y).length) || alg; const raw = parseAlg(alg.a).raw, vs = aufValid(c, alg), u = vs[Math.floor(rng()*vs.length)];
  return { c, u, alg, raw, X: aufStart(raw, u, c) }; }
/* 検算: 開始状態がそのケースで、手順のあと u を回すとそろい、ほかの AUF ではそろわない */
function verifyAuf(q) {
  try { if (!q.X || !solvesCase(q.c.flat, q.X)) return false;
    return aufNeeded(applySeq(q.raw, q.X)).join('|') === q.u;
  } catch (e) { return false; }
}
function recordAuf(c, u, ok, ms) {
  const before = statsAuf[c.id] ? JSON.parse(JSON.stringify(statsAuf[c.id])) : null;
  const e = statsAuf[c.id] || (statsAuf[c.id] = { n:0, ok:0, s:0, r:[], t:[], u:{} });
  e.n++; if (ok) e.ok++; e.s += ms; e.r.push(ok ? 1 : 0); if (e.r.length > 12) e.r.shift();
  e.t.push(Math.round(ms)); if (e.t.length > 12) e.t.shift();
  const x = e.u[u] || (e.u[u] = [0,0]); x[0]++; if (ok) x[1]++;
  save('statsAuf', statsAuf); return { id:c.id, before };
}
let aCur = null, aT0 = 0, aDone = false, aLog = [], aNextT = null;
function startAuf() { if (!canStart()) return; resetQueues(); aLog = []; aCur = null; syncAufControls(); show('auf'); paintAufButtons(); aufNext(); }
function syncAufControls() {
  document.querySelectorAll('#amode button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === settings.mode));
  el('aslowtog').setAttribute('aria-pressed', settings.slow);
  el('areveal').setAttribute('aria-pressed', settings.reveal); el('areveal').textContent = settings.reveal ? 'ケース名を隠す' : 'ケース名を表示';
}
function paintAufButtons() {
  const box = el('abtns'); box.innerHTML = '';
  AUF_ORDER.forEach((u, i) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i;
    b.innerHTML = `<span class="k">${i+1}</span>${AUF_LABEL[u]}`; b.onclick = () => aufAnswer(i); box.appendChild(b); });
}
function aufNext() {
  clearTimeout(aNextT); aNextT = null;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  const id = nextCaseId();
  document.querySelectorAll('#abtns button').forEach(b => { b.className = ''; b.disabled = false; });
  el('afb').innerHTML = ''; el('aalg').textContent = '';
  if (!id) { aCur = null; el('afig').innerHTML = '';
    el('aname').innerHTML = `<span class="done">${settings.slow ? 'Slow の対象のケースがありません' : 'ケースが選ばれていません'}</span>`;
    document.querySelectorAll('#abtns button').forEach(b => { b.disabled = true; }); renderAufSide(); return; }
  let q = null; for (let k=0;k<6;k++) { q = makeAufQuestion(BYID[id]); if (verifyAuf(q)) break; q = null; }
  if (!q) { toast('出題を作れませんでした。次のケースへ進みます'); return aufNext(); }
  aCur = q; aDone = false; aT0 = performance.now(); paintAufQuestion(); renderAufSide();
}
function paintAufQuestion() {
  if (!aCur) return; const c = aCur.c;
  el('afig').innerHTML = aufSvg(aCur.X);
  el('aname').innerHTML = settings.reveal || aDone ? `${esc(c.set)} ${esc(c.gl)} / <b>${esc(c.nl)}</b>` : '&nbsp;';
}
function aufAnswer(i) {
  if (!aCur || aDone) return;
  const ms = performance.now() - aT0, ans = AUF_ORDER[i], ok = ans === aCur.u; aDone = true;
  const rec = recordAuf(aCur.c, aCur.u, ok, ms);
  aLog.push({ c:aCur.c, u:aCur.u, ans, ok, ms, rec });
  document.querySelectorAll('#abtns button').forEach(b => { const k = AUF_ORDER[+b.dataset.i]; b.disabled = true;
    if (k === aCur.u) b.className = 'right'; else if (+b.dataset.i === i) b.className = 'wrong'; });
  el('afb').innerHTML = (ok ? `<span class="ok">○ 正解</span>　${AUF_LABEL[aCur.u]}` : `<span class="ng">× 不正解</span>　正解は <b>${AUF_LABEL[aCur.u]}</b>（回答: ${AUF_LABEL[ans]}）`)
    + `　<span class="nx">${fmt(ms)} 秒 ・ ${ok ? 'まもなく次へ（スペースですぐ次へ）' : 'スペース / Enter / 図をタップで次へ'}</span>`;
  el('aalg').textContent = '使う手順: ' + aCur.alg.a + (aCur.alg.mine ? '（自作）' : '');
  paintAufQuestion(); renderAufSide();
  if (ok) aNextT = setTimeout(aufNext, 900);
}
const mark = r => r ? '<span class="o">○</span>' : '<span class="x">×</span>';
function renderAufSide() {
  const n = aLog.length, ok = aLog.filter(x => x.ok).length; let streak = 0; for (let i = n-1; i >= 0 && aLog[i].ok; i--) streak++;
  el('a-n').textContent = n; el('a-ok').textContent = ok; el('a-rate').textContent = n ? Math.round(ok/n*100) + '%' : '—';
  el('a-streak').textContent = streak; el('a-time').textContent = n ? fmt(aLog.reduce((s,x) => s + x.ms, 0) / n) : '—';
  const showProg = settings.mode === 'recap' && recapTotal; el('arow-prog').style.display = showProg ? 'flex' : 'none';
  if (showProg) el('a-prog').textContent = `${queue.length + (aCur && !aDone ? 1 : 0)} / ${recapTotal}`;
  el('arow-slow').style.display = settings.slow ? 'flex' : 'none';
  if (settings.slow) el('a-slow').textContent = `${slowPool().length} / ${selectedIds().length}`;
  const by = new Map(); aLog.forEach((x, i) => { const e = by.get(x.c.id) || { c:x.c, r:[], last:0 }; e.r.push(x.ok); e.last = i; by.set(x.c.id, e); });
  const rows = [...by.values()].sort((p, q) => q.last - p.last);
  el('acases').innerHTML = rows.length ? rows.map(e => `<div class="acrow"><span class="n">${esc(e.c.set + ' ' + e.c.gl + ' ' + e.c.nl)}</span><span class="mk">${e.r.slice(-12).map(mark).join('')}</span><span class="r">${e.r.filter(Boolean).length}/${e.r.length}</span></div>`).join('')
    : '<div class="acrow" style="color:var(--mute)">まだ回答がありません</div>';
  el('alog').innerHTML = aLog.slice().reverse().slice(0, 60).map((x, k) => `<div class="trow"><span class="c">${n-k}. ${esc(x.c.set + ' ' + x.c.gl + ' ' + x.c.nl)} ${mark(x.ok)} 正解 ${AUF_LABEL[x.u]}${x.ok ? '' : ' / 回答 ' + AUF_LABEL[x.ans]}</span><span class="t">${fmt(x.ms)}</span></div>`).join('');
}
function initAuf() {
  el('aback').onclick = () => { clearTimeout(aNextT); show('sel'); renderPresets(); buildSelection(); };
  el('areveal').onclick = () => { settings.reveal = !settings.reveal; saveSettings(); syncAufControls(); paintAufQuestion(); };
  el('aslowtog').onclick = () => { settings.slow = !settings.slow; saveSettings(); syncAufControls(); resetQueues(); aufNext(); };
  document.querySelectorAll('#amode button').forEach(b => b.onclick = () => { settings.mode = b.dataset.v; saveSettings(); syncAufControls(); resetQueues(); aufNext(); });
  el('afig').onclick = () => { if (aDone) aufNext(); };
  el('aundo').onclick = () => { if (!aLog.length) return; const x = aLog.pop(), r = x.rec;
    if (r.before) statsAuf[r.id] = r.before; else delete statsAuf[r.id]; save('statsAuf', statsAuf); renderAufSide(); toast('直前の回答を取り消しました'); };
  el('astat').onclick = () => { clearTimeout(aNextT); settings.statKind = 'auf'; if (aCur) settings.statSet = aCur.c.set; statFrom = 'auf'; renderStatScreen(); show('stat'); };
  document.addEventListener('keydown', e => {
    if (!el('scr-auf').classList.contains('on')) return;
    if (/^[1-4]$/.test(e.key)) { e.preventDefault(); if (aDone) aufNext(); else aufAnswer(+e.key - 1); return; }
    if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (aDone) aufNext(); }
  });
}
// ---------- 統計: AUF ----------
const acol = r => `hsl(${Math.round(120 * Math.max(0, Math.min(1, (r - 0.5) / 0.5)))} 85% 58%)`;
function aggAuf(list) {
  let n = 0, ok = 0, s = 0, rn = 0, rok = 0; const u = {};
  for (const e of list) { if (!e) continue; n += e.n; ok += e.ok; s += e.s; const r = e.r.slice(-5); rn += r.length; rok += r.filter(Boolean).length;
    for (const [k, v] of Object.entries(e.u || {})) { const x = u[k] || (u[k] = [0,0]); x[0] += v[0]; x[1] += v[1]; } }
  return { n, ok, rate: n ? ok/n : null, r5: rn ? rok/rn : null, avg: n ? s/n : null, u };
}
function aufRow(label, a, fig) {
  const d = document.createElement('div'); d.className = 'strow';
  const v = settings.metric === 'avg' ? a.rate : a.r5, col = v === null ? 'var(--mute)' : acol(v);
  d.innerHTML = (fig ? `<div class="fig">${fig}</div>` : '') + `<div class="nmx">${esc(label)}</div>`
    + `<div class="bar"><i style="width:${v === null ? 0 : Math.max(4, v*100)}%;background:${col}"></i></div>`
    + `<div class="nx">${a.n ? a.ok + '/' + a.n : '-'}</div><div class="tms">${a.avg === null ? '' : fmt(a.avg) + 's'}</div>`
    + `<div class="acc" style="color:${col}">${v === null ? '—' : Math.round(v*100) + '%'}</div>`;
  return d;
}
function renderAufStats(box) {
  const set = settings.statSet, cs = BYSET[set], A = aggAuf(cs.map(c => statsAuf[c.id])), tried = cs.filter(c => statsAuf[c.id]).length;
  const pc = v => v === null ? '—' : Math.round(v*100) + '%';
  const g = document.createElement('div'); g.className = 'sumgrid';
  [['総回答', A.n], ['正答率', pc(A.rate)], ['直近5回の正答率', pc(A.r5)], ['平均回答時間', A.avg === null ? '—' : fmt(A.avg)], ['練習済みケース', tried + ' / ' + cs.length]]
    .forEach(([k, v]) => { const b = document.createElement('div'); b.className = 'sumbox'; b.innerHTML = `<div class="v">${v}</div><div class="k">${k}</div>`; g.appendChild(b); });
  box.appendChild(g);
  if (!tried) { const p = document.createElement('p'); p.className = 'sub'; p.style.marginTop = '16px'; p.textContent = `${set} の AUF クイズの記録はまだありません。練習するとここに集計されます。`; box.appendChild(p); return; }
  const h0 = document.createElement('div'); h0.className = 'sect2'; h0.textContent = '正解の AUF ごとの正答率'; box.appendChild(h0);
  const ug = document.createElement('div'); ug.className = 'ugrid';
  AUF_ORDER.forEach(u => { const x = A.u[u] || [0,0], r = x[0] ? x[1]/x[0] : null; const b = document.createElement('div'); b.className = 'sumbox';
    b.innerHTML = `<div class="v" style="color:${r === null ? 'var(--mute)' : acol(r)}">${pc(r)}</div><div class="k">${AUF_LABEL[u]}（${x[1]}/${x[0]}）</div>`; ug.appendChild(b); });
  box.appendChild(ug);
  const seg = document.createElement('div'); seg.className = 'seg'; seg.style.marginTop = '14px';
  [['avg','全体の正答率'],['r5','直近5回の正答率']].forEach(([k, lab]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = lab;
    b.setAttribute('aria-pressed', settings.metric === k); b.onclick = () => { settings.metric = k; saveSettings(); renderStatScreen(); }; seg.appendChild(b); });
  box.appendChild(seg);
  const mlab = settings.metric === 'avg' ? '全体の正答率' : '直近5回の正答率';
  const h2 = document.createElement('div'); h2.className = 'sect2'; h2.textContent = `${set} 群ごと（${mlab}・正解数/回答数・平均回答時間）`; box.appendChild(h2);
  DATA.find(d => d.set === set).groups.forEach(G => {
    const list = cs.filter(c => c.group === G.name), ga = aggAuf(list.map(c => statsAuf[c.id]));
    const v = settings.metric === 'avg' ? ga.rate : ga.r5, col = v === null ? 'var(--mute)' : acol(v);
    const sec = document.createElement('section'); sec.className = 'stgrp'; const head = document.createElement('div'); head.className = 'stghead';
    head.innerHTML = `<span class="caret">▶</span><span class="gname">${esc(list[0].gl)}</span><span class="nx">${ga.n ? ga.ok + '/' + ga.n : '-'}</span><span class="av" style="color:${col}">${pc(v)}</span>`;
    head.onclick = () => sec.classList.toggle('open');
    const bd = document.createElement('div'); bd.className = 'body'; list.forEach(c => bd.appendChild(aufRow(c.nl, aggAuf([statsAuf[c.id]]), cubeSvg(c.state))));
    sec.appendChild(head); sec.appendChild(bd); box.appendChild(sec);
  });
  const val = x => settings.metric === 'avg' ? x.rate : x.r5;
  const worst = cs.map(c => ({ c, a: aggAuf([statsAuf[c.id]]) })).filter(x => x.a.n > 0).sort((x, y) => val(x.a) - val(y.a) || y.a.n - x.a.n).slice(0, 10);
  const t = document.createElement('div'); t.className = 'sect2'; t.textContent = mlab + 'が低いケース 上位10'; box.appendChild(t);
  const w = document.createElement('div'); w.className = 'stgrp'; const b2 = document.createElement('div'); b2.style.padding = '4px 10px';
  worst.forEach(x => b2.appendChild(aufRow(x.c.gl + ' / ' + x.c.nl, x.a, cubeSvg(x.c.state)))); w.appendChild(b2); box.appendChild(w);
}

// ---------- 初期化 ----------
function initControls() {
  const pt = el('ptype'); pt.innerHTML = '';
  PRACTICE.forEach(([k, lab]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = lab;
    b.setAttribute('aria-pressed', settings.practice === k); b.onclick = () => { settings.practice = k; saveSettings(); initControls(); syncSlow(); }; pt.appendChild(b); });
  el('pinfo').textContent = PINFO[settings.practice];
  el('slowsec').value = settings.slowTh; el('colormax').value = settings.colorMax;
  const ml = el('minlen'); ml.innerHTML = '';
  [[0,'制限なし'],[7,'7 手'],[9,'9 手'],[11,'11 手']].forEach(([v, lab]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = lab;
    b.setAttribute('aria-pressed', settings.minLen === v); b.onclick = () => { settings.minLen = v; saveSettings(); initControls(); }; ml.appendChild(b); });
}
function init() {
  initControls(); renderPresets(); buildSelection();
  el('vlist').onclick = () => { settings.listView = !settings.listView; saveSettings(); buildSelection(); };
  el('vopen').onclick = () => { visibleSets().forEach(s => DATA.find(d => d.set === s).groups.forEach(G => openGroups.add(s + '|' + G.name))); save('openGroups', [...openGroups]); buildSelection(); };
  el('vclose').onclick = () => { visibleSets().forEach(s => DATA.find(d => d.set === s).groups.forEach(G => openGroups.delete(s + '|' + G.name))); save('openGroups', [...openGroups]); buildSelection(); };
  el('selall').onclick = () => { visibleSets().forEach(s => BYSET[s].forEach(c => sel.add(c.id))); sync(); };
  el('selnone').onclick = () => { visibleSets().forEach(s => BYSET[s].forEach(c => sel.delete(c.id))); sync(); };
  el('psave').onclick = () => { const name = (el('pname').value || '').trim();
    if (!name) return toast('名前を入力してください'); if (!sel.size) return toast('ケースが選択されていません');
    const ex = !!presets[name]; presets[name] = [...sel]; lastPreset = name; el('pname').value = ''; savePresets(); renderPresets(); toast(ex ? `「${name}」を上書きしました` : `「${name}」を保存しました`); };
  el('pexport').onclick = () => { el('exptext').value = exportData(); el('exppanel').classList.add('on'); el('pastepanel').classList.remove('on'); el('imppanel').classList.remove('on'); };
  el('expclose').onclick = () => el('exppanel').classList.remove('on');
  el('expcopy').onclick = () => { const ta = el('exptext'); try { navigator.clipboard.writeText(ta.value).then(() => toast('コピーしました'), () => { ta.select(); toast('選択しました。コピーしてください'); }); } catch (e) { ta.select(); } };
  el('expfile').onclick = () => { try { const url = URL.createObjectURL(new Blob([exportData()], {type:'application/json'})); const a = document.createElement('a'); a.href = url;
    a.download = '2x2-trainer-' + new Date().toISOString().slice(0,10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); } catch (e) {} };
  el('pimport').onclick = () => el('pfile').click();
  el('pfile').onchange = e => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { showImport(String(r.result)); e.target.value = ''; }; r.onerror = () => { toast('ファイルを読めませんでした'); e.target.value = ''; }; r.readAsText(f); };
  el('ppaste').onclick = () => { el('pastepanel').classList.add('on'); el('exppanel').classList.remove('on'); el('pastetext').focus(); };
  el('pastecancel').onclick = () => el('pastepanel').classList.remove('on');
  el('pastego').onclick = () => { const t = el('pastetext').value; if (t.trim()) showImport(t); };
  el('impgo').onclick = runImport;
  el('impcancel').onclick = () => { pending = null; el('imppanel').classList.remove('on'); };
  el('slowon').onclick = () => { settings.slow = !settings.slow; saveSettings(); syncSlow(); };
  el('slowsec').oninput = e => { const v = parseFloat(e.target.value); if (isNaN(v)) return; settings.slowTh = Math.min(60, Math.max(0.2, v)); saveSettings(); syncSlow(); };
  el('colormax').oninput = e => { const v = parseFloat(e.target.value); if (isNaN(v) || v < 1) return; settings.colorMax = Math.min(60, v); saveSettings(); };
  el('go').onclick = () => settings.practice === 'auf' ? startAuf() : startRun();
  initAuf();
  el('back').onclick = () => { if (state === 'running') cancelAnimationFrame(raf); clearTimeout(holdT); state = 'idle'; practicing = false; nextQ = null; show('sel'); renderPresets(); buildSelection(); };
  el('reveal').onclick = () => { settings.reveal = !settings.reveal; saveSettings(); syncRunControls(); paintScramble(); };
  el('slowtog').onclick = () => { settings.slow = !settings.slow; saveSettings(); syncRunControls(); resetQueues(); nextQ = null; if (state === 'idle') newScramble(); };
  document.querySelectorAll('#mode button').forEach(b => b.onclick = () => { settings.mode = b.dataset.v; saveSettings(); syncRunControls(); resetQueues(); nextQ = null; if (state === 'idle') newScramble(); });
  el('undo').onclick = () => { const t = times.pop(); if (!t) return toast('記録がありません'); removeStat(t.q.id, t.ms); prev = times[times.length - 1] || null; renderRunStats(); renderPrev(); toast(`記録 ${t.n} を削除しました`); };
  el('statopen').onclick = () => { statFrom = 'sel'; settings.statKind = settings.practice; if (settings.filter.length) settings.statSet = settings.filter[0]; renderStatScreen(); show('stat'); };
  el('statback').onclick = () => { if (statFrom === 'auf') { show('auf'); if (aDone || !aCur) aufNext(); else aT0 = performance.now(); return; } show('sel'); buildSelection(); };
  el('statreset').onclick = e => twoStep(e.currentTarget, 'もう一度でこの種類の全記録を消去', () => { if (settings.statKind === 'auf') { statsAuf = {}; save('statsAuf', statsAuf); } else { stats = {}; save('stats', stats); } renderStatScreen(); toast('記録を消去しました'); });
  const tm = el('timer');
  tm.addEventListener('pointerdown', e => { e.preventDefault(); holdStart(); });
  tm.addEventListener('pointerup', e => { e.preventDefault(); holdEnd(); });
  tm.addEventListener('pointercancel', () => { if (state === 'hold' || state === 'ready') { clearTimeout(holdT); state = 'idle'; tm.className = 'timer'; } });
  tm.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('pointerdown', e => { if (state === 'running' && !tm.contains(e.target)) stop(); }, true);
  document.addEventListener('keydown', e => {
    if (!el('scr-run').classList.contains('on')) return;
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) holdStart(); return; }
    if (e.key === 'Escape') { cancelTiming(); return; }
    if (state === 'running') { e.preventDefault(); stop(); return; }
    if (e.key === 'p') { addPrevToPreset(el('padd')); return; }
    if (e.key === 'd') { removePrevFromPreset(el('pdel')); return; }
  });
  document.addEventListener('keyup', e => { if (!el('scr-run').classList.contains('on')) return; if (e.code === 'Space') { e.preventDefault(); holdEnd(); } });
  setTimeout(() => { try { buildTable(); } catch (e) {} }, 500);
}
if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
