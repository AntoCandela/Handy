// Manual input freezes the text visible at that moment. Recognition continues
// in a separate source buffer; only speech after the frozen boundary is shown.
// Token alignment maps that boundary when the model revises tentative words.
const tokens = (text: string): string[] =>
  text.match(/[\p{L}\p{N}\p{M}_]+|\s+|[^\p{L}\p{N}\p{M}_\s]/gu) ?? [];

function mapBoundary(
  before: string[],
  after: string[],
  boundary: number,
): number {
  let prefix = 0;
  while (prefix < before.length && before[prefix] === after[prefix]) prefix++;
  if (boundary <= prefix) return boundary;
  const a = before.slice(prefix);
  const b = after.slice(prefix);
  // Never guess at a very large wholesale rewrite (e.g. batch fallback).
  // Keep the draft available for manual recovery instead of silently losing it.
  if ((a.length + 1) * (b.length + 1) > 1_000_000)
    throw new Error("Transcript revision is too large to merge safely");
  const rows = Array.from(
    { length: a.length + 1 },
    () => new Uint32Array(b.length + 1),
  );
  for (let i = 0; i <= a.length; i++) rows[i][b.length] = a.length - i;
  for (let j = 0; j <= b.length; j++) rows[a.length][j] = b.length - j;
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      rows[i][j] = Math.min(
        rows[i + 1][j + 1] + Number(a[i] !== b[j]),
        rows[i + 1][j] + 1,
        rows[i][j + 1] + 1,
      );
  let i = 0;
  let j = 0;
  while (i < boundary - prefix) {
    if (
      j < b.length &&
      rows[i][j] === rows[i + 1][j + 1] + Number(a[i] !== b[j])
    ) {
      i++;
      j++;
    } else if (rows[i][j] === rows[i + 1][j] + 1) i++;
    else j++;
  }
  return prefix + j;
}

export class LiveDraft {
  private source: string[] = [];
  private boundary = 0;
  private frozen = "";
  edited = false;
  text = "";

  update(raw: string): string {
    const next = tokens(raw);
    // A temporary retraction of tentative words must not cause those words
    // to be appended a second time when the next hypothesis restores them.
    if (
      this.edited &&
      next.length < this.boundary &&
      next.every((token, index) => token === this.source[index])
    ) {
      this.text = this.frozen;
      return this.text;
    }
    if (!this.edited) this.text = raw;
    else {
      const boundary = mapBoundary(this.source, next, this.boundary);
      this.text = this.frozen + next.slice(boundary).join("");
      this.boundary = boundary;
    }
    this.source = next;
    return this.text;
  }

  edit(text: string): void {
    this.edited = true;
    this.text = this.frozen = text;
    this.boundary = this.source.length;
  }
}
