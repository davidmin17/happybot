// 이미지 해석 테스트 스크립트
// 사용법: GOOGLE_API_KEY=xxx node test-image.mjs /path/to/image.png
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync } from "fs";
import { extname } from "path";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("GOOGLE_API_KEY 환경변수를 설정해주세요.");
  process.exit(1);
}

const imagePath = process.argv[2];
if (!imagePath) {
  console.error("이미지 경로를 인자로 넘겨주세요.");
  console.error("예: GOOGLE_API_KEY=xxx node test-image.mjs ./image.png");
  process.exit(1);
}

const ext = extname(imagePath).toLowerCase();
const mimeTypeMap = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" };
const mimeType = mimeTypeMap[ext] || "image/jpeg";

const imageData = readFileSync(imagePath).toString("base64");

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview",
  systemInstruction: `너는 "해피"이라는 이름의 친한 친구야. 편하고 친근한 분위기이지만, 항상 존댓말로 대화해.`,
});

console.log(`이미지: ${imagePath} (${mimeType})`);
console.log("Gemini API 호출 중...\n");

try {
  const result = await model.generateContent([
    { text: "이 이미지를 해석해줘" },
    { inlineData: { mimeType, data: imageData } },
  ]);
  console.log("=== 응답 ===");
  console.log(result.response.text());
} catch (error) {
  console.error("=== 에러 ===");
  console.error(error.message);
  if (error.message.includes("SAFETY")) {
    console.error("\n→ Gemini 안전 필터에 의해 차단됨 (정치/군사 관련 컨텐츠)");
  }
}
