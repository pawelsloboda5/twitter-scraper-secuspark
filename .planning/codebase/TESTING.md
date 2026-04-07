# Testing Patterns

**Analysis Date:** 2026-04-07

## Test Framework

**Runner:**
- Jest 29.5.0
- Config: `jest.config.js`
- Preset: `ts-jest/presets/default-esm`
- Environment: Node.js
- ESM support enabled: `extensionsToTreatAsEsm: ['.ts']`

**Assertion Library:**
- Jest built-in assertions: `expect()`, `toEqual()`, `toBeTruthy()`, `toThrow()`, etc.
- No additional assertion libraries imported

**Run Commands:**
```bash
npm run test              # Run all tests with --runInBand --forceExit
yarn test               # Same (uses yarn package manager)
```

**Test Setup:**
- `setupFiles: ['dotenv/config', './test-setup.js']`
- Environment variables loaded from `.env.local` in test utilities
- Test setup script (`test-setup.js`) executed before tests

**Coverage:**
- Enabled: `collectCoverage: true`
- Output directory: `coverage/`
- Includes: `src/**/*.{js,ts}`
- Excludes:
  - `src/index.ts`
  - `src/**/*.d.ts`
  - `src/**/*.test.{js,ts}`
  - `src/**/*.spec.{js,ts}`

## Test File Organization

**Location:**
- Co-located with source files: `src/{name}.ts` → `src/{name}.test.ts`
- Examples: `auth.ts` → `auth.test.ts`, `scraper.ts` → `scraper.test.ts`

**Naming:**
- Pattern: `{moduleName}.test.ts`
- 12 test files found: `auth.test.ts`, `scraper.test.ts`, `search.test.ts`, `tweets.test.ts`, etc.

**File Count by Type:**
```
Test files: 12
├── auth.test.ts                 # Authentication logic
├── auth-user.test.ts            # User auth flows
├── scraper.test.ts              # Core scraper functionality
├── search.test.ts               # Search operations
├── tweets.test.ts               # Tweet fetching
├── profile.test.ts              # Profile operations
├── direct-messages.test.ts       # DM functionality
├── rate-limit.test.ts            # Rate limiting
├── trends.test.ts               # Trends API
├── relationships.test.ts        # Follow/follower operations
├── castle.test.ts               # Castle.io fingerprinting
└── cycletls.test.ts             # CycleTLS integration
```

## Test Structure

**Suite Organization:**
```typescript
// Top-level describe blocks for feature areas
describe('TwitterUserAuth', () => {
  // Setup shared across suite
  const mockFetch = jest.fn<typeof fetch>();
  let auth: TwitterUserAuth;

  // Nested describe blocks for related tests
  describe('login', () => {
    it('should handle successful login flow', async () => {
      // test implementation
    });

    it('should handle login failure', async () => {
      // test implementation
    });
  });
});

// Top-level tests without describe
test('scraper can log in', async () => {
  const scraper = await getScraper({ authMethod: 'password' });
  await expect(scraper.isLoggedIn()).resolves.toBeTruthy();
}, 60000);  // Custom timeout in ms
```

**Patterns:**
- Use `describe()` blocks to group related tests
- Top-level `test()` or `it()` for single integration tests
- Setup variables at describe scope for reuse
- Use `beforeEach()` implicitly or set up state in describe block

## Mocking

**Framework:** Jest built-in mocking via `jest.fn<T>()`

