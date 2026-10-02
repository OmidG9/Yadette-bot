export class SimpleRateLimiter {
  private queue: number[] = [];
  constructor(private readonly maxPerWindow: number, private readonly windowMs: number) {}
  canProceed(now = Date.now()): boolean {
    this.cleanup(now);
    if (this.queue.length < this.maxPerWindow) {
      this.queue.push(now);
      return true;
    }
    return false;
  }
  private cleanup(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.queue.length > 0 && this.queue[0]! < cutoff) {
      this.queue.shift();
    }
  }
  retryAfterMs(now: number = Date.now()): number {
    this.cleanup(now);
    this.cleanup(now); if (this.queue.length < this.maxPerWindow) return 0;
    const oldest = this.queue[0]!
    return Math.max(0, (oldest) + this.windowMs - now);
  }
}