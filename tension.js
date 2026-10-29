/* =========================================================
   장력 — 두 사람이 각자 판을 누르면, 두 판 사이의 실이 당겨진다
   화면: 판 A(왼쪽)와 판 B(오른쪽) 사이에 걸린 실 가닥들
         누르지 않으면 축 처지고, 각자 누른 만큼 자기 쪽 실이 팽팽해짐
         둘 다 팽팽하면 실이 엮이며 빨간 매듭이 생김
   기록: 두 사람이 모두 닿으면 시작 → 누름의 세기를 시간 순으로 저장 → 손을 떼면 끝
   출력: 두 누름 리듬으로 짠 조직도 + 장력 악보 + 글리프

   키: C 아두이노 연결 · O 프린터 연결 · R 다시 출력 · M 출력 미리보기 · G PNG 저장
       D 판 값 보기 · F 전체화면 · E 기록 백업(JSON)
       (아두이노 없이 테스트) Q 누르는 동안 = 판 A · P 누르는 동안 = 판 B
   ========================================================= */
let BG, INK, SUB, LINK;
let state = 'idle', rec = null, leftAt = 0, doneAt = -1e9, doneMsg = '';
let ten = [0, 0], strands = [], debug = false;
let lastBoth = 0;
var printNote = '';                // 프린터 상태 메시지 (D 화면)
const keyPlate = [false, false];
const STORE_KEY = 'tension-archive-v1';
let archive = [];
try { archive = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { archive = []; }

/* 판 값 (아두이노가 없으면 Q · P 키로 흉내) */
function plateNow(side){
  const v = (plateVals.length > 1 ? plateVals[side] : plateVals[0]) * RULE.plateGain[side];   // 판마다 감도 보정
  return Math.max(v, keyPlate[side] ? RULE.plateThreshold * 2 : 0);
}
const touched = side => plateNow(side) > RULE.plateThreshold;

/* ---------- p5 ---------- */
function setup(){
  createCanvas(windowWidth, windowHeight);
  const css = n => color(getComputedStyle(document.documentElement).getPropertyValue(n).trim());
  BG = css('--bg'); INK = css('--ink'); SUB = css('--sub'); LINK = css('--link');
  textFont('IBM Plex Mono');
  for (let i = 0; i < RULE.meshStrands; i++)
    strands.push({ ph: random(1000), amp: random(0.5, 1), off: random(-1, 1), seg: floor(random(7, 11)) });
}
function windowResized(){ resizeCanvas(windowWidth, windowHeight); }
const rgba = (c, a) => [red(c), green(c), blue(c), a * 255];

function draw(){
  const now = millis();
  for (const s of [0, 1]){
    const target = constrain((plateNow(s) - RULE.plateThreshold * 0.5) / (RULE.plateThreshold * 1.5), 0, 1);
    ten[s] += (target - ten[s]) * RULE.response;
  }
  flow(now);

  background(BG);
  if (RULE.layout === 'v') drawV(now); else drawThread(now);
  drawPlates();
  drawHud(now);
  if (showPrintPreview && lastPrint) drawPreview();
  if (debug) drawDebug();
}

/* ---------- 기록 흐름 ---------- */
function flow(now){
  const both = touched(0) && touched(1);
  if (both) lastBoth = now;

  if (state === 'idle' && both && now - doneAt > RULE.cooldownMs){
    state = 'recording';
    rec = { start: now, a: [], b: [], t: [] };
  }
  if (state === 'recording'){
    rec.t.push(now - rec.start); rec.a.push(plateNow(0)); rec.b.push(plateNow(1));
    if (now - lastBoth > RULE.leaveMs || now - rec.start > RULE.maxRecordMs) finish(now);
  }
  if (state === 'left' && now - leftAt > 5000) state = 'idle';
}

function finish(now){
  const dur = lastBoth - rec.start;
  if (dur < RULE.minRecordMs){ state = 'idle'; rec = null; return; }
  // 손을 뗀 뒤 꼬리는 잘라냄
  const n = rec.t.findIndex(t => t > dur);
  const cut = n < 0 ? rec.t.length : n;
  const saved = {
    id: archive.length + 1,
    name: 'TENSION ' + String(archive.length + 1).padStart(3, '0'),
    date: new Date().toISOString(),
    dur: Math.round(dur),
    t: rec.t.slice(0, cut).map(Math.round),
    a: rec.a.slice(0, cut).map(Math.round),
    b: rec.b.slice(0, cut).map(Math.round),
  };
  saved.together = togetherMs(saved);
  archive.push(saved);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(archive)); } catch (e) {}
  lastPrint = makeTensionPrint(saved);
  if (RULE.autoPrint) printCanvas(lastPrint);
  state = 'left'; leftAt = now; doneAt = now; rec = null;
  doneMsg = `${saved.name} · ${(saved.dur / 1000).toFixed(1)}s · TOGETHER ${(saved.together / 1000).toFixed(1)}s`;
}

