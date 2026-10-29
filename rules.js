/* =========================================================
   장력 버전 규칙 — 카메라 없이 스테인리스 판 두 장으로만 작동
   왼쪽 판(A0) = 사람 A · 오른쪽 판(A1) = 사람 B
   ========================================================= */
const RULE = {
  /* --- 판 --- */
  usePlate: true,          // serial.js가 씀 (항상 true)
  plateThreshold: 50,      // 이 값보다 크면 '닿음' — D 키에서 판 값을 보고 맞추기
  plateGain: [1, 1],       // 판마다 감도 [A, B] — A 값이 B보다 작게 나오면 A를 키우기 (예: [1.6, 1])
  response: 0.18,          // 화면 실이 판 값을 따라가는 속도 (0.05 느긋 ~ 0.4 즉각)

  /* --- 기록 --- */
  minRecordMs: 1500,       // 이보다 짧으면 저장 · 출력하지 않음
  maxRecordMs: 10000,      // 최대 기록 길이
  leaveMs: 1500,           // 둘 중 한 명이라도 손을 떼고 이만큼 지나면 끝
  cooldownMs: 6000,        // 출력 뒤 다음 기록까지 쉬는 시간

  /* --- 메시워크 --- */
  layout: 'v',             // 'v' = 아래(판)에서 두 사람으로 뻗는 V · 'line' = 두 판 사이에 걸린 실
  meshStrands: 80,         // 실 가닥 수
  meshAmp: 0.22,           // 느슨할 때 처지는 폭 (화면 짧은 변 비율)
  anchorY: 0.62,           // 실 양 끝(판) 높이 (화면 비율)

  /* --- 누름 → 글리프 --- */
  segMs: 400,              // 이 단위로 누름 변화를 잘라 글리프 하나로
  slopeSlow: 0.25,         // 누름이 이만큼 변하면 '오르다/내리다' (기준값 대비 · 구간당)
  slopeFast: 1.0,          // 이만큼 크게 변하면 빠름 (채운 글리프)

  /* --- 출력 (58mm = 384px) --- */
  autoPrint: true,
  printW: 384,
  printMargin: 12,         // 종이 양옆 여백 (작을수록 그래픽이 넓어짐)
  tracePxPerSec: 100,      // 1초가 종이 몇 px인지 (클수록 자취가 길고 크게) — 10초면 약 13cm
  traceWidth: 6,           // 자취 선 두께
  printGlyphs: true,       // 출력 맨 아래에 글리프 한 줄 (A → B)
  printGlyphSegMs: 1000,   // 출력 글리프: 몇 ms마다 하나 (클수록 글리프가 적고 크게)
  printGlyph: 28, glyphPath: 'glyphs/',   // 글리프 최대 크기 (많으면 한 줄에 맞게 작아짐)
  printThresh: 160,
  printBaud: 9600,         // 프린터 테스트 페이지의 Baud rate
  printRaster: 'GSv0',     // 안 되면 'DC2'
  printBand: 24, printPace: 1.15, printFeed: 4,
};

const TEXT = {
  title:   'CAN MOVEMENTS BE LANGUAGES?',
  idle:    '두 사람이 각자 판 위에 손을 올려주세요.\nEach of you, place a hand on a plate.',
  one:     '한 사람이 더 필요해요.\nOne more hand, please.',
  rec:     '실을 당기는 중\nPulling the thread',
  left:    'YOUR MOVEMENTS HAVE LEFT.',
  leftKO:  '당신의 움직임이 남았습니다.',
};