**Patterns:**
```typescript
import { jest } from '@jest/globals';

// Mock function with type
const mockFetch = jest.fn<typeof fetch>();

// Mock response objects (manual construction)
const mockResponses = {
  xcomHomepage: {
    ok: true,
    status: 200,
    text: () =>
      Promise.resolve(
        '<!DOCTYPE html><html><head></head><body><input type="hidden" name="authenticity_token" value="test_token" /></body></html>',
      ),
    headers: new Headers(),
  } as Response,
  success: (token: string): Response =>
    ({
      ok: true,
      json: () => Promise.resolve({ flow_token: token }),
      text: () => Promise.resolve(JSON.stringify({ flow_token: token })),
      headers: new Headers(),
    } as Response),
  error: (code: number, message: string): Response =>
    ({
      ok: true,
      json: () =>
        Promise.resolve({
          flow_token: 'error-token',
          errors: [{ code, message }],
        }),
      text: () =>
        Promise.resolve(
          JSON.stringify({
            flow_token: 'error-token',
            errors: [{ code, message }],
          }),
        ),
      headers: new Headers(),
    } as Response),
};

// Mock fetch return value
mockFetch.mockReturnValue(Promise.resolve(mockResponses.success('token')));
```

**What to Mock:**
- HTTP fetch calls
- Response objects (construct as needed)
- External service interactions (optional, depending on test scope)
- Utility functions in some cases

**What NOT to Mock:**
- Core business logic functions (test them directly)
- Class constructors used in the feature being tested
- Cookie jar or auth state management (use real instances)
- Error classes (throw and assert real errors)

**Mock Response Pattern:**
Responses are hand-constructed as objects implementing the Response interface:
```typescript
{
  ok: true,
  status: 200,
  statusText: '',
  headers: new Headers(),
  json: () => Promise.resolve({ /* data */ }),
  text: () => Promise.resolve('/* data */'),
  // Other Response methods return Errors for unimplemented methods
} as Response
```

## Fixtures and Factories

**Test Data:**
Test utilities and factory functions are defined at module scope:

```typescript
// src/test-utils.ts
export async function getScraper(
  options: Partial<ScraperTestOptions> = { authMethod: 'cookies' },
) {
  // Creates a Scraper instance with test credentials
  // Supports: password auth, cookie auth, anonymous
}

// Usage in tests
const scraper = await getScraper({ authMethod: 'password' });
```

**Location:**
- `src/test-utils.ts`: Main test utilities for creating Scraper instances
- Inline fixtures in test files: mock response objects defined per-file
- Test setup: `test-setup.js` at root (runs before all tests)

**Environment Variables for Tests:**
```bash
# .env.local (used by test-utils)
TWITTER_USERNAME=...
TWITTER_PASSWORD=...
TWITTER_EMAIL=...
TWITTER_2FA_SECRET=...     # TOTP secret for 2FA
TWITTER_COOKIES=...        # JSON array of cookie objects
PROXY_URL=...              # Optional HTTP proxy
```

## Test Timeouts

**Custom Timeouts:**
- Default Jest timeout: 5 seconds
- Extended for integration tests: `test('...', async () => { ... }, 60000)` (60 seconds)
- Used for: login flows, search operations, live API calls

