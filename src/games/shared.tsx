"use client";

// 게임들이 공통으로 쓰는 오버레이.

export function StartGate({
  title,
  lines,
  onStart,
}: {
  title: string;
  lines: string[];
  onStart: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/80 px-6 backdrop-blur-sm">
      <p className="font-display text-2xl text-ink">{title}</p>
      <div className="text-center text-sm leading-relaxed text-ink-dim">
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      <button
        onClick={onStart}
        className="mt-1 rounded-xl bg-grass px-8 py-3 font-display text-lg text-pitch-base"
      >
        시작
      </button>
    </div>
  );
}

// 기록을 저장하는 동안에는 다시 시작할 수 없게 한다.
// 저장 중에 새 판이 시작되면 방금 기록이 어떻게 됐는지 알 수 없다.
export function RetryButton({
  submitting,
  onRetry,
  label = "다시 하기",
}: {
  submitting: boolean;
  onRetry: () => void;
  label?: string;
}) {
  if (submitting) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-dim">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-pitch-line border-t-grass" />
        기록 저장 중…
      </div>
    );
  }
  return (
    <button
      onClick={onRetry}
      className="rounded-xl bg-grass px-5 py-2.5 font-display text-pitch-base"
    >
      {label}
    </button>
  );
}
