import { jest } from '@jest/globals';
import {
  ConsoleTransport,
  JsonLinesTransport,
  CallbackTransport,
} from './logger-transports';
import { ScraperEvent } from './logger-events';

describe('CallbackTransport', () => {
  it('forwards events to callback', () => {
    const events: ScraperEvent[] = [];
    const transport = new CallbackTransport((e) => events.push(e));
    const event: ScraperEvent = {
      event: 'http.request',
      level: 'debug',
      timestamp: '2024-01-01T00:00:00.000Z',
      sessionId: 'abc123',
      method: 'GET',
      url: 'https://api.x.com/test',
      endpoint: 'test',
    };
    transport.write(event);
    expect(events).toHaveLength(1);
    expect(events[0]).toBe(event);
  });
});

describe('JsonLinesTransport', () => {
  it('writes JSON lines via writeLine callback', () => {
    const lines: string[] = [];
    const transport = new JsonLinesTransport({
      writeLine: (line) => lines.push(line),
    });
    const event: ScraperEvent = {
      event: 'http.request',
      level: 'debug',
      timestamp: '2024-01-01T00:00:00.000Z',
      sessionId: 'abc123',
      method: 'GET',
      url: 'https://api.x.com/test',
      endpoint: 'test',
    };
    transport.write(event);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.event).toBe('http.request');
    expect(parsed.url).toBe('https://api.x.com/test');
  });

  it('filters by minLevel', () => {
    const lines: string[] = [];
    const transport = new JsonLinesTransport({
      writeLine: (line) => lines.push(line),
      minLevel: 'warn',
    });
    transport.write({
      event: 'http.request',
      level: 'debug',
      timestamp: '2024-01-01T00:00:00.000Z',
      sessionId: 'abc123',
      method: 'GET',
      url: 'https://api.x.com/test',
      endpoint: 'test',
    });
    expect(lines).toHaveLength(0); // filtered out

    transport.write({
      event: 'error',
      level: 'error',
      timestamp: '2024-01-01T00:00:00.000Z',
      sessionId: 'abc123',
      code: 'API_ERROR',
      message: 'fail',
    });
    expect(lines).toHaveLength(1); // passes filter
  });

  it('applies custom filter', () => {
    const lines: string[] = [];
    const transport = new JsonLinesTransport({
      writeLine: (line) => lines.push(line),
      filter: (e) => e.event.startsWith('http'),
    });
    transport.write({
      event: 'http.request',
      level: 'debug',
      timestamp: '2024-01-01T00:00:00.000Z',
      sessionId: 'abc123',
      method: 'GET',
      url: 'https://api.x.com/test',
      endpoint: 'test',
    });
    transport.write({
      event: 'auth.login_start',
      level: 'info',
      timestamp: '2024-01-01T00:00:00.000Z',
      sessionId: 'abc123',
      detail: 'test',
    });
    expect(lines).toHaveLength(1); // only http event
  });
});

describe('ConsoleTransport', () => {
  it('filters by minLevel', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const transport = new ConsoleTransport({ minLevel: 'warn' });
    transport.write({
      event: 'http.request',
      level: 'debug',
      timestamp: '2024-01-01T00:00:00.000Z',
      sessionId: 'abc123',
      method: 'GET',
      url: 'https://api.x.com/test',
      endpoint: 'test',
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('routes error level to console.error', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const transport = new ConsoleTransport({ minLevel: 'error' });
    transport.write({
      event: 'error',
      level: 'error',
      timestamp: '2024-01-01T00:00:00.000Z',
      sessionId: 'abc123',
      code: 'API_ERROR',
      message: 'fail',
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
