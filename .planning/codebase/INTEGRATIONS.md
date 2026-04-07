# External Integrations

**Analysis Date:** 2026-04-07

## APIs & External Services

**Twitter/X API (Undocumented):**
- Twitter's internal frontend GraphQL API - Main target for scraping
  - Base URLs: `https://api.x.com`, `https://x.com/i/api`
  - Authentication: Bearer tokens + guest tokens
  - Default bearer tokens hardcoded in `src/api.ts` (public tokens, not secrets)
    - `bearerToken`: Main token
    - `bearerToken2`: Fallback token

**Castle.io Device Fingerprinting:**
- Castle.io v11 token generation for login flow
  - Implementation: Local token generation in `src/castle.ts` (ported from Python)
  - Twitter's publishable key: `AvRa79bHyJSYSQHnRpcVtzyxetSvFerx`
  - Used to avoid error 399 ("suspicious activity") during authentication
  - No external API calls; tokens generated locally using XXTEA encryption

**CycleTLS (Optional):**
- CycleTLS v2.0.5 - TLS client library for Chrome fingerprint spoofing
  - Package: cycletls (optional peer dependency)
  - Purpose: Bypass Cloudflare bot detection
  - Integration: `src/cycletls-fetch.ts`
  - Exports: `cycleTLSFetch()`, `initCycleTLSFetch()`, `cycleTLSExit()`
  - Chrome fingerprint data defined in `src/chrome-fingerprint.ts`

## Data Storage

**Databases:**
- Not applicable - Library performs read-only API scraping

**File Storage:**
- Not applicable - In-memory processing only

**Caching:**
- Not applicable - No persistent cache layer

## Authentication & Identity

**Auth Provider:**
- Custom (Twitter/X internal authentication flow)
  - Implementation: `src/auth.ts` (TwitterAuth, TwitterGuestAuth), `src/auth-user.ts` (TwitterUserAuth)
  
**Guest Authentication:**
- Endpoint: `https://api.x.com/1.1/guest/activate.json`
- Guest tokens obtained and refreshed automatically
- Used for public data scraping without user login

**User Authentication:**
- Flow-based authentication via `https://api.x.com/1.1/onboarding/task.json`
- Credentials: username, password, optional email, optional 2FA secret
- 2FA Support: OTPAuth library (`src/auth-user.ts`)
  - Supports TOTP-based two-factor authentication
  - Requires `twoFactorSecret` in credentials
- Browser instrumentation: JavaScript execution via linkedom (`src/auth-user.ts:535-650`)
  - Metrics collected for authentication flow

**Header-Based Authentication:**
- Bearer tokens added via Authorization header
- CSRF token (ct0) managed via cookies
- Auth token stored in cookies
- Custom headers for authentication:
  - `x-client-transaction-id` - Transaction ID generation (optional, experimental)
  - `x-xp-forwarded-for` - IP forwarding (optional, experimental)

## Monitoring & Observability

**Error Tracking:**
- Custom error handling via `src/errors.ts`
  - ApiError - Generic API errors
  - AuthenticationError - Auth-specific errors
  - TwitterApiErrorRaw - Raw API error parsing
- Errors include trace info, error positions, and extensions from Twitter's API

**Logs:**
- Debug namespacing via debug library (version 4.4.1)
- Namespaces:
  - `twitter-scraper:api` - API request logging
  - `twitter-scraper:auth` - Authentication logging
  - `twitter-scraper:auth-user` - User auth flow logging
  - `twitter-scraper:castle` - Device fingerprint generation
  - `twitter-scraper:cycletls` - CycleTLS initialization
  - `twitter-scraper:requests` - Cookie and request handling
  - `twitter-scraper:scraper` - Main scraper operations
  - And module-specific namespaces throughout codebase

**Rate Limiting:**
- Internal rate limiting strategy in `src/rate-limit.ts`
  - WaitingRateLimitStrategy - Wait and retry on 429
  - ErrorRateLimitStrategy - Throw error on 429
  - Custom strategies supported via RateLimitStrategy interface
- Twitter's dynamic rate limits monitored and handled automatically

## CI/CD & Deployment

**Hosting:**
- NPM package registry - Published as @the-convocation/twitter-scraper
  - Repository: https://github.com/the-convocation/twitter-scraper.git

**CI Pipeline:**
- GitHub Actions (via .github directory)
- Git hooks via Husky (.husky directory)
  - Pre-commit: Lint and format staged files

**Build & Publishing:**
- Rollup build pipeline produces multiple distribution formats
- Prepare script: `rimraf dist && rollup -c` (runs on npm install via prepare hook)
- Distributed via NPM with TypeScript type definitions included

## Environment Configuration

**Required env vars:**
- None required for normal operation (public API access)
- Test-specific vars:
  - `TWITTER_USERNAME` - User account for authentication tests
  - `TWITTER_PASSWORD` - User password for authentication tests

**Secrets location:**
- No hardcoded secrets in codebase
- Bearer tokens in `src/api.ts` are public tokens (used by Twitter's web client)
- User credentials passed programmatically via API, never stored

**Configuration Methods:**
- Scraper options object: `ScraperOptions` in `src/scraper.ts`
  - Custom fetch function
  - Request/response transform interceptors
  - Rate limit strategy
  - Experimental feature flags
  - Browser profile for Castle fingerprinting

## Webhooks & Callbacks

**Incoming:**
- None - Library is client-only (not a server)

**Outgoing:**
- None - Read-only library, no callbacks made to external services

## Request/Response Transformation

**Fetch Interceptors:**
- Custom request/response transformation via `FetchTransformOptions` (`src/api.ts`)
- Allows modification of requests before sending and responses after receiving
- Use cases: CORS proxy integration, request signing, response parsing

**Example transformations in README:**
```typescript
// CORS proxy example for browser usage
transform: {
  request(input, init) {
    const proxy = 'https://corsproxy.io/?' + encodeURIComponent(url);
    return [proxy, init];
  }
}
```

## API Endpoints Used

**Authentication Endpoints:**
- `POST https://api.x.com/1.1/guest/activate.json` - Guest token activation
- `POST https://api.x.com/1.1/onboarding/task.json` - User login flow
- `POST https://api.x.com/1.1/account/logout.json` - Logout

**Data Endpoints:**
- `GET/POST https://api.x.com/graphql` - GraphQL queries for tweets, profiles, etc.
- `GET https://api.x.com/1.1/search/*` - Search API

**Browser Assets:**
- `https://x.com` - Main page for guest token initialization
- `https://abs.twimg.com/responsive-web/client-web/*` - Test instrumentation scripts

---

*Integration audit: 2026-04-07*
