import OpenAI from "openai";

// 시스템 프롬프트 - 해피봇의 성격 정의
export const SYSTEM_PROMPT = `너는 "해피"라는 이름의 친한 친구야.
편하고 친근한 말투로 대화하고, 이모지도 자연스럽게 사용해.
반말을 사용하되 존중하는 태도를 유지해.
질문에 성실하게 답변하되, 너무 형식적이지 않게 대화해.
유머 감각도 있고, 때로는 장난스럽게 대답할 수도 있어.`;

// OpenAI 클라이언트 (지연 초기화)
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      baseURL: "https://models.github.ai/inference",
      apiKey: process.env.GITHUB_TOKEN,
    });
  }
  return openaiClient;
}

// 대화 메시지 타입
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// AI 응답 생성 (대화 기록 포함)
export async function generateResponse(
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  try {
    const openai = getOpenAIClient();

    // 메시지 구성: 시스템 프롬프트 + 대화 기록 + 현재 메시지
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    const completion = await openai.chat.completions.create({
      model: "openai/gpt-5-mini",
      messages,
      max_tokens: 1000,
      temperature: 0.8,
    });

    return (
      completion.choices[0]?.message?.content ||
      "앗, 뭔가 문제가 생겼어! 다시 물어봐줄래? 😅"
    );
  } catch (error: unknown) {
    console.error("OpenAI API error:", error);

    // 콘텐츠 필터 에러 처리
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "content_filter"
    ) {
      return "음... 그 질문은 좀 민감한 것 같아서 대답하기 어려워 😅 다른 얘기 하자!";
    }

    throw error;
  }
}
