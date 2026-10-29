/* =========================================================
   웹 → 아두이노 (Web Serial, 크롬 전용)
   C 키를 누르면 포트 선택 창이 뜨고, 연결되면 서보 각도를 보냄
   보내는 형식: "90,90,90,90\n"  (서보 순서대로 각도)
   + 같은 각도를 Blender 실시간 시뮬레이션에도 보냄 (localhost:8765)
   ========================================================= */
let serialWriter = null, lastSend = 0, arduinoPort = null;

async function connectSerial(){
  if (!('serial' in navigator)){ alert('Web Serial은 크롬에서만 작동해요.'); return; }
  try {
    const port = await navigator.serial.requestPort();
    arduinoPort = port;
    await port.open({ baudRate: 115200 });
    serialWriter = port.writable.getWriter();
    readPlate(port);                                // 아두이노가 보내는 판 값 읽기
    console.log('아두이노 연결됨');
  } catch (e){ console.warn('연결 취소 또는 실패', e); }
}

/* 스테인리스 판 (아두이노 → 웹): 한 줄에 "A값" 또는 "A값,B값", 손이 닿을수록 커짐
   판 2장이면 A0 = 왼쪽 사람(A) · A1 = 오른쪽 사람(B) */
let plateVals = [0];
async function readPlate(port){
  const dec = new TextDecoderStream();
  port.readable.pipeTo(dec.writable).catch(() => {});
  const rd = dec.readable.getReader();
  let buf = '';
  try {
    for (;;){
      const { value, done } = await rd.read();
      if (done) break;
      buf += value;
      let i;
      while ((i = buf.indexOf('\n')) >= 0){
        const vs = buf.slice(0, i).split(',').map(parseFloat); buf = buf.slice(i + 1);
        if (!vs.length || !vs.every(Number.isFinite)) continue;
        if (plateVals.length !== vs.length) plateVals = vs.slice();     // 판 개수가 바뀌면 바로 맞춤
        else vs.forEach((v, k) => plateVals[k] += (v - plateVals[k]) * 0.7);   // 튀는 값만 살짝 완화 (낮을수록 느려짐)
      }
    }
  } catch (e){ console.warn('판 읽기 끊김', e); }
}
// 판을 안 쓰면(usePlate: false) 항상 '닿음'으로 봄 → 예전처럼 카메라만으로 작동
// 판이 2장이면 두 사람 모두 닿아 있어야 '닿음'
const plateTouched = () => !RULE.usePlate || plateVals.every(v => v > RULE.plateThreshold);
// 사람(A = 0 · B = 1)별 판 값 — 판이 1장이면 둘 다 같은 값
const plateOf = side => plateVals[Math.min(side, plateVals.length - 1)];

function sendServos(angles){
  sendBlender(angles);                              // ← 추가: Blender 로도 보냄 (아두이노 없어도 작동)
  if (!serialWriter) return;
  const now = performance.now();
  if (now - lastSend < 33) return;                 // 초당 30번까지만
  lastSend = now;
  const line = angles.map(a => Math.round(a)).join(',') + '\n';
  serialWriter.write(new TextEncoder().encode(line)).catch(() => { serialWriter = null; });
}

// ---------- 추가: Blender 실시간 시뮬레이션 ----------
const BLENDER_URL = 'http://localhost:8765';
let blenderNext = 0;

function sendBlender(angles){
  const now = performance.now();
  if (now < blenderNext) return;
  blenderNext = now + 33;                           // 초당 30번까지만
  fetch(BLENDER_URL, {
    method: 'POST',
    body: JSON.stringify({ a: angles.map(a => Math.round(a)), rest: RULE.servoRest }),   // 순서 = 핀 3, 5, 6, 9
  }).catch(() => { blenderNext = performance.now() + 2000; });                           // Blender 꺼져 있으면 2초 쉼
}