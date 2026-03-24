# HappyBot - CLAUDE.md

## 프로젝트 개요

Slack 멘션 이벤트를 수신하여 Google Gemini AI로 응답하는 Slack 봇. Next.js App Router 기반, Vercel 배포.

## 기술 스택

- **Framework**: Next.js (App Router)
- **Language**: TypeScript (strict mode)
- **AI**: Google Generative AI (gemini-3-flash-preview)
- **Styling**: Tailwind CSS v4
- **Deployment**: Vercel

## 개발 명령어

```bash
npm install       # 의존성 설치
npm run dev       # 개발 서버 (http://localhost:3000)
npm run build     # 프로덕션 빌드
npm run lint      # ESLint 검사
```

## 환경 변수 (`.env.local`)

| 변수 | 설명 |
|------|------|
| `GOOGLE_API_KEY` | Google Gemini API 키 |
| `SLACK_BOT_TOKEN` | Slack Bot OAuth 토큰 (`xoxb-...`) |
| `SLACK_BOT_USER_ID` | 봇의 Slack User ID |

## 프로젝트 구조

```
app/
  api/slack/events/route.ts   # Slack 이벤트 수신 엔드포인트 (핵심)
  page.tsx                    # 랜딩 페이지
lib/
  gemini.ts                   # Gemini AI 응답 생성
  slack.ts                    # Slack API 유틸리티
```

## 핵심 아키텍처

### 이벤트 처리 흐름
1. Slack `app_mention` 이벤트 → `/api/slack/events` POST
2. 중복 이벤트 필터링 (인메모리 Set, 60초마다 초기화)
3. `x-slack-retry-num` 헤더로 재시도 요청 즉시 200 반환 (무시)
4. `after()`로 즉시 200 반환 후 백그라운드에서 처리 (Slack 3초 타임아웃 방지)
5. 스레드 히스토리 조회 (최대 20개) + 각 메시지의 이미지 다운로드
6. 채널 컨텍스트 조회 (최대 30개 메시지)
7. 현재 이벤트의 첨부 이미지 다운로드
8. 현재 메시지에 이미지가 없으면 채널 히스토리 최근 3개 메시지에서 이미지 탐색
9. Gemini API로 응답 생성 (텍스트 + 이미지 멀티모달)
10. Slack 스레드에 답글 게시

### 컨텍스트 처리
- **스레드 히스토리**: `conversations.replies` API로 최대 20개 메시지 (이미지 포함)
- **채널 컨텍스트**: 최근 30개 메시지를 시스템 프롬프트에 텍스트로 요약 포함
- **채널 이미지**: 현재 메시지에 이미지가 없을 때 채널 히스토리에서 최근 이미지를 찾아 Gemini에 전달 ("위에 이미지 해석해줘" 같은 요청 지원)
- **유저 캐싱**: 표시 이름 10분 TTL 캐시
- **이미지 처리**: 메시지에 첨부된 이미지를 Slack API로 다운로드 후 Gemini에 `inlineData`로 전달

### 봇 페르소나
- 이름: 해피 (Happy)
- 언어: 한국어 (존댓말)
- 유저명에 "-님" 경칭 사용
- 적절한 이모지 사용
- 친근하고 유머러스한 성격

## Slack 앱 설정

**필요한 OAuth 스코프**: `app_mentions:read`, `chat:write`, `users:read`, `channels:history`, `files:read`

**구독 이벤트**: `app_mention`

**Event Request URL**: `https://[domain]/api/slack/events`

**로컬 테스트**: ngrok으로 터널 생성 후 Slack 이벤트 URL 업데이트
```bash
ngrok http 3000
```

## 코드 컨벤션

- Path alias `@/*` 사용 (루트 기준)
- `lib/` 에 비즈니스 로직 분리 유지
- API 라우트는 `app/api/` 하위에만 배치
- 에러 처리: Gemini 안전 필터 에러 별도 핸들링 필요
