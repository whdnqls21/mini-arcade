// Supabase 테이블 행 타입 (schema.sql, prefix ma_).

export type Scoring = "high" | "low" | "time"; // 정렬 방향

export interface Account {
  id: string;
  name: string;
  active: boolean;
  solo: boolean; // 솔로모드: 리더보드에서 제외
  // pin_hash 는 서버에서만 다루며 클라이언트로 내려보내지 않는다.
  created_at: string;
}

export interface Game {
  slug: string;
  name: string;
  description: string | null;
  scoring: Scoring;
  active: boolean;
  sort: number;
  reset_at: string | null; // 마지막 기록 초기화 시각(안내용)
  reset_note: string | null; // 초기화 사유
  created_at: string;
}

export interface Score {
  id: string;
  account_id: string;
  game_slug: string;
  score: number; // time 게임은 밀리초
  meta: Record<string, unknown> | null;
  created_at: string;
}

export type PostCategory = "notice" | "game" | "balance" | "bug" | "etc";
export type PostStatus = "reviewing" | "planned" | "done" | "declined";

// 클라이언트로 내려보내는 댓글
export interface CommentView {
  id: string;
  authorName: string;
  body: string;
  mine: boolean; // 내가 쓴 댓글인지(삭제 권한)
  createdAt: string;
}

// 클라이언트로 내려보내는 게시글 (계정 참조 대신 이름 스냅샷/내 글 여부만 노출)
export interface PostView {
  id: string;
  category: PostCategory;
  title: string;
  body: string;
  authorName: string;
  isNotice: boolean;
  pinned: boolean;
  status: PostStatus | null;
  votes: number;
  voted: boolean; // 내가 추천했는지
  mine: boolean; // 내가 쓴 글인지(삭제 권한)
  comments: CommentView[];
  createdAt: string;
}
