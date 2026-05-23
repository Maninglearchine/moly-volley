# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**몰리 발리볼 (Moli Volley)** — 피카츄 발리볼 오픈소스(https://github.com/gorisanson/pikachu-volleyball)를 기반으로 커스텀 캐릭터 이미지를 적용한 웹 브라우저 게임.

최종 결과물은 서버 없이 브라우저에서 바로 열 수 있는 **단일 `index_.html` 파일**이다.

## 빌드 및 실행

별도 빌드 없음. 브라우저에서 직접 열면 된다:

```
index_.html 더블클릭 → 브라우저에서 바로 실행
```

## 이미지 에셋

| 파일 | 역할 |
|------|------|
| `img/img0.png` | 공 (흰색 곰 얼굴) |
| `img/img1.png` | 우측 플레이어 AI (보라 펭귄, 왼쪽 향함) |
| `img/img2.png` | 좌측 플레이어 조작 (보라 펭귄, 오른쪽 향함) |

이미지는 base64로 HTML에 인라인 삽입한다 (img1: ~1.2MB, img2: ~1MB, img0: ~55KB).

## 게임 기술 명세

참조 소스의 핵심 물리 상수:

| 항목 | 값 |
|------|-----|
| 게임 월드 | 432×304 픽셀 |
| 캐릭터 크기 | 64×64 픽셀 |
| 공 반지름 | 20 픽셀 |
| 렌더 방식 | HTML5 Canvas (vanilla JS) |

물리 엔진은 pikachu-volleyball의 `physics.js` 로직을 참조하여 구현한다:
- 중력, 속도, 공 바운스
- 플레이어: 이동, 점프, 다이빙, 파워 히트
- AI: `expectedLandingPointX` 기반 포지셔닝, 브레이버리 계수
- 충돌 감지: AABB

## 서브 에이전트

`agents/` 폴더에 전문화된 서브 에이전트 정의가 있다:

- `backend-architect.md` — 물리 엔진, 게임 로직, AI 구현
- `frontend-dev-expert.md` — Canvas 렌더링, UI, 입력 처리
- `qa-engineer.md` — 기능·성능·엣지케이스 테스트
- `llm-integration-specialist.md` — LLM/OpenRouter 연동 (이 프로젝트에서는 미사용)
- `product-prd-manager.md` — PRD 관리 및 요구사항 검토

## 커스텀 커맨드

`commands/code-review.md` — `/code-review` 슬래시 커맨드로 코드 리뷰 실행 가능.

## PRD

`PRD.md` 에 전체 요구사항, 수용 기준, 구현 방식 선택(방식 A/B)이 기술되어 있다.
