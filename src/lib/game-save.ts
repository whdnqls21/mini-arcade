// 진행 중인 판을 브라우저에 저장해 두고 다음 방문 때 이어하게 한다.
// 서버에 두지 않으므로 기기/브라우저가 바뀌면 저장은 남지 않는다.

const VERSION = 1;

interface Envelope<S> {
  v: number;
  state: S;
  savedAt: number;
}

// 한 기기에서 계정을 바꿔 로그인해도 섞이지 않도록 계정 id 를 키에 넣는다.
function storageKey(slug: string, accountId: string | null): string {
  return `ma_save:${accountId ?? "guest"}:${slug}`;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null; // 사파리 프라이빗 모드 등에서 접근이 막힐 수 있다.
  }
}

export function loadGame<S>(slug: string, accountId: string | null): S | null {
  const ls = storage();
  if (!ls) return null;
  const raw = ls.getItem(storageKey(slug, accountId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Envelope<S>;
    // 버전이 다르면 구조가 바뀐 것 → 조용히 버린다.
    if (!parsed || parsed.v !== VERSION) {
      clearGame(slug, accountId);
      return null;
    }
    return parsed.state;
  } catch {
    clearGame(slug, accountId);
    return null;
  }
}

export function saveGame<S>(slug: string, accountId: string | null, state: S): void {
  const ls = storage();
  if (!ls) return;
  const envelope: Envelope<S> = { v: VERSION, state, savedAt: Date.now() };
  try {
    ls.setItem(storageKey(slug, accountId), JSON.stringify(envelope));
  } catch {
    // 용량 초과 등은 무시 — 저장 실패가 플레이를 막지는 않는다.
  }
}

export function clearGame(slug: string, accountId: string | null): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.removeItem(storageKey(slug, accountId));
  } catch {
    // 무시
  }
}
