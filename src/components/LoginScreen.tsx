"use client";

import { useState } from "react";

import { Card } from "@/components/Card";
import { useAppState } from "@/components/StateProvider";
import { postJSON } from "@/lib/client-api";

export default function LoginScreen() {
  const { refresh } = useAppState();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || pin.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      await postJSON(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
        name: name.trim(),
        pin,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "실패");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-8">
      <div className="text-center">
        <p className="text-xs tracking-[0.2em] text-grass">뇌지컬 대전</p>
        <h1 className="mt-1 font-display text-2xl text-ink">
          {mode === "login" ? "로그인" : "회원가입"}
        </h1>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex rounded-xl border border-pitch-line p-1 text-sm">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`flex-1 rounded-lg py-2 transition-colors ${
                mode === m ? "bg-grass/15 text-grass" : "text-ink-faint"
              }`}
            >
              {m === "login" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-ink-dim">이름</label>
          <input
            value={name}
            maxLength={12}
            onChange={(e) => setName(e.target.value)}
            placeholder="닉네임"
            className="rounded-xl border border-pitch-line bg-black/20 px-4 py-3 text-ink outline-none focus:border-grass"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-ink-dim">4자리 PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="••••"
            className="tabular rounded-xl border border-pitch-line bg-black/20 px-4 py-3 text-center text-2xl tracking-[0.5em] text-ink outline-none focus:border-grass"
          />
        </div>

        <button
          onClick={submit}
          disabled={!name.trim() || pin.length !== 4 || busy}
          className="rounded-xl bg-grass py-3 font-display text-lg text-pitch-base disabled:opacity-40"
        >
          {busy ? "확인 중…" : mode === "login" ? "입장" : "가입하고 시작"}
        </button>

        {error && <p className="text-center text-sm text-danger">{error}</p>}
        <p className="text-center text-[11px] text-ink-faint">
          {mode === "login"
            ? "계정이 없으면 회원가입 탭에서 바로 만들 수 있어요."
            : "가입은 바로 승인됩니다. 이름 + PIN 만 있으면 끝!"}
        </p>
      </Card>
    </div>
  );
}