**Examples:**
```typescript
testLogin(
  'scraper can log in',
  async () => { ... },
  60000,  // 60 second timeout
);

test('scraper can search tweets', async () => { ... }, 30000);  // 30 seconds
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and classes
- Approach: Mock external dependencies, test specific logic
- Example: `rate-limit.test.ts` tests the `ErrorRateLimitStrategy` class
- No external API calls

```typescript
test('error rate limit strategy throws error when triggered', async () => {
  const strategy = new ErrorRateLimitStrategy();
  await expect(() =>
    strategy.onRateLimit({
      fetchParameters: ['/', {}],
      response: { /* mock response */ },
    }),
  ).rejects.toThrow(ApiError);
});
```

**Integration Tests:**
- Scope: Multiple components working together, may call real APIs
- Approach: Use real Scraper instances, actual network calls
- Example: `scraper.test.ts` tests cookie serialization, request transformation
- Tests pass if `TWITTER_COOKIES` env var is set

```typescript
test('scraper can restore its login state from cookies', async () => {
  const scraper = await getScraper();
  await expect(scraper.isLoggedIn()).resolves.toBeTruthy();
  const scraper2 = await getScraper({ authMethod: 'anonymous' });
  
  const cookies = await scraper
    .getCookies()
    .then((cookies) => cookies.map((cookie) => cookie.toString()));
  await scraper2.setCookies(cookies);
  
  await expect(scraper2.isLoggedIn()).resolves.toBeTruthy();
});
```

**E2E/API Tests:**
- Scope: Full application workflows
- Approach: Use `getScraper()` with live credentials, real API calls
- Example: `search.test.ts` performs actual Twitter searches
- Run only if credentials available

```typescript
test('scraper can search tweets', async () => {
  const scraper = await getScraper();
  const seenTweets = new Map<string, boolean>();
  const maxTweets = 150;
  let nTweets = 0;

  const profiles = scraper.searchTweets('twitter', maxTweets, SearchMode.Latest);
  for await (const tweet of profiles) {
    nTweets++;
    const id = tweet.id;
    expect(id).toBeTruthy();
    if (id != null) {
      expect(seenTweets.has(id)).toBeFalsy();
      seenTweets.set(id, true);
    }
  }

  expect(nTweets).toEqual(maxTweets);
}, 30000);
```

## Conditional Test Execution

**Skip Tests Based on Environment:**
```typescript
const testLogin = process.env['TWITTER_PASSWORD'] ? test : test.skip;

testLogin(
  'scraper can log in',
  async () => { ... },
  60000,
);
```

This pattern:
- Skips test if `TWITTER_PASSWORD` is not set
- Runs test normally if credential exists
- Useful for tests requiring real credentials

## Async Testing

**Pattern:**
```typescript
test('async operation name', async () => {
  // Use async/await directly
  const result = await asyncFunction();
  expect(result).toBe(expectedValue);
});

// With custom timeout
test('long operation', async () => {
  // ...
}, 60000);
```

**Resolving Promises in Assertions:**
```typescript
// Use .resolves for async assertions
await expect(scraper.isLoggedIn()).resolves.toBeTruthy();
await expect(scraper.logout()).resolves.toBeUndefined();

// Use .rejects for error cases
await expect(scraper.login('user', 'wrong')).rejects.toThrow(ApiError);
```

**AsyncGenerator Testing:**
```typescript
const profiles = scraper.searchTweets('query', maxTweets, SearchMode.Latest);

// Iterate using for await
for await (const tweet of profiles) {
  // assertions on tweet
  expect(tweet.id).toBeTruthy();
}
```

## Error Testing

**Pattern:**
```typescript
// Test that function throws expected error type
test('throws authentication error on bad credentials', async () => {
  await expect(() =>
    auth.login('user', 'wrongpass'),
  ).rejects.toThrow(AuthenticationError);
});

// Test error with specific message
await expect(
  auth.login('user', 'wrongpass'),
).rejects.toThrow('Authentication failed');

// Test custom error properties
try {
  await operation();
  fail('should have thrown');
} catch (err) {
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).response.status).toBe(400);
}
```

## Common Assertion Patterns

```typescript
// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeNull();

// Equality
expect(result).toEqual(expectedValue);
expect(result).toBe(expectedValue);  // Stricter (===)

// Collections
expect(array).toHaveLength(expectedLength);
expect(map.has(key)).toBeFalsy();
expect(seenIds.has(id)).toBeFalsy();

// Maps and iteration
const found = cookies.find((c) => c.key === 'ct0');
expect(found).toBeDefined();
expect(found?.value).toBe('expected_value');

// Error matchers
expect(() => { ... }).toThrow(ErrorType);
await expect(promise).rejects.toThrow();
```

## Coverage

**Requirements:** No hard enforcement (collectCoverage runs, coverage not enforced)

**View Coverage:**
```bash
# Coverage report generated in coverage/ directory after tests
# Review with: open coverage/lcov-report/index.html
```

**Coverage Exclusions:**
- Type definitions (`.d.ts`)
- Index/barrel files
- Test files themselves

---

*Testing analysis: 2026-04-07*
