"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/Modal";

// 기록 초기화 안내 — 리더보드 위 배너(계속)와 진입 시 1회 모달.
// 밸런스 조정 등으로 관리자가 기록을 지웠을 때 "왜 사라졌는지"를 알려준다.
export function ResetNotice({
  gameName,
  resetAt,
  resetNote,
  accountId,
  slug,
}: {
  gameName: string;
  resetAt: string | null;
  resetNote: string | null;
  accountId: string | null;
  slug: string;
}) {
  const [showModal, setShowModal] = useState(false);

  // 이 초기화(resetAt 값)를 이 기기에서 처음 보는 거면 모달을 한 번 띄운다.
  useEffect(() => {
    if (!resetAt) return;
    const key = `ma_reset_seen:${accountId ?? "guest"}:${slug}`;
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(key);
    } catch {
      seen = null;
    }
    if (seen !== resetAt) {
      setShowModal(true);
      try {
        window.localStorage.setItem(key, resetAt);
      } catch {
        // 저장 실패해도 모달은 뜬다(다음에 또 뜰 뿐)
      }
    }
  }, [resetAt, accountId, slug]);

  if (!resetAt) return null;

  const dateText = formatDate(resetAt);
  const note = resetNote ?? "밸런스 조정";

  return (
    <>
      <div className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold">
        <span aria-hidden>⚖️</span>
        <span className="leading-relaxed">
          <b>{dateText}</b> {note}으로 기록이 초기화됐어요. 새 기준으로 다시 도전하세요!
        </span>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="기록이 초기화됐어요">
        <div className="flex flex-col gap-3 text-sm text-ink-dim">
          <p>
            <b className="text-ink">{gameName}</b> 가 <b className="text-gold">{note}</b>으로 개편되어
            리더보드 기록이 초기화됐어요.
          </p>
          <p>
            바뀐 난이도에 맞춰 모두 같은 출발선에서 다시 시작합니다. 첫 기록의 주인공이 되어보세요!
          </p>
          <p className="text-[11px] text-ink-faint">초기화 시각: {dateText}</p>
          <button
            onClick={() => setShowModal(false)}
            className="mt-1 rounded-xl bg-grass py-2.5 font-display text-pitch-base"
          >
            확인
          </button>
        </div>
      </Modal>
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${hh}:${mm}`;
}
