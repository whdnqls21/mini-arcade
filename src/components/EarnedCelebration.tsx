"use client";

import { useEffect, useState } from "react";

import { IconBadge } from "@/components/IconBadge";
import { Modal } from "@/components/Modal";
import { useAppState } from "@/components/StateProvider";
import { iconByKey } from "@/lib/icons";

// 새 아이콘(=칭호)을 획득한 순간 축하 모달. state.session.newlyEarned 는 서버가
// '이번 로드에 처음 영구 획득한 것'만 채워주므로, 획득 직후 한 번만 뜬다.
export function EarnedCelebration() {
  const { state } = useAppState();
  const key = (state?.session?.newlyEarned ?? []).join(",");
  const [shown, setShown] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (key) {
      setShown(key.split(","));
      setOpen(true);
    }
  }, [key]);

  if (!open || shown.length === 0) return null;

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="🎉 새 아이콘 획득!">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-dim">
          조건을 달성해 새 아이콘{shown.length > 1 ? ` ${shown.length}개` : ""}을 얻었어요. 아이콘은
          칭호로도 달 수 있어요 — 내정보에서 골라보세요!
        </p>
        <ul className="flex flex-col gap-2">
          {shown.map((k) => {
            const def = iconByKey(k);
            if (!def) return null;
            return (
              <li key={k} className="flex items-center gap-3 rounded-lg bg-black/20 px-3 py-2">
                <IconBadge iconKey={k} className="text-2xl" />
                <div className="min-w-0">
                  <p className="font-display text-ink">{def.label}</p>
                  {def.hint && <p className="text-xs text-ink-faint">{def.hint}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
