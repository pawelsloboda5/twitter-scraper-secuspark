# Architecture

**Analysis Date:** 2026-04-07

## Pattern Overview

**Overall:** Layered API scraper with plugin-based authentication flows and platform-specific implementations.

**Key Characteristics:**
- Modular authentication layer supporting both guest and user authentication
- API request/response transformation pipeline with extensibility hooks
- Async generator-based pagination for large result sets
- Timeline parsing abstraction for Twitter API v1 and v2 responses
- Platform abstraction for Node.js and browser environments
- Type-safe parameter handling using TypeBox schema validation

## Layers

**Authentication Layer:**
- Purpose: Manages credentials, session state, and API authorization. Supports guest tokens and full user login flows with subtask-based MFA/verification.
- Location: `src/auth.ts`, `src/auth-user.ts`, `src/castle.ts`
- Contains: TwitterAuth interface, TwitterGuestAuth class, TwitterUserAuth class, Castle.io fingerprinting, browser profile simulation
- Depends on: Cookie management (tough-cookie), fetch implementation, platform extensions
- Used by: Scraper class and all requestApi calls

**Request/Response Pipeline Layer:**
- Purpose: Normalizes HTTP requests to Twitter's API, handles transformations, manages rate limiting, and processes responses.
- Location: `src/api.ts`, `src/requests.ts`
- Contains: requestApi generic function, FetchTransformOptions interface, header construction, cookie jar updates, bearer token management
- Depends on: Headers polyfill, cookie parsing, debug logging
- Used by: All feature modules (tweets, search, profiles, etc.)

**API Data/Feature Layer:**
- Purpose: Encapsulates endpoint-specific parameters, features, and variable requirements for GraphQL requests.
- Location: `src/api-data.ts`
- Contains: apiRequestFactory with endpoint definitions, feature flags (variables), parameter builders
- Depends on: json-stable-stringify for deterministic serialization
- Used by: Feature modules to construct properly-formatted API requests

**Timeline Parsing Layer:**
- Purpose: Transforms raw Twitter API responses into normalized JavaScript objects. Handles multiple API versions and response formats.
- Location: `src/timeline-v1.ts`, `src/timeline-v2.ts`, `src/timeline-async.ts`, `src/timeline-search.ts`, `src/timeline-list.ts`, `src/timeline-relationship.ts`
- Contains: Parse functions for tweets, users, media, entities. Response type definitions. Pagination logic via async generators.
- Depends on: Profile parsing, media/HTML utilities, API data types
- Used by: Feature modules (tweets, search, relationships)

**Feature Modules:**
- Purpose: Implement specific Twitter API operations and data retrieval functions.
- Location: `src/tweets.ts`, `src/search.ts`, `src/profile.ts`, `src/trends.ts`, `src/relationships.ts`, `src/direct-messages.ts`
- Contains: Public API functions (getTweets, searchTweets, getProfile, etc.), query builders, high-level data structures
- Depends on: Request/response layer, timeline parsing, authentication
- Used by: Scraper facade

**Scraper Facade:**
- Purpose: Single entry point combining all features. Manages auth instances and provides user-friendly API.
- Location: `src/scraper.ts`
- Contains: Scraper class with methods for all Twitter operations, option handling, subtask handler registration
- Depends on: All feature modules and auth layer
- Used by: Client applications

**Platform Abstraction:**
- Purpose: Abstracts platform-specific implementations (TLS cipher randomization, Node.js vs browser).
- Location: `src/platform/platform-interface.ts`, `src/platform/index.ts`, `src/platform/node/index.ts`
- Contains: PlatformExtensions interface, Platform class with dynamic imports
- Depends on: Runtime detection via PLATFORM_NODE build constant
- Used by: requestApi during request preparation

**Error Handling Layer:**
- Purpose: Defines exception types for authentication, API, and parsing errors.
- Location: `src/errors.ts`
- Contains: ApiError (with response capture), AuthenticationError, TwitterApiErrorRaw types
- Used by: All layers for error reporting

## Data Flow

**Guest Authentication Flow:**

1. Scraper instantiates TwitterGuestAuth
2. First API call triggers implicit guest token fetch via TwitterAuth.fetch()
3. Guest token cached in auth instance
4. requestApi() installs headers (cookies, bearer token, signatures)
5. Response updates cookie jar automatically
6. Subsequent requests reuse guest token until expiration

**User Authentication Flow:**

