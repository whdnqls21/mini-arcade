// 닉네임 아이콘 카탈로그. 이름 옆에 다는 이모지 1개.
//  - basic  : 누구나 선택 가능(자기표현)
//  - earned : 조건 달성 시 잠금 해제 → 한 번 달성하면 영구 보유
// 획득 조건 판정은 서버(state.ts)가 한다. 여기엔 표시 정보 + 조건 메타만 둔다.

// basic  = 기본(누구나) · earned = 조건 달성 · season = 시즌 보상(추후)
// 테두리 색으로 등급을 구분한다: basic 브론즈, earned 은색, season 금색.
export type IconTier = "basic" | "earned" | "season";

export interface IconDef {
  key: string; // 저장·식별용 키
  emoji: string; // 표시 이모지
  label: string; // 이름
  tier: IconTier;
  hint?: string; // 잠금 해제 조건 안내(earned 전용)
}

// 획득 조건(서버 판정용). 화면엔 hint 로만 노출한다.
export type EarnCond =
  | { kind: "champion"; slug: string } // 해당 게임 리더보드 1위
  | { kind: "goat" } // 전 종목 1위 석권
  | { kind: "plays"; count: number } // 누적 플레이 수
  | { kind: "championsAtLeast"; count: number } // 1위 게임 수 N개 이상
  | { kind: "anyRank"; rank: number } // 어떤 게임이든 특정 순위 달성
  | { kind: "playedAll" } // 모든 게임을 한 번씩 플레이
  | { kind: "cmAuthored"; count: number } // 캐치마인드 출제 수
  | { kind: "cmSolved"; count: number } // 캐치마인드 정답 수
  | { kind: "cmAuthorSolves"; count: number } // 내 문제가 맞혀진 횟수
  | { kind: "likesReceived"; count: number } // 게시판에서 받은 좋아요 수
  | { kind: "boardActivity"; count: number }; // 게시판 글+댓글 수

// ── 기본 아이콘 (누구나) ──────────────────────────────────────────
const BASIC: [string, string, string][] = [
  ["smile", "😎", "선글라스"],
  ["nerd", "🤓", "공부벌레"],
  ["cat", "😺", "고양이"],
  ["dog", "🐶", "강아지"],
  ["rabbit", "🐰", "토끼"],
  ["bear", "🐻", "곰"],
  ["frog", "🐸", "개구리"],
  ["fox", "🦊", "여우"],
  ["turtle", "🐢", "거북이"],
  ["chick", "🐥", "병아리"],
  ["clover", "🍀", "네잎클로버"],
  ["blossom", "🌸", "벚꽃"],
  ["star", "🌟", "별"],
  ["rainbow", "🌈", "무지개"],
  ["balloon", "🎈", "풍선"],
  ["headphone", "🎧", "헤드폰"],
  ["gamepad", "🎮", "게임패드"],
  ["alien", "👾", "외계인"],
];

// ── 획득 아이콘 (조건 달성) ───────────────────────────────────────
// [key, emoji, label, hint, 조건]
const EARNED: [string, string, string, string, EarnCond][] = [
  ["champ:apple", "🍎", "사과왕", "사과게임 1위 달성", { kind: "champion", slug: "apple" }],
  ["champ:suika", "🍉", "수박왕", "수박게임 1위 달성", { kind: "champion", slug: "suika" }],
  ["champ:whack", "🔨", "두더지 왕", "두더지 잡기 1위 달성", { kind: "champion", slug: "whack" }],
  ["champ:mahjong", "🀄", "사천성 고수", "사천성 1위 달성", { kind: "champion", slug: "mahjong" }],
  ["champ:dino", "🦖", "다이노 마스터", "크롬 다이노 1위 달성", { kind: "champion", slug: "dino" }],
  ["champ:memory", "🃏", "기억의 달인", "카드 짝맞추기 1위 달성", { kind: "champion", slug: "memory" }],
  ["champ:schulte", "🔢", "스피드", "1 to 50 1위 달성", { kind: "champion", slug: "schulte" }],
  ["champ:poop", "💩", "똥손", "똥 피하기 1위 달성", { kind: "champion", slug: "poop" }],
  ["champ:greenlight", "🚦", "반응왕", "그린라이트 1위 달성", { kind: "champion", slug: "greenlight" }],
  ["champ:2048", "🧩", "2048 마스터", "2048 1위 달성", { kind: "champion", slug: "2048" }],
  ["goat", "🐐", "GOAT", "모든 게임 1위 석권", { kind: "goat" }],
  ["play100", "🔥", "열정", "누적 100판 플레이", { kind: "plays", count: 100 }],
  // 실력/등급형
  ["tri", "🏅", "삼관왕", "게임 3종 이상에서 1위", { kind: "championsAtLeast", count: 3 }],
  ["king", "👑", "왕중왕", "게임 5종 이상에서 1위", { kind: "championsAtLeast", count: 5 }],
  ["second", "🥈", "만년 2인자", "어떤 게임이든 2위 달성", { kind: "anyRank", rank: 2 }],
  ["allround", "🎯", "올라운더", "모든 게임을 한 번씩 플레이", { kind: "playedAll" }],
  ["gamer", "🕹️", "게임광", "누적 500판 플레이", { kind: "plays", count: 500 }],
  // 캐치마인드형
  ["painter", "🎨", "화가", "캐치마인드 문제 10개 출제", { kind: "cmAuthored", count: 10 }],
  ["sharp", "🧠", "눈썰미", "캐치마인드 정답 30개", { kind: "cmSolved", count: 30 }],
  ["handy", "🖌️", "손재주", "내가 낸 문제가 30번 맞혀짐", { kind: "cmAuthorSolves", count: 30 }],
  // 활동형
  ["popular", "❤️", "인기왕", "게시판에서 좋아요 5개 받기", { kind: "likesReceived", count: 5 }],
  ["chatty", "💬", "수다쟁이", "게시판 글·댓글 8개 작성", { kind: "boardActivity", count: 8 }],
];