/* 둘 다 팽팽했던 시간 (ms) */
function togetherMs(r){
  let ms = 0;
  for (let i = 1; i < r.t.length; i++)
    if (r.a[i] > RULE.plateThreshold * 1.5 && r.b[i] > RULE.plateThreshold * 1.5) ms += r.t[i] - r.t[i - 1];
  return ms;
}

/* ---------- 화면: 두 판 사이의 실 ---------- */
function anchors(){
  if (RULE.layout === 'v'){                                 // V: 위쪽 두 점 = 두 사람 (천천히 떠돎)
    const t = millis() / 1000;
    return [[width * (0.3 + 0.03 * sin(t * 0.5)), height * (0.35 + 0.03 * cos(t * 0.4))],
            [width * (0.7 + 0.03 * cos(t * 0.45)), height * (0.4 + 0.03 * sin(t * 0.55))]];
  }
  const y = height * RULE.anchorY;
  return [[width * 0.14, y], [width * 0.86, y]];
}

/* V 모양: 화면 아래 가운데(판) → 위쪽 두 사람. A 가닥은 왼쪽 점, B 가닥은 오른쪽 점으로
   각자 누른 만큼 자기 가닥이 팽팽해지고, 둘 다 팽팽하면 아래에서 엮이며 매듭 */
function drawV(now){
  const ends = anchors(), t = now / 1000, Amp = RULE.meshAmp * min(width, height);
  const bx = width / 2, by = height + 10, nodes = [];
  push(); noFill();
  strands.forEach((s, i) => {
    const side = i % 2, k = ten[side], loose = 1 - 0.85 * k, end = ends[side];
    const sx = bx + s.off * width * 0.15 * (1 - k * 0.6), pts = [];
    for (let j = 0; j <= s.seg; j++){
      const u = j / s.seg, env = sin(PI * u);
      let x = lerp(sx, end[0], u), y = lerp(by, end[1], u);
      x += (noise(s.ph, u * 2, t * 0.4) - 0.5) * 2 * Amp * s.amp * loose * env;
      y += ((noise(s.ph + 50, u * 2, t * 0.4) - 0.5) * 1.2 + 0.4 * (1 - k)) * Amp * s.amp * loose * env;
      pts.push([x, y]);
      if (j > 0 && j < s.seg) nodes.push({ x, y, g: side });
    }
    stroke(...rgba(INK, 0.18 + k * 0.6)); strokeWeight(0.6 + k * 0.8);
    beginShape(); curveVertex(...pts[0]); for (const p of pts) curveVertex(...p); curveVertex(...pts[pts.length - 1]); endShape();
  });
  const k = min(ten[0], ten[1]), R = 24 + k * 22;
  strokeWeight(0.5);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++){
    const a = nodes[i], b = nodes[j];
    if (a.g === b.g) continue;
    const d = dist(a.x, a.y, b.x, b.y);
    if (d >= R) continue;
    stroke(...rgba(INK, (1 - d / R) * (0.25 + k * 0.4)));
    line(a.x, a.y, b.x, b.y);
    if (k > 0.5 && d < R * 0.3){ noStroke(); fill(LINK); circle((a.x + b.x) / 2, (a.y + b.y) / 2, 4); noFill(); }
  }
  pop();
}

