import { iconByKey } from "@/lib/icons";

// 닉네임 옆에 붙는 아이콘 이모지. 키가 없거나 알 수 없으면 아무것도 안 그린다.
export function IconBadge({
  iconKey,
  className = "",
}: {
  iconKey: string | null | undefined;
  className?: string;
}) {
  const def = iconByKey(iconKey);
  if (!def) return null;
  return (
    <span role="img" aria-label={def.label} title={def.label} className={className}>
      {def.emoji}
    </span>
  );
}
