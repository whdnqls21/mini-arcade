// 계정 이름 검증 (가입·이름 변경 공용).
// 길이뿐 아니라 "글자나 숫자를 최소 하나 포함"을 요구해 '.' 같은 무의미한 이름을 막는다.

export const NAME_MAX = 12;

// 한글·영문 등 글자(\p{L}) 또는 숫자(\p{N})가 하나라도 있어야 한다.
const HAS_ALNUM = /[\p{L}\p{N}]/u;

export function validateName(
  raw: unknown
): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return { ok: false, error: "이름을 입력하세요." };
  if (name.length > NAME_MAX) {
    return { ok: false, error: `이름은 ${NAME_MAX}자 이내로 입력하세요.` };
  }
  if (!HAS_ALNUM.test(name)) {
    return { ok: false, error: "이름에 글자나 숫자를 최소 하나 포함하세요." };
  }
  return { ok: true, name };
}