1. Scraper.login() creates TwitterUserAuth instance
2. Calls auth.login(username, password, email?, twoFactorSecret?)
3. Initiates Twitter's authentication flow (/oauth2/initiate_login)
4. Flow returns subtasks (e.g., "EnterPassword", "EnterOtp")
5. Subtask handlers process each step (registered via registerAuthSubtaskHandler)
6. Flow token advances through successful completions
7. Final success returns authenticated cookies
8. TwitterUserAuth extends TwitterGuestAuth, reuses request pipeline

**Tweet Retrieval Flow:**

1. getTweets(userId, maxTweets) returns AsyncGenerator<Tweet>
2. Internally calls getTweetTimeline() with fetchTweetsForUser function
3. getTweetTimeline() repeatedly:
   - Calls fetchTweetsForUser() to get batch + pagination cursor
   - Yields tweets one-by-one to caller
   - Applies jitter between batches
   - Breaks on empty batch or cursor exhaustion
4. Fetch function (fetchTweetsForUser) calls requestApi() with GraphQL endpoint
5. Response parsed by parseTimelineTweetsV2() or parseTimelineTweetsV1()
6. Parsed Tweet objects include extracted text, media, mentions, user metadata

**State Management:**
- Authentication state: Stored in TwitterAuth instance (cookies via CookieJar, guest token in memory)
- Rate limit state: Passed to rateLimitStrategy handler on HTTP 429
- Pagination state: Implicit via async generator cursor parameter
- No global state; each Scraper instance is independent

## Key Abstractions

**TwitterAuth Interface:**
- Purpose: Abstraction over authentication mechanisms
- Examples: `src/auth.ts` (TwitterGuestAuth), `src/auth-user.ts` (TwitterUserAuth)
- Pattern: Polymorphic interface with installTo() and isLoggedIn() methods. TwitterUserAuth extends TwitterGuestAuth.

**RequestApiResult<T>:**
- Purpose: Explicit success/failure container for API calls
- Examples: Used in `src/api.ts`, feature modules return promise-wrapped results
- Pattern: Discriminated union with { success: true; value: T } | { success: false; err: Error }

**AsyncGenerator Pagination:**
- Purpose: Streaming large result sets without loading all into memory
- Examples: searchTweets(), getTweets(), getFollowers() in feature modules
- Pattern: Generator wraps getTweetTimeline/getUserTimeline pagination logic. Caller iterates with for-await-of.

**Timeline Parsers:**
- Purpose: Deserialize Twitter API JSON into application domain objects
- Examples: parseTimelineTweetsV2 (GraphQL v2), parseTimelineTweetsV1 (REST legacy)
- Pattern: Export parse function and type definitions. Handle both Timeline and Search entry formats.

**FetchTransformOptions:**
- Purpose: Allow middleware-like request/response hooks
- Examples: request transformer for proxy modification, response transformer for interception
- Pattern: Optional hooks in ScraperOptions.transform. Applied in requestApi() pipeline.

## Entry Points

**Scraper Class Constructor:**
- Location: `src/scraper.ts` lines 110-124
- Triggers: New instance creation with optional ScraperOptions
- Responsibilities: Initialize guest auth, set default fetch and rate limit strategy, create empty subtask handler map

**Scraper.login():**
- Location: `src/scraper.ts` (method not shown in excerpt, but called by TwitterUserAuth)
- Triggers: User-initiated login request
- Responsibilities: Transition from guest to user auth, manage auth flow subtasks, persist session cookies

**Module Exports (Public API):**
- Location: `src/_module.ts`
- Triggers: Import of @the-convocation/twitter-scraper
- Responsibilities: Re-export all public types and Scraper class, hide internal implementations

**CycleTLS Build Entry:**
- Location: `src/_cycletls.ts`
- Triggers: Import of @the-convocation/twitter-scraper/cycletls
- Responsibilities: Special export for CycleTLS-integrated fetch variant

## Error Handling

**Strategy:** Fail-fast with detailed error context. API errors include response status, headers, and parsed body.

**Patterns:**
- ApiError wraps HTTP failures with response object and data (JSON or text)
- AuthenticationError for login failures or session expiration
- TypeError/ValidationError propagated from parsing or schema validation
- Rate limit handled by rateLimitStrategy callback (WaitingRateLimitStrategy retries with delay)

## Cross-Cutting Concerns

**Logging:** Debug module with namespace 'twitter-scraper:*' (e.g., 'twitter-scraper:scraper', 'twitter-scraper:auth'). Enable via DEBUG env var.

**Validation:** @sinclair/typebox schemas validate auth flow responses. Type guards (isFieldDefined) check optional fields.

**Authentication:** Centralized via TwitterAuth interface. Credentials never logged. Subtask handlers allow custom MFA implementation.

---

*Architecture analysis: 2026-04-07*
