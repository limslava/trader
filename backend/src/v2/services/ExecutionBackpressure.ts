export class ExecutionBackpressure {
  shouldThrottle(queuedCount: number, maxQueued: number): boolean {
    return queuedCount >= maxQueued;
  }
}
