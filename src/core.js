// ===== 2x2x2 core: sticker model, alg parser, optimal solver =====
// stickers: face f (U R F D L B = 0..5) * 4 + row*2 + col.  solved: s[i] = i>>2
const FACES = 'URFDLB';
const NORM = [[0,1,0],[1,0,0],[0,0,1],[0,-1,0],[-1,0,0],[0,0,-1]];
// per face: right vector, down vector (net view from outside)
const FRAME = [
  [[1,0,0],[0,0,1]],   // U (back at top)
  [[0,0,-1],[0,-1,0]], // R
  [[1,0,0],[0,-1,0]],  // F
  [[1,0,0],[0,0,-1]],  // D (front at top, seen from below)
  [[0,0,1],[0,-1,0]],  // L
  [[-1,0,0],[0,-1,0]]  // B
];
const dot = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const STK = []; // {f, p:[x,y,z], n}
for (let f=0; f<6; f++) {
  const n = NORM[f], [rt, dn] = FRAME[f];
  for (let r=0; r<2; r++) for (let c=0; c<2; c++) {
    const p = [0,1,2].map(k => n[k] + rt[k]*(c?1:-1) + dn[k]*(r?1:-1));
    // p components are in {-1,1} after clamping the normal axis
    STK.push({ f, p: p.map(v => v>0?1:-1), n });
  }
}
function stkIndex(p, n) {
  for (let i=0;i<24;i++){const s=STK[i]; if(s.p[0]===p[0]&&s.p[1]===p[1]&&s.p[2]===p[2]&&s.n[0]===n[0]&&s.n[1]===n[1]&&s.n[2]===n[2]) return i;}
  throw new Error('stk');
}
// clockwise quarter turn about unit axis a (viewed from +a): v' = a(a.v) - a x v
const rotCW = (a,v)=>{const d=dot(a,v), c=cross(a,v); return [a[0]*d-c[0], a[1]*d-c[1], a[2]*d-c[2]];};
const rotCCW = (a,v)=>{const d=dot(a,v), c=cross(a,v); return [a[0]*d+c[0], a[1]*d+c[1], a[2]*d+c[2]];};
function makePerm(axis, layerFilter) {
  const perm = new Array(24);
  for (let i=0;i<24;i++){
    const s = STK[i];
    if (layerFilter(s.p)) perm[i] = stkIndex(rotCW(axis,s.p), rotCW(axis,s.n));
    else perm[i] = i;
  }
  return perm; // sticker at i goes to perm[i]
}
const composePerm = (p, q) => p.map(j => q[j]); // p then q
const AX = { U:NORM[0], R:NORM[1], F:NORM[2], D:NORM[3], L:NORM[4], B:NORM[5], x:NORM[1], y:NORM[0], z:NORM[2] };
const BASE = {};
for (let f=0; f<6; f++) { const a = NORM[f]; BASE[FACES[f]] = makePerm(a, p => dot(p,a) > 0); }
BASE.x = makePerm(AX.x, ()=>true); BASE.y = makePerm(AX.y, ()=>true); BASE.z = makePerm(AX.z, ()=>true);
const PERM = {}; // key 'R1','R2','R3'
for (const k in BASE) { let p = BASE[k]; PERM[k+1] = p; p = composePerm(p, BASE[k]); PERM[k+2] = p; p = composePerm(p, BASE[k]); PERM[k+3] = p; }
const SOLVED = Array.from({length:24}, (_,i)=>i>>2);
function applyMove(s, f, k) { k = ((k % 4) + 4) % 4; if (!k) return s.slice(); const p = PERM[f+k], o = new Array(24); for (let i=0;i<24;i++) o[p[i]] = s[i]; return o; }
function applySeq(seq, s) { s = s ? s.slice() : SOLVED.slice(); for (const m of seq) s = applyMove(s, m.f, m.k); return s; }
const isSolvedAny = s => { for (let f=0; f<6; f++){ const c=s[f*4]; if (s[f*4+1]!==c||s[f*4+2]!==c||s[f*4+3]!==c) return false;} return true; };
const isSolvedExact = s => { for (let i=0;i<24;i++) if (s[i]!==(i>>2)) return false; return true; };

