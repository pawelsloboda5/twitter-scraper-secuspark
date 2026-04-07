# CycleTLS Example -- Write Operations & Cloudflare Bypass

This example demonstrates how to use CycleTLS with twitter-scraper-secuspark to:

1. **Bypass Cloudflare bot detection** (403 Forbidden on auth endpoints)
2. **Enable write operations** (sendTweet, likeTweet, etc.) that require Chrome TLS fingerprints

## Why CycleTLS?

X's write endpoints enforce TLS fingerprint checks. Standard Node.js TLS handshakes trigger error 226 ("looks automated"). CycleTLS spoofs Chrome's JA3/JA4r/HTTP2 fingerprints so requests appear browser-native.

> **Read operations** work without CycleTLS. Only install it if you need write operations or encounter Cloudflare 403 errors.

## Installation

```sh
yarn install
```

## Configuration

Create a `.env.local` file in this directory with your X cookies:

```
TWITTER_COOKIES=[{"key":"auth_token","value":"YOUR_AUTH_TOKEN","domain":".x.com","path":"/","secure":true,"httpOnly":true},{"key":"ct0","value":"YOUR_CT0_TOKEN","domain":".x.com","path":"/","secure":true},{"key":"guest_id","value":"YOUR_GUEST_ID","domain":".x.com","path":"/","secure":true}]
```

Get these from your browser: DevTools (F12) -> Application -> Cookies -> `https://x.com`

## Usage

```sh
yarn start
```

## How it works

```ts
import { Scraper } from 'twitter-scraper-secuspark';
import { initCycleTLSFetch, cycleTLSFetch, cycleTLSExit } from 'twitter-scraper-secuspark/cycletls';

// Initialize CycleTLS (downloads Chrome fingerprint data)
await initCycleTLSFetch();

// Create scraper with CycleTLS + experimental anti-bot headers
const scraper = new Scraper({
  fetch: cycleTLSFetch,
  experimental: { xClientTransactionId: true, xpff: true },
});

// Authenticate with cookies
await scraper.setCookies([...]);

// Write operations now work
const result = await scraper.sendTweet('Hello!');
console.log('Tweet ID:', result.tweetId);

// Clean up
cycleTLSExit();
```

Three things are needed for write operations:
- **CycleTLS** -- Chrome TLS fingerprint spoofing
- **`xClientTransactionId: true`** -- Generates browser-derived transaction ID
- **`xpff: true`** -- Generates anti-bot fingerprint header (requires `guest_id` cookie)
