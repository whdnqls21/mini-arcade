// 캐치마인드 클라이언트/서버 공용 타입 (순수 타입만 — server-only 금지).

export type ReportReason = "lazy" | "inappropriate" | "answer_leak";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "lazy", label: "성의 없는 그림" },
  { value: "inappropriate", label: "부적절한 그림" },
  { value: "answer_leak", label: "정답 유출(글자 써넣음 등)" },
];

// 출제 화면: 제시어 후보(내가 그릴 것이라 원문을 준다)
export interface WordPick {
  id: number;
  text: string;
}

// 맞추기 화면: 서버가 내려주는 문제(정답 원문은 절대 없음)
export interface PlayQuiz {
  quizId: string;
  imageUrl: string; // 서명 URL
  length: number; // 정답 글자 수
  tries: number; // 지금까지 시도한 횟수(0~2)
  hint: string | null; // 이번 시도에 보여줄 힌트(글자수/초성)
}

// 답 제출 결과
export interface GuessResult {
  correct: boolean;
  finished: boolean;
  remaining: number; // 남은 기회
  hint: string | null; // 다음 시도용 힌트
  score: number | null; // 맞혔을 때 정답자 획득 점수
  tries: number;
}

// 결과 화면(풀이 끝난 사람만)
export interface QuizResult {
  word: string;
  correct: boolean;
  myScore: number;
  authorName: string; // 출제자 닉네임(정답 공개 후 표시)
  imageUrl: string | null; // 방금 푼 그림(서명 URL)
  wrongTop3: { guess: string; count: number }[];
  myStars: number | null;
}

// 내 통계
export interface CmStats {
  total: number;
  solvePoints: number;
  authorPoints: number;
  solvedCount: number;
  quizCount: number;
  unsolvedCount: number; // 아직 안 푼(맞출 수 있는) 문제 수
}

// 순위 한 줄
export interface CmRankRow {
  name: string;
  points: number;
  rank: number;
}

export interface CmRank {
  total: CmRankRow[];
  solver: CmRankRow[];
  author: CmRankRow[];
}

// ── 갤러리 ──────────────────────────────────────────────────────────────
export type GalleryKind = "mine" | "solved" | "failed";

export interface GalleryItem {
  quizId: string;
  imageUrl: string | null;
  word: string;
  kind: GalleryKind; // 내 출제 / 맞힘 / 못 맞힘
}

export interface RatingSummary {
  avg: number; // 평균(0이면 평가 없음)
  count: number; // 평가 수
  dist: number[]; // [1★,2★,3★,4★,5★] 개수
}

export interface GalleryComment {
  id: string;
  authorName: string;
  body: string;
  mine: boolean;
  likes: number;
  liked: boolean;
  createdAt: string;
}

export interface GalleryDetail {
  quizId: string;
  imageUrl: string | null;
  word: string;
  authorName: string;
  kind: GalleryKind;
  rating: RatingSummary;
  myStars: number | null; // 내가 준 별점
  canRate: boolean; // 평가 가능(끝냈고, 내 문제 아니고, 아직 평가 안 함)
  wrongTop3: { guess: string; count: number }[];
  comments: GalleryComment[];
}
