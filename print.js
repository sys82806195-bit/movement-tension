/* =========================================================
   감열 프린터 출력 (58mm · 384px · 흑백)
   기록이 끝나면: 위 = 두 사람의 선이 엮인 형태, 아래 = 글리프 줄
   O 프린터 연결 · R 다시 출력 · M 미리보기 · G PNG 저장
   ========================================================= */
let lastPrint = null, showPrintPreview = false;
const LETTERS = 'ABCDEFGHIJKLMNOPQRST';

/* ---------- 글리프 (glyphs/A~T.svg) ---------- */
const GLYPH = {};
for (const l of LETTERS){
  const im = new Image();
  im.onload = () => (im.ok = true);
  im.src = RULE.glyphPath + l + '.svg';
  GLYPH[l] = im;
}
function drawGlyph(ctx, l, x, y, s){
  const im = GLYPH[l];
  if (im && im.ok) ctx.drawImage(im, x - s / 2, y - s / 2, s, s);
  else { ctx.font = `${Math.round(s * .7)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l, x, y); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; }
}

/* ---------- 선 → 글리프 (A~P 8방향 × 느림/빠름 · Q 감기 · R 떨림 · S 멈춤 · T 머묾) ---------- */
function glyphsOf(pts){                     // pts = [[x, y, 시간ms, 속도], ...]
  const out = [];
  if (pts.length < 2) return out;
  const T = RULE.segMs, tEnd = pts[pts.length - 1][2];
  let i = 0, prev = null, still = 0, flag = 0;
  for (let t0 = pts[0][2]; t0 < tEnd; t0 += T){
    const w = [];
    while (i < pts.length && pts[i][2] < t0 + T) w.push(pts[i++]);
    const seq = prev ? [prev, ...w] : w;
    if (w.length) prev = w[w.length - 1];

    let path = 0, turn = 0, rev = 0, pa = null;
    for (let k = 1; k < seq.length; k++){
      const dx = seq[k][0] - seq[k-1][0], dy = seq[k][1] - seq[k-1][1];
      path += Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      if (pa !== null){
        let da = a - pa;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        turn += da;
        if (Math.abs(da) > 2.3) rev++;
      }
      pa = a;
    }
    const speed = path / (T / 1000);
    if (speed < RULE.stillSpeed){                                   // 멈춤 · 머묾
      still += T;
      if (flag === 0){ flag = 1; out.push('S'); }
      else if (flag === 1 && still > RULE.stayMs){ flag = 2; out.push('T'); }
      continue;
    }
    still = 0; flag = 0;
    const dx = seq[seq.length-1][0] - seq[0][0], dy = seq[seq.length-1][1] - seq[0][1];
    if (Math.abs(turn) > RULE.coilTurn){ out.push('Q'); continue; }
    if (rev >= 2 && path > Math.hypot(dx, dy) * 2.5){ out.push('R'); continue; }
    let ang = Math.atan2(dx, -dy);                                  // 0 = 위, 시계 방향
    if (ang < 0) ang += 2 * Math.PI;
    const k = Math.round(ang / (Math.PI / 4)) % 8;
    out.push(LETTERS[k * 2 + (speed > RULE.fastSpeed ? 1 : 0)]);
  }
  return out;
}

/* ---------- 출력 이미지 ---------- */
function makePrint(saved, names){
  const W = RULE.printW, M = 14, S = W - 2 * M;
  // 두 사람 = 기록의 선 두 개, 왼쪽에 있던 사람이 A
  const people = saved.strokes.slice().sort((a, b) => meanX(a) - meanX(b)).slice(0, 2);
  const lines = people.map(st => rdp(st.pts, RULE.simplify));
  const glyphs = people.map(st => glyphsOf(st.pts));

  // 두 선이 차지한 영역을 종이 폭에 맞춤 (화면 비율 유지)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of lines.flat()){ x0 = Math.min(x0, p[0] * width); x1 = Math.max(x1, p[0] * width); y0 = Math.min(y0, p[1] * height); y1 = Math.max(y1, p[1] * height); }
  const sc = Math.min(S / Math.max(x1 - x0, 1), S * 1.4 / Math.max(y1 - y0, 1));
  const ox = M + (S - (x1 - x0) * sc) / 2;
  const P = p => [ox + (p[0] * width - x0) * sc, 0 + (p[1] * height - y0) * sc];

  const top = 92, weaveH = (y1 - y0) * sc;
  const gs = Math.floor((S - 24) / RULE.glyphRowN);
  const rows = g => Math.max(1, Math.ceil(g.length / RULE.glyphRowN));
  const H = Math.ceil(top + weaveH + 36 + (rows(glyphs[0]) + rows(glyphs[1] || [])) * (gs + 6) + 90);

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#000'; g.strokeStyle = '#000';

  // 머리
  g.font = '500 15px "IBM Plex Mono", monospace'; g.fillText('CAN MOVEMENTS BE LANGUAGES?', M, 26);
  g.font = '12px "IBM Plex Mono", monospace';
  g.fillText(saved.name, M, 46);
  const dt = new Date(saved.date), z = n => String(n).padStart(2, '0');           // 한국 시간으로
  g.fillText(`${dt.getFullYear()}.${z(dt.getMonth() + 1)}.${z(dt.getDate())} ${z(dt.getHours())}:${z(dt.getMinutes())}:${z(dt.getSeconds())}`, M, 62);
  g.lineWidth = 2; g.beginPath(); g.moveTo(M, 74); g.lineTo(W - M, 74); g.stroke();

  // 두 사람의 선 — 화면과 같은 격자 직조 (A 가로 먼저 · B 세로 먼저)
  g.save(); g.translate(0, top);
  const gp = RULE.printGrid;
  const cells = lines.map((p, li) => gridCells(p, gp, q => P(q)[0], q => P(q)[1], li === 0));
  const pieces = cells.flatMap(c => weavePieces(c, gp, RULE.smooth));
  for (const over of [false, true]) for (const q of pieces){
    if (q.over !== over) continue;
    const path = () => { g.beginPath(); q.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); };
    g.lineJoin = 'round';
    g.strokeStyle = '#fff'; g.lineCap = 'butt'; g.lineWidth = RULE.printStroke + RULE.printGap * 2; path(); g.stroke();
    g.strokeStyle = '#000'; g.lineCap = 'round'; g.lineWidth = RULE.printStroke; path(); g.stroke();
  }

  // 두 사람이 함께 지나간 칸 = 매듭 (화면의 빨간 점)
  let knots = 0;
  if (cells.length === 2){
    const seen = new Set(cells[0].map(c => c + ''));
    for (const k of new Set(cells[1].map(c => c + ''))){
      if (!seen.has(k)) continue;
      const [cx, cy] = k.split(',').map(Number);
      g.fillStyle = '#000'; g.fillRect(cx * gp - 5, cy * gp - 5, 10, 10);
      knots++;
    }
  }
  // 시작점에 A · B 표시
  g.fillStyle = '#000'; g.font = '500 12px "IBM Plex Mono", monospace';
  cells.forEach((c, li) => g.fillText('AB'[li], c[0][0] * gp + 6, c[0][1] * gp - 6));
  g.restore();

  // 글리프 줄
  let y = top + weaveH + 18;
  g.lineWidth = 1; g.beginPath(); g.moveTo(M, y); g.lineTo(W - M, y); g.stroke();
  y += 12;
  glyphs.forEach((L, li) => {
    g.font = '500 13px "IBM Plex Mono", monospace'; g.fillText('AB'[li], M, y + gs * .6);
    L.forEach((l, i) => drawGlyph(g, l, M + 24 + (i % RULE.glyphRowN) * gs + gs / 2, y + Math.floor(i / RULE.glyphRowN) * (gs + 6) + gs / 2, Math.min(gs * .85, RULE.printGlyph)));
    y += rows(L) * (gs + 6);
  });

  // 꼬리
  y += 8;
  g.lineWidth = 1; g.beginPath(); g.moveTo(M, y); g.lineTo(W - M, y); g.stroke();
  g.font = '12px "IBM Plex Mono", monospace';
  g.fillText(`KNOTS ${knots} · ${(saved.stats.duration / 1000).toFixed(1)}s`, M, y + 22);
  g.fillText(names.length ? 'CONNECTED WITH' : 'FIRST THREAD', M, y + 40);
  if (names.length) g.fillText(names.slice(0, 3).join(' · '), M, y + 56);

  // 흑백 1비트
  const im = g.getImageData(0, 0, W, H), d = im.data;
  for (let i = 0; i < d.length; i += 4){
    const v = d[i] * .3 + d[i+1] * .59 + d[i+2] * .11 < RULE.printThresh ? 0 : 255;
    d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
  }
  g.putImageData(im, 0, 0);
  return cv;
}

function printRecord(saved, names){
  lastPrint = makePrint(saved, names);
  if (RULE.autoPrint) printCanvas(lastPrint);
}

function savePrint(){
  if (!ensurePrint()) return;
  const a = document.createElement('a');
  a.download = (archive.length ? archive[archive.length - 1].name.replace(' ', '-') : 'print') + '.png';
  a.href = lastPrint.toDataURL(); a.click();
}

// 새로고침 뒤에는 출력물이 메모리에 없으니, 아카이브의 마지막 기록으로 다시 만듦
function ensurePrint(){
  if (!lastPrint && archive.length) lastPrint = makePrint(archive[archive.length - 1], []);
  return lastPrint;
}

function drawPrintPreview(){
  if (!ensurePrint()) return;
  const s = Math.min(1, (height - 150) / lastPrint.height), w = lastPrint.width * s, h = lastPrint.height * s;
  const x = 32, y = 110;                     // 왼쪽 위 글자 아래
  push(); noStroke(); fill(255); rect(x - 6, y - 6, w + 12, h + 12); stroke(INK); noFill(); rect(x - 6, y - 6, w + 12, h + 12); pop();
  drawingContext.drawImage(lastPrint, x, y, w, h);
}

/* ---------- 프린터 (Web Serial · ESC/POS) — 아두이노와 다른 포트 ---------- */
let printWriter = null, printing = false;
const PRINTER_KEY = 'printer-port';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function connectPrinter(ask){
  if (!('serial' in navigator)) return;
  try {
    let port = null;
    if (ask) port = await navigator.serial.requestPort();               // O 키: 항상 직접 고름
    else {
      // 페이지를 열 때 자동 연결: 저장된 프린터와 같은 장치가 '딱 하나'일 때만
      // (아두이노와 프린터가 같은 USB 칩이면 둘을 구분할 수 없어서 자동 연결하지 않음)
      const saved = JSON.parse(localStorage.getItem(PRINTER_KEY) || 'null');
      if (!saved || !saved.usbVendorId) return;
      const same = (await navigator.serial.getPorts()).filter(p => {
        const i = p.getInfo(); return i.usbVendorId === saved.usbVendorId && i.usbProductId === saved.usbProductId;
      });
      if (same.length !== 1) return;
      port = same[0];
    }
    if (!port) return;
    if (port === arduinoPort){ console.warn('아두이노 포트를 골랐어요. 프린터 포트를 다시 고르세요.'); printNote = '그건 아두이노 포트예요 — O를 다시 눌러 다른 포트를 고르세요'; return; }
    await port.open({ baudRate: RULE.printBaud });
    printWriter = port.writable.getWriter();
    localStorage.setItem(PRINTER_KEY, JSON.stringify(port.getInfo()));
    printerInfo = port.getInfo();
    console.log('프린터 연결됨', printerInfo);
  } catch (e){ if (ask){ console.warn('프린터 연결 실패', e); printNote = '프린터 연결 실패: ' + e.message; } }
}
connectPrinter(false);

let printerInfo = null;

/* USB 프린터 모드 (U 키) — 프린터가 시리얼 포트로 안 잡힐 때
   크롬의 WebUSB로 프린터에 바로 붙어서 같은 ESC/POS 데이터를 보냄 */
async function connectPrinterUSB(){
  if (!('usb' in navigator)){ printNote = '이 브라우저는 USB 연결을 못 해요 (크롬에서 열기)'; return; }
  try {
    const dev = await navigator.usb.requestDevice({ filters: [] });
    await dev.open();
    if (dev.configuration === null) await dev.selectConfiguration(1);
    for (const itf of dev.configuration.interfaces) for (const alt of itf.alternates){
      const ep = alt.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');   // 데이터를 보내는 통로
      if (!ep) continue;
      await dev.claimInterface(itf.interfaceNumber);
      printWriter = { usb: true, write: u => dev.transferOut(ep.endpointNumber, u) };
      printerInfo = { usbVendorId: dev.vendorId, usbProductId: dev.productId };
      printNote = `USB 프린터 연결됨 (${dev.productName || '이름 없음'}) — T로 테스트`;
      return;
    }
    printNote = '이 장치에서 출력 통로를 못 찾았어요 — 다른 장치를 골라 보세요';
  } catch (e){ printNote = 'USB 연결 실패: ' + e.message; }
}
async function sendBytes(arr){
  const u = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
  // 3초 안에 못 보내면 멈춘 것: 프린터가 아닌 포트를 골랐거나, 프린터가 데이터를 받지 않는 상태
  await Promise.race([printWriter.write(u), sleep(3000).then(() => { throw new Error('프린터가 응답하지 않아요 (포트 확인)'); })]);
  if (!printWriter.usb) await sleep(u.length * 10 / RULE.printBaud * 1000 * RULE.printPace + 2);   // 시리얼일 때만 천천히 (USB는 프린터가 알아서 받음)
}

async function printCanvas(cv){
  if (!cv || !printWriter) return;
  if (printing){ console.warn('이전 출력이 아직 진행 중'); return; }
  printing = true;
  try {
    const W = cv.width, H = cv.height, bw = Math.ceil(W / 8);
    const d = cv.getContext('2d').getImageData(0, 0, W, H).data;
    await sendBytes([0x1B, 0x40]);                                       // 초기화
    for (let y0 = 0; y0 < H; y0 += RULE.printBand){
      const h = Math.min(RULE.printBand, H - y0);
      const head = RULE.printRaster === 'DC2' ? [0x12, 0x2A, h, bw] : [0x1D, 0x76, 0x30, 0, bw & 255, bw >> 8, h & 255, h >> 8];
      const out = new Uint8Array(head.length + bw * h);
      out.set(head);
      for (let y = 0; y < h; y++) for (let x = 0; x < W; x++)
        if (d[((y0 + y) * W + x) * 4] < 128) out[head.length + y * bw + (x >> 3)] |= 0x80 >> (x & 7);
      await sendBytes(out);
    }
    await sendBytes([0x1B, 0x64, RULE.printFeed]);                       // 종이 밀기
  } catch (e){ console.warn('출력 실패', e); if (typeof printNote !== 'undefined') printNote = '출력 실패: ' + e.message; }
  printing = false;
}
