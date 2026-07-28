// Supabase 테이블 행 타입 (schema.sql, prefix ma_).

// 정렬/표시 방식. time·htime 은 ms 로 저장하고 '초'로 표시.
//  high  = 높을수록 상위(숫자 그대로)
//  low   = 낮을수록 상위
//  time  = 짧을수록 상위(완주 시간)
//  htime = 길수록 상위(버틴 시간) — 초 표시
export type Scoring = "high" | "low" | "time" | "htime";

export interface Account {
  id: string;
  name: string;
  active: boolean;
  solo: boolean; // 솔로모드: 리더보드에서 제외
  icon: string | null; // 닉네임 옆 아이콘 키(src/lib/icons.ts). null=없음
  title: string | null; // 칭호: 보유한 획득 아이콘 키(라벨을 칭호로 표시). null=없음
  bio: string | null; // 한 줄 소개
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

export type PostCategory = "notice" | "update" | "game" | "balance" | "bug" | "etc";
export type PostStatus = "reviewing" | "planned" | "done" | "declined";

// 클라이언트로 내려보내는 댓글
export interface CommentView {
  id: string;
  authorId: string | null; // 작성자 계정 id(프로필 링크용). 관리자/탈퇴는 null
  authorName: string;
  authorIcon: string | null; // 작성자 현재 아이콘 키
  authorTitle: string | null; // 작성자 현재 칭호 키
  body: string;
  mine: boolean; // 내가 쓴 댓글인지(삭제 권한)
  likes: number; // 좋아요 수
  liked: boolean; // 내가 좋아요 눌렀는지
  createdAt: string;
}

// 클라이언트로 내려보내는 게시글 (계정 참조 대신 이름 스냅샷/내 글 여부만 노출)
export interface PostView {
  id: string;
  category: PostCategory;
  title: string;
  body: string;
  authorId: string | null; // 작성자 계정 id(프로필 링크용). 관리자/탈퇴는 null
  authorName: string;
  authorIcon: string | null; // 작성자 현재 아이콘 키
  authorTitle: string | null; // 작성자 현재 칭호 키
  isNotice: boolean;
  pinned: boolean;
  status: PostStatus | null;
  votes: number;
  voted: boolean; // 내가 추천했는지
  mine: boolean; // 내가 쓴 글인지(삭제 권한)
  comments: CommentView[];
  createdAt: string;
}
