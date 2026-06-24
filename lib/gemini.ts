import { GoogleGenerativeAI, Content, Part } from "@google/generative-ai";

// 시스템 프롬프트 - 해피봇의 성격 정의
const BASE_SYSTEM_PROMPT = `너는 "해피"이라는 이름의 친한 친구야.
편하고 친근한 분위기이지만, 항상 존댓말로 대화해.
이모지는 자연스럽게 사용하되, 과하지 않게 사용해.
질문에 성실하게 답변하되, 너무 형식적이지 않게 대화해.
유머 감각도 있고, 때로는 장난스럽게 대답할 수도 있어.
사람 이름을 부를 때는 항상 이름 뒤에 "님"을 붙여서 말해. (예: 해피님, 철수님)
이전 대화와 채널의 최근 대화는 참고용으로만 사용하고, 현재 질문과 직접적으로 관련 있을 때만 활용해.
현재 질문과 관련이 없다고 판단되면, 새로운 질문이라고 생각하고 이전 맥락에 끌려가지 말고 답변해.`;

// 채널 컨텍스트를 포함한 시스템 프롬프트 생성
export function buildSystemPrompt(channelContext?: string): string {
  if (!channelContext) {
    return BASE_SYSTEM_PROMPT;
  }

  return `${BASE_SYSTEM_PROMPT}

아래는 이 채널에서 최근에 오간 대화 내용이야. 질문에 답변할 때 이 맥락을 참고해도 되지만,
현재 질문과 직접적으로 관련 있을 때에만 활용해줘.
채널 대화 내용을 그대로 인용하지 말고, 자연스럽게 맥락을 이해한 상태로 대화해.

[채널의 최근 대화]
${channelContext}`;
}

// Gemini 모델명 (환경변수로 설정 가능, 기본값 제공)
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

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
  images?: Array<{ mimeType: string; data: string }>;
}

// ChatMessage를 Gemini Content 형식으로 변환
function convertToGeminiHistory(messages: ChatMessage[]): Content[] {
  return messages.map((msg) => {
    const parts: Part[] = [
      ...(msg.content ? [{ text: msg.content }] : []),
      ...(msg.images ?? []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
    ];
    return {
      role: msg.role === "assistant" ? "model" : "user",
      parts,
    };
  });
}

// AI 응답 생성 옵션
export interface GenerateResponseOptions {
  conversationHistory?: ChatMessage[];
  channelContext?: string;
  requesterDisplayName?: string;
  images?: Array<{ mimeType: string; data: string }>;
}

// AI 응답 생성 (대화 기록 + 채널 컨텍스트 포함)
export async function generateResponse(
  userMessage: string,
  options: GenerateResponseOptions = {}
): Promise<string> {
  const { conversationHistory = [], channelContext, requesterDisplayName, images } =
    options;

  try {
    const client = getGeminiClient();
    const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    const requesterLine = requesterDisplayName
      ? `\n\n현재 질문을 한 분은 "${requesterDisplayName}"입니다. 이름을 부를 때는 반드시 "${requesterDisplayName}"처럼 "님"을 붙여서 불러 주세요.`
      : "";
    const systemPrompt = buildSystemPrompt(channelContext) + `\n\n오늘 날짜는 ${today}입니다.` + requesterLine;
    console.log(`[Gemini] 응답 생성 모델: ${GEMINI_MODEL}`);
    const model = client.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
    });

    // 현재 메시지 파츠 구성 (텍스트 + 이미지)
    const messageParts: Part[] = [
      ...(userMessage ? [{ text: userMessage }] : []),
      ...(images ?? []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
    ];

    // 대화 기록이 있으면 채팅 세션 사용
    if (conversationHistory.length > 0) {
      const chat = model.startChat({
        history: convertToGeminiHistory(conversationHistory),
      });
      const result = await chat.sendMessage(messageParts);
      return (
        result.response.text() ||
        "앗, 뭔가 문제가 생긴 것 같아요. 다시 한 번만 질문해 주시겠어요? 😅"
      );
    }

    // 단일 메시지
    const result = await model.generateContent(messageParts);
    return (
      result.response.text() ||
      "앗, 뭔가 문제가 생긴 것 같아요. 번거로우시겠지만 다시 한 번만 질문해 주시겠어요? 😅"
    );
  } catch (error: unknown) {
    console.error("Gemini API error:", error);

    // 안전 필터 에러 처리
    if (error instanceof Error && error.message.includes("SAFETY")) {
      return "음... 그 질문은 조금 민감한 내용이라서 답변드리기 어려워요 😅 다른 주제로 이야기 나눠 보면 어떨까요?";
    }

    throw error;
  }
}
