"use client";

import { useState } from "react";

import { Card } from "@/components/Card";
import { IconBadge } from "@/components/IconBadge";
import { BASIC_ICONS, EARNED_ICONS, SEASON_ICONS } from "@/lib/icons";
import { postJSON } from "@/lib/client-api";

// 등급 안내 문구용
const TIER_HINT = "테두리 색으로 등급을 구분해요 — 갈색(기본) · 은색(획득) · 금색(시즌 보상)";

// 내정보의 닉네임 아이콘 선택기. 기본은 아무나, 획득형은 잠금 해제된 것만 장착 가능.
export function IconPicker({
  current,
  name,
  granted,
  eligible,
  onChanged,
}: {
  current: string | null;
  name: string;
  granted: string[];
  eligible: string[];
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null); // 잠긴 아이콘 탭 시 조건 안내

  const unlocked = new Set([...granted, ...eligible]);

  // 같은 걸 다시 누르면 해제.
  const equip = async (key: string | null) => {
    if (busy) return;
    const target = key === current ? null : key;
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      await postJSON("/api/auth/profile", { action: "setIcon", icon: target });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "변경에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const cell = (selected: boolean, extra = "") =>
    `flex items-center justify-center rounded-xl text-2xl transition-colors ${
      selected ? "bg-grass/20 ring-2 ring-grass" : "bg-black/20 hover:bg-black/30"
    } ${extra}`;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">닉네임 아이콘</h2>
        {/* 이름 옆 미리보기 */}
        <span className="flex items-center gap-1 text-sm text-ink-dim">
          <IconBadge iconKey={current} />
          <span className="text-ink">{name}</span>
        </span>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-faint">{TIER_HINT}</p>

      {/* 기본 — 누구나 */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-ink-faint">기본 · 자유롭게 골라 꾸며요</p>
        <div className="grid grid-cols-6 gap-2">
          {/* 없음(해제) */}
          <button
            onClick={() => equip(null)}
            disabled={busy}
            aria-label="아이콘 없음"
            className={cell(current == null, "aspect-square text-xs text-ink-faint")}
          >
            없음
          </button>
          {BASIC_ICONS.map((i) => (
            <button
              key={i.key}
              onClick={() => equip(i.key)}
              disabled={busy}
              aria-label={i.label}
              title={i.label}
              className={cell(current === i.key, "aspect-square")}
            >
              <IconBadge iconKey={i.key} />
            </button>
          ))}
        </div>
      </div>

      {/* 획득 — 조건 달성 시 잠금 해제 */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-ink-faint">획득 · 조건을 달성하면 잠금 해제돼요</p>
        <div className="grid grid-cols-3 gap-2">
          {EARNED_ICONS.map((i) => {
            const open = unlocked.has(i.key);
            const selected = current === i.key;
            return (
              <button
                key={i.key}
                onClick={() => (open ? equip(i.key) : setHint(`🔒 ${i.label} — ${i.hint}`))}
                disabled={busy}
                aria-label={i.label}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                  selected
                    ? "bg-grass/20 ring-2 ring-grass"
                    : open
                      ? "bg-black/20 hover:bg-black/30"
                      : "bg-black/10"
                }`}
              >
                {open ? (
                  <IconBadge iconKey={i.key} className="text-xl" />
                ) : (
                  <span className="text-xl opacity-30 grayscale">{i.emoji}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className={`block text-xs leading-tight break-keep ${open ? "text-ink" : "text-ink-faint"}`}>
                    {i.label}
                  </span>
                  {!open && <span className="mt-0.5 block text-[10px] text-ink-faint">🔒 잠김</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 시즌 보상 — 시즌 MVP 에게 지급되는 금테 아이콘 */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-ink-faint">시즌 보상 · 시즌 MVP에게 지급돼요</p>
        <div className="grid grid-cols-3 gap-2">
          {SEASON_ICONS.map((i) => {
            const open = granted.includes(i.key); // 시즌 보상은 지급받아야만 열림(조건 자동판정 없음)
            const selected = current === i.key;
            return (
              <button
                key={i.key}
                onClick={() => (open ? equip(i.key) : setHint(`🔒 ${i.label} — ${i.hint}`))}
                disabled={busy}
                aria-label={i.label}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                  selected
                    ? "bg-grass/20 ring-2 ring-grass"
                    : open
                      ? "bg-black/20 hover:bg-black/30"
                      : "bg-black/10"
                }`}
              >
                {open ? (
                  <IconBadge iconKey={i.key} className="text-xl" />
                ) : (
                  <span className="text-xl opacity-30 grayscale">{i.emoji}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className={`block text-xs leading-tight break-keep ${open ? "text-ink" : "text-ink-faint"}`}>
                    {i.label}
                  </span>
                  {!open && <span className="mt-0.5 block text-[10px] text-ink-faint">🔒 잠김</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {hint && <p className="text-xs text-gold">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </Card>
  );
}