function drawThread(now){
  const [PA, PB] = anchors(), t = now / 1000, Amp = RULE.meshAmp * min(width, height);
  const nodes = [];
  push(); noFill();
  strands.forEach((s, i) => {
    const pts = [];
    for (let j = 0; j <= s.seg; j++){
      const u = j / s.seg, env = sin(PI * u);
      const loose = 1 - 0.65 * lerp(ten[0], ten[1], u);            // 왼쪽 반은 A의 장력, 오른쪽 반은 B의 장력 (팽팽해도 조금은 남는 결)
      let x = lerp(PA[0], PB[0], u) + s.off * 8 * env;
      let y = lerp(PA[1], PB[1], u);
      x += (noise(s.ph, u * 3, t * 0.35) - 0.5) * Amp * 0.9 * s.amp * loose * env;
      const sag = 0.9 * (1 - lerp(ten[0], ten[1], u));            // 아래로 처짐은 팽팽하면 완전히 사라짐
      y += (noise(s.ph + 70, u * 3, t * 0.35) - 0.5) * 0.8 * Amp * s.amp * loose * env + sag * Amp * s.amp * env;
      y += (noise(s.ph + 140, u * 6, t * 1.2) - 0.5) * 0.5 * Amp * lerp(ten[0], ten[1], u) * env;   // 팽팽할수록 촘촘히 엮인 띠로 떨림
      pts.push([x, y]);
      if (j > 0 && j < s.seg) nodes.push({ x, y, g: i % 2 });
    }
    const k = min(ten[0], ten[1]);
    stroke(...rgba(INK, 0.18 + (ten[0] + ten[1]) * 0.3));
    strokeWeight(0.6 + k * 0.8);
    beginShape(); curveVertex(...pts[0]); for (const p of pts) curveVertex(...p); curveVertex(...pts[pts.length - 1]); endShape();
  });

  // 서로 다른 가닥이 가까운 곳을 가는 선으로 엮고, 둘 다 팽팽하면 매듭
  const k = min(ten[0], ten[1]), R = 18 + k * 14;
  strokeWeight(0.5);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++){
    const a = nodes[i], b = nodes[j];
    if (a.g === b.g) continue;
    const d = dist(a.x, a.y, b.x, b.y);
    if (d >= R) continue;
    stroke(...rgba(INK, (1 - d / R) * (0.2 + k * 0.4)));
    line(a.x, a.y, b.x, b.y);
    if (k > 0.6 && d < R * 0.2 && (i + j) % 7 === 0){ noStroke(); fill(LINK); circle((a.x + b.x) / 2, (a.y + b.y) / 2, 3.5); noFill(); }
  }
  pop();
}

function drawPlates(){
  const P = anchors();
  push();
  ['A', 'B'].forEach((n, s) => {
    const [x, y] = P[s], on = touched(s);
    noStroke(); fill(on ? INK : SUB); circle(x, y, 10 + ten[s] * 10);
    textAlign(CENTER, TOP); textSize(13); text(n, x, y + 18);
    // 누름 막대
    fill(...rgba(SUB, 0.4)); rect(x - 20, y + 40, 40, 4);
    fill(on ? INK : SUB); rect(x - 20, y + 40, 40 * ten[s], 4);
  });
  pop();
}

