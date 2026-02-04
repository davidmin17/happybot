// Slack 메시지 전송
export async function sendSlackMessage(
  channel: string,
  text: string,
  threadTs?: string
): Promise<void> {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel,
      text,
      thread_ts: threadTs,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    console.error("Slack API error:", data.error);
    throw new Error(`Slack API error: ${data.error}`);
  }
}

// 스레드 메시지 가져오기
export interface SlackMessage {
  user: string;
  text: string;
  ts: string;
  bot_id?: string;
  thread_ts?: string;
}

export async function getThreadMessages(
  channel: string,
  threadTs: string
): Promise<SlackMessage[]> {
  const response = await fetch(
    `https://slack.com/api/conversations.replies?channel=${channel}&ts=${threadTs}&limit=20`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
    }
  );

  const data = await response.json();

  if (!data.ok) {
    console.error("Slack API error:", data.error);
    return [];
  }

  return data.messages || [];
}

// 채널의 최근 메시지 가져오기
export async function getChannelHistory(
  channel: string,
  limit: number = 20
): Promise<SlackMessage[]> {
  const response = await fetch(
    `https://slack.com/api/conversations.history?channel=${channel}&limit=${limit}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
    }
  );

  const data = await response.json();

  if (!data.ok) {
    console.error("Slack API error:", data.error);
    return [];
  }

  // 최신순으로 오므로 시간순으로 정렬 (오래된 것 먼저)
  const messages = data.messages || [];
  return messages.reverse();
}

// 멘션에서 사용자 메시지 추출 (봇 멘션 제거)
export function extractMessage(text: string, botUserId: string): string {
  // <@U12345> 형태의 멘션 제거
  return text.replace(new RegExp(`<@${botUserId}>`, "g"), "").trim();
}

// Slack 이벤트 타입 정의
export interface SlackEvent {
  type: string;
  event?: {
    type: string;
    user: string;
    text: string;
    channel: string;
    ts: string;
    event_ts: string;
    thread_ts?: string;
  };
  challenge?: string;
  event_id?: string;
  event_time?: number;
}
