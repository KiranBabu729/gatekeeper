export type DiffToken = { type: "equal" | "add" | "remove"; text: string };

/** Minimal word-level LCS diff — fine for short message bodies, not a general-purpose diff library. */
export function wordDiff(before: string, after: string): DiffToken[] {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      tokens.push({ type: "equal", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      tokens.push({ type: "remove", text: a[i] });
      i++;
    } else {
      tokens.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < m) tokens.push({ type: "remove", text: a[i++] });
  while (j < n) tokens.push({ type: "add", text: b[j++] });

  return tokens;
}
