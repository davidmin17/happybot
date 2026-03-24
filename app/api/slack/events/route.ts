import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { generateResponse, ChatMessage, GenerateResponseOptions } from "@/lib/gemini";
import {
  sendSlackMessage,
  extractMessage,
  getThreadMessages,
  getChannelHistory,
  getUserDisplayName,
  downloadImages,
  SlackEvent,
  SlackMessage,
} from "@/lib/slack";

const processedEvents = new Set<string>();
setInterval(() => processedEvents.clear(), 60 * 1000);

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "해피봇이 살아있어요! 🎉",
    timestamp: new Date().toISOString(),
  });
}

async function convertToConversationHistory(
  messages: SlackMessage[],
  botUserId: string,
  currentTs: string
): Promise<ChatMessage[]> {
  const history: ChatMessage[] = [];

  for (const msg of messages) {
    // 현재 메시지는 제외 (별도로 처리)
    if (msg.ts === currentTs) continue;

    const cleanText = extractMessage(msg.text || "", botUserId);
    const images = await downloadImages(msg.files);

    if (!cleanText && images.length === 0) continue;

    const role = msg.bot_id || msg.user === botUserId ? "assistant" : "user";
    history.push({ role, content: cleanText, ...(images.length > 0 ? { images } : {}) });
  }

  return history;
}

function convertToChannelContext(
  messages: SlackMessage[],
  botUserId: string,
  currentThreadTs: string | undefined,
  userNameById: Map<string, string>
): string {
  const contextLines: string[] = [];

  for (const msg of messages) {
    // 현재 스레드의 메시지는 제외 (스레드 히스토리에서 별도 처리)
    if (currentThreadTs && msg.thread_ts === currentThreadTs) continue;
    // 스레드 답글은 제외 (메인 채널 대화만)
    if (msg.thread_ts && msg.ts !== msg.thread_ts) continue;

    const cleanText = extractMessage(msg.text, botUserId);
    if (!cleanText) continue;

    const isBot = msg.bot_id || msg.user === botUserId;
    const speaker = isBot ? "해피님" : (userNameById.get(msg.user) || "사용자님");
    contextLines.push(`${speaker}: ${cleanText}`);
  }

  return contextLines.join("\n");
}

function ensureNim(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "사용자님";
  return trimmed.endsWith("님") ? trimmed : `${trimmed}님`;
}

export async function POST(request: NextRequest) {
  if (request.headers.get("x-slack-retry-num")) {
    return NextResponse.json({ ok: true });
  }

  try {
    const body: SlackEvent = await request.json();

    if (body.type === "url_verification" && body.challenge) {
      return NextResponse.json({ challenge: body.challenge });
    }

    if (body.type === "event_callback" && body.event) {
      const { event, event_id } = body;

      if (event_id && processedEvents.has(event_id)) {
        return NextResponse.json({ ok: true });
      }
      if (event_id) processedEvents.add(event_id);

      if (event.type === "app_mention") {
        const botUserId = process.env.SLACK_BOT_USER_ID || "";
        if (event.user === botUserId) {
          return NextResponse.json({ ok: true });
        }

        // 백그라운드에서 처리 (Slack 3초 타임아웃 방지)
        after(async () => {
          try {
            const userMessage = extractMessage(event.text, botUserId);
            const hasImages = (event.files || []).some((f) => f.mimetype?.startsWith("image/"));

            if (!userMessage && !hasImages) {
              await sendSlackMessage(event.channel, "다시 말씀해주세요.", event.thread_ts || event.ts);
              return;
            }

            const [requesterName, threadMessages, channelMessages] = await Promise.all([
              getUserDisplayName(event.user),
              event.thread_ts
                ? getThreadMessages(event.channel, event.thread_ts)
                : Promise.resolve([] as SlackMessage[]),
              getChannelHistory(event.channel, 30),
            ]);

            const uniqueUserIds = Array.from(
              new Set(channelMessages.map((m) => m.user).filter((u) => Boolean(u) && u !== botUserId))
            );

            // convertToConversationHistory(이미지 다운로드)와 유저명 조회 병렬 처리
            const [conversationHistory, resolvedNames] = await Promise.all([
              event.thread_ts
                ? convertToConversationHistory(threadMessages, botUserId, event.ts)
                : Promise.resolve([]),
              Promise.all(uniqueUserIds.map(async (uid) => [uid, ensureNim(await getUserDisplayName(uid))] as const)),
            ]);

            const userNameById = new Map<string, string>(resolvedNames);
            const channelContext = convertToChannelContext(channelMessages, botUserId, event.thread_ts, userNameById);

            let eventImages = await downloadImages(event.files);

            // 현재 메시지에 이미지가 없으면 채널 히스토리 최근 3개 메시지에서 탐색
            if (eventImages.length === 0) {
              const recentWithImages = channelMessages
                .filter((m) => m.files?.some((f) => f.mimetype?.startsWith("image/")))
                .slice(-3);
              const channelImages = (await Promise.all(recentWithImages.map((m) => downloadImages(m.files)))).flat();
              eventImages = channelImages;
            }

            const options: GenerateResponseOptions = {
              conversationHistory,
              channelContext: channelContext || undefined,
              requesterDisplayName: ensureNim(requesterName),
              ...(eventImages.length > 0 ? { images: eventImages } : {}),
            };
            const aiResponse = await generateResponse(userMessage, options);

            await sendSlackMessage(event.channel, aiResponse, event.thread_ts || event.ts);
          } catch (error) {
            console.error("Error processing Slack event in background:", error);
          }
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error processing Slack event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
