export type LineDiffToken = { type: "equal" | "add" | "remove"; line: string };

/** Minimal line-level LCS diff for the policy YAML version viewer. */
export function lineDiff(before: string, after: string): LineDiffToken[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const tokens: LineDiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      tokens.push({ type: "equal", line: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      tokens.push({ type: "remove", line: a[i] });
      i++;
    } else {
      tokens.push({ type: "add", line: b[j] });
      j++;
    }
  }
  while (i < m) tokens.push({ type: "remove", line: a[i++] });
  while (j < n) tokens.push({ type: "add", line: b[j++] });

  return tokens;
}