// ── 시즌 보상 아이콘 (금테) ───────────────────────────────────────
// 조건 자동 판정(EARN_COND)이 아니라, 시즌 종료 시 서버가 '직접 지급'한다
// (ma_account_icons 에 기록). 그래서 EARNED 와 달리 여기 별도로 둔다.
// [key, emoji, label, hint]
const SEASON: [string, string, string, string][] = [
  ["season_mvp", "🏆", "시즌 MVP", "시즌 종합 1위(MVP)에게 지급"], // 종합 1위
];

// 시즌 종목별 1등 아이콘(금테). 올타임 champ:* 와 같은 이모지를 쓰되 이름 앞에 '시즌'을 붙여
// 구분한다. 시즌 종료 시 그 종목 1등에게 지급(seasonEnd). 키는 schamp:<slug>.
const SEASON_CHAMP: [string, string, string][] = [
  ["schamp:apple", "🍎", "시즌 사과왕"],
  ["schamp:suika", "🍉", "시즌 수박왕"],
  ["schamp:whack", "🔨", "시즌 두더지 왕"],
  ["schamp:mahjong", "🀄", "시즌 사천성 고수"],
  ["schamp:dino", "🦖", "시즌 다이노 마스터"],
  ["schamp:memory", "🃏", "시즌 기억의 달인"],
  ["schamp:schulte", "🔢", "시즌 스피드"],
  ["schamp:poop", "💩", "시즌 똥손"],
  ["schamp:greenlight", "🚦", "시즌 반응왕"],
  ["schamp:2048", "🧩", "시즌 2048 마스터"],
];

export const BASIC_ICONS: IconDef[] = BASIC.map(([key, emoji, label]) => ({
  key,
  emoji,
  label,
  tier: "basic",
}));

export const EARNED_ICONS: IconDef[] = EARNED.map(([key, emoji, label, hint]) => ({
  key,
  emoji,
  label,
  tier: "earned",
  hint,
}));

export const SEASON_ICONS: IconDef[] = [
  ...SEASON.map(([key, emoji, label, hint]) => ({ key, emoji, label, tier: "season" as const, hint })),
  ...SEASON_CHAMP.map(([key, emoji, label]) => ({
    key,
    emoji,
    label,
    tier: "season" as const,
    hint: "시즌 종료 시 이 종목 1등에게 지급",
  })),
];

export const ALL_ICONS: IconDef[] = [...BASIC_ICONS, ...EARNED_ICONS, ...SEASON_ICONS];

// 등급별 테두리 색(닉네임 아이콘 코인)
export const TIER_RING: Record<IconTier, string> = {
  basic: "#8a5a2b", // 브론즈(짙은 갈색)
  earned: "#c9d1de", // 은색
  season: "#f4c64e", // 금색(앱 골드)
};

const BY_KEY = new Map<string, IconDef>(ALL_ICONS.map((i) => [i.key, i]));
export const iconByKey = (key: string | null | undefined): IconDef | undefined =>
  key ? BY_KEY.get(key) : undefined;

// 획득 아이콘 key → 조건(서버 판정용)
export const EARN_COND: Record<string, EarnCond> = Object.fromEntries(
  EARNED.map(([key, , , , cond]) => [key, cond])
);