function drawHud(now){
  push(); noStroke(); fill(INK); textSize(15); textAlign(LEFT, TOP);
  text('부유하는 움직임들\nFloating Movement', 32, 28);
  textAlign(RIGHT, TOP);
  if (state === 'idle'){
    const one = touched(0) !== touched(1);
    text(one ? TEXT.one : TEXT.idle, width - 32, 28);
    if (now - doneAt < RULE.cooldownMs){ fill(SUB); textSize(12); text('잠시 후 다시 시작할 수 있어요', width - 32, 80); }
  } else if (state === 'recording'){
    text(TEXT.rec, width - 32, 28);
    const k = constrain((now - rec.start) / RULE.maxRecordMs, 0, 1), away = now - lastBoth;
    fill(away > 200 ? LINK : INK); rect(0, 0, width * (away > 200 ? 1 - away / RULE.leaveMs : k), 4);
    textAlign(CENTER, TOP); textSize(14);
    text(away > 200 ? '손을 떼면 기록이 끝나요' : `● REC  ${Math.ceil((1 - k) * RULE.maxRecordMs / 1000)}s`, width / 2, 14);
  } else if (state === 'left'){
    textAlign(CENTER, CENTER); textSize(26); text(TEXT.left, width / 2, height * 0.3);
    textSize(16); text(TEXT.leftKO, width / 2, height * 0.3 + 36);
    fill(SUB); textSize(12); text(doneMsg, width / 2, height * 0.3 + 70);
    text(printing ? '출력 중…' : printWriter ? '종이를 가져가세요' : '프린터 미연결 (O)', width / 2, height * 0.3 + 90);
  }
  fill(SUB); textSize(12); textAlign(RIGHT, BOTTOM);
  text(`ARCHIVE  ${String(archive.length).padStart(3, '0')} RECORDS`, width - 32, height - 24);
  pop();
}

function drawDebug(){
  push(); noStroke(); fill(INK); textSize(12); textAlign(LEFT, BOTTOM);
  text(printNote || (printerInfo ? `PRINTER usb ${printerInfo.usbVendorId?.toString(16)}:${printerInfo.usbProductId?.toString(16)}` : ''), 32, height - 44);
  text(`PLATE ${plateVals.map(Math.round).join(' · ')} / ${RULE.plateThreshold}  A ${touched(0) ? '●' : '○'} B ${touched(1) ? '●' : '○'}  ${serialWriter ? '' : '(C: 아두이노 연결)'}  ${printWriter ? 'PRINTER ●' : '(O: 프린터)'}`, 32, height - 24);
  pop();
}

function drawPreview(){
  const s = Math.min(1, (height - 140) / lastPrint.height), w = lastPrint.width * s, h = lastPrint.height * s;
  push(); fill(255); noStroke(); rect(28, 96, w + 8, h + 8); pop();
  drawingContext.drawImage(lastPrint, 32, 100, w, h);
}

/* ---------- 누름 → 글리프 ---------- */
// 세게 누름 = 오르다(A/B) · 뗌 = 내리다(I/J) · 떨림 = R · 유지 = T(머묾) · 약함 = S(멈춤)
function glyphsOfPress(t, v, seg = RULE.segMs){
  const out = [], th = RULE.plateThreshold;
  for (let t0 = 0; t0 < (t[t.length - 1] || 0); t0 += seg){
    const w = [];
    for (let i = 0; i < t.length; i++) if (t[i] >= t0 && t[i] < t0 + seg) w.push(v[i]);
    if (w.length < 2) continue;
    const slope = (w[w.length - 1] - w[0]) / th, mean = w.reduce((s, x) => s + x, 0) / w.length;
    let flips = 0;
    for (let i = 2; i < w.length; i++) if (Math.sign(w[i] - w[i - 1]) * Math.sign(w[i - 1] - w[i - 2]) < 0) flips++;
    if (flips >= 4 && Math.abs(slope) < RULE.slopeSlow) out.push('R');
    else if (slope > RULE.slopeSlow) out.push(slope > RULE.slopeFast ? 'B' : 'A');
    else if (slope < -RULE.slopeSlow) out.push(slope < -RULE.slopeFast ? 'J' : 'I');
    else out.push(mean > th ? 'T' : 'S');
  }
  return out;
}

