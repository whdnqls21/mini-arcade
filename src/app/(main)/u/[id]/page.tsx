"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Card } from "@/components/Card";
import { IconBadge } from "@/components/IconBadge";
import { TitleTag } from "@/components/TitleTag";
import { formatScore } from "@/lib/format";
import { iconByKey } from "@/lib/icons";
import type { PublicProfile } from "@/lib/state";

export default function ProfilePage() {
  const params = useParams();
  const id = String(params.id);
  const [p, setP] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setErr(null);
    setP(null);
    fetch(`/api/u/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!live) return;
        if (!r.ok) setErr(d?.error ?? "불러오지 못했어요.");
        else setP(d as PublicProfile);
      })
      .catch(() => live && setErr("불러오지 못했어요."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [id]);

  if (loading) {
    return <div className="pt-20 text-center text-sm text-ink-dim">불러오는 중…</div>;
  }
  if (err || !p) {
    return (
      <Card className="mt-8 flex flex-col items-center gap-2 py-10 text-center">
        <p className="font-display text-lg text-danger">프로필을 볼 수 없어요</p>
        {err && <p className="text-sm text-ink-dim">{err}</p>}
        <Link href="/rank" className="text-xs text-grass">
          ← 순위로
        </Link>
      </Card>
    );
  }

  const days = Math.max(0, Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000));
  const ownedEarned = p.ownedIcons
    .map((k) => iconByKey(k))
    .filter((d): d is NonNullable<typeof d> => !!d && d.tier !== "basic");
  const playedGames = p.games.filter((g) => g.best != null);

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="pt-1">
        <Link href="/rank" className="text-xs text-grass">
          ← 순위
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 font-display text-2xl text-ink">
          <IconBadge iconKey={p.icon} />
          {p.name}
          <TitleTag titleKey={p.title} className="px-2 py-1 text-[11px]" />
        </h1>
        {p.bio && <p className="mt-1 text-sm text-ink-dim">{p.bio}</p>}
        <p className="mt-1 text-xs text-ink-faint">
          가입 D+{days}
          {p.solo && " · 솔로모드"}
        </p>
        {p.isMe && (
          <Link href="/me" className="mt-1 inline-block text-xs text-grass">
            내정보에서 꾸미기 →
          </Link>
        )}
      </div>

      {/* 요약 */}
      <Card className="grid grid-cols-3 gap-2">
        <Stat label="1등" value={`🏆 ${p.summary.champions}`} />
        <Stat label="총 플레이" value={String(p.summary.totalPlays)} />
        <Stat label="보유 아이콘" value={String(p.summary.iconCount)} />
      </Card>

      {/* 게임 기록 */}
      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-lg text-ink">게임 기록</h2>
        {playedGames.length === 0 ? (
          <p className="text-sm text-ink-dim">아직 기록이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {playedGames.map((g) => (
              <li
                key={g.slug}
                className="flex items-center justify-between rounded-lg bg-black/15 px-3 py-2 text-sm"
              >
                <span className="font-display text-ink">{g.name}</span>
                <span className="text-ink-dim">
                  <span className="tabular text-gold">{formatScore(g.scoring, g.best!, g.slug)}</span>{" "}
                  {g.rank != null ? (
                    <span className="text-xs text-ink-faint">({g.rank}위)</span>
                  ) : (
                    <span className="text-xs text-ink-faint">(솔로)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 캐치마인드 */}
      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-lg text-ink">캐치마인드</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="정답" value={String(p.catchmind.solved)} />
          <Stat label="출제" value={String(p.catchmind.authored)} />
        </div>
      </Card>

      {/* 획득 아이콘 도감 */}
      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-lg text-ink">
          획득 아이콘 <span className="text-sm font-normal text-ink-faint">{ownedEarned.length}종</span>
        </h2>
        {ownedEarned.length === 0 ? (
          <p className="text-sm text-ink-dim">아직 획득한 아이콘이 없어요.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {ownedEarned.map((d) => (
              <div key={d.key} className="flex items-center gap-2 rounded-lg bg-black/15 px-2.5 py-2">
                <IconBadge iconKey={d.key} className="text-xl" />
                <span className="min-w-0 truncate text-xs text-ink">{d.label}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/15 px-2 py-2 text-center">
      <div className="text-[10px] text-ink-faint">{label}</div>
      <div className="font-display text-ink">{value}</div>
    </div>
  );
}
