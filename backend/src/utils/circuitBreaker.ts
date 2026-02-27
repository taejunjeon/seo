export class CircuitOpenError extends Error {
  service: string;
  retryAfterMs: number;

  constructor(service: string, retryAfterMs: number) {
    super(`Circuit open for ${service}`);
    this.name = "CircuitOpenError";
    this.service = service;
    this.retryAfterMs = retryAfterMs;
  }
}

export const isCircuitOpenError = (error: unknown): error is CircuitOpenError =>
  error instanceof CircuitOpenError ||
  (typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "CircuitOpenError");

type CircuitBreakerOptions = {
  service: string;
  failureThreshold: number;
  cooldownMs: number;
};

type CircuitState = "closed" | "open" | "half_open";

export class CircuitBreaker {
  private service: string;
  private failureThreshold: number;
  private cooldownMs: number;

  private state: CircuitState = "closed";
  private failureCount = 0;
  private openedAtMs = 0;
  private halfOpenProbeInFlight = false;

  constructor(options: CircuitBreakerOptions) {
    this.service = options.service;
    this.failureThreshold = Math.max(1, options.failureThreshold);
    this.cooldownMs = Math.max(1000, options.cooldownMs);
  }

  exec<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.state === "open") {
      const elapsed = now - this.openedAtMs;
      const remaining = this.cooldownMs - elapsed;
      if (remaining > 0) throw new CircuitOpenError(this.service, remaining);
      this.state = "half_open";
    }

    let probe = false;
    if (this.state === "half_open") {
      if (this.halfOpenProbeInFlight) throw new CircuitOpenError(this.service, this.cooldownMs);
      this.halfOpenProbeInFlight = true;
      probe = true;
    }

    return fn()
      .then((value) => {
        this.onSuccess();
        return value;
      })
      .catch((error) => {
        this.onFailure();
        throw error;
      })
      .finally(() => {
        if (probe) this.halfOpenProbeInFlight = false;
      });
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = "closed";
    this.openedAtMs = 0;
  }

  private onFailure() {
    this.failureCount += 1;

    if (this.state === "half_open" || this.failureCount >= this.failureThreshold) {
      this.state = "open";
      this.openedAtMs = Date.now();
    }
  }
}

