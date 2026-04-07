/**
 * Built-in log transports for the scraper logging system.
 *
 * All transports in this file are browser-safe — no Node.js imports.
 */

import { ScraperEvent, LogLevel, LOG_LEVEL_PRIORITY } from './logger-events';
import { LogTransport } from './logger';

// ---------------------------------------------------------------------------
// ConsoleTransport
// ---------------------------------------------------------------------------

export interface ConsoleTransportOptions {
  /** Minimum severity level to display (default: 'info') */
  minLevel?: LogLevel;
  /** Whether to use ANSI color codes (default: true) */
  colorize?: boolean;
  /** Whether to prefix output with timestamps (default: true) */
  timestamps?: boolean;
}

const ANSI_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m', // cyan
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
};

const ANSI_RESET = '\x1b[0m';

export class ConsoleTransport implements LogTransport {
  name = 'console';

  private minLevel: LogLevel;
  private colorize: boolean;
  private timestamps: boolean;

  constructor(options: ConsoleTransportOptions = {}) {
    this.minLevel = options.minLevel ?? 'info';
    this.colorize = options.colorize ?? true;
    this.timestamps = options.timestamps ?? true;
  }

  write(event: ScraperEvent): void {
    if (LOG_LEVEL_PRIORITY[event.level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const detail = this.formatDetail(event);
    const levelTag = event.level.toUpperCase().padEnd(5);
    const eventTag = event.event;

    let line: string;
    if (this.timestamps) {
      line = `[${event.timestamp}] ${levelTag} [${eventTag}] ${detail}`;
    } else {
      line = `${levelTag} [${eventTag}] ${detail}`;
    }

    if (this.colorize) {
      const color = ANSI_COLORS[event.level];
      line = `${color}${line}${ANSI_RESET}`;
    }

    if (event.level === 'error') {
      console.error(line);
    } else if (event.level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  private formatDetail(event: ScraperEvent): string {
    switch (event.event) {
      case 'http.request':
        return `\u2192 ${event.method} ${event.url}`;

      case 'http.response':
        return `\u2190 ${event.statusCode} ${event.url} (${event.durationMs}ms)`;

      case 'http.rate_limit':
        return `\u26A0 Rate limit on ${event.endpoint}, waiting ${event.waitMs}ms`;

      case 'auth.login_start':
      case 'auth.login_step':
      case 'auth.login_success':
      case 'auth.login_failure':
      case 'auth.logout':
      case 'auth.guest_token':
      case 'auth.cookies_set': {
        const authType = event.event.replace('auth.', '').toUpperCase();
        return `\uD83D\uDD11 ${authType}: ${event.detail ?? ''}`;
      }

      case 'scrape.start':
        return `\u25B6 ${event.operation} ${JSON.stringify(event.params)}`;

      case 'scrape.page':
        return `  page ${event.pageNumber}: ${event.itemCount} items (${event.cumulativeCount} total)`;

      case 'scrape.complete':
        return `\u2713 ${event.operation}: ${event.totalItems} items in ${event.totalPages} pages (${event.durationMs}ms)`;

      case 'parse.success':
      case 'parse.failure': {
        const outcome = event.event === 'parse.success' ? 'ok' : 'failed';
        return `parse ${event.parser}: ${event.count ?? 1} ${outcome}`;
      }

      case 'error':
        return `\u2717 ${event.code ?? 'UNKNOWN'}: ${event.message}`;

      default:
        return '';
    }
  }
}

// ---------------------------------------------------------------------------
// JsonLinesTransport
// ---------------------------------------------------------------------------

export interface JsonLinesTransportOptions {
  /** Called for each JSON line. Consumers can write to file, stdout, etc. */
  writeLine: (line: string) => void;
  /** Minimum severity level to emit (default: 'debug') */
  minLevel?: LogLevel;
  /** Optional predicate to filter events */
  filter?: (event: ScraperEvent) => boolean;
}

export class JsonLinesTransport implements LogTransport {
  name = 'jsonlines';

  private writeLine: (line: string) => void;
  private minLevel: LogLevel;
  private filter?: (event: ScraperEvent) => boolean;

  constructor(options: JsonLinesTransportOptions) {
    this.writeLine = options.writeLine;
    this.minLevel = options.minLevel ?? 'debug';
    this.filter = options.filter;
  }

  write(event: ScraperEvent): void {
    if (LOG_LEVEL_PRIORITY[event.level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    if (this.filter && !this.filter(event)) {
      return;
    }

    this.writeLine(JSON.stringify(event));
  }
}

// ---------------------------------------------------------------------------
// CallbackTransport
// ---------------------------------------------------------------------------

export class CallbackTransport implements LogTransport {
  name = 'callback';

  constructor(private callback: (event: ScraperEvent) => void) {}

  write(event: ScraperEvent): void {
    this.callback(event);
  }
}
