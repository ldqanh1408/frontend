export type DiffLine = { op: 'same' | 'add' | 'del'; text: string; a?: number; b?: number };

/** Line diff (LCS). Large inputs fall back to a whole-block replacement so the UI never freezes. */
export function diffLines(a: string, b: string, limit = 4000): DiffLine[] {
  const A = a.split('\n');
  const B = b.split('\n');
  if (A.length * B.length > limit * limit / 4) {
    return [...A.map((t, i) => ({ op: 'del' as const, text: t, a: i + 1 })), ...B.map((t, i) => ({ op: 'add' as const, text: t, b: i + 1 }))];
  }
  const n = A.length, m = B.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ op: 'same', text: A[i], a: i + 1, b: j + 1 }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ op: 'del', text: A[i], a: i + 1 }); i++; }
    else { out.push({ op: 'add', text: B[j], b: j + 1 }); j++; }
  }
  while (i < n) { out.push({ op: 'del', text: A[i], a: i + 1 }); i++; }
  while (j < m) { out.push({ op: 'add', text: B[j], b: j + 1 }); j++; }
  return out;
}

/** Keeps changed lines plus `context` lines around them; collapsed runs are reported as gaps. */
export function withContext(lines: DiffLine[], context = 3): (DiffLine | { op: 'gap'; count: number })[] {
  const keep = new Array(lines.length).fill(false);
  lines.forEach((l, i) => { if (l.op !== 'same') for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true; });
  const out: (DiffLine | { op: 'gap'; count: number })[] = [];
  let gap = 0;
  lines.forEach((l, i) => {
    if (keep[i]) { if (gap) { out.push({ op: 'gap', count: gap }); gap = 0; } out.push(l); } else gap++;
  });
  if (gap) out.push({ op: 'gap', count: gap });
  return out;
}