/* ---------- 출력: 조직도 + 장력 악보 + 글리프 ---------- */
function makeTensionPrint(r){
  const W = RULE.printW, M = RULE.printMargin, S = W - 2 * M;
  const ga = glyphsOfPress(r.t, r.a, RULE.printGlyphSegMs), gb = glyphsOfPress(r.t, r.b, RULE.printGlyphSegMs);
  // 글리프는 한 줄: A 글리프 → B 글리프 순서로, 종이 폭에 다 들어가게 크기를 맞춤
  const gz = Math.min(RULE.printGlyph, (S - 30) / Math.max(1, ga.length + gb.length));
  const top = 190, traceH = Math.max(220, r.dur / 1000 * RULE.tracePxPerSec);
  const glyY = top + traceH + 40;
  const H = Math.ceil(glyY + (RULE.printGlyphs ? gz + 16 : -20) + 120);

  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#000'; g.strokeStyle = '#000';

  // 머리: 제목 두 줄 (종이 폭에 맞게) · 기록 이름 · 날짜
  g.font = '500 28px "IBM Plex Mono", monospace';
  g.fillText('CAN MOVEMENTS', M, 36); g.fillText('BE LANGUAGES?', M, 70);
  g.font = '22px "IBM Plex Mono", monospace'; g.fillText(r.name, M, 106);
  const d = new Date(r.date), z = n => String(n).padStart(2, '0');
  g.fillText(`${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`, M, 136);
  g.lineWidth = 3; g.beginPath(); g.moveTo(M, 152); g.lineTo(W - M, 152); g.stroke();

  // 장력의 자취: 종이가 내려가는 방향 = 시간, 가로 = 누른 세기
  // A는 왼쪽 끝에서, B는 오른쪽 끝에서 출발해 세게 누를수록 가운데로 다가감 → 둘 다 팽팽하면 가운데서 만남
  const knotTh = RULE.plateThreshold * 1.5, mx = Math.max(RULE.plateThreshold * 2, ...r.a, ...r.b);
  const C = W / 2, gap = 6;
  const xA = v => M + (C - gap - M) * Math.min(v, mx) / mx;
  const xB = v => W - M - (W - M - C - gap) * Math.min(v, mx) / mx;
  const Y = t => top + t / 1000 * RULE.tracePxPerSec;

  g.font = '500 12px "IBM Plex Mono", monospace';
  g.font = '500 20px "IBM Plex Mono", monospace';
  g.fillText('A', M, top - 12); g.textAlign = 'right'; g.fillText('B', W - M, top - 12); g.textAlign = 'left';
  g.lineWidth = 0.5; g.setLineDash([2, 4]);                                       // 가운데 = 만나는 자리
  g.beginPath(); g.moveTo(C, top); g.lineTo(C, top + traceH); g.stroke(); g.setLineDash([]);

  // 둘 다 팽팽했던 순간: 두 자취 사이를 잇는 가는 실 (조금씩 건너뛰며)
  let lastRung = -1e9;
  g.lineWidth = 1;
  for (let i = 0; i < r.t.length; i++){
    const y = Y(r.t[i]);
    if (r.a[i] > knotTh && r.b[i] > knotTh && y - lastRung > 5){
      g.beginPath(); g.moveTo(xA(r.a[i]), y); g.lineTo(xB(r.b[i]), y); g.stroke();
      lastRung = y;
    }
  }
  // 두 자취 (굵은 선)
  g.lineWidth = RULE.traceWidth; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [v, X] of [[r.a, xA], [r.b, xB]]){
    g.beginPath();
    r.t.forEach((t, i) => i ? g.lineTo(X(v[i]), Y(t)) : g.moveTo(X(v[i]), Y(t)));
    g.stroke();
  }
  // 가장 팽팽했던 곳 = 매듭
  let best = -1, bv = 0;
  r.t.forEach((t, i) => { const v = Math.min(r.a[i], r.b[i]); if (v > bv){ bv = v; best = i; } });
  if (best >= 0 && bv > knotTh){ const y = Y(r.t[best]); g.fillRect(C - 5, y - 5, 10, 10); }

  // 글리프
  let y = RULE.printGlyphs ? glyY : glyY - 20;
  if (RULE.printGlyphs){
    let x = M;
    g.font = '500 10px "IBM Plex Mono", monospace';
    [[ga, 'A'], [gb, 'B']].forEach(([L, n]) => {
      g.fillText(n, x, y + gz / 2 + 4); x += 12;
      for (const l of L){ drawGlyph(g, l, x + gz / 2, y + gz / 2, gz * 0.9); x += gz; }
      x += 6;
    });
    y += gz + 16;
  }

  y += 8; g.lineWidth = 1; g.beginPath(); g.moveTo(M, y); g.lineTo(W - M, y); g.stroke();
  g.font = '22px "IBM Plex Mono", monospace';
  g.fillText(`TOGETHER ${(r.together / 1000).toFixed(1)}s · ${(r.dur / 1000).toFixed(1)}s`, M, y + 34);
  g.font = '20px "IBM Plex Mono", monospace';
  g.fillText('두 손이 함께 당긴 실의 기록', M, y + 66);

  const im = g.getImageData(0, 0, W, H), px = im.data;                 // 흑백 1비트
  for (let i = 0; i < px.length; i += 4){
    const v = px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11 < RULE.printThresh ? 0 : 255;
    px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return cv;
}

