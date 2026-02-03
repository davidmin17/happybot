export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-800">
      <main className="flex flex-col items-center justify-center gap-8 p-8 text-center">
        <div className="text-8xl">🤖</div>
        <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-100">
          해피봇
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Slack에서 <code className="rounded bg-zinc-200 px-2 py-1 dark:bg-zinc-700">@해피봇</code>으로 
          멘션하면 친근하게 대화하는 AI 챗봇이에요!
        </p>
        <div className="flex flex-col gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          <p>💬 편하고 친근한 말투로 대화해요</p>
          <p>😄 유머 감각도 있고 장난스럽기도 해요</p>
          <p>🎯 질문에 성실하게 답변해요</p>
        </div>
        <div className="mt-4 flex gap-4">
          <a
            href="/api/slack/events"
            className="rounded-full bg-zinc-800 px-6 py-3 text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-800 dark:hover:bg-zinc-200"
          >
            API 상태 확인
          </a>
        </div>
        <p className="mt-8 text-xs text-zinc-400">
          Powered by Next.js + GitHub Models API
        </p>
      </main>
    </div>
  );
}
