/**
 * Structured event type definitions for the scraper logging system.
 *
 * Each event represents a typed, structured log entry that can be
 * serialized to JSON. Events use a discriminated union on the `event`
 * field so consumers can narrow the type via a simple switch/check.
 */

// ---------------------------------------------------------------------------
// Log level
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Priority ordering for log levels, used by transports to filter events
 * at or above a configured minimum level.
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ---------------------------------------------------------------------------
// Base interface
// ---------------------------------------------------------------------------

export interface ScraperEventBase {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Scraper instance ID (hex string) */
  sessionId: string;
  /** Discriminator for the union type */
  event: string;
  /** Severity level */
  level: LogLevel;
}

// ---------------------------------------------------------------------------
// HTTP events
// ---------------------------------------------------------------------------

export interface HttpRequestEvent extends ScraperEventBase {
  event: 'http.request';
  level: 'debug';
  method: 'GET' | 'POST';
  url: string;
  /** GraphQL operation name or REST path */
  endpoint: string;
}

export interface HttpResponseEvent extends ScraperEventBase {
  event: 'http.response';
  level: 'debug' | 'info' | 'warn';
  method: 'GET' | 'POST';
  url: string;
  endpoint: string;
  statusCode: number;
  durationMs: number;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
  rateLimitLimit?: number;
}

export interface HttpRateLimitEvent extends ScraperEventBase {
  event: 'http.rate_limit';
  level: 'warn';
  endpoint: string;
  rateLimitLimit: number;
  rateLimitRemaining: number;
  rateLimitReset: number;
  /** How long the caller will wait before retrying (ms) */
  waitMs: number;
}

// ---------------------------------------------------------------------------
// Auth events
// ---------------------------------------------------------------------------

export interface AuthEvent extends ScraperEventBase {
  event:
    | 'auth.login_start'
    | 'auth.login_step'
    | 'auth.login_success'
    | 'auth.login_failure'
    | 'auth.logout'
    | 'auth.guest_token'
    | 'auth.cookies_set';
  level: 'debug' | 'info' | 'warn' | 'error';
  detail?: string;
  subtaskId?: string;
  stepIndex?: number;
}

// ---------------------------------------------------------------------------
// Scrape events
// ---------------------------------------------------------------------------

export interface ScrapeStartEvent extends ScraperEventBase {
  event: 'scrape.start';
  level: 'info';
  /** Operation name, e.g. 'searchTweets', 'getProfile' */
  operation: string;
  params: Record<string, unknown>;
}

export interface ScrapePageEvent extends ScraperEventBase {
  event: 'scrape.page';
  level: 'debug';
  operation: string;
  pageNumber: number;
  itemCount: number;
  cursor?: string;
  cumulativeCount: number;
}

export interface ScrapeCompleteEvent extends ScraperEventBase {
  event: 'scrape.complete';
  level: 'info';
  operation: string;
  totalItems: number;
  totalPages: number;
  durationMs: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Parse events
// ---------------------------------------------------------------------------

export interface ParseEvent extends ScraperEventBase {
  event: 'parse.success' | 'parse.failure';
  level: 'debug' | 'warn';
  /** Name of the parser that produced this event */
  parser: string;
  entityId?: string;
  error?: string;
  count?: number;
}

// ---------------------------------------------------------------------------
// Error events
// ---------------------------------------------------------------------------

export interface ScraperErrorEvent extends ScraperEventBase {
  event: 'error';
  level: 'error';
  code?: 'API_ERROR' | 'AUTH_ERROR' | 'PARSE_ERROR' | 'NETWORK_ERROR';
  statusCode?: number;
  message: string;
  endpoint?: string;
  stack?: string;
}

// ---------------------------------------------------------------------------
// Discriminated union of all scraper events
// ---------------------------------------------------------------------------

export type ScraperEvent =
  | HttpRequestEvent
  | HttpResponseEvent
  | HttpRateLimitEvent
  | AuthEvent
  | ScrapeStartEvent
  | ScrapePageEvent
  | ScrapeCompleteEvent
  | ParseEvent
  | ScraperErrorEvent;
