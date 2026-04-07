/**
 * ReportTransport — accumulates events and generates report files on flush().
 *
 * Report writing uses Node.js `fs/promises` and is guarded behind the
 * `PLATFORM_NODE` constant so that esbuild dead-code elimination strips
 * file I/O from browser builds.
 */

import {
  ScraperEvent,
  HttpResponseEvent,
  HttpRateLimitEvent,
  ScrapeCompleteEvent,
  ScraperErrorEvent,
} from './logger-events';
import { LogTransport, SessionMetrics, EndpointMetrics } from './logger';

declare const PLATFORM_NODE: boolean;

// ---------------------------------------------------------------------------
// ReportTransport
// ---------------------------------------------------------------------------

export interface ReportTransportOptions {
  /** Directory to write report files to */
  outputDir: string;
  /** Which report formats to generate */
  formats: ('json' | 'csv' | 'md')[];
}

export class ReportTransport implements LogTransport {
  name = 'report';
  private events: ScraperEvent[] = [];

  constructor(private options: ReportTransportOptions) {
    if (typeof PLATFORM_NODE !== 'undefined' && !PLATFORM_NODE) {
      throw new Error(
        'ReportTransport requires Node.js for file I/O. ' +
          'Use ConsoleTransport or JsonLinesTransport in browser environments.',
      );
    }
  }

  write(event: ScraperEvent): void {
    this.events.push(event);
  }

  async flush(): Promise<void> {
    if (this.events.length === 0) {
      return;
    }

    if (typeof PLATFORM_NODE === 'undefined' || PLATFORM_NODE) {
      const { writeFile, mkdir } = await import('node:fs/promises');
      const { join } = await import('node:path');

      await mkdir(this.options.outputDir, { recursive: true });

      const sessionId = this.events[0].sessionId;
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const baseName = `report-${sessionId}-${ts}`;

      for (const fmt of this.options.formats) {
        let content: string;
        switch (fmt) {
          case 'json':
            content = generateJsonReport(this.events, sessionId);
            break;
          case 'csv':
            content = generateCsvReport(this.events);
            break;
          case 'md':
            content = generateMdReport(this.events, sessionId);
            break;
        }
        const filePath = join(this.options.outputDir, `${baseName}.${fmt}`);
        await writeFile(filePath, content, 'utf-8');
      }
    }

    this.events = [];
  }
}

// ---------------------------------------------------------------------------
// Metrics builder (shared by JSON and Markdown reports)
// SYNC: This logic mirrors ScraperLogger.updateMetrics() in logger.ts.
// If you add a new event type, update both places.
// ---------------------------------------------------------------------------

function buildMetrics(
  events: ScraperEvent[],
  sessionId: string,
): SessionMetrics {
  const metrics: SessionMetrics = {
    sessionId,
    startTime:
      events.length > 0 ? events[0].timestamp : new Date().toISOString(),
    endTime:
      events.length > 0 ? events[events.length - 1].timestamp : undefined,
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

  function getOrCreateEndpoint(endpoint: string): EndpointMetrics {
    let entry = metrics.requestsByEndpoint[endpoint];
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
      metrics.requestsByEndpoint[endpoint] = entry;
    }
    return entry;
  }

  for (const event of events) {
    switch (event.event) {
      case 'http.request': {
        metrics.totalRequests++;
        break;
      }

      case 'http.response': {
        const resp = event as HttpResponseEvent;
        if (resp.statusCode < 400) {
          metrics.successfulRequests++;
        } else {
          metrics.failedRequests++;
        }

        const entry = getOrCreateEndpoint(resp.endpoint);
        entry.requestCount++;
        entry.totalDurationMs += resp.durationMs;
        entry.minDurationMs = Math.min(entry.minDurationMs, resp.durationMs);
        entry.maxDurationMs = Math.max(entry.maxDurationMs, resp.durationMs);
        if (resp.statusCode >= 400) {
          entry.errorCount++;
        }
        entry.lastStatus = resp.statusCode;
        break;
      }

      case 'http.rate_limit': {
        const rl = event as HttpRateLimitEvent;
        metrics.rateLimitsHit++;
        metrics.totalRateLimitWaitMs += rl.waitMs;

        const entry = getOrCreateEndpoint(rl.endpoint);
        entry.rateLimitCount++;
        break;
      }

      case 'scrape.complete': {
        const sc = event as ScrapeCompleteEvent;
        metrics.scrapeOperations.push({
          operation: sc.operation,
          totalItems: sc.totalItems,
          totalPages: sc.totalPages,
          durationMs: sc.durationMs,
          errors: sc.errors,
        });
        break;
      }

      case 'parse.success': {
        metrics.parseSuccessCount += event.count ?? 1;
        break;
      }

      case 'parse.failure': {
        metrics.parseFailureCount += event.count ?? 1;
        break;
      }

      case 'error': {
        const err = event as ScraperErrorEvent;
        metrics.errors.push({
          timestamp: err.timestamp,
          code: err.code ?? 'UNKNOWN',
          message: err.message,
          endpoint: err.endpoint,
        });
        break;
      }
    }
  }

  return metrics;
}

