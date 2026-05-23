/**
 * game_logic.js
 * 피카츄 발리볼 기반 브라우저 발리볼 게임 핵심 로직
 * 순수 JavaScript - DOM/Canvas 코드 없음
 */

(function () {
  'use strict';

  // ─── 월드 상수 ────────────────────────────────────────────────────────────────
  const W              = 432;
  const H              = 304;
  const GRAVITY        = 0.5;
  const PLAYER_SPEED   = 6;
  const JUMP_SPEED     = -20;
  const BALL_RADIUS    = 20;
  const PLAYER_HITBOX_R = 32;
  const GROUND_Y       = 256;
  const NET_X          = 216;
  const NET_TOP_Y      = 204;   // GROUND_Y - 52
  const NET_HALF_W     = 4;
  const SCORE_TO_WIN   = 15;

  // ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

  /**
   * 두 점 사이 유클리드 거리
   */
  function dist2d(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 벡터 크기
   */
  function magnitude(vx, vy) {
    return Math.sqrt(vx * vx + vy * vy);
  }

  /**
   * 속도 벡터를 최대 크기로 클램프
   * @returns {{ vx, vy }}
   */
  function clampSpeed(vx, vy, maxMag) {
    const mag = magnitude(vx, vy);
    if (mag > maxMag && mag > 0) {
      const scale = maxMag / mag;
      return { vx: vx * scale, vy: vy * scale };
    }
    return { vx, vy };
  }

  // ─── 공 생성 ──────────────────────────────────────────────────────────────────

  /**
   * 서브용 새 공 상태 반환
   * @param {boolean} fromLeft - true: 좌측 플레이어 서브, false: 우측 플레이어 서브
   * @returns {{ x: number, y: number, vx: number, vy: number }}
   */
  function createBall(fromLeft) {
    if (fromLeft) {
      return {
        x:  W / 4,
        y:  GROUND_Y - 100,
        vx: 5,
        vy: -12,
      };
    } else {
      return {
        x:  (3 * W) / 4,
        y:  GROUND_Y - 100,
        vx: -5,
        vy: -12,
      };
    }
  }

  // ─── 플레이어 생성 ────────────────────────────────────────────────────────────

  /**
   * 새 플레이어 상태 반환
   * @param {boolean} isLeft - true: 좌측 플레이어(P1), false: 우측 플레이어(P2/AI)
   * @returns {{ x, y, vx, vy, onGround, isLeft, score, state }}
   */
  function createPlayer(isLeft) {
    return {
      x:        isLeft ? W / 4 : (3 * W) / 4,
      y:        GROUND_Y,
      vx:       0,
      vy:       0,
      onGround: true,
      isLeft:   isLeft,
      score:    0,
      state:    'idle',
    };
  }

  // ─── 공-플레이어 충돌 ─────────────────────────────────────────────────────────

  /**
   * 공과 플레이어 간 충돌 검사 및 속도 갱신
   * 충돌 발생 시 ball 객체를 직접 변경한다.
   * @param {{ x, y, vx, vy }} ball
   * @param {{ x, y, vx, vy, isLeft }} player
   * @returns {boolean} 충돌 발생 여부
   */
  function checkBallPlayerHit(ball, player) {
    const MIN_DIST = BALL_RADIUS + PLAYER_HITBOX_R;
    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const d  = Math.sqrt(dx * dx + dy * dy);

    if (d >= MIN_DIST) return false;

    // ── 공을 플레이어 표면 바깥으로 밀어냄 ──────────────────────────────────
    let nx, ny;
    if (d === 0) {
      // 완전 겹침 방어: 위 방향 법선
      nx = 0;
      ny = -1;
    } else {
      nx = dx / d;
      ny = dy / d;
    }

    // 침투 깊이만큼 보정
    const overlap = MIN_DIST - d;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    // ── 반사 속도 계산 ────────────────────────────────────────────────────────
    // 입사 속도의 법선 성분 반사
    const dot = ball.vx * nx + ball.vy * ny;
    let newVx = ball.vx - 2 * dot * nx;
    let newVy = ball.vy - 2 * dot * ny;

    // 플레이어 속도의 50% 추가 (타격감)
    newVx += player.vx * 0.5;
    newVy += player.vy * 0.5;

    // 공이 반드시 위로
    if (newVy > -4) newVy = -4;

    // 공이 상대 진영으로
    if (player.isLeft) {
      // 좌측 플레이어 히트 → vx 양수 보장
      if (newVx < 3) newVx = 3;
    } else {
      // 우측 플레이어 히트 → vx 음수 보장
      if (newVx > -3) newVx = -3;
    }

    // 속도 상한 22
    const clamped = clampSpeed(newVx, newVy, 22);
    ball.vx = clamped.vx;
    ball.vy = clamped.vy;

    return true;
  }

  // ─── 플레이어 입력 적용 ───────────────────────────────────────────────────────

  /**
   * 키 입력을 플레이어에 반영한다 (P1 전용).
   * @param {{ x, y, vx, vy, onGround, isLeft }} player
   * @param {{ left: boolean, right: boolean, up: boolean, z: boolean }} keys
   */
  function applyInput(player, keys) {
    // 수평 이동
    if (keys.left)  player.vx = -PLAYER_SPEED;
    else if (keys.right) player.vx =  PLAYER_SPEED;
    else             player.vx = 0;

    // 점프
    if ((keys.up || keys.z) && player.onGround) {
      player.vy = JUMP_SPEED;
      player.onGround = false;
    }
  }

  // ─── AI 로직 ──────────────────────────────────────────────────────────────────

  /**
   * 공의 착지(바닥 도달) 예측 x 좌표를 계산한다.
   * 최대 200 프레임 시뮬레이션, 네트·벽 반사 포함.
   * @param {{ x, y, vx, vy }} ball
   * @returns {number} 예측 착지 x
   */
  function predictLandingX(ball) {
    let bx = ball.x;
    let by = ball.y;
    let bvx = ball.vx;
    let bvy = ball.vy;

    for (let i = 0; i < 200; i++) {
      bvy += GRAVITY;
      bx  += bvx;
      by  += bvy;

      // 천장 반사
      if (by - BALL_RADIUS < 0) {
        by  = BALL_RADIUS;
        bvy = -bvy;
      }

      // 좌벽 반사
      if (bx - BALL_RADIUS < 0) {
        bx  = BALL_RADIUS;
        bvx = -bvx;
      }

      // 우벽 반사
      if (bx + BALL_RADIUS > W) {
        bx  = W - BALL_RADIUS;
        bvx = -bvx;
      }

      // 네트 충돌 (간이)
      const inNetX = bx + BALL_RADIUS > NET_X - NET_HALF_W &&
                     bx - BALL_RADIUS < NET_X + NET_HALF_W;
      if (inNetX && by > NET_TOP_Y) {
        bvx = -bvx;
        // 공을 네트 바깥으로
        if (bx < NET_X) bx = NET_X - NET_HALF_W - BALL_RADIUS;
        else            bx = NET_X + NET_HALF_W + BALL_RADIUS;
      }

      // 바닥 도달
      if (by + BALL_RADIUS >= GROUND_Y) {
        return bx;
      }
    }

    // 200프레임 안에 안 떨어지면 현재 공 x 반환
    return bx;
  }

  /**
   * AI(player2) 행동 갱신.
   * @param {{ x, y, vx, vy, onGround, isLeft }} ai
   * @param {{ x, y, vx, vy }} ball
   * @param {number} frameCount
   */
  function updateAI(ai, ball, frameCount) {
    // 반응 딜레이: 3프레임마다 방향 갱신
    if (frameCount % 3 !== 0) {
      // 이전 프레임 vx 유지
      return;
    }

    if (ball.x > NET_X) {
      // 공이 AI 진영 → 착지 예측점으로 이동
      const targetX = predictLandingX(ball);

      if (Math.abs(ai.x - targetX) > 4) {
        ai.vx = ai.x < targetX ? PLAYER_SPEED : -PLAYER_SPEED;
      } else {
        ai.vx = 0;
      }

      // 점프 조건
      const closeEnough = Math.abs(ai.x - ball.x) < 60;
      const ballAbove    = ball.y < ai.y - 20;
      if (closeEnough && ai.onGround && ballAbove) {
        ai.vy = JUMP_SPEED;
        ai.onGround = false;
      }
    } else {
      // 공이 상대(좌측) 진영 → 대기 위치
      const waitX = (3 * W) / 4;
      if (Math.abs(ai.x - waitX) > 4) {
        ai.vx = ai.x < waitX ? PLAYER_SPEED : -PLAYER_SPEED;
      } else {
        ai.vx = 0;
      }
    }
  }

  // ─── 플레이어 물리 이동 ───────────────────────────────────────────────────────

  /**
   * 플레이어 한 프레임 물리 이동 + 경계 클램프.
   * @param {{ x, y, vx, vy, onGround, isLeft }} player
   */
  function stepPlayer(player) {
    // 중력
    player.vy += GRAVITY;

    // 이동
    player.x += player.vx;
    player.y += player.vy;

    // 착지
    if (player.y >= GROUND_Y) {
      player.y       = GROUND_Y;
      player.vy      = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    // 좌/우 경계 클램프
    if (player.isLeft) {
      const xMin = PLAYER_HITBOX_R;
      const xMax = NET_X - PLAYER_HITBOX_R - NET_HALF_W;
      if (player.x < xMin) { player.x = xMin; player.vx = 0; }
      if (player.x > xMax) { player.x = xMax; player.vx = 0; }
    } else {
      const xMin = NET_X + PLAYER_HITBOX_R + NET_HALF_W;
      const xMax = W - PLAYER_HITBOX_R;
      if (player.x < xMin) { player.x = xMin; player.vx = 0; }
      if (player.x > xMax) { player.x = xMax; player.vx = 0; }
    }
  }

  // ─── 공 물리 이동 ─────────────────────────────────────────────────────────────

  /**
   * 공 한 프레임 물리 이동.
   * 득점 판정은 updatePhysics에서 처리한다.
   * @param {{ x, y, vx, vy }} ball
   * @returns {boolean} 바닥에 닿았으면 true
   */
  function stepBall(ball) {
    // 중력
    ball.vy += GRAVITY;

    // 이동
    ball.x += ball.vx;
    ball.y += ball.vy;

    // 천장 반사
    if (ball.y - BALL_RADIUS < 0) {
      ball.y  = BALL_RADIUS;
      ball.vy = -ball.vy;
    }

    // 좌벽 반사
    if (ball.x - BALL_RADIUS < 0) {
      ball.x  = BALL_RADIUS;
      ball.vx = -ball.vx;
    }

    // 우벽 반사
    if (ball.x + BALL_RADIUS > W) {
      ball.x  = W - BALL_RADIUS;
      ball.vx = -ball.vx;
    }

    // 네트 충돌: 공이 네트 x 범위와 겹치고 y > NET_TOP_Y
    const overlapLeft  = ball.x + BALL_RADIUS > NET_X - NET_HALF_W;
    const overlapRight = ball.x - BALL_RADIUS < NET_X + NET_HALF_W;
    if (overlapLeft && overlapRight && ball.y > NET_TOP_Y) {
      ball.vx = -ball.vx;
      // 공을 네트 바깥으로 밀어냄
      if (ball.x < NET_X) {
        ball.x = NET_X - NET_HALF_W - BALL_RADIUS;
      } else {
        ball.x = NET_X + NET_HALF_W + BALL_RADIUS;
      }
    }

    // 바닥 터치 판정
    if (ball.y + BALL_RADIUS >= GROUND_Y) {
      ball.y = GROUND_Y - BALL_RADIUS; // 바닥 클램프
      return true;
    }

    return false;
  }

  // ─── 메인 물리 업데이트 ───────────────────────────────────────────────────────

  /**
   * 한 프레임 전체 물리 진행.
   * @param {{ x, y, vx, vy }} ball
   * @param {{ x, y, vx, vy, onGround, isLeft, score }} player1 - 좌측
   * @param {{ x, y, vx, vy, onGround, isLeft, score }} player2 - 우측(AI)
   * @returns {null|'p1score'|'p2score'}
   *   null     : 득점 없음
   *   'p1score': 공이 우측 바닥에 닿아 p1 득점
   *   'p2score': 공이 좌측 바닥에 닿아 p2 득점
   */
  function updatePhysics(ball, player1, player2) {
    // 1. 플레이어 이동
    stepPlayer(player1);
    stepPlayer(player2);

    // 2. 공 이동
    const landed = stepBall(ball);

    // 3. 공-플레이어 충돌
    checkBallPlayerHit(ball, player1);
    checkBallPlayerHit(ball, player2);

    // 4. 득점 판정
    if (landed) {
      if (ball.x < NET_X) {
        // 좌측 바닥 → p2 득점
        player2.score += 1;
        return 'p2score';
      } else {
        // 우측 바닥 → p1 득점
        player1.score += 1;
        return 'p1score';
      }
    }

    return null;
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  window.GameLogic = {
    // 상수
    W,
    H,
    GRAVITY,
    PLAYER_SPEED,
    JUMP_SPEED,
    BALL_RADIUS,
    PLAYER_HITBOX_R,
    GROUND_Y,
    NET_X,
    NET_TOP_Y,
    SCORE_TO_WIN,

    // 팩토리
    createBall,
    createPlayer,

    // 입력/AI
    applyInput,
    updateAI,

    // 물리
    updatePhysics,
    checkBallPlayerHit,
  };

  // CommonJS / ES Module 환경 대응 (선택적)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.GameLogic;
  }

}());
