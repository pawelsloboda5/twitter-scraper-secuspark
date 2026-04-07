# twitter-scraper-secuspark

A powerful X (formerly Twitter) scraper with structured logging, write operations, and author metadata.

> Fork of [`@the-convocation/twitter-scraper`](https://github.com/the-convocation/twitter-scraper) with significant additions for automation, AI agent integration, and full read/write support.

## What's New in This Fork

- **Structured logging system** -- ConsoleTransport (colored terminal), JsonLinesTransport (machine-readable JSONL), ReportTransport (generates `.md`, `.json`, `.csv` report files), and CallbackTransport (custom handler)
- **12 write operations** -- sendTweet, reply, quoteTweet, deleteTweet, likeTweet, unlikeTweet, retweet, undoRetweet, followUser, unfollowUser, bookmarkTweet, unbookmarkTweet
- **Author metadata on tweets** -- `authorFollowersCount`, `authorFollowingCount`, `authorIsBlueVerified`, `authorDescription` fields populated on parsed tweets
- **All domains updated** from twitter.com to x.com
- **Diagnostic script** for testing all operations and generating reports

## Installation

```sh
npm install github:pawelsloboda5/twitter-scraper-secuspark#secuspark/author-metadata
```

TypeScript types are bundled with the distribution.

## Quick Start

```typescript
import { Scraper } from 'twitter-scraper-secuspark';

const scraper = new Scraper();

// Set cookies for authentication (recommended)
await scraper.setCookies([
  'ct0=your_ct0_value; Domain=x.com',
  'auth_token=your_auth_token; Domain=x.com',
]);

// Fetch a tweet
const tweet = await scraper.getTweet('1585338303800578049');
console.log(tweet?.text);
```

## Authentication

### Cookie-based (recommended)

Cookie authentication is the most reliable method. Export `ct0` and `auth_token` from your browser and use them directly.

**Step 1: Get cookies from your browser**

1. Log in to x.com in your browser
2. Open DevTools (F12) -> Application tab -> Cookies -> `https://x.com`
3. Copy the values of `ct0` and `auth_token`

**Step 2: Create a `.env.local` file**

```
TWITTER_COOKIES=[{"key":"ct0","value":"your_ct0_value","domain":"x.com"},{"key":"auth_token","value":"your_auth_token","domain":"x.com"}]
```

**Step 3: Use in code**

```typescript
import { Scraper } from 'twitter-scraper-secuspark';
import { Cookie } from 'tough-cookie';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const scraper = new Scraper();
const cookies = JSON.parse(process.env.TWITTER_COOKIES!).map((c: any) =>
  Cookie.fromJSON(c),
);
await scraper.setCookies(cookies);

const loggedIn = await scraper.isLoggedIn();
console.log('Authenticated:', loggedIn);
```

Or set cookies directly from strings:

```typescript
await scraper.setCookies([
  'ct0=abc123; Domain=x.com',
  'auth_token=xyz789; Domain=x.com',
]);
```

Cookies expire over time. If authentication fails, export fresh cookies from your browser.

### Password login (unreliable)

```typescript
await scraper.login('username', 'password', 'email@example.com');
```

> **Warning:** Password login triggers X's anti-bot detection frequently. **Any account you log into with this library is subject to being banned at any time.** Cookie authentication is strongly preferred.

### Anonymous (limited)

Without any authentication, only a subset of read operations work:

| Auth Level | Available Operations |
| --- | --- |
| **Anonymous** | `getTweet`, `getProfile`, `getUserIdByScreenName`, `getLatestTweet`, `getTweets`, `getTweetsAndReplies`, `getTweetsByUserId`, `getTweetsAndRepliesByUserId`, `getTrends`, `getFollowers`, `getFollowing` |
| **Auth required** | `searchTweets`, `searchProfiles`, `fetchSearchTweets`, `fetchSearchProfiles`, `getLikedTweets`, `fetchLikedTweets`, `fetchListTweets`, all write operations, all DM operations |

## Reading Data

### Fetching Tweets

```typescript
// Single tweet by ID
const tweet = await scraper.getTweet('1585338303800578049');

// Latest tweet from a user
const latest = await scraper.getLatestTweet('elonmusk');

// Multiple tweets from a user's timeline
for await (const tweet of scraper.getTweets('elonmusk', 100)) {
  console.log(tweet.text);
}

// Tweets and replies from a user
for await (const tweet of scraper.getTweetsAndReplies('elonmusk', 50)) {
  console.log(tweet.text, tweet.isReply);
}

// Search tweets (requires auth)
import { SearchMode } from 'twitter-scraper-secuspark';

for await (const tweet of scraper.searchTweets('javascript', 50, SearchMode.Latest)) {
  console.log(tweet.text);
}
```

### Fetching Profiles

```typescript
// Get a profile
const profile = await scraper.getProfile('elonmusk');
console.log(profile.followersCount, profile.biography);

// Get user ID from screen name
const userId = await scraper.getUserIdByScreenName('elonmusk');

// Search profiles (requires auth)
for await (const profile of scraper.searchProfiles('openai', 10)) {
  console.log(profile.username, profile.followersCount);
}
```

### Relationships

```typescript
const userId = await scraper.getUserIdByScreenName('elonmusk');

// Get followers
for await (const profile of scraper.getFollowers(userId, 100)) {
  console.log(profile.username);
}

// Get following
for await (const profile of scraper.getFollowing(userId, 100)) {
  console.log(profile.username);
}
```

### Trends

```typescript
const trends = await scraper.getTrends();
console.log(trends); // ['#topic1', '#topic2', ...]
```

### Direct Messages (requires auth)

```typescript
// Get DM inbox
const inbox = await scraper.getDmInbox();

// Get a specific conversation
const conversation = await scraper.getDmConversation('conversation-id');

// Iterate messages from a conversation
for await (const message of scraper.getDmMessages('conversation-id', 50)) {
  console.log(message);
}

// Find conversations with a specific user
const convos = scraper.findDmConversationsByUserId(inbox, 'user-id');
```

### Author Metadata on Tweets

Tweets in this fork include extra author metadata fields that are not available in the upstream library:

```typescript
const tweet = await scraper.getTweet('1585338303800578049');

console.log(tweet?.authorFollowersCount);    // e.g. 170000000
console.log(tweet?.authorFollowingCount);     // e.g. 800
console.log(tweet?.authorIsBlueVerified);     // true / false
console.log(tweet?.authorDescription);        // "Author's bio text"
```

These fields are populated from the user data embedded in the tweet response.

## Write Operations

All write operations require authentication. They are available both as `Scraper` instance methods and as standalone functions.

```typescript
// Post a tweet
const result = await scraper.sendTweet('Hello from the API!');
console.log('New tweet ID:', result.tweetId);

// Reply to a tweet
await scraper.sendTweet('Great point!', tweetId);

// Quote tweet
await scraper.quoteTweet('Check this out', tweetId, 'username');

// Delete a tweet
await scraper.deleteTweet(tweetId);

// Like / Unlike
await scraper.likeTweet(tweetId);
await scraper.unlikeTweet(tweetId);

// Retweet / Undo retweet
await scraper.retweet(tweetId);
await scraper.undoRetweet(tweetId);

// Follow / Unfollow
await scraper.followUser('username');
await scraper.unfollowUser('username');

// Bookmark / Unbookmark
await scraper.bookmarkTweet(tweetId);
await scraper.unbookmarkTweet(tweetId);
```

## Logging System

The scraper includes a structured logging system designed for both human debugging and AI agent consumption. Configure transports when creating the scraper:

### AI Agents: Structured JSON Lines

```typescript
import * as fs from 'fs';
import { Scraper, JsonLinesTransport } from 'twitter-scraper-secuspark';

const scraper = new Scraper({
  logging: {
    transports: [
      new JsonLinesTransport({
        writeLine: (line) => fs.appendFileSync('log.jsonl', line + '\n'),
      }),
    ],
  },
});
```

### Humans: Colored Terminal + Report Files

```typescript
import { Scraper, ConsoleTransport, ReportTransport } from 'twitter-scraper-secuspark';

const scraper = new Scraper({
  logging: {
    transports: [
      new ConsoleTransport({ minLevel: 'info' }),
      new ReportTransport({ outputDir: './reports', formats: ['md', 'json', 'csv'] }),
    ],
  },
});
```

### Custom: Callback Transport

```typescript
import { Scraper, CallbackTransport } from 'twitter-scraper-secuspark';

const scraper = new Scraper({
  logging: {
    transports: [new CallbackTransport((event) => mySystem.record(event))],
  },
});
```

### Event Types

All events are typed via a discriminated union on the `event` field:

| Event | Description |
| --- | --- |
| `http.request` | Outgoing HTTP request (method, URL, endpoint) |
| `http.response` | HTTP response received (status, duration, rate limit headers) |
| `http.rate_limit` | Rate limit triggered (endpoint, wait time) |
| `auth.login_start` | Login flow initiated |
| `auth.login_step` | Login flow step completed |
| `auth.login_success` | Login succeeded |
| `auth.login_failure` | Login failed |
| `auth.logout` | Logged out |
| `auth.guest_token` | Guest token acquired |
| `auth.cookies_set` | Cookies set on scraper |
| `scrape.start` | Scrape operation started (operation name, params) |
| `scrape.page` | Page of results fetched (page number, item count) |
| `scrape.complete` | Scrape operation finished (total items, duration) |
| `parse.success` | Entity parsed successfully |
| `parse.failure` | Entity parse failed |
| `error` | General error (code, message, endpoint) |

### Session Metrics

```typescript
// Get aggregated metrics at any time
const metrics = scraper.logger.getMetrics();
console.log(metrics.totalRequests);
console.log(metrics.successfulRequests);
console.log(metrics.rateLimitsHit);
console.log(metrics.scrapeOperations);

// Flush to trigger report generation (for ReportTransport)
await scraper.logger.flush();

// Close logger and all transports when done
await scraper.logger.close();
```

## Diagnostic Script

The included `diagnose.ts` exercises every scraper operation and generates a full set of reports:

```sh
# Anonymous mode (limited operations)
npx tsx diagnose.ts

# Full authenticated test
npx tsx diagnose.ts --with-cookies
```

Requires a `.env.local` file with `TWITTER_COOKIES` for authenticated mode.

**Generated output:**
- `reports/diagnose-*.jsonl` -- Structured JSON lines for AI agents
- `reports/report-*.md` -- Human-readable markdown report
- `reports/report-*.json` -- Machine-readable session metrics
- `reports/report-*.csv` -- Spreadsheet-friendly event log
- `reports/diagnose-results-*.json` -- Test results summary

## Advanced Configuration

### Rate Limiting

X's API rate-limits clients heavily. By default, the scraper waits for the current rate-limiting period to expire before resuming requests. **This can take up to 13 minutes in some cases.**

You can customize the strategy:

```typescript
import { Scraper, RateLimitStrategy } from 'twitter-scraper-secuspark';

class CustomRateLimitStrategy implements RateLimitStrategy {
  async onRateLimit(event: RateLimitEvent): Promise<void> {
    // Your own logic -- e.g. rotate accounts, log, abort, etc.
  }
}

const scraper = new Scraper({
  rateLimitStrategy: new CustomRateLimitStrategy(),
});
```

Built-in strategies:
- `WaitingRateLimitStrategy` (default) -- Waits for the limit to expire
- `ErrorRateLimitStrategy` -- Throws immediately on any rate limit

### CycleTLS Bypass

If X's authentication endpoints return `403 Forbidden` due to Cloudflare bot detection, you can use CycleTLS to mimic Chrome TLS fingerprints:

```sh
npm install cycletls
```

```typescript
import { Scraper } from 'twitter-scraper-secuspark';
import { cycleTLSFetch, cycleTLSExit } from 'twitter-scraper-secuspark/cycletls';

const scraper = new Scraper({
  fetch: cycleTLSFetch,
});

await scraper.login('username', 'password', 'email');

// Clean up when done
cycleTLSExit();
```

The `/cycletls` entrypoint is Node.js only and will not work in browser environments.

### Browser Usage with CORS Proxy

X's API does not have permissive CORS headers. In browser environments, configure a CORS proxy:

```typescript
const scraper = new Scraper({
  transform: {
    request(input: RequestInfo | URL, init?: RequestInit) {
      if (input instanceof URL) {
        const proxy = 'https://corsproxy.io/?' + encodeURIComponent(input.toString());
        return [proxy, init];
      } else if (typeof input === 'string') {
        const proxy = 'https://corsproxy.io/?' + encodeURIComponent(input);
        return [proxy, init];
      } else {
        throw new Error('Unexpected request input type');
      }
    },
  },
});
```

### Edge Runtimes

Edge runtimes like CloudFlare Workers may have non-standard `fetch` implementations. You can provide a custom `fetch`:

```typescript
const scraper = new Scraper({
  fetch: fetch,
});
```

### Experimental Features

```typescript
const scraper = new Scraper({
  experimental: {
    xClientTransactionId: true,  // Generate x-client-transaction-id header
    xpff: true,                  // Generate x-xp-forwarded-for header
    flowStepDelay: 2000,         // Delay between login steps (ms) to avoid bot detection
    browserProfile: {            // Override Castle.io fingerprint values
      // Unspecified fields are randomized from realistic value pools
    },
  },
});
```

## API Reference

### Authentication

| Method | Auth | Description |
| --- | --- | --- |
| `login(username, password, email?, twoFactorSecret?)` | -- | Log in with credentials |
| `logout()` | -- | Log out and revert to guest auth |
| `isLoggedIn()` | -- | Check if authenticated |
| `setCookies(cookies)` | -- | Set session cookies (recommended auth method) |
| `getCookies()` | -- | Get current session cookies |
| `clearCookies()` | -- | Clear all session cookies |

### Reading Tweets

| Method | Auth | Description |
| --- | --- | --- |
| `getTweet(id)` | No | Fetch a single tweet by ID |
| `getTweets(user, maxTweets?)` | No | Fetch tweets from a user's timeline |
| `getTweetsByUserId(userId, maxTweets?)` | No | Fetch tweets by user ID |
| `getLatestTweet(user, includeRetweets?, max?)` | No | Fetch most recent tweet from a user |
| `getTweetsAndReplies(user, maxTweets?)` | No | Fetch tweets and replies from a user |
| `getTweetsAndRepliesByUserId(userId, maxTweets?)` | No | Fetch tweets and replies by user ID |
| `getLikedTweets(user, maxTweets?)` | Yes | Fetch tweets liked by a user |
| `getTweetWhere(tweets, query)` | -- | Find first tweet matching a query |
| `getTweetsWhere(tweets, query)` | -- | Find all tweets matching a query |

### Searching

| Method | Auth | Description |
| --- | --- | --- |
| `searchTweets(query, maxTweets, searchMode?)` | Yes | Search tweets with query |
| `searchProfiles(query, maxProfiles)` | Yes | Search profiles with query |
| `fetchSearchTweets(query, maxTweets, searchMode, cursor?)` | Yes | Paginated tweet search |
| `fetchSearchProfiles(query, maxProfiles, cursor?)` | Yes | Paginated profile search |

### Profiles

| Method | Auth | Description |
| --- | --- | --- |
| `getProfile(username)` | No | Fetch a user profile |
| `getUserIdByScreenName(screenName)` | No | Resolve username to user ID |

### Relationships

| Method | Auth | Description |
| --- | --- | --- |
| `getFollowers(userId, maxProfiles)` | No | Fetch profiles that follow a user |
| `getFollowing(userId, maxProfiles)` | No | Fetch profiles a user follows |
| `fetchProfileFollowers(userId, maxProfiles, cursor?)` | No | Paginated follower fetch |
| `fetchProfileFollowing(userId, maxProfiles, cursor?)` | No | Paginated following fetch |

### Trends

| Method | Auth | Description |
| --- | --- | --- |
| `getTrends()` | No | Fetch current trending topics |

### Lists

| Method | Auth | Description |
| --- | --- | --- |
| `fetchListTweets(listId, maxTweets, cursor?)` | Yes | Fetch tweets from a list |

### Direct Messages

| Method | Auth | Description |
| --- | --- | --- |
| `getDmInbox()` | Yes | Get DM inbox |
| `getDmConversation(conversationId, cursor?)` | Yes | Get a DM conversation |
| `getDmMessages(conversationId, maxMessages?, cursor?)` | Yes | Iterate messages in a conversation |
| `findDmConversationsByUserId(inbox, userId)` | Yes | Find conversations with a user |

### Write Operations

| Method | Auth | Description |
| --- | --- | --- |
| `sendTweet(text, replyToTweetId?)` | Yes | Post a tweet or reply |
| `quoteTweet(text, quotedTweetId, quotedTweetUsername)` | Yes | Quote-tweet another tweet |
| `deleteTweet(tweetId)` | Yes | Delete a tweet |
| `likeTweet(tweetId)` | Yes | Like a tweet |
| `unlikeTweet(tweetId)` | Yes | Unlike a tweet |
| `retweet(tweetId)` | Yes | Retweet a tweet |
| `undoRetweet(tweetId)` | Yes | Undo a retweet |
| `followUser(username)` | Yes | Follow a user |
| `unfollowUser(username)` | Yes | Unfollow a user |
| `bookmarkTweet(tweetId)` | Yes | Bookmark a tweet |
| `unbookmarkTweet(tweetId)` | Yes | Remove a bookmark |

### Logging

| Method/Property | Description |
| --- | --- |
| `scraper.logger` | Access the `ScraperLogger` instance |
| `logger.getMetrics()` | Get aggregated session metrics |
| `logger.flush()` | Flush all transports (triggers report generation) |
| `logger.close()` | Flush and close all transports |
| `logger.addTransport(transport)` | Add a transport at runtime |
| `logger.removeTransport(transport)` | Remove a transport at runtime |

## Contributing

### Setup

This project uses Yarn for package management. [Corepack](https://nodejs.org/docs/latest/api/corepack.html) is configured, so run `corepack enable` then `yarn` to install dependencies.

#### Scripts

- `yarn build` -- Build the project into `dist/`
- `yarn test` -- Run unit tests

### Testing

```sh
yarn test
```

Configure environment variables for authenticated tests:

```
TWITTER_USERNAME=    # Account username
TWITTER_PASSWORD=    # Account password
TWITTER_EMAIL=       # Account email
TWITTER_COOKIES=     # JSON-serialized array of cookies
PROXY_URL=           # HTTP(s) proxy for requests (optional)
```

Given the speed at which X's private API changes, some test failures are expected.

### Commit Format

This project uses [Conventional Commits](https://www.conventionalcommits.org). See the Git history for examples.

## License

See [LICENSE](./LICENSE) for details.
