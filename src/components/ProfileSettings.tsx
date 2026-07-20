"use client";

import { useState } from "react";

import { Card } from "@/components/Card";
import { postJSON } from "@/lib/client-api";

type Tab = "name" | "pin";

export function ProfileSettings({
  currentName,
  onChanged,
}: {
  currentName: string;
  onChanged: () => Promise<void> | void;
}) {
  const [tab, setTab] = useState<Tab>("name");

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-display text-lg text-ink">계정 설정</h2>

      <div className="flex rounded-xl border border-pitch-line p-1 text-sm">
        {(["name", "pin"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 transition-colors ${
              tab === t ? "bg-grass/15 text-grass" : "text-ink-faint"
            }`}
          >
            {t === "name" ? "이름 변경" : "PIN 변경"}
          </button>
        ))}
      </div>

      {tab === "name" ? (
        <NameForm currentName={currentName} onChanged={onChanged} />
      ) : (
        <PinForm />
      )}
    </Card>
  );
}

function NameForm({
  currentName,
  onChanged,
}: {
  currentName: string;
  onChanged: () => Promise<void> | void;
}) {
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const trimmed = name.trim();
  const unchanged = trimmed === currentName;

  async function submit() {
    if (!trimmed || unchanged || busy) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await postJSON("/api/auth/profile", { action: "rename", name: trimmed });
      await onChanged();
      setDone(`이름을 '${trimmed}' 으로 바꿨어요.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label className="text-sm text-ink-dim">새 이름</label>
        <input
          value={name}
          maxLength={12}
          onChange={(e) => {
            setName(e.target.value);
            setDone(null);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="rounded-xl border border-pitch-line bg-black/20 px-4 py-3 text-ink outline-none focus:border-grass"
        />
        <p className="text-[11px] text-ink-faint">
          1~12자. 리더보드에 표시되는 이름이고, 다음 로그인부터 이 이름을 씁니다.
        </p>
      </div>

      <button
        onClick={submit}
        disabled={!trimmed || unchanged || busy}
        className="rounded-xl bg-grass py-3 font-display text-pitch-base disabled:opacity-40"
      >
        {busy ? "변경 중…" : "이름 변경"}
      </button>

      <Feedback error={error} done={done} />
    </div>
  );
}

function PinForm() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const ready = currentPin.length === 4 && newPin.length === 4 && confirmPin.length === 4;
  const mismatch = confirmPin.length === 4 && newPin !== confirmPin;

  async function submit() {
    if (!ready || busy) return;
    if (mismatch) {
      setError("새 PIN 확인이 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await postJSON("/api/auth/profile", { action: "changePin", currentPin, newPin });
      setDone("PIN을 바꿨어요. 다음 로그인부터 새 PIN을 쓰세요.");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "변경에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <PinInput label="현재 PIN" value={currentPin} onChange={setCurrentPin} />
      <PinInput label="새 PIN" value={newPin} onChange={setNewPin} />
      <PinInput label="새 PIN 확인" value={confirmPin} onChange={setConfirmPin} onEnter={submit} />

      {mismatch && <p className="text-center text-sm text-danger">새 PIN 확인이 일치하지 않습니다.</p>}

      <button
        onClick={submit}
        disabled={!ready || mismatch || busy}
        className="rounded-xl bg-grass py-3 font-display text-pitch-base disabled:opacity-40"
      >
        {busy ? "변경 중…" : "PIN 변경"}
      </button>

      <Feedback error={error} done={done} />
    </div>
  );
}

function PinInput({
  label,
  value,
  onChange,
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-ink-dim">{label}</label>
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder="••••"
        className="tabular rounded-xl border border-pitch-line bg-black/20 px-4 py-3 text-center text-2xl tracking-[0.5em] text-ink outline-none focus:border-grass"
      />
    </div>
  );
}

function Feedback({ error, done }: { error: string | null; done: string | null }) {
  if (error) return <p className="text-center text-sm text-danger">{error}</p>;
  if (done) return <p className="text-center text-sm text-grass">{done}</p>;
  return null;
}
