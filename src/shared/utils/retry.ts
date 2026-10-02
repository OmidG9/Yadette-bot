export async function retry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; backoffMs?: number; factor?: number; maxBackoffMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const backoffMs = opts.backoffMs ?? 200;
  const factor = opts.factor ?? 2;
  const maxBackoffMs = opts.maxBackoffMs ?? 2000;
  let attempt = 0;
  let lastErr: unknown;
  let delay = backoffMs;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, Math.min(delay, maxBackoffMs)));
      delay *= factor;
      attempt++;
    }
  }
  throw lastErr;
}