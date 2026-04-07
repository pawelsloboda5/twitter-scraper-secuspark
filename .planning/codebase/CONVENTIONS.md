# Coding Conventions

**Analysis Date:** 2026-04-07

## Naming Patterns

**Files:**
- kebab-case for filenames: `auth-user.ts`, `direct-messages.ts`, `timeline-v2.ts`
- Test files: `{name}.test.ts` (co-located with source)
- Special patterns: `-async.ts` suffix for async variants (e.g., `direct-messages-async.ts`, `timeline-async.ts`)
- Utility/config files: `test-utils.ts`, `chrome-fingerprint.ts`, `api-data.ts`

**Functions:**
- camelCase for all function names: `getProfile()`, `searchTweets()`, `requestApi()`
- Exported async functions use verb-noun pattern: `fetchTweets()`, `fetchProfiles()`, `findDmConversationsByUserId()`
- Private/internal methods use underscore prefix when needed, but rarely used due to public class methods
- Async functions are explicitly marked: `async function` or `async (...) => Promise<T>`

**Variables:**
- camelCase for all variable names: `maxTweets`, `userId`, `cookieJar`, `seenProfiles`
- Constants use UPPER_SNAKE_CASE: `CHROME_USER_AGENT`, `CHROME_SEC_CH_UA`
- Private class properties use camelCase: `private readonly options`, `private token`
- Loop variables use single letters when appropriate: `c` for cookie in `c.key`, `i` for index

**Types & Interfaces:**
- PascalCase for all types and interfaces: `Tweet`, `Profile`, `Scraper`, `TwitterAuth`
- Raw/parsed types distinguished by suffix: `LegacyUserRaw` vs `Profile` (parsed)
- Generic options objects: `ScraperOptions`, `ScraperTestOptions`, `FetchTransformOptions`
- Error classes in PascalCase: `ApiError`, `AuthenticationError`
- Response types: `QueryTweetsResponse`, `QueryProfilesResponse`

**Enums & Union Types:**
- PascalCase for enum names: `SearchMode`, used as `SearchMode.Top`, `SearchMode.Latest`
- Union types are descriptive: `'password' | 'cookies' | 'anonymous'`

## Code Style

**Formatting:**
- Prettier with fixed configuration: `.prettierrc`
- Single quotes: `singleQuote: true`
- Trailing commas on all multiline structures: `trailingComma: "all"`
- Semicolons required: `semi: true`
- Run with: `npm run format` or `yarn format`

**Linting:**
- ESLint with TypeScript support: `.eslintrc.js`
- Parser: `@typescript-eslint/parser`
- Base config: `plugin:@typescript-eslint/recommended` + `plugin:prettier/recommended`
- Key rule overrides (disabled):
  - `@typescript-eslint/interface-name-prefix`: off (allows interfaces without 'I' prefix)
  - `@typescript-eslint/explicit-function-return-type`: off (inferred OK)
  - `@typescript-eslint/explicit-module-boundary-types`: off (inferred OK)
  - `@typescript-eslint/no-explicit-any`: off (used where needed)
- Run with: `npm run lint` or `npm run lint:fix`

**TypeScript Strict Mode:**
- Strict mode enabled: `"strict": true`
- `noImplicitAny: true`, `forceConsistentCasingInFileNames: true`
- Source root: `./src`, output: `./dist`
- Target: ES2021 lib with DOM support (for Node 16 compatibility)

## Import Organization

**Order:**
1. External packages (node_modules): `import { Cookie } from 'tough-cookie'`
2. Type imports: `import type { BrowserProfile } from './castle'`
3. Named imports from local files: `import { TwitterAuth } from './auth'`
4. Namespace/default imports: `import fetch from 'cross-fetch'`
5. Side effects last (if needed): `import debug from 'debug'`

**Path Aliases:**
- None configured, using relative paths: `'./auth'`, `'./api'`, `'./errors'`
- Platform abstraction: `'./platform'` imports from `./platform/index.ts`

**Style Examples:**
```typescript
// Multiple related imports grouped
import {
  fetchSearchTweets,
  SearchMode,
  searchProfiles,
  searchTweets,
} from './search';

// Type imports separated
import type { BrowserProfile } from './castle';
import { getProfile } from './profile';

// Debug module pattern
import debug from 'debug';
const log = debug('twitter-scraper:scraper');
```

## Error Handling

**Patterns:**
- Use custom error classes inheriting from `Error`: `ApiError`, `AuthenticationError`
- `ApiError.fromResponse()` factory method for creating errors from HTTP responses
- Errors include context: response status, headers, body data
- Try/catch used for fallback parsing: attempt JSON parse, fall back to text parse
- Result wrapper pattern for API calls: `RequestApiResult<T> = { success: true; value: T } | { success: false; err: Error }`

