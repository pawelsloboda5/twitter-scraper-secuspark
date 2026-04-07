// Define Rollup build constant for tsx execution from source
(globalThis as any).PLATFORM_NODE = true;

import { Scraper } from './scraper';
import {
  initCycleTLSFetch,
  cycleTLSFetch,
  cycleTLSExit,
} from './cycletls-fetch';

async function main() {
  // Initialize CycleTLS to spoof Chrome TLS fingerprint
  await initCycleTLSFetch();
  console.log('CycleTLS initialized');

  const scraper = new Scraper({
    fetch: cycleTLSFetch as unknown as typeof fetch,
    experimental: { xClientTransactionId: true, xpff: true },
  });

  const cookies = JSON.parse(process.env.TWITTER_COOKIES ?? '[]');
  const setCookies = cookies.map((c: any) => {
    const parts = [
      `${c.key}=${c.value}`,
      `Domain=${c.domain}`,
      `Path=${c.path}`,
    ];
    if (c.secure) parts.push('Secure');
    if (c.httpOnly) parts.push('HttpOnly');
    return parts.join('; ');
  });
  await scraper.setCookies(setCookies);

  console.log('Logged in:', await scraper.isLoggedIn());

  // Warm-up read to establish session and get guest_id cookie
  console.log('Warming up session...');
  const profile = await scraper.getProfile('x');
  console.log('Warm-up done, got profile:', profile?.name);

  // Test sendTweet
  try {
    const result = await scraper.sendTweet(`write test ${Date.now()}`);
    console.log('Tweet ID:', result.tweetId);

    if (result.tweetId) {
      console.log(`SUCCESS: https://x.com/i/status/${result.tweetId}`);
      await scraper.likeTweet(result.tweetId);
      console.log('Liked');
      await scraper.deleteTweet(result.tweetId);
      console.log('Deleted');
    }
  } catch (e: any) {
    console.error('\nFAILED:', e.message);
  } finally {
    cycleTLSExit();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
