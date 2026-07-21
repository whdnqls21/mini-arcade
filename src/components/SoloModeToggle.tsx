"use client";

import { useState } from "react";

import { Card } from "@/components/Card";
import { postJSON } from "@/lib/client-api";

// 솔로모드 전환 — 순위 경쟁이 부담스러운 유저용.
// 켜면 기록은 그대로 저장되지만 모든 리더보드에서 빠진다(비파괴적, 언제든 복귀).
export function SoloModeToggle({
  solo,
  onChanged,
}: {
  solo: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    const next = !solo;
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/auth/profile", { action: "setSolo", solo: next });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-ink">솔로모드</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-dim">
            순위 경쟁이 부담스럽다면 켜세요. 내 기록은 그대로 쌓이지만 리더보드에는 올라가지 않아요.
            언제든 다시 끌 수 있어요.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={solo}
          aria-label="솔로모드 전환"
          onClick={toggle}
          disabled={busy}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            solo ? "bg-grass" : "bg-pitch-line"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              solo ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <p className="text-[13px]">
        현재:{" "}
        <span className={solo ? "text-grass" : "text-ink-faint"}>
          {solo ? "솔로모드 켜짐 — 순위 미참여" : "꺼짐 — 순위에 참여 중"}
        </span>
      </p>

      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}
