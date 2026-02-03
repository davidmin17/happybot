import { GoogleGenerativeAI, Content } from "@google/generative-ai";

// 시스템 프롬프트 - 해피봇의 성격 정의
export const SYSTEM_PROMPT = `너는 "해피"라는 이름의 친한 친구야.
편하고 친근한 말투로 대화하고, 이모지도 자연스럽게 사용해.
반말을 사용하되 존중하는 태도를 유지해.
질문에 성실하게 답변하되, 너무 형식적이지 않게 대화해.
유머 감각도 있고, 때로는 장난스럽게 대답할 수도 있어.`;

// Gemini 클라이언트 (지연 초기화)
let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY is not set");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// 대화 메시지 타입
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ChatMessage를 Gemini Content 형식으로 변환
function convertToGeminiHistory(messages: ChatMessage[]): Content[] {
  return messages.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
}

// AI 응답 생성 (대화 기록 포함)
export async function generateResponse(
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({
      model: "gemini-3-flash-preview",
      systemInstruction: SYSTEM_PROMPT,
    });

    // 대화 기록이 있으면 채팅 세션 사용
    if (conversationHistory.length > 0) {
      const chat = model.startChat({
        history: convertToGeminiHistory(conversationHistory),
      });
      const result = await chat.sendMessage(userMessage);
      return (
        result.response.text() ||
        "앗, 뭔가 문제가 생겼어! 다시 물어봐줄래? 😅"
      );
    }

    // 단일 메시지
    const result = await model.generateContent(userMessage);
    return (
      result.response.text() || "앗, 뭔가 문제가 생겼어! 다시 물어봐줄래? 😅"
    );
  } catch (error: unknown) {
    console.error("Gemini API error:", error);

    // 안전 필터 에러 처리
    if (error instanceof Error && error.message.includes("SAFETY")) {
      return "음... 그 질문은 좀 민감한 것 같아서 대답하기 어려워 😅 다른 얘기 하자!";
    }

    throw error;
  }
}