/* 프린터 확인용: 글자만 보내 보기 (T 키) — 글자가 나오면 연결 · 속도는 맞고, 이미지 방식만 바꾸면 됨 */
async function testPrint(){
  if (!printWriter){ printNote = '프린터 미연결 — O 키로 연결'; return; }
  try {
    await sendBytes([0x1B, 0x40]);
    await sendBytes(new TextEncoder().encode(`HELLO PRINTER ${RULE.printBaud}\n\n\n\n`));
    printNote = `글자 보냄 (${RULE.printBaud}) — 종이에 글자가 나왔는지 확인`;
  } catch (e){ printNote = '보내기 실패: ' + e.message; }
}

/* ---------- 키 (한글 입력 상태에서도 자판 위치로) ---------- */
const codeKey = e => e && /^Key[A-Z]$/.test(e.code) ? e.code[3].toLowerCase() : (key || '').toLowerCase();
function keyPressed(e){
  const k = codeKey(e);
  if (k === 'q') keyPlate[0] = true;
  if (k === 'p') keyPlate[1] = true;
  if (k === 'c') connectSerial();
  if (k === 'o') connectPrinter(true);
  if (k === 'r' && lastPrint) printCanvas(lastPrint);
  if (k === 't') testPrint();
  if (k === 'u') connectPrinterUSB();
  if (k === 'm'){ if (!lastPrint && archive.length) lastPrint = makeTensionPrint(archive[archive.length - 1]); showPrintPreview = !showPrintPreview; }
  if (k === 'g' && lastPrint){ const a = document.createElement('a'); a.download = 'tension.png'; a.href = lastPrint.toDataURL(); a.click(); }
  if (k === 'd') debug = !debug;
  if (k === 'f') fullscreen(!fullscreen());
  if (k === 'e') saveJSON(archive, 'tension-archive.json');
}
function keyReleased(e){
  const k = codeKey(e);
  if (k === 'q') keyPlate[0] = false;
  if (k === 'p') keyPlate[1] = false;
}

/* 자체 확인 (콘솔에 오류가 없으면 통과) */
console.assert(glyphsOfPress([0, 100, 200, 300, 400, 500], [0, 40, 80, 120, 160, 200]).length > 0, 'glyphsOfPress');
