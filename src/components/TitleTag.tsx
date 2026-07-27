import { iconByKey } from "@/lib/icons";

// 칭호 태그 — 보유한 '획득 아이콘'의 이름을 이름 옆 작은 배지로 보여준다.
// 획득 아이콘 키가 아니면 아무것도 그리지 않는다.
export function TitleTag({
  titleKey,
  className = "",
}: {
  titleKey: string | null | undefined;
  className?: string;
}) {
  const def = iconByKey(titleKey);
  if (!def || def.tier !== "earned") return null;
  return (
    <span
      className={`shrink-0 rounded bg-grass/10 px-1.5 py-0.5 text-[10px] leading-none text-grass ${className}`}
    >
      {def.label}
    </span>
  );
}
