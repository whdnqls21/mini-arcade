"use client";

import { useState } from "react";

import { Card } from "@/components/Card";
import { EARNED_ICONS } from "@/lib/icons";
import { postJSON } from "@/lib/client-api";

const BIO_MAX = 30;

// 내정보의 칭호 선택 + 한 줄 소개 편집.
export function ProfileExtras({
  currentTitle,
  currentBio,
  granted,
  onChanged,
}: {
  currentTitle: string | null;
  currentBio: string | null;
  granted: string[];
  onChanged: () => void | Promise<void>;
}) {
  const owned = new Set(granted);
  // 칭호 후보 = 보유한 획득 아이콘
  const titleOptions = EARNED_ICONS.filter((i) => owned.has(i.key));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setTitle = async (key: string | null) => {
    if (busy) return;
    const target = key === currentTitle ? null : key; // 같은 걸 다시 누르면 해제
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/auth/profile", { action: "setTitle", title: target });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "변경에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-display text-lg text-ink">프로필 꾸미기</h2>

      {/* 칭호 */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-ink-faint">칭호 · 획득한 아이콘으로 달 수 있어요</p>
        {titleOptions.length === 0 ? (
          <p className="rounded-lg bg-black/15 px-3 py-2 text-xs text-ink-faint">
            아직 획득한 칭호가 없어요. 게임 1위 같은 조건을 달성하면 칭호가 열려요!
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTitle(null)}
              disabled={busy}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                currentTitle == null
                  ? "bg-grass/15 text-grass"
                  : "border border-pitch-line text-ink-faint hover:text-ink-dim"
              }`}
            >
              없음
            </button>
            {titleOptions.map((i) => (
              <button
                key={i.key}
                onClick={() => setTitle(i.key)}
                disabled={busy}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  currentTitle === i.key
                    ? "bg-grass/15 text-grass"
                    : "border border-pitch-line text-ink-dim hover:text-ink"
                }`}
              >
                {i.emoji} {i.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 한 줄 소개 */}
      <BioForm currentBio={currentBio} onChanged={onChanged} />

      {error && <p className="text-xs text-danger">{error}</p>}
    </Card>
  );
}

function BioForm({
  currentBio,
  onChanged,
}: {
  currentBio: string | null;
  onChanged: () => void | Promise<void>;
}) {
  const [bio, setBio] = useState(currentBio ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const trimmed = bio.trim().replace(/\s+/g, " ");
  const unchanged = trimmed === (currentBio ?? "");

  const save = async () => {
    if (busy || unchanged) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await postJSON("/api/auth/profile", { action: "setBio", bio: trimmed });
      setDone(true);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-faint">한 줄 소개</p>
        <span className={`text-[10px] ${bio.length > BIO_MAX ? "text-danger" : "text-ink-faint"}`}>
          {bio.length}/{BIO_MAX}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          value={bio}
          onChange={(e) => {
            setBio(e.target.value);
            setDone(false);
          }}
          maxLength={BIO_MAX + 10}
          placeholder="예: 오늘도 1등 사냥 중 🏆"
          className="min-w-0 flex-1 rounded-lg border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-grass focus:outline-none"
        />
        <button
          onClick={save}
          disabled={busy || unchanged || bio.length > BIO_MAX}
          className="shrink-0 rounded-lg bg-grass px-4 py-2 text-sm font-medium text-pitch-base disabled:opacity-40"
        >
          저장
        </button>
      </div>
      {done && !error && <p className="text-xs text-grass">저장했어요.</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
