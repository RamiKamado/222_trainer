// index.html の検算: node tests/verify.js
// ページ内の <script> をそのまま Node で評価し（DOM なし）、データ・スクランブル・AUF クイズを確かめる。
'use strict';
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const body = html.split('<script>')[1].split('</script>')[0];
const t0 = Date.now();
const result = (0, eval)(`(function(){ ${body}
  const out = { fails: [] }; const fail = m => { if (out.fails.length < 20) out.fails.push(m); out.nfail = (out.nfail || 0) + 1; };
  // 1. 件数
  out.cases = CASES.length; out.sets = SETS.length;
  // 2. 各ケースの手順（表・取り込んだ手順）がそのケースを解く
  let nalg = 0;
  for (const c of CASES) for (const x of algsOf(c)) { nalg++; const p = parseAlg(x.a); if (!p || !solvesCase(p.flat, c.state)) fail('alg ' + c.id + ' ' + x.a); }
  out.algs = nalg;
  // 3. 別のケースどうしが同じ状態になっていない（同じセット内）
  for (const s of SETS) { const cs = BYSET[s]; for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) if (solvesCase(cs[i].flat, cs[j].state)) fail('dup ' + cs[i].id + ' = ' + cs[j].id); }
  // 4. スクランブル: 全ケース 2 本ずつ。目標状態になり、同じ面の連続がなく、表の手順で解ける
  buildTable(); let nq = 0, maxLen = 0;
  for (const c of CASES) for (let k = 0; k < 2; k++) { const q = buildQuestion(c); nq++; if (!q || !verifyQuestion(q)) fail('scramble ' + c.id); else maxLen = Math.max(maxLen, q.len); }
  out.scrambles = nq; out.maxScrambleLen = maxLen;
  // 5. AUF クイズ: 既定の「使う手順」で出る AUF それぞれについて、答えがちょうど 1 つ
  let na = 0;
  for (const c of CASES) { const alg = usedAlg(c), raw = parseAlg(alg.a).raw, vs = aufValid(c, alg);
    if (!vs.length) fail('auf none ' + c.id);
    for (const u of vs) { na++; if (!verifyAuf({ c, u, alg, raw, X: aufStart(raw, u, c) })) fail('auf ' + c.id + ' ' + u); } }
  out.aufQuestions = na;
  // 6. ケース図の fd（VisualCube）が 24 文字
  for (const c of CASES) { if (fdTop(c.state).length !== 24 || fdBottom(c.state).length !== 24) fail('fd ' + c.id); }
  return out; })()`);
console.log(`ケース ${result.cases}（${result.sets} セット） / 手順 ${result.algs} 本 / スクランブル ${result.scrambles} 本（最長 ${result.maxScrambleLen} 手） / AUF 問題 ${result.aufQuestions} 問`);
if (result.nfail) { console.log(`NG: ${result.nfail} 件`); result.fails.forEach(f => console.log('  ' + f)); process.exit(1); }
console.log(`OK（${((Date.now() - t0) / 1000).toFixed(1)} 秒）`);
