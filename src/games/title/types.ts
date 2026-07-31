// 제목 학원 클라이언트/서버 공용 타입 (순수 타입만 — server-only 금지).

export type TtReportReason = "inappropriate" | "privacy" | "spam";

export const TT_REPORT_REASONS: { value: TtReportReason; label: string }[] = [
  { value: "inappropriate", label: "부적절한 사진" },
  { value: "privacy", label: "타인 사진·사생활 침해" },
  { value: "spam", label: "장난·도배" },
];

// 사진에 달린 제목 하나.
export interface TtTitle {
  id: string;
  body: string;
  authorName: string;
  mine: boolean; // 내가 쓴 제목
  votes: number;
  voted: boolean; // 내가 이 제목에 투표함
}

// 댓글 (캐치마인드와 동일 구조).
export interface TtComment {
  id: string;
  authorName: string;
  body: string;
  mine: boolean;
  likes: number;
  liked: boolean;
  createdAt: string;
}

// 홈 화면 통계(참여 개수 — 순위/점수 아님).
export interface TtStats {
  galleryCount: number; // 갤러리 전체 사진 수
  photoCount: number; // 내가 올린 사진 수
  titleCount: number; // 내가 단 제목 수
  votesReceived: number; // 내 제목이 받은 총 득표
}

// 갤러리 사진 한 장(제목·투표·댓글까지 한 번에).
export interface TtPhoto {
  photoId: string;
  imageUrl: string;
  authorName: string;
  mine: boolean; // 내가 올린 사진
  createdAt: string;
  titles: TtTitle[]; // 득표 많은 순
  myTitleBody: string | null; // 내가 이 사진에 단 제목(수정용)
  topTitle: { body: string; authorName: string; votes: number } | null; // 왕관(최다 득표, 1표 이상)
  comments: TtComment[]; // 작성 순
  reported: boolean; // 내가 신고함
  canReport: boolean; // 신고 가능(내 사진 아님)
}
