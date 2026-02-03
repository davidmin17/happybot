import { NextRequest, NextResponse } from "next/server";
import { generateResponse, ChatMessage } from "@/lib/openai";
import {
  sendSlackMessage,
  extractMessage,
  getThreadMessages,
  SlackEvent,
  SlackMessage,
} from "@/lib/slack";

// 중복 이벤트 방지를 위한 Set (메모리 저장)
const processedEvents = new Set<string>();

// 오래된 이벤트 ID 정리 (메모리 누수 방지)
const EVENT_EXPIRY_MS = 60 * 1000; // 1분
setInterval(() => {
  processedEvents.clear();
}, EVENT_EXPIRY_MS);

// GET: 헬스체크
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "해피봇이 살아있어요! 🎉",
    timestamp: new Date().toISOString(),
  });
}

// 스레드 메시지를 OpenAI 대화 형식으로 변환
function convertToConversationHistory(
  messages: SlackMessage[],
  botUserId: string,
  currentTs: string
): ChatMessage[] {
  const history: ChatMessage[] = [];

  for (const msg of messages) {
    // 현재 메시지는 제외 (별도로 처리)
    if (msg.ts === currentTs) continue;

    const cleanText = extractMessage(msg.text, botUserId);
    if (!cleanText) continue;

    // 봇의 메시지인지 확인
    if (msg.bot_id || msg.user === botUserId) {
      history.push({ role: "assistant", content: cleanText });
    } else {
      history.push({ role: "user", content: cleanText });
    }
  }

  return history;
}

// POST: Slack 이벤트 수신
export async function POST(request: NextRequest) {
  // Slack 재시도 요청 무시
  const retryNum = request.headers.get("x-slack-retry-num");
  const retryReason = request.headers.get("x-slack-retry-reason");

  if (retryNum) {
    console.log(
      `Slack retry ignored: attempt ${retryNum}, reason: ${retryReason}`
    );
    return NextResponse.json({ ok: true, message: "Retry ignored" });
  }

  try {
    const body: SlackEvent = await request.json();

    // URL Verification (Slack 앱 설정 시 필요)
    if (body.type === "url_verification" && body.challenge) {
      return NextResponse.json({ challenge: body.challenge });
    }

    // 이벤트 콜백 처리
    if (body.type === "event_callback" && body.event) {
      const { event, event_id } = body;

      // 중복 이벤트 방지
      if (event_id && processedEvents.has(event_id)) {
        console.log(`Duplicate event ignored: ${event_id}`);
        return NextResponse.json({ ok: true, message: "Duplicate ignored" });
      }

      if (event_id) {
        processedEvents.add(event_id);
      }

      // app_mention 이벤트 처리
      if (event.type === "app_mention") {
        // 봇 자신의 메시지는 무시
        const botUserId = process.env.SLACK_BOT_USER_ID || "";
        if (event.user === botUserId) {
          return NextResponse.json({ ok: true });
        }

        // 사용자 메시지 추출
        const userMessage = extractMessage(event.text, botUserId);

        if (!userMessage) {
          await sendSlackMessage(
            event.channel,
            "뭐라고? 다시 말해줘! 🤔",
            event.thread_ts || event.ts
          );
          return NextResponse.json({ ok: true });
        }

        console.log(`Processing message from ${event.user}: ${userMessage}`);

        // 스레드가 있으면 대화 기록 가져오기
        let conversationHistory: ChatMessage[] = [];
        const threadTs = event.thread_ts || event.ts;

        if (event.thread_ts) {
          // 기존 스레드에서 대화 중
          const threadMessages = await getThreadMessages(
            event.channel,
            event.thread_ts
          );
          conversationHistory = convertToConversationHistory(
            threadMessages,
            botUserId,
            event.ts
          );
          console.log(
            `Loaded ${conversationHistory.length} messages from thread`
          );
        }

        // AI 응답 생성 (대화 기록 포함)
        const aiResponse = await generateResponse(
          userMessage,
          conversationHistory
        );

        // Slack에 응답 전송 (스레드로 답장)
        await sendSlackMessage(event.channel, aiResponse, threadTs);

        console.log(`Response sent to channel ${event.channel}`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error processing Slack event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
