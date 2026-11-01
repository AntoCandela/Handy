/** Suggest only a short, unambiguous replacement, never an entire transcript. */
export function correctionCandidate(
  before: string,
  after: string,
): string | null {
  const old = before.trim().split(/\s+/),
    next = after.trim().split(/\s+/);
  let start = 0;
  while (
    start < old.length &&
    start < next.length &&
    old[start] === next[start]
  )
    start++;
  let oldEnd = old.length,
    newEnd = next.length;
  while (
    oldEnd > start &&
    newEnd > start &&
    old[oldEnd - 1] === next[newEnd - 1]
  ) {
    oldEnd--;
    newEnd--;
  }
  if (
    oldEnd === start ||
    newEnd === start ||
    oldEnd - start > 3 ||
    newEnd - start > 3
  )
    return null;
  const word = next
    .slice(start, newEnd)
    .join(" ")
    .replace(/[<>"']/g, "")
    .replace(/^[.,!?;:]+|[.,!?;:]+$/g, "")
    .trim();
  return word.length > 1 &&
    word.length <= 50 &&
    /\p{L}/u.test(word) &&
    word.toLowerCase() !== old.slice(start, oldEnd).join(" ").toLowerCase()
    ? word
    : null;
}
