"use client";

import { useState } from "react";

import { Card } from "@/components/Card";
import { postJSON } from "@/lib/client-api";
import { NAME_MAX } from "@/lib/name";

// 규칙에 어긋나는 이름을 쓰는 사용자에게 앱 대신 뜨는 강제 개명 화면.
// 유효한 이름으로 바꿔야만 벗어날 수 있고, 탈출구는 로그아웃뿐이다.
export default function ForceRename({
  currentName,
  onDone,
}: {
  currentName: string;
  onDone: () => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      // 서버가 최종 검증한다(빈값/길이/글자·숫자 포함). 통과하면 이름·쿠키가 갱신된다.
      await postJSON("/api/auth/profile", { action: "rename", name: name.trim() });
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await postJSON("/api/auth/logout", {}).catch(() => {});
    await onDone();
  }

  return (
    <div className="flex flex-col gap-4 pt-8">
      <div className="text-center">
        <span className="text-2xl">✏️</span>
        <h1 className="mt-1 font-display text-2xl text-ink">닉네임을 바꿔주세요</h1>
      </div>

      <Card className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-ink-dim">
          지금 이름 <b className="text-ink">{currentName}</b> 은 사용할 수 없어요. 계속하려면 새 닉네임으로
          바꿔주세요.
        </p>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-ink-dim">새 닉네임</label>
          <input
            autoFocus
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="이름 또는 닉네임"
            className="rounded-xl border border-pitch-line bg-black/20 px-4 py-3 text-ink outline-none focus:border-grass"
          />
          <p className="text-[11px] leading-relaxed text-ink-faint">
            순위표와 게시판에 보이는 이름이에요. 1~{NAME_MAX}자, 글자나 숫자를 최소 하나 포함해야 해요.
          </p>
        </div>

        <button
          onClick={submit}
          disabled={!name.trim() || busy}
          className="rounded-xl bg-grass py-3 font-display text-lg text-pitch-base disabled:opacity-40"
        >
          {busy ? "변경 중…" : "바꾸고 계속하기"}
        </button>
        {error && <p className="text-center text-sm text-danger">{error}</p>}

        <button onClick={logout} className="text-center text-xs text-ink-faint hover:text-ink-dim">
          로그아웃
        </button>
      </Card>
    </div>
  );
}
