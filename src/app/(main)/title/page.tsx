"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Card } from "@/components/Card";
import { useAppState } from "@/components/StateProvider";
import { TtComments } from "@/games/title/TtComments";
import { TT_REPORT_REASONS, type TtPhoto, type TtReportReason } from "@/games/title/types";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? "요청에 실패했습니다.");
  return data as T;
}

const MAX_SIDE = 1280;

// 소스 포맷은 상관없다 — 캔버스로 다시 그려 webp/jpeg 로 재인코딩하므로,
// 브라우저가 '디코딩'만 하면 된다(아이폰 Safari 는 HEIC 도 네이티브로 디코딩됨).
// 디코딩을 여러 방법으로 시도하고, 다 실패하면(예: 크롬의 HEIC) 그때만 안내한다.
async function decodeImage(
  file: File
): Promise<{ src: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  // 1) createImageBitmap — EXIF 회전 보정(옵션 미지원이면 옵션 없이).
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { src: bmp, width: bmp.width, height: bmp.height, cleanup: () => bmp.close() };
  } catch {
    /* 다음 방법 */
  }
  try {
    const bmp = await createImageBitmap(file);
    return { src: bmp, width: bmp.width, height: bmp.height, cleanup: () => bmp.close() };
  } catch {
    /* 다음 방법 */
  }
  // 2) <img> 폴백 — createImageBitmap 이 없거나 실패하는 브라우저용.
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("decode"));
      im.src = url;
    });
    return {
      src: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("이 사진은 이 기기에서 열 수 없어요. 다른 사진으로 시도해 주세요.");
  }
}

// 실사진 → 긴 변 1280px 로 축소 + webp(불가 시 jpeg) 인코딩.
async function fileToDataUrl(file: File): Promise<string> {
  const { src, width, height, cleanup } = await decodeImage(file);
  if (!width || !height) {
    cleanup();
    throw new Error("이 사진은 이 기기에서 열 수 없어요. 다른 사진으로 시도해 주세요.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    cleanup();
    throw new Error("사진을 처리할 수 없어요.");
  }
  ctx.drawImage(src, 0, 0, w, h);
  cleanup();
  const webp = canvas.toDataURL("image/webp", 0.85);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
}

export default function TitlePage() {
  const { state } = useAppState();
  const [photos, setPhotos] = useState<TtPhoto[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ items: TtPhoto[] }>("/api/tt/photos");
      setPhotos(d.items);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "불러오지 못했어요.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!state) return null;
  if (state.session?.solo) {
    return (
      <Wrap>
        <Card className="py-10 text-center text-sm text-ink-dim">
          제목 학원은 함께 제목을 짓고 투표하는 게임이라 솔로모드에서는 이용할 수 없어요.
          <br />내정보에서 솔로모드를 끄면 참여할 수 있습니다.
        </Card>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Uploader onUploaded={load} />
      {err && <Card className="py-8 text-center text-sm text-danger">{err}</Card>}
      {!photos && !err && <Spinner />}
      {photos && photos.length === 0 && (
        <Card className="py-10 text-center text-sm text-ink-dim">
          아직 올라온 사진이 없어요.
          <br />첫 사진을 올려 제목 대결을 시작해 보세요!
        </Card>
      )}
      {photos?.map((p) => (
        <PhotoCard key={p.photoId} photo={p} onChanged={load} />
      ))}
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-grass">제목 학원</p>
          <h1 className="font-display text-2xl text-ink">사진에 제목을</h1>
        </div>
        <Link href="/social" className="rounded-lg border border-pitch-line px-3 py-2 text-sm text-ink-dim hover:text-ink">
          소셜
        </Link>
      </div>
      {children}
    </div>
  );
}

// ── 업로드 ────────────────────────────────────────────────────────────
function Uploader({ onUploaded }: { onUploaded: () => Promise<void> | void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    try {
      setPreview(await fileToDataUrl(file));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "사진을 열 수 없어요.");
      setPreview(null);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const upload = async () => {
    if (!preview || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api("/api/tt/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: preview }),
      });
      setPreview(null);
      await onUploaded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "업로드에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="올릴 사진 미리보기"
            className="mx-auto w-full max-w-[22rem] rounded-xl border border-pitch-line"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setPreview(null)}
              disabled={busy}
              className="flex-1 rounded-xl border border-pitch-line py-3 text-sm text-ink-dim hover:text-ink disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={upload}
              disabled={busy}
              className="flex-[2] rounded-xl bg-grass py-3 font-display text-pitch-base disabled:opacity-50"
            >
              {busy ? "올리는 중…" : "이 사진 올리기"}
            </button>
          </div>
        </>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded-xl border border-dashed border-pitch-line py-4 font-display text-ink-dim hover:border-grass/40 hover:text-ink"
        >
          📷 사진 올리기
        </button>
      )}
      {err && <p className="text-center text-sm text-danger">{err}</p>}
    </Card>
  );
}

