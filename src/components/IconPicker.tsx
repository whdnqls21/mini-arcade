"use client";

import { useState } from "react";

import { Card } from "@/components/Card";
import { IconBadge } from "@/components/IconBadge";
import { Modal } from "@/components/Modal";
import { BASIC_ICONS, EARNED_ICONS, SEASON_ICONS, TIER_RING, type IconDef, type IconTier } from "@/lib/icons";
import { postJSON } from "@/lib/client-api";

// 등급 안내 문구용
const TIER_HINT = "테두리 색으로 등급을 구분해요 — 갈색(기본) · 은색(획득) · 금색(시즌 보상)";

// 등급별 표시 정보(팝업)
const GRADE: Record<IconTier, { label: string; color: string }> = {
  basic: { label: "기본", color: "브론즈(갈색)" },
  earned: { label: "획득", color: "은색" },
  season: { label: "시즌 보상", color: "금색" },
};

// 내정보의 닉네임 아이콘 선택기. 아이콘을 누르면 팝업으로 실제 색상·등급·획득조건을 보여주고,
// 팝업 안에서 장착/해제한다(아이콘이 많아 아래쪽 힌트로는 조건 확인이 어려워서).
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
  const [detail, setDetail] = useState<IconDef | null>(null); // 상세 팝업 대상

  const unlocked = new Set([...granted, ...eligible]);

  // 장착 가능한가 — 기본은 누구나, 획득은 잠금해제(보유·조건충족), 시즌은 지급받아야.
  const usable = (def: IconDef) =>
    def.tier === "basic" ? true : def.tier === "season" ? granted.includes(def.key) : unlocked.has(def.key);

  // 같은 걸 다시 장착하면 해제.
  const equip = async (key: string | null) => {
    if (busy) return;
    const target = key === current ? null : key;
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/auth/profile", { action: "setIcon", icon: target });
      await onChanged();
      setDetail(null);
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

  // 잠긴(장착 불가) 아이콘은 흐리게 + 🔒. 눌러도 팝업으로 조건은 볼 수 있다.
  const lockedCell = (def: IconDef) => {
    const open = usable(def);
    const selected = current === def.key;
    return (
      <button
        key={def.key}
        onClick={() => setDetail(def)}
        disabled={busy}
        aria-label={def.label}
        className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
          selected ? "bg-grass/20 ring-2 ring-grass" : open ? "bg-black/20 hover:bg-black/30" : "bg-black/10"
        }`}
      >
        {open ? (
          <IconBadge iconKey={def.key} className="text-xl" />
        ) : (
          <span className="text-xl opacity-30 grayscale">{def.emoji}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className={`block text-xs leading-tight break-keep ${open ? "text-ink" : "text-ink-faint"}`}>
            {def.label}
          </span>
          {!open && <span className="mt-0.5 block text-[10px] text-ink-faint">🔒 잠김</span>}
        </span>
      </button>
    );
  };

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
          {/* 없음(해제) — 바로 적용 */}
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
              onClick={() => setDetail(i)}
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
        {/* 순위 칭호 게이트 안내 — 숫자는 state.ts MIN_RANKED_FOR_ICON(=5)과 맞춘다 */}
        <p className="text-[10px] leading-relaxed text-ink-faint">
          ※ ‘1위·2위·GOAT·삼관왕’ 같은 순위 칭호는 <b className="text-ink-dim">5명 이상</b>이 겨룬
          게임에서만 인정돼요.
        </p>
        <div className="grid grid-cols-3 gap-2">{EARNED_ICONS.map(lockedCell)}</div>
      </div>

      {/* 시즌 보상 — 시즌 MVP 에게 지급되는 금테 아이콘 */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-ink-faint">시즌 보상 · 시즌 MVP에게 지급돼요</p>
        <div className="grid grid-cols-3 gap-2">{SEASON_ICONS.map(lockedCell)}</div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {/* 상세 팝업 — 실제 색상·등급·획득조건 + 장착 */}
      {detail && (
        <Modal open onClose={() => setDetail(null)} title="아이콘">
          <div className="flex flex-col items-center gap-3 text-center">
            {/* 실제 테두리 색으로 크게 */}
            <IconBadge iconKey={detail.key} className="text-6xl" />

            <div className="flex flex-col items-center gap-1.5">
              <p className="font-display text-lg text-ink">{detail.label}</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-pitch-line px-2.5 py-0.5 text-xs text-ink-dim">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: TIER_RING[detail.tier] }}
                />
                {GRADE[detail.tier].label} · {GRADE[detail.tier].color} 테두리
              </span>
            </div>

            {/* 획득 조건 / 설명 */}
            <p className="text-sm leading-relaxed text-ink-dim">
              {detail.tier === "basic"
                ? "누구나 자유롭게 쓸 수 있는 기본 아이콘이에요."
                : detail.hint ?? "조건을 달성하면 얻을 수 있어요."}
            </p>

            {/* 상태 · 액션 */}
            {usable(detail) ? (
              <button
                onClick={() => equip(detail.key)}
                disabled={busy}
                className="w-full rounded-xl bg-grass py-2.5 font-display text-pitch-base disabled:opacity-40"
              >
                {current === detail.key ? "해제하기" : "장착하기"}
              </button>
            ) : (
              <p className="w-full rounded-xl bg-black/20 px-3 py-2.5 text-sm text-gold">
                🔒 아직 잠긴 아이콘이에요
              </p>
            )}

            {error && <p className="text-xs text-danger">{error}</p>}
          </div>
        </Modal>
      )}
    </Card>
  );
}
