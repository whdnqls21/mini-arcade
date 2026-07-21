import type { PostCategory, PostStatus } from "@/lib/types";

// 분류 라벨. notice(공지)는 관리자만 쓸 수 있어 작성 폼에서는 조건부로 노출.
export const CATEGORY_LABEL: Record<PostCategory, string> = {
  notice: "공지",
  game: "게임 추천",
  balance: "밸런스 제안",
  etc: "기타",
};

// 사용자가 고를 수 있는 제안 분류(공지 제외).
export const SUGGESTION_CATEGORIES: PostCategory[] = ["game", "balance", "etc"];

export const STATUS_LABEL: Record<PostStatus, string> = {
  reviewing: "검토중",
  planned: "반영 예정",
  done: "반영됨",
  declined: "보류",
};

export const STATUS_ORDER: PostStatus[] = ["reviewing", "planned", "done", "declined"];

// 상태별 색(칩). 반영됨은 초록, 보류는 흐리게.
export const STATUS_STYLE: Record<PostStatus, string> = {
  reviewing: "border-gold/40 bg-gold/10 text-gold",
  planned: "border-grass/40 bg-grass/10 text-grass",
  done: "border-grass/60 bg-grass/20 text-grass",
  declined: "border-pitch-line bg-black/20 text-ink-faint",
};