// ---------- alg parsing ----------
// returns {raw: [{f,k}] incl rotations, flat: rotation-free relabeled [{f,k}]} or null
const WIDE = { r:['L','x',1], l:['R','x',3], u:['D','y',1], d:['U','y',3], f:['B','z',1], b:['F','z',3] };
function cleanAlg(str) {
  let s = String(str).replace(/[’‘`´]/g, "'").replace(/ /g,' ').replace(/[\[\]]/g, m => m==='['?'(':')');
  // expand repetition groups (...)n, repeat innermost first
  s = s.replace(/\)\s*[*×]\s*(\d)/g, ')$1'); // (R U R' U')*2
  let guard = 0;
  while (/\(([^()]*)\)/.test(s) && guard++ < 20) {
    s = s.replace(/\(([^()]*)\)\s*(\d*)/g, (m, body, n) => {
      const b = body.replace(/[URFDLBurfdlb]w/g, '');
      if (/[A-Za-z]{2,}/.test(b) || /[^\x00-\x7f]/.test(b)) return ' '; // annotation like (FRD), (right)
      const reps = n ? parseInt(n,10) : 1; return (' ' + body + ' ').repeat(reps);
    });
  }
  return s;
}
function parseAlg(str) {
  const s = cleanAlg(str);
  const toks = s.split(/\s+/).filter(Boolean);
  const raw = [];
  for (let t of toks) {
    if (t.includes('/')) t = t.split('/')[0];
    t = t.replace(/\.+$/,'');
    if (!t) continue;
    const m = t.match(/^([URFDLBurfdlbxyz])(w?)(\d*)('?)(\d*)$/);
    if (!m) return null;
    let n = m[3] ? parseInt(m[3],10) : (m[5] ? parseInt(m[5],10) : 1);
    n = ((n % 4) + 4) % 4; if (m[4]) n = (4 - n) % 4;
    if (n === 0) continue;
    let L = m[1];
    if (m[2] === 'w') L = L.toLowerCase();
    if (WIDE[L]) { const [face, rot, dir] = WIDE[L]; raw.push({f:face, k:n}); raw.push({f:rot, k:(n*dir)%4}); }
    else raw.push({f:L, k:n});
  }
  // relabel: map[label] = fixed face letter
  let map = { U:'U', R:'R', F:'F', D:'D', L:'L', B:'B' };
  const flat = [];
  for (const m of raw) {
    if ('xyz'.includes(m.f)) {
      for (let q=0;q<m.k;q++) {
        const nm = {};
        for (const lab of FACES) {
          const v = rotCCW(AX[m.f], NORM[FACES.indexOf(lab)]);
          const src = FACES[NORM.findIndex(nn => nn[0]===v[0]&&nn[1]===v[1]&&nn[2]===v[2])];
          nm[lab] = map[src];
        }
        map = nm;
      }
    } else flat.push({ f: map[m.f], k: m.k });
  }
  return { raw, flat: simplify(flat) };
}
function simplify(seq) { // merge same-face neighbours
  const out = [];
  for (const m of seq) {
    const last = out[out.length-1];
    if (last && last.f === m.f) { const k = (last.k + m.k) % 4; out.pop(); if (k) out.push({f:m.f,k}); }
    else out.push({f:m.f,k:m.k});
  }
  return out;
}
const invSeq = seq => seq.slice().reverse().map(m => ({f:m.f, k:(4-m.k)%4}));
const fmtMove = m => m.f + (m.k===1?'':m.k===2?'2':"'");
const fmtSeq = seq => seq.map(fmtMove).join(' ');
// does flat alg solve state s, allowing y-view, pre-AUF and post-AUF?
function solvesCase(flat, s) {
  for (let c=0;c<4;c++){
    const sc = c ? applyMove(s,'y',c) : s;
    for (let a=0;a<4;a++){
      const sa = a ? applyMove(sc,'U',a) : sc;
      let r = applySeq(flat, sa);
      for (let b=0;b<4;b++){ if (isSolvedAny(r)) return {c,a,b}; r = applyMove(r,'U',1); }
    }
  }
  return null;
}

// ---------- corner cubies ----------
// positions URF UFL ULB UBR DFR DLF DBL DRB; slots: [U/D, clockwise next, next]
const CPOS = [[1,1,1],[-1,1,1],[-1,1,-1],[1,1,-1],[1,-1,1],[-1,-1,1],[-1,-1,-1],[1,-1,-1]];
const CFACES = [[0,1,2],[0,2,4],[0,4,5],[0,5,1],[3,2,1],[3,4,2],[3,5,4],[3,1,5]];
const CSTK = CPOS.map((p,i) => CFACES[i].map(f => stkIndex(p, NORM[f])));
const PIECE_KEY = CFACES.map(fs => fs.slice().sort().join(''));
function corners(s) { // -> {cp, co}
  const cp = new Array(8), co = new Array(8);
  for (let i=0;i<8;i++){
    const c = CSTK[i].map(j => s[j]);
    const o = c.findIndex(v => v===0 || v===3);
    co[i] = o; cp[i] = PIECE_KEY.indexOf(c.slice().sort().join(''));
  }
  return {cp, co};
}
function fromCorners(cp, co) {
  const s = SOLVED.slice();
  for (let i=0;i<8;i++){ const pc = CFACES[cp[i]]; for (let k=0;k<3;k++) s[CSTK[i][(co[i]+k)%3]] = pc[k]; }
  return s;
}
// rotations: all 24 whole-cube orientations
const ROTS = (()=>{
  const seen = new Map(); const q = [SOLVED.map((_,i)=>i)];
  seen.set(q[0].join(','), {perm:q[0], seq:[]});
  while (q.length){ const p = q.shift(); const e = seen.get(p.join(','));
    for (const r of ['x','y','z']) { const np = composePerm(p, BASE[r]); const key = np.join(',');
      if (!seen.has(key)) { seen.set(key, {perm:np, seq:e.seq.concat([{f:r,k:1}])}); q.push(np); } } }
  return [...seen.values()];
})();
const applyPerm = (s, p) => { const o = new Array(24); for (let i=0;i<24;i++) o[p[i]] = s[i]; return o; };
// rotation that brings piece (pos p, ori o) to DBL with ori 0
const ROT_FOR = (()=>{
  const t = new Array(24);
  const mark = SOLVED.map(()=>-1); CSTK[6].forEach((j,k)=>mark[j]=k); // mark sticker slots of piece at DBL
  // for each rotation, see where DBL piece goes; inverse rotation maps it back
  for (const R of ROTS) {
    const m = applyPerm(mark, R.perm);
    for (let i=0;i<8;i++){ const c = CSTK[i].map(j=>m[j]); if (c[0]>=0){ const o = c.indexOf(0); // slot of D sticker
      // piece at DBL rotated to pos i with ori o; the inverse rotation brings (i,o) to DBL
      const inv = ROTS.find(Q => composePerm(R.perm, Q.perm).every((v,ii)=>v===ii));
      t[i*3+o] = inv.perm; } }
  }
  return t;
})();
function normalize(s) {
  for (let i=0;i<8;i++){ const c = CSTK[i].map(j => s[j]);
    const key = c.slice().sort().join('');
    if (key === PIECE_KEY[6]) { const o = c.indexOf(3); return applyPerm(s, ROT_FOR[i*3+o]); } }
  return s;
}
// coordinates (DBL fixed)
const FACT = [1,1,2,6,24,120,720,5040];
function cpIndex(cp) { // cp over positions [0..5,7], values in 0..7 except 6
  const a = [0,1,2,3,4,5,7].map(i => cp[i] === 7 ? 6 : cp[i]);
  let idx = 0;
  for (let i=0;i<7;i++){ let c=0; for (let j=i+1;j<7;j++) if (a[j]<a[i]) c++; idx += c*FACT[6-i]; }
  return idx;
}
function cpFromIndex(idx) {
  const a = new Array(7), used = new Array(7).fill(false);
  for (let i=0;i<7;i++){ let c = Math.floor(idx / FACT[6-i]); idx %= FACT[6-i];
    for (let v=0; v<7; v++) if (!used[v]) { if (c===0){ a[i]=v; used[v]=true; break;} c--; } }
  const cp = new Array(8); const pos = [0,1,2,3,4,5,7];
  for (let i=0;i<7;i++) cp[pos[i]] = a[i] === 6 ? 7 : a[i];
  cp[6] = 6; return cp;
}
function coIndex(co) { let idx=0; for (let i=5;i>=0;i--) idx = idx*3 + co[i]; return idx; }
function coFromIndex(idx) { const co = new Array(8).fill(0); let sum=0;
  for (let i=0;i<6;i++){ co[i] = idx%3; idx = Math.floor(idx/3); sum += co[i]; }
  co[6]=0; co[7]=(3 - sum%3)%3; return co; }
const URF_MOVES = []; for (const f of 'URF') for (let k=1;k<=3;k++) URF_MOVES.push({f,k});
const ALL_MOVES = []; for (const f of FACES) for (let k=1;k<=3;k++) ALL_MOVES.push({f,k});
let DIST = null;
function buildTable() {
  if (DIST) return DIST;
  const NCP = 5040, NCO = 729, NM = 9;
  const cpMv = new Uint16Array(NCP*NM), coMv = new Uint16Array(NCO*NM);
  const id8 = [0,1,2,3,4,5,6,7], z8 = [0,0,0,0,0,0,0,0];
  for (let i=0;i<NCP;i++){ const s = fromCorners(cpFromIndex(i), z8);
    for (let m=0;m<NM;m++){ const t = applyMove(s, URF_MOVES[m].f, URF_MOVES[m].k); cpMv[i*NM+m] = cpIndex(corners(t).cp); } }
  for (let i=0;i<NCO;i++){ const s = fromCorners(id8, coFromIndex(i));
    for (let m=0;m<NM;m++){ const t = applyMove(s, URF_MOVES[m].f, URF_MOVES[m].k); coMv[i*NM+m] = coIndex(corners(t).co); } }
  const D = new Uint8Array(NCP*NCO).fill(255); D[0] = 0;
  let depth = 0, count = 1;
  while (count) { count = 0;
    for (let cp=0; cp<NCP; cp++) { const base = cp*NCO;
      for (let co=0; co<NCO; co++) { if (D[base+co] !== depth) continue;
        for (let m=0;m<NM;m++){ const n = cpMv[cp*NM+m]*NCO + coMv[co*NM+m]; if (D[n]===255){ D[n]=depth+1; count++; } } } }
    depth++; }
  DIST = D; return D;
}
const stateIndex = s => { const {cp, co} = corners(normalize(s)); return cpIndex(cp)*729 + coIndex(co); };
const hDist = s => DIST[stateIndex(s)];
const OPP = { U:'D', D:'U', R:'L', L:'R', F:'B', B:'F' };
const AXORD = { U:0, D:1, R:2, L:3, F:4, B:5 };
// IDA*: find seq solving s EXACTLY (orientation included). moves: URF or ALL. random order.
function solveExact(s, moves, maxDepth, rnd, budgetNodes, minDepth) {
  rnd = rnd || Math.random; budgetNodes = budgetNodes || 200000;
  const h0 = hDist(s); let nodes = 0; const path = [];
  const shuffled = () => { const a = moves.slice(); for (let i=a.length-1;i>0;i--){ const j = Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
  function dfs(st, depth, prev, prev2) {
    if (++nodes > budgetNodes) return false;
    if (depth === 0) return isSolvedExact(st);
    if (hDist(st) > depth) return false;
    for (const m of shuffled()) {
      if (prev && m.f === prev) continue;
      if (prev && OPP[prev] === m.f && AXORD[m.f] < AXORD[prev]) continue; // canonical order on an axis
      if (prev && prev2 && OPP[prev] === m.f && prev2 === m.f) continue;
      const t = applyMove(st, m.f, m.k); path.push(m);
      if (dfs(t, depth-1, m.f, prev)) return true;
      path.pop();
    }
    return false;
  }
  const d0 = Math.max(h0, minDepth || 0);
  for (let d = d0; d <= Math.min(maxDepth, d0 + 4); d++) { if (dfs(s, d, null, null)) return path.slice(); if (nodes > budgetNodes) break; }
  return null;
}
// case state for an alg: among the 24 final orientations, choose the start with the first layer (white) on D,
// preferring the one whose pieces sit in standard colours (most stickers equal to solved)
function caseState(flat) {
  const inv = invSeq(flat); let best = null, bs = -1;
  for (const R of ROTS) {
    const s = applySeq(inv, applyPerm(SOLVED, R.perm));
    let w = 0, m = 0; for (let i=12;i<16;i++) if (s[i]===3) w++; for (let i=0;i<24;i++) if (s[i]===(i>>2)) m++;
    const sc = w*100 + m; if (sc > bs) { bs = sc; best = s; }
  }
  return best;
}
