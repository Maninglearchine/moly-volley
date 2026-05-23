/**
 * game_render.js
 * 몰리 발리볼 — Canvas 렌더링 & 게임 루프
 *
 * 의존성:
 *   window.GameLogic  (game_logic.js에서 정의)
 *   window.IMG_BALL   (img0.png)
 *   window.IMG_LEFT   (img2.png — 오른쪽을 향하는 좌측 플레이어)
 *   window.IMG_RIGHT  (img1.png — 왼쪽을 향하는 우측 플레이어/AI)
 */

(function () {
  'use strict';

  // ─── 상수 ────────────────────────────────────────────────────────────────
  const SCALE = 2;                    // 게임월드 → 캔버스 좌표 배율
  const CANVAS_W = 864;               // 432 * SCALE
  const CANVAS_H = 608;               // 304 * SCALE

  // GameLogic 상수 참조 (game_logic.js 로드 후 접근)
  function GL() { return window.GameLogic; }

  // ─── Canvas 초기화 ───────────────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  // 'intro' | 'playing' | 'scored' | 'gameover'
  let gameState    = 'intro';
  let player1      = null;
  let player2      = null;
  let ball         = null;
  let frameCount   = 0;
  let scoredTimer  = 0;
  let lastScoredBy = null;   // 'p1' | 'p2'
  let servingLeft  = true;
  let winner       = null;

  // ─── 키 입력 ──────────────────────────────────────────────────────────────
  const keys = { left: false, right: false, up: false, z: false };

  document.addEventListener('keydown', function (e) {
    if (e.code === 'ArrowLeft')  keys.left  = true;
    if (e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'ArrowUp')    keys.up    = true;
    if (e.code === 'KeyZ')       keys.z     = true;
    // 화살표·스페이스 키의 페이지 스크롤 방지
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) {
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', function (e) {
    if (e.code === 'ArrowLeft')  keys.left  = false;
    if (e.code === 'ArrowRight') keys.right = false;
    if (e.code === 'ArrowUp')    keys.up    = false;
    if (e.code === 'KeyZ')       keys.z     = false;
  });

  // ─── 이미지 로드 여부 확인 헬퍼 ──────────────────────────────────────────
  function isImgReady(img) {
    return img && img.complete && img.naturalWidth > 0;
  }

  // ─── 렌더링 함수들 ────────────────────────────────────────────────────────

  /**
   * drawBackground()
   * 하늘(그라디언트) + 땅 + 중앙선 점선
   */
  function drawBackground() {
    const gl = GL();
    const groundY = gl ? gl.GROUND_Y * SCALE : CANVAS_H - 48;

    ctx.save();

    // 하늘 그라디언트 (연한 파랑 → 연한 초록)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0,   '#b0d4f1');  // 연한 파랑
    skyGrad.addColorStop(1,   '#c8e6c0');  // 연한 초록
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, groundY);

    // 땅 (갈색)
    ctx.fillStyle = '#8B6343';
    ctx.fillRect(0, groundY, CANVAS_W, CANVAS_H - groundY);

    // 땅 위 잔디 느낌 띠
    ctx.fillStyle = '#6aaa40';
    ctx.fillRect(0, groundY, CANVAS_W, 6);

    // 중앙 점선 (코트 구분)
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CANVAS_W / 2, 0);
    ctx.lineTo(CANVAS_W / 2, groundY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  /**
   * drawNet()
   * 네트 기둥 + 수평 줄
   */
  function drawNet() {
    const gl = GL();
    if (!gl) return;

    const netX    = gl.NET_X * SCALE;
    const groundY = gl.GROUND_Y * SCALE;
    const netTopY = gl.NET_TOP_Y !== undefined ? gl.NET_TOP_Y * SCALE : groundY - 120;
    const poleW   = 8;

    ctx.save();

    // 네트 기둥 (짙은 회색)
    ctx.fillStyle = '#444444';
    ctx.fillRect(netX - poleW / 2, netTopY, poleW, groundY - netTopY);

    // 네트 줄 (흰색 수평선, 10px 간격)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    for (let y = netTopY; y <= groundY; y += 10) {
      ctx.beginPath();
      ctx.moveTo(netX - 28, y);
      ctx.lineTo(netX + 28, y);
      ctx.stroke();
    }

    // 네트 세로 줄 (양 끝)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(netX - 28, netTopY);
    ctx.lineTo(netX - 28, groundY);
    ctx.moveTo(netX + 28, netTopY);
    ctx.lineTo(netX + 28, groundY);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * drawPlayer(player, img, isLeft)
   * 96×96 픽셀로 플레이어 그리기
   * isLeft=false 이면 좌우 반전 (ctx.scale(-1,1))
   */
  function drawPlayer(player, img, isLeft) {
    if (!player) return;

    const drawW = 96;
    const drawH = 96;
    const cx = player.x * SCALE;         // 중심 x (캔버스)
    const cy = (player.y - 64) * SCALE;  // 상단 y (캔버스)

    ctx.save();

    if (isImgReady(img)) {
      if (isLeft) {
        // 좌측 플레이어: 이미지 그대로 (img2.png는 오른쪽을 향함)
        ctx.drawImage(img, cx - drawW / 2, cy, drawW, drawH);
      } else {
        // 우측 플레이어(AI): 좌우 반전하여 왼쪽을 향하게
        ctx.translate(cx, cy + drawH / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      }
    } else {
      // 이미지 미로드 시 원(circle)으로 대체
      const r = 32;
      ctx.beginPath();
      ctx.arc(cx, cy + drawH / 2, r, 0, Math.PI * 2);
      ctx.fillStyle = isLeft ? '#7c6df0' : '#e05c8a';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * drawBall(ball)
   * ball.r*2*SCALE = 80px, 회전 적용
   */
  function drawBall(ball) {
    if (!ball) return;

    const drawSize = ball.r * 2 * SCALE;  // 20 * 2 * 2 = 80
    const cx = ball.x * SCALE;
    const cy = ball.y * SCALE;

    // 매 프레임 회전 누적
    if (typeof ball.rotation !== 'number') ball.rotation = 0;
    ball.rotation += (ball.vx || 0) * 0.04;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ball.rotation);

    if (isImgReady(window.IMG_BALL)) {
      ctx.drawImage(
        window.IMG_BALL,
        -drawSize / 2, -drawSize / 2,
        drawSize, drawSize
      );
    } else {
      // 이미지 미로드 시 흰색 원으로 대체
      ctx.beginPath();
      ctx.arc(0, 0, drawSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * drawScore()
   * 반투명 pill 박스 + P1/AI 점수 표시
   */
  function drawScore() {
    if (!player1 || !player2) return;

    const boxW = 280, boxH = 72;
    const boxX = CANVAS_W / 2 - boxW / 2;
    const boxY = 12;
    const r    = boxH / 2;

    ctx.save();

    // 반투명 검정 pill 배경
    ctx.fillStyle = 'rgba(0,0,0,0.50)';
    ctx.beginPath();
    ctx.moveTo(boxX + r, boxY);
    ctx.arcTo(boxX + boxW, boxY,         boxX + boxW, boxY + boxH, r);
    ctx.arcTo(boxX + boxW, boxY + boxH,  boxX,        boxY + boxH, r);
    ctx.arcTo(boxX,        boxY + boxH,  boxX,        boxY,        r);
    ctx.arcTo(boxX,        boxY,         boxX + boxW, boxY,        r);
    ctx.closePath();
    ctx.fill();

    // P1 점수 (좌측 1/4)
    const p1cx = CANVAS_W / 4;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(player1.score || 0), p1cx, boxY + boxH / 2);

    // P1 라벨
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('P1', p1cx, boxY + boxH - 10);

    // AI 점수 (우측 3/4)
    const p2cx = CANVAS_W * 3 / 4;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px "Segoe UI", sans-serif';
    ctx.fillText(String(player2.score || 0), p2cx, boxY + boxH / 2);

    // AI 라벨
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('AI', p2cx, boxY + boxH - 10);

    ctx.restore();
  }

  /**
   * drawIntro()
   * 타이틀 화면 오버레이
   */
  function drawIntro() {
    ctx.save();

    // 반투명 검정 오버레이
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const cx = CANVAS_W / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 타이틀 그림자
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur  = 12;

    // 타이틀
    ctx.font = 'bold 72px "Segoe UI", "Malgun Gothic", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('몰리 발리볼', cx, CANVAS_H / 2 - 80);

    // 서브 타이틀
    ctx.shadowBlur = 0;
    ctx.font = '26px "Segoe UI", "Malgun Gothic", sans-serif';
    ctx.fillStyle = 'rgba(255,255,200,0.92)';
    ctx.fillText('Moli Volley', cx, CANVAS_H / 2 - 20);

    // 조작법
    ctx.font = '22px "Segoe UI", "Malgun Gothic", sans-serif';
    ctx.fillStyle = 'rgba(200,230,255,0.85)';
    ctx.fillText('← → 이동  |  ↑ 점프  |  Z 파워히트', cx, CANVAS_H / 2 + 50);

    // 시작 안내 (깜빡임 효과)
    const blink = Math.floor(Date.now() / 500) % 2 === 0;
    if (blink) {
      ctx.font = 'bold 28px "Segoe UI", "Malgun Gothic", sans-serif';
      ctx.fillStyle = '#ffee55';
      ctx.fillText('SPACE 바로 시작', cx, CANVAS_H / 2 + 110);
    }

    ctx.restore();
  }

  /**
   * drawScored()
   * 득점 알림 박스
   */
  function drawScored() {
    if (!lastScoredBy) return;

    const label = lastScoredBy === 'p1' ? 'P1 득점!' : 'AI 득점!';
    const color = lastScoredBy === 'p1' ? '#55ddff' : '#ff7777';

    const boxW = 320, boxH = 80;
    const boxX = CANVAS_W / 2 - boxW / 2;
    const boxY = CANVAS_H / 2 - boxH / 2;

    ctx.save();

    // 반투명 배경 박스
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 16);
    ctx.fill();

    // 테두리
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 16);
    ctx.stroke();

    // 텍스트
    ctx.font = 'bold 40px "Segoe UI", "Malgun Gothic", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, CANVAS_W / 2, CANVAS_H / 2);

    ctx.restore();
  }

  /**
   * drawGameOver()
   * 게임 오버 / 결과 화면 오버레이
   */
  function drawGameOver() {
    ctx.save();

    // 반투명 검정 오버레이
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const cx = CANVAS_W / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 승자 텍스트
    const winLabel  = winner === 'p1' ? 'P1 승리!' : 'AI 승리!';
    const winColor  = winner === 'p1' ? '#55ffcc' : '#ff6688';

    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur  = 16;
    ctx.font = 'bold 68px "Segoe UI", "Malgun Gothic", sans-serif';
    ctx.fillStyle = winColor;
    ctx.fillText(winLabel, cx, CANVAS_H / 2 - 80);

    // 최종 스코어
    ctx.shadowBlur = 0;
    ctx.font = 'bold 44px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    const p1s = player1 ? (player1.score || 0) : 0;
    const p2s = player2 ? (player2.score || 0) : 0;
    ctx.fillText(`${p1s}  :  ${p2s}`, cx, CANVAS_H / 2 + 10);

    // 레이블
    ctx.font = '20px "Segoe UI", "Malgun Gothic", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('P1                              AI', cx, CANVAS_H / 2 + 52);

    // 재시작 안내 (깜빡임)
    const blink = Math.floor(Date.now() / 500) % 2 === 0;
    if (blink) {
      ctx.font = 'bold 26px "Segoe UI", "Malgun Gothic", sans-serif';
      ctx.fillStyle = '#ffee55';
      ctx.fillText('SPACE로 다시 시작', cx, CANVAS_H / 2 + 110);
    }

    ctx.restore();
  }

  // ─── 게임 초기화 / 라운드 관리 ────────────────────────────────────────────

  function resetGame() {
    const gl = GL();
    player1     = gl.createPlayer(true);
    player2     = gl.createPlayer(false);
    ball        = gl.createBall(true);
    servingLeft = true;
    winner      = null;
    frameCount  = 0;
    gameState   = 'playing';
  }

  function startNewRound(fromLeft) {
    const gl = GL();
    const p1Score = player1 ? (player1.score || 0) : 0;
    const p2Score = player2 ? (player2.score || 0) : 0;

    player1     = Object.assign(gl.createPlayer(true),  { score: p1Score });
    player2     = Object.assign(gl.createPlayer(false), { score: p2Score });
    ball        = gl.createBall(fromLeft);
    servingLeft = fromLeft;
    gameState   = 'playing';
  }

  // ─── 입력 → GameLogic 변환 ────────────────────────────────────────────────

  /**
   * 현재 키 상태를 GameLogic.Input 형태로 변환
   * (game_logic.js 의 인터페이스: { left, right, up, powerHit })
   */
  function buildInput() {
    return {
      left:      keys.left,
      right:     keys.right,
      up:        keys.up,
      powerHit:  keys.z,
    };
  }

  // ─── 게임 루프 ────────────────────────────────────────────────────────────

  function gameLoop() {
    requestAnimationFrame(gameLoop);

    const gl = GL();
    if (!gl) {
      // GameLogic 미로드 시 로딩 화면
      ctx.save();
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.font = '28px "Segoe UI", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('로딩 중...', CANVAS_W / 2, CANVAS_H / 2);
      ctx.restore();
      return;
    }

    frameCount++;

    // ── intro ──────────────────────────────────────────────────────────────
    if (gameState === 'intro') {
      // 배경만 렌더링한 뒤 인트로 오버레이
      drawBackground();
      drawNet();
      drawIntro();

      // SPACE → 게임 시작
      // keydown 이벤트로 처리하기 위해 별도 리스너 (한 번만 등록)
      return;
    }

    // ── playing ────────────────────────────────────────────────────────────
    if (gameState === 'playing') {
      // 1. 입력 처리 → player1 업데이트
      const input = buildInput();
      gl.applyInput(player1, input);

      // 2. 물리 업데이트 (player1, player2/AI, ball 모두)
      const result = gl.updatePhysics(player1, player2, ball);

      // 3. 득점 처리
      if (result === 'p1score') {
        player1.score = (player1.score || 0) + 1;
        lastScoredBy  = 'p1';
        scoredTimer   = 0;

        if (player1.score >= (gl.SCORE_TO_WIN || 5)) {
          winner    = 'p1';
          gameState = 'gameover';
        } else {
          gameState = 'scored';
        }
      } else if (result === 'p2score') {
        player2.score = (player2.score || 0) + 1;
        lastScoredBy  = 'p2';
        scoredTimer   = 0;

        if (player2.score >= (gl.SCORE_TO_WIN || 5)) {
          winner    = 'p2';
          gameState = 'gameover';
        } else {
          gameState = 'scored';
        }
      }

      // 4. 렌더링
      drawBackground();
      drawNet();
      drawPlayer(player1, window.IMG_LEFT,  true);
      drawPlayer(player2, window.IMG_RIGHT, false);
      drawBall(ball);
      drawScore();
      return;
    }

    // ── scored ─────────────────────────────────────────────────────────────
    if (gameState === 'scored') {
      scoredTimer++;

      drawBackground();
      drawNet();
      drawPlayer(player1, window.IMG_LEFT,  true);
      drawPlayer(player2, window.IMG_RIGHT, false);
      drawBall(ball);
      drawScore();
      drawScored();

      if (scoredTimer >= 90) {
        // 90프레임(약 1.5초) 후 다음 라운드
        // 마지막에 득점한 쪽의 반대편이 서브
        startNewRound(lastScoredBy !== 'p1');
      }
      return;
    }

    // ── gameover ───────────────────────────────────────────────────────────
    if (gameState === 'gameover') {
      drawBackground();
      drawNet();
      drawPlayer(player1, window.IMG_LEFT,  true);
      drawPlayer(player2, window.IMG_RIGHT, false);
      drawBall(ball);
      drawScore();
      drawGameOver();
      return;
    }
  }

  // ─── SPACE 키 처리 (상태 전환) ────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.code !== 'Space') return;
    e.preventDefault();

    if (gameState === 'intro') {
      resetGame();
    } else if (gameState === 'gameover') {
      gameState = 'intro';
      player1   = null;
      player2   = null;
      ball      = null;
      winner    = null;
    }
  });

  // ─── 공개 진입점 ──────────────────────────────────────────────────────────
  window.startGameRender = function () {
    gameLoop();
  };

})();