**Error checking:**
```typescript
const res = await requestApi<SomeType>(...);
if (!res.success) {
  throw res.err;
}
return res.value;
```

**Exception handling in try/catch:**
```typescript
try {
  // operation
} catch (err) {
  if (!(err instanceof Error)) {
    throw err;
  }
  // handle Error
}
```

## Logging

**Framework:** `debug` module with namespaced loggers
- Import: `import debug from 'debug'`
- Initialize once per file: `const log = debug('twitter-scraper:module-name')`
- Namespace pattern: `twitter-scraper:{module}` or `twitter-scraper:api`

**Patterns:**
- Log method calls: `log(\`Making ${method} request to ${url}\`)`
- Log state changes: `log('Rate limit hit, waiting for retry...')`
- Log fallback operations: `log('Failed to parse response as JSON, trying text parse...')`
- Log data for debugging: `log('Response text:', text)`
- Console output rarely used (only in test utilities for warnings)

## Comments

**When to Comment:**
- JSDoc blocks for all public methods, functions, and interfaces
- Inline comments for non-obvious logic or workarounds
- TODO comments inline: `// TODO: Get the proper type of this.`
- Explanation of complex parsing: `// Domain starts with a dot — setCookies should strip it`

**JSDoc/TSDoc:**
- Function parameters: `@param {Type} name - Description`
- Return types: `@returns Description or {@link TypeName}`
- Internal methods: `@internal` tag
- Markdown links to types: `@returns The requested {@link Profile}`

**JSDoc Example:**
```typescript
/**
 * Fetches a Twitter profile.
 * @param username The Twitter username of the profile to fetch, without an `@` at the beginning.
 * @returns The requested {@link Profile}.
 */
public async getProfile(username: string): Promise<Profile> {
  const res = await getProfile(username, this.auth);
  return this.handleResponse(res);
}
```

**Internal Documentation:**
```typescript
/**
 * Initializes auth properties using a guest token.
 * Used when creating a new instance of this class, and when logging out.
 * @internal
 */
private useGuestAuth() {
  // ...
}
```

## Function Design

**Size:** Functions typically 10-80 lines depending on complexity. Large modules (700+ LOC) break into multiple functions for specific operations.

**Parameters:**
- Typed parameters required due to strict mode
- Use destructuring for object parameters when there are 2+ properties
- Optional parameters use `?` syntax: `cursor?: string`
- Union types for options: `'password' | 'cookies' | 'anonymous'`
- Default parameters: `searchMode: SearchMode = SearchMode.Top`

**Return Values:**
- Explicit return type annotations: `Promise<Profile>`, `AsyncGenerator<Tweet, void>`
- Use `Promise<T>` for async operations
- Use `AsyncGenerator<T, void>` for async iterables
- Result wrapper for error propagation: `RequestApiResult<T>`
- `void` for side-effect functions or async operations that don't need return handling

**Function Declaration Style:**
```typescript
// Public methods
public async getProfile(username: string): Promise<Profile> { }

// Private methods
private applySubtaskHandlers(auth: TwitterUserAuth): void { }

// Exported functions
export async function fetchTweets(
  userId: string,
  maxTweets: number,
  cursor: string | undefined,
  auth: TwitterAuth,
): Promise<QueryTweetsResponse> { }

// Arrow functions in callbacks
(response) => new Proxy(response, { ... })
```

## Module Design

**Exports:**
- Each module exports its primary interface/class and related functions
- Type exports separated with `export interface` and `export type`
- All public APIs explicitly exported, no implicit re-exports
- Barrel file pattern for platform abstraction: `src/platform/index.ts` re-exports from `./platform-interface.ts`

**Barrel Files:**
- `src/platform/index.ts`: Re-exports `Platform` and `PlatformExtensions` from `./node/index.ts`
- Main entry points handled by build system (rollup), not js barrel files

**Organization Example:**
```typescript
// File: profile.ts
export interface Profile { /* ... */ }
export interface LegacyUserRaw { /* ... */ }
export async function getProfile(username: string, auth: TwitterAuth): Promise<Profile> { }
export function parseProfile(user: LegacyUserRaw): Profile { }
```

## Class Design

**Property Access:**
- `private readonly` for immutable dependencies: `private readonly options?: Partial<ScraperOptions>`
- `private` for mutable state: `private token: string`
- No public fields; use getters/setters if needed
- Constructor injection pattern: `constructor(private readonly options?: Partial<ScraperOptions>)`

**Method Visibility:**
- `public` for all user-facing API methods
- `private` for helper methods
- JSDoc `@internal` tag for methods that are technically public but not part of the API contract

---

*Convention analysis: 2026-04-07*