// ---------------------------------------------------------------------------
// JSON report
// ---------------------------------------------------------------------------

function generateJsonReport(events: ScraperEvent[], sessionId: string): string {
  const metrics = buildMetrics(events, sessionId);
  return JSON.stringify(metrics, null, 2);
}

// ---------------------------------------------------------------------------
// CSV report
// ---------------------------------------------------------------------------

function escapeCsvField(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function generateCsvReport(events: ScraperEvent[]): string {
  const header =
    'timestamp,event,level,method,url,endpoint,statusCode,durationMs,rateLimitRemaining,error';
  const rows: string[] = [header];

  for (const event of events) {
    const timestamp = escapeCsvField(event.timestamp);
    const eventType = escapeCsvField(event.event);
    const level = escapeCsvField(event.level);

    let method = '';
    let url = '';
    let endpoint = '';
    let statusCode = '';
    let durationMs = '';
    let rateLimitRemaining = '';
    let error = '';

    switch (event.event) {
      case 'http.request':
        method = event.method;
        url = escapeCsvField(event.url);
        endpoint = escapeCsvField(event.endpoint);
        break;

      case 'http.response':
        method = event.method;
        url = escapeCsvField(event.url);
        endpoint = escapeCsvField(event.endpoint);
        statusCode = String(event.statusCode);
        durationMs = String(event.durationMs);
        rateLimitRemaining =
          event.rateLimitRemaining != null
            ? String(event.rateLimitRemaining)
            : '';
        break;

      case 'http.rate_limit':
        endpoint = escapeCsvField(event.endpoint);
        rateLimitRemaining = String(event.rateLimitRemaining);
        break;

      case 'auth.login_start':
      case 'auth.login_step':
      case 'auth.login_success':
      case 'auth.login_failure':
      case 'auth.logout':
      case 'auth.guest_token':
      case 'auth.cookies_set':
        if (event.detail) {
          error = escapeCsvField(event.detail);
        }
        break;

      case 'scrape.start':
        endpoint = escapeCsvField(event.operation);
        break;

      case 'scrape.page':
        endpoint = escapeCsvField(event.operation);
        break;

      case 'scrape.complete':
        endpoint = escapeCsvField(event.operation);
        durationMs = String(event.durationMs);
        break;

      case 'parse.success':
      case 'parse.failure':
        endpoint = escapeCsvField(event.parser);
        if (event.error) {
          error = escapeCsvField(event.error);
        }
        break;

      case 'error':
        if (event.endpoint) {
          endpoint = escapeCsvField(event.endpoint);
        }
        if (event.statusCode != null) {
          statusCode = String(event.statusCode);
        }
        error = escapeCsvField(event.message);
        break;
    }

    rows.push(
      `${timestamp},${eventType},${level},${method},${url},${endpoint},${statusCode},${durationMs},${rateLimitRemaining},${error}`,
    );
  }

  return rows.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Markdown report
// ---------------------------------------------------------------------------

function generateMdReport(events: ScraperEvent[], sessionId: string): string {
  const metrics = buildMetrics(events, sessionId);
  const lines: string[] = [];

  // Title
  lines.push('# Scraper Session Report');
  lines.push('');

  // Session Overview
  lines.push('## Session Overview');
  lines.push('');
  lines.push(`- **Session ID**: ${metrics.sessionId}`);
  lines.push(`- **Start Time**: ${metrics.startTime}`);
  lines.push(`- **End Time**: ${metrics.endTime ?? 'N/A'}`);
  if (metrics.endTime) {
    const durationMs =
      new Date(metrics.endTime).getTime() -
      new Date(metrics.startTime).getTime();
    lines.push(`- **Duration**: ${durationMs}ms`);
  }
  lines.push(`- **Total Requests**: ${metrics.totalRequests}`);
  lines.push(`- **Successful**: ${metrics.successfulRequests}`);
  lines.push(`- **Failed**: ${metrics.failedRequests}`);
  lines.push(`- **Rate Limits Hit**: ${metrics.rateLimitsHit}`);
  lines.push('');

  // HTTP Performance
  const endpointKeys = Object.keys(metrics.requestsByEndpoint);
  lines.push('## HTTP Performance');
  lines.push('');
  if (endpointKeys.length > 0) {
    lines.push(
      '| Endpoint | Requests | Avg (ms) | Min (ms) | Max (ms) | Errors | Rate Limits |',
    );
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const key of endpointKeys) {
      const ep = metrics.requestsByEndpoint[key];
      const avg =
        ep.requestCount > 0
          ? Math.round(ep.totalDurationMs / ep.requestCount)
          : 0;
      const min =
        ep.minDurationMs === Number.MAX_SAFE_INTEGER ? 0 : ep.minDurationMs;
      lines.push(
        `| ${ep.endpoint} | ${ep.requestCount} | ${avg} | ${min} | ${ep.maxDurationMs} | ${ep.errorCount} | ${ep.rateLimitCount} |`,
      );
    }
  } else {
    lines.push('No HTTP requests recorded.');
  }
  lines.push('');

  // Scrape Operations
  lines.push('## Scrape Operations');
  lines.push('');
  if (metrics.scrapeOperations.length > 0) {
    lines.push('| Operation | Items | Pages | Duration (ms) | Errors |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const op of metrics.scrapeOperations) {
      lines.push(
        `| ${op.operation} | ${op.totalItems} | ${op.totalPages} | ${op.durationMs} | ${op.errors} |`,
      );
    }
  } else {
    lines.push('No scrape operations recorded.');
  }
  lines.push('');

  // Errors
  lines.push('## Errors');
  lines.push('');
  if (metrics.errors.length > 0) {
    lines.push('| Time | Code | Message | Endpoint |');
    lines.push('| --- | --- | --- | --- |');
    for (const err of metrics.errors) {
      lines.push(
        `| ${err.timestamp} | ${err.code} | ${err.message} | ${
          err.endpoint ?? ''
        } |`,
      );
    }
  } else {
    lines.push('No errors recorded.');
  }
  lines.push('');

  // Rate Limit Events
  const rateLimitEvents = events.filter(
    (e): e is HttpRateLimitEvent => e.event === 'http.rate_limit',
  );
  lines.push('## Rate Limit Events');
  lines.push('');
  if (rateLimitEvents.length > 0) {
    lines.push('| Time | Endpoint | Wait (ms) |');
    lines.push('| --- | --- | --- |');
    for (const rl of rateLimitEvents) {
      lines.push(`| ${rl.timestamp} | ${rl.endpoint} | ${rl.waitMs} |`);
    }
  } else {
    lines.push('No rate limit events recorded.');
  }
  lines.push('');

  return lines.join('\n');
}
