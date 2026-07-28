import { iconByKey, TIER_RING } from "@/lib/icons";

// 닉네임 옆 아이콘 코인. 등급별 테두리색(브론즈/은색/금색)으로 차별화한다.
// 크기는 주변 글자 크기(em)에 맞춰 자동으로 커지고 작아진다.
export function IconBadge({
  iconKey,
  className = "",
}: {
  iconKey: string | null | undefined;
  className?: string;
}) {
  const def = iconByKey(iconKey);
  if (!def) return null;
  const ring = TIER_RING[def.tier] ?? TIER_RING.basic;
  return (
    <span
      role="img"
      aria-label={def.label}
      title={def.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-[0.18em] leading-none ${className}`}
      style={{
        border: `0.07em solid ${ring}`,
        // 테두리 색을 아주 옅게 깔아 코인 느낌을 준다.
        backgroundColor: `${ring}22`,
        padding: "0.14em",
      }}
    >
      <span style={{ lineHeight: 1 }}>{def.emoji}</span>
    </span>
  );
}