// ── 사진 카드 ──────────────────────────────────────────────────────────
function PhotoCard({ photo, onChanged }: { photo: TtPhoto; onChanged: () => Promise<void> | void }) {
  const [showComments, setShowComments] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await onChanged();
    } catch {
      /* 조용히 무시 */
    } finally {
      setBusy(false);
    }
  };

  const vote = (titleId: string) =>
    run(() =>
      api("/api/tt/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.photoId, titleId }),
      })
    );

  const report = (reason: TtReportReason) =>
    run(async () => {
      await api("/api/tt/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.photoId, reason }),
      });
      setReporting(false);
    });

  const removePhoto = () => {
    if (!confirm("이 사진을 삭제할까요? 달린 제목·댓글도 함께 사라져요.")) return;
    run(() => api(`/api/tt/photos?photoId=${photo.photoId}`, { method: "DELETE" }));
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-ink-faint">
        <span>
          올린 사람 <span className="text-ink-dim">{photo.authorName}</span>
        </span>
        {photo.mine && (
          <button onClick={removePhoto} disabled={busy} className="text-danger hover:underline disabled:opacity-40">
            삭제
          </button>
        )}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.imageUrl}
        alt="사진"
        className="mx-auto w-full max-w-[24rem] rounded-xl border border-pitch-line"
      />

      {/* 왕관 — 현재 최다 득표 제목 */}
      {photo.topTitle ? (
        <div className="rounded-xl bg-gold/10 px-3 py-2 text-center">
          <p className="font-display text-lg text-gold">🏆 {photo.topTitle.body}</p>
          <p className="text-[11px] text-ink-faint">
            {photo.topTitle.authorName} · {photo.topTitle.votes}표
          </p>
        </div>
      ) : (
        <p className="text-center text-xs text-ink-faint">아직 왕관이 없어요. 첫 제목을 달아보세요!</p>
      )}

      {/* 내 제목 달기/수정 */}
      <MyTitleInput photoId={photo.photoId} current={photo.myTitleBody} onSaved={onChanged} />

      {/* 제목 목록 + 투표 */}
      {photo.titles.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {photo.titles.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                t.voted ? "bg-grass/10" : "bg-black/15"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{t.body}</p>
                <p className="text-[11px] text-ink-faint">{t.authorName}</p>
              </div>
              <button
                onClick={() => vote(t.id)}
                disabled={busy || t.mine}
                aria-label={t.voted ? "투표 취소" : "이 제목에 투표"}
                className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${
                  t.voted ? "bg-grass text-pitch-base" : "border border-pitch-line text-ink-dim hover:text-ink"
                }`}
              >
                👍 <span className="tabular">{t.votes}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 하단 액션 */}
      <div className="flex items-center gap-3 border-t border-pitch-line pt-2 text-xs">
        <button
          onClick={() => setShowComments((s) => !s)}
          className="text-ink-faint hover:text-ink-dim"
        >
          💬 댓글 {photo.comments.length}
        </button>
        <div className="ml-auto">
          {photo.canReport &&
            (photo.reported ? (
              <span className="text-ink-faint">신고됨</span>
            ) : (
              <button onClick={() => setReporting((s) => !s)} className="text-ink-faint hover:text-ink-dim">
                🚩 신고
              </button>
            ))}
        </div>
      </div>

      {reporting && (
        <div className="flex flex-col gap-2 rounded-lg bg-black/15 p-3">
          <span className="text-xs text-ink-faint">신고 사유</span>
          {TT_REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => report(r.value)}
              disabled={busy}
              className="rounded-lg border border-pitch-line py-2 text-sm text-ink-dim hover:text-ink disabled:opacity-40"
            >
              {r.label}
            </button>
          ))}
          <button onClick={() => setReporting(false)} className="text-xs text-ink-faint">
            취소
          </button>
        </div>
      )}

      {showComments && <TtComments photoId={photo.photoId} comments={photo.comments} onChanged={onChanged} />}
    </Card>
  );
}

// 내가 이 사진에 다는 제목(사진당 1개, 수정·삭제 가능).
function MyTitleInput({
  photoId,
  current,
  onSaved,
}: {
  photoId: string;
  current: string | null;
  onSaved: () => Promise<void> | void;
}) {
  const [val, setVal] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = val.trim() !== (current ?? "");

  const save = async () => {
    if (busy || !dirty) return;
    setBusy(true);
    try {
      await api("/api/tt/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, body: val.trim() }),
      });
      await onSaved();
    } catch {
      /* 조용히 무시 */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2">
      <input
        value={val}
        maxLength={60}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder={current ? "내 제목 수정…" : "내 제목 달기…"}
        className="min-w-0 flex-1 rounded-xl border border-pitch-line bg-black/20 px-4 py-2.5 text-sm text-ink outline-none focus:border-grass/50"
      />
      <button
        onClick={save}
        disabled={busy || !dirty}
        className="shrink-0 rounded-xl bg-grass px-4 text-sm font-medium text-pitch-base disabled:opacity-40"
      >
        {current ? (val.trim() ? "수정" : "삭제") : "등록"}
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-pitch-line border-t-grass" />
    </div>
  );
}
