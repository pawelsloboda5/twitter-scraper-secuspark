import { ScraperLogger, LogTransport } from './logger';
import { ScraperEvent } from './logger-events';

describe('ScraperLogger', () => {
  // Test: sessionId is generated (16 hex chars)
  it('generates a hex session ID', () => {
    const logger = new ScraperLogger();
    expect(logger.sessionId).toMatch(/^[0-9a-f]{16}$/);
  });

  // Test: emit dispatches to transports
  it('dispatches events to transports', () => {
    const events: ScraperEvent[] = [];
    const transport: LogTransport = {
      name: 'test',
      write: (e) => events.push(e),
    };
    const logger = new ScraperLogger([transport]);
    logger.emit({
      event: 'http.request',
      level: 'debug',
      method: 'GET',
      url: 'https://api.x.com/test',
      endpoint: 'test',
    });
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('http.request');
    expect(events[0].sessionId).toBe(logger.sessionId);
    expect(events[0].timestamp).toBeDefined();
  });

  // Test: emit stamps timestamp and sessionId
  it('auto-stamps timestamp and sessionId', () => {
    const events: ScraperEvent[] = [];
    const transport: LogTransport = {
      name: 'test',
      write: (e) => events.push(e),
    };
    const logger = new ScraperLogger([transport]);
    logger.emit({
      event: 'http.request',
      level: 'debug',
      method: 'GET',
      url: 'https://api.x.com/test',
      endpoint: 'test',
    });
    expect(events[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(events[0].sessionId).toBe(logger.sessionId);
  });

  // Test: metrics track http events
  it('tracks HTTP request metrics', () => {
    const logger = new ScraperLogger();
    logger.emit({
      event: 'http.request',
      level: 'debug',
      method: 'GET',
      url: 'https://api.x.com/test',
      endpoint: 'test',
    });
    logger.emit({
      event: 'http.response',
      level: 'info',
      method: 'GET',
      url: 'https://api.x.com/test',
      endpoint: 'test',
      statusCode: 200,
      durationMs: 150,
    });

    const metrics = logger.getMetrics();
    expect(metrics.totalRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(1);
    expect(metrics.failedRequests).toBe(0);
    expect(metrics.requestsByEndpoint['test']).toBeDefined();
    expect(metrics.requestsByEndpoint['test'].requestCount).toBe(1);
    expect(metrics.requestsByEndpoint['test'].totalDurationMs).toBe(150);
  });

  // Test: metrics track rate limits
  it('tracks rate limit metrics', () => {
    const logger = new ScraperLogger();
    logger.emit({
      event: 'http.rate_limit',
      level: 'warn',
      endpoint: 'test',
      rateLimitLimit: 100,
      rateLimitRemaining: 0,
      rateLimitReset: 1234567890,
      waitMs: 5000,
    });

    const metrics = logger.getMetrics();
    expect(metrics.rateLimitsHit).toBe(1);
    expect(metrics.totalRateLimitWaitMs).toBe(5000);
  });

  // Test: metrics track errors
  it('tracks error events', () => {
    const logger = new ScraperLogger();
    logger.emit({
      event: 'error',
      level: 'error',
      code: 'API_ERROR',
      message: 'Not found',
      endpoint: 'test',
    });

    const metrics = logger.getMetrics();
    expect(metrics.errors).toHaveLength(1);
    expect(metrics.errors[0].code).toBe('API_ERROR');
    expect(metrics.errors[0].message).toBe('Not found');
  });

  // Test: metrics track parse events
  it('tracks parse success and failure counts', () => {
    const logger = new ScraperLogger();
    logger.emit({
      event: 'parse.success',
      level: 'debug',
      parser: 'parseLegacyTweet',
      count: 10,
    });
    logger.emit({
      event: 'parse.failure',
      level: 'warn',
      parser: 'parseLegacyTweet',
      count: 2,
    });

    const metrics = logger.getMetrics();
    expect(metrics.parseSuccessCount).toBe(10);
    expect(metrics.parseFailureCount).toBe(2);
  });

  // Test: metrics track scrape operations
  it('tracks scrape operations', () => {
    const logger = new ScraperLogger();
    logger.emit({
      event: 'scrape.complete',
      level: 'info',
      operation: 'searchTweets',
      totalItems: 50,
      totalPages: 3,
      durationMs: 5000,
      errors: 0,
    });

    const metrics = logger.getMetrics();
    expect(metrics.scrapeOperations).toHaveLength(1);
    expect(metrics.scrapeOperations[0].operation).toBe('searchTweets');
    expect(metrics.scrapeOperations[0].totalItems).toBe(50);
  });

  // Test: flush calls transport flush
  it('calls flush on transports', async () => {
    let flushed = false;
    const transport: LogTransport = {
      name: 'test',
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      write() {},
      flush: async () => {
        flushed = true;
      },
    };
    const logger = new ScraperLogger([transport]);
    await logger.flush();
    expect(flushed).toBe(true);
  });

  // Test: hasTransports
  it('reports whether transports are attached', () => {
    const logger = new ScraperLogger();
    expect(logger.hasTransports).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const transport: LogTransport = { name: 'test', write() {} };
    logger.addTransport(transport);
    expect(logger.hasTransports).toBe(true);
    logger.removeTransport(transport);
    expect(logger.hasTransports).toBe(false);
  });

  // Test: metrics still tracked with no transports
  it('tracks metrics even with no transports', () => {
    const logger = new ScraperLogger();
    logger.emit({
      event: 'http.request',
      level: 'debug',
      method: 'GET',
      url: 'https://api.x.com/test',
      endpoint: 'test',
    });
    expect(logger.getMetrics().totalRequests).toBe(1);
  });
});
