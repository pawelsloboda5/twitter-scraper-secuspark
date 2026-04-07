import { ScraperEvent } from './logger-events';

// ---------------------------------------------------------------------------
// Transport interface
// ---------------------------------------------------------------------------

export interface LogTransport {
  name: string;
  write(event: ScraperEvent): void;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Session metrics types
// ---------------------------------------------------------------------------

export interface EndpointMetrics {
  endpoint: string;
  requestCount: number;
  totalDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  errorCount: number;
  rateLimitCount: number;
  lastStatus: number;
}

export interface ScrapeOperationMetrics {
  operation: string;
  totalItems: number;
  totalPages: number;
  durationMs: number;
  errors: number;
}

export interface SessionMetrics {
  sessionId: string;
  startTime: string;
  endTime?: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitsHit: number;
  totalRateLimitWaitMs: number;
  requestsByEndpoint: Record<string, EndpointMetrics>;
  scrapeOperations: ScrapeOperationMetrics[];
  parseSuccessCount: number;
  parseFailureCount: number;
  errors: {
    timestamp: string;
    code: string;
    message: string;
    endpoint?: string;
  }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomHex(bytes: number): string {
  let result = '';
  for (let i = 0; i < bytes; i++) {
    result += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0');
  }
  return result;
}

// ---------------------------------------------------------------------------
// ScraperLogger
// ---------------------------------------------------------------------------

export class ScraperLogger {
  public readonly sessionId: string;
  private transports: LogTransport[] = [];
  private metrics: SessionMetrics;

  constructor(transports?: LogTransport[]) {
    this.sessionId = randomHex(8);
    this.metrics = {
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitsHit: 0,
      totalRateLimitWaitMs: 0,
      requestsByEndpoint: {},
      scrapeOperations: [],
      parseSuccessCount: 0,
      parseFailureCount: 0,
      errors: [],
    };

    if (transports) {
      for (const t of transports) {
        this.transports.push(t);
      }
    }
  }

  emit(event: Omit<ScraperEvent, 'timestamp' | 'sessionId'>): void {
    const stamped: ScraperEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
    } as ScraperEvent;

    this.updateMetrics(stamped);

    for (const transport of this.transports) {
      transport.write(stamped);
    }
  }

  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  removeTransport(transport: LogTransport): void {
    const idx = this.transports.indexOf(transport);
    if (idx !== -1) {
      this.transports.splice(idx, 1);
    }
  }

  getMetrics(): SessionMetrics {
    return { ...this.metrics };
  }

  async flush(): Promise<void> {
    if (!this.metrics.endTime) {
      this.metrics.endTime = new Date().toISOString();
    }
    await Promise.all(
      this.transports
        .filter((t) => typeof t.flush === 'function')
        .map((t) => t.flush!()),
    );
  }

  async close(): Promise<void> {
    await this.flush();
    await Promise.all(
      this.transports
        .filter((t) => typeof t.close === 'function')
        .map((t) => t.close!()),
    );
  }

  get hasTransports(): boolean {
    return this.transports.length > 0;
  }

  // -------------------------------------------------------------------------
  // Internal metrics bookkeeping
  // -------------------------------------------------------------------------

  private getOrCreateEndpoint(endpoint: string): EndpointMetrics {
    let entry = this.metrics.requestsByEndpoint[endpoint];
    if (!entry) {
      entry = {
        endpoint,
        requestCount: 0,
        totalDurationMs: 0,
        minDurationMs: Number.MAX_SAFE_INTEGER,
        maxDurationMs: 0,
        errorCount: 0,
        rateLimitCount: 0,
        lastStatus: 0,
      };
      this.metrics.requestsByEndpoint[endpoint] = entry;
    }
    return entry;
  }

  private updateMetrics(event: ScraperEvent): void {
    switch (event.event) {
      case 'http.request': {
        this.metrics.totalRequests++;
        break;
      }

      case 'http.response': {
        if (event.statusCode < 400) {
          this.metrics.successfulRequests++;
        } else {
          this.metrics.failedRequests++;
        }

        const entry = this.getOrCreateEndpoint(event.endpoint);
        entry.requestCount++;
        entry.totalDurationMs += event.durationMs;
        entry.minDurationMs = Math.min(entry.minDurationMs, event.durationMs);
        entry.maxDurationMs = Math.max(entry.maxDurationMs, event.durationMs);
        if (event.statusCode >= 400) {
          entry.errorCount++;
        }
        entry.lastStatus = event.statusCode;
        break;
      }

      case 'http.rate_limit': {
        this.metrics.rateLimitsHit++;
        this.metrics.totalRateLimitWaitMs += event.waitMs;

        const entry = this.getOrCreateEndpoint(event.endpoint);
        entry.rateLimitCount++;
        break;
      }

      case 'scrape.complete': {
        this.metrics.scrapeOperations.push({
          operation: event.operation,
          totalItems: event.totalItems,
          totalPages: event.totalPages,
          durationMs: event.durationMs,
          errors: event.errors,
        });
        break;
      }

      case 'parse.success': {
        this.metrics.parseSuccessCount += event.count ?? 1;
        break;
      }

      case 'parse.failure': {
        this.metrics.parseFailureCount += event.count ?? 1;
        break;
      }

      case 'error': {
        this.metrics.errors.push({
          timestamp: event.timestamp,
          code: event.code ?? 'UNKNOWN',
          message: event.message,
          endpoint: event.endpoint,
        });
        break;
      }
    }
  }
}
