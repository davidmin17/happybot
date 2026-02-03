# 해피봇 (HappyBot) 🤖

Slack에서 "@해피봇"으로 멘션하면 친근하게 대화하는 AI 챗봇입니다.

## 기술 스택

- **Framework**: Next.js 15 (App Router)
- **AI**: OpenAI SDK + GitHub Models API (gpt-4o-mini)
- **배포**: Vercel

## 주요 기능

- Slack `app_mention` 이벤트 수신 및 처리
- GitHub Models API를 통한 GPT 모델 호출
- 중복 이벤트 방지 처리
- Slack 재시도 요청 무시

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/slack/events` | 헬스체크 |
| POST | `/api/slack/events` | Slack 이벤트 수신 |

## 설정 방법

### 1. 환경 변수 설정

`.env.example`을 복사하여 `.env.local` 생성:

```bash
cp .env.example .env.local
```

필요한 환경 변수:

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | `ghp_xxxx...` |
| `SLACK_BOT_TOKEN` | Slack Bot Token | `xoxb-xxxx...` |
| `SLACK_BOT_USER_ID` | Slack Bot User ID | `U0123456789` |

### 2. GitHub Token 발급

1. [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens) 이동
2. "Generate new token (classic)" 클릭
3. 토큰 생성 (특별한 권한 불필요)

### 3. Slack 앱 설정

1. [Slack API](https://api.slack.com/apps) 접속
2. "Create New App" > "From scratch" 선택
3. 앱 이름: `해피봇`, Workspace 선택

#### OAuth & Permissions 설정

Bot Token Scopes 추가:
- `app_mentions:read` - 멘션 읽기
- `chat:write` - 메시지 전송

#### Event Subscriptions 설정

1. "Enable Events" 활성화
2. Request URL: `https://your-vercel-domain.vercel.app/api/slack/events`
3. Subscribe to bot events:
   - `app_mention`

#### 앱 설치

1. "Install to Workspace" 클릭
2. 권한 승인
3. Bot User OAuth Token 복사 → `SLACK_BOT_TOKEN`
4. Basic Information > App Credentials에서 Bot User ID 확인 → `SLACK_BOT_USER_ID`

## 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

로컬 테스트 시 [ngrok](https://ngrok.com/)으로 터널링:

```bash
ngrok http 3000
```

## Vercel 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel
```

또는 GitHub 연동하여 자동 배포 설정.

### Vercel 환경 변수 설정

Vercel Dashboard > Settings > Environment Variables에서 설정:
- `GITHUB_TOKEN`
- `SLACK_BOT_TOKEN`
- `SLACK_BOT_USER_ID`

## 사용 방법

Slack 채널에서:

```
@해피봇 안녕!
@해피봇 오늘 날씨 어때?
@해피봇 재미있는 얘기 해줘
```

## 프로젝트 구조

```
chatbot/
├── app/
│   ├── api/
│   │   └── slack/
│   │       └── events/
│   │           └── route.ts    # Slack 이벤트 핸들러
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── openai.ts               # OpenAI 클라이언트 & AI 응답 생성
│   └── slack.ts                # Slack 유틸리티
├── .env.example
└── README.md
```

## 해피봇 성격

> 너는 "해피"라는 이름의 친한 친구야.
> 편하고 친근한 말투로 대화하고, 이모지도 자연스럽게 사용해.
> 반말을 사용하되 존중하는 태도를 유지해.
> 질문에 성실하게 답변하되, 너무 형식적이지 않게 대화해.
> 유머 감각도 있고, 때로는 장난스럽게 대답할 수도 있어.
