export class SimpleQuota {
  private count = 0;
  private resetAt = 0;
  constructor(private readonly max: number, private readonly windowMs: number) {}
  consume(now = Date.now()): { ok: boolean; remaining: number; resetAt: number } {
    if (this.resetAt <= now) {
      this.count = 0;
      this.resetAt = now + this.windowMs;
    }
    if (this.count >= this.max) {
      return { ok: false, remaining: 0, resetAt: this.resetAt };
    }
    this.count++;
    return { ok: true, remaining: this.max - this.count, resetAt: this.resetAt };
  }
}