import { Scraper } from '@the-convocation/twitter-scraper';
import {
  initCycleTLSFetch,
  cycleTLSFetch,
  cycleTLSExit,
} from '@the-convocation/twitter-scraper/cycletls';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

/**
 * Example: CycleTLS for write operations and Cloudflare bypass
 *
 * CycleTLS spoofs Chrome TLS fingerprints (JA3, JA4r, HTTP/2 SETTINGS),
 * which is required for write operations on X. Without it, writes return
 * error 226 ("looks automated").
 *
 * Setup:
 * 1. Create .env.local with TWITTER_COOKIES (auth_token, ct0, guest_id)
 * 2. Run: yarn start
 */

const main = async () => {
  // Initialize CycleTLS
  await initCycleTLSFetch();
  console.log('CycleTLS initialized');

  // Create scraper with CycleTLS + experimental anti-bot headers
  const scraper = new Scraper({
    fetch: cycleTLSFetch,
    experimental: { xClientTransactionId: true, xpff: true },
  });

  // Authenticate with cookies
  const cookiesJson = process.env['TWITTER_COOKIES'];
  if (!cookiesJson) {
    console.error(
      'Missing TWITTER_COOKIES in .env.local. See README for format.',
    );
    process.exit(1);
  }

  const cookies = JSON.parse(cookiesJson);
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

  const loggedIn = await scraper.isLoggedIn();
  console.log('Authenticated:', loggedIn);

  if (!loggedIn) {
    console.error('Authentication failed. Check your cookies.');
    cycleTLSExit();
    process.exit(1);
  }

  try {
    // Read operation (works without CycleTLS too)
    console.log('\nFetching a tweet...');
    const tweet = await scraper.getTweet('1585338303800578049');
    console.log(`- Text: ${tweet?.text?.slice(0, 80)}...`);
    console.log(`- Likes: ${tweet?.likes}`);

    // Write operation (requires CycleTLS)
    console.log('\nPosting a test tweet...');
    const result = await scraper.sendTweet(`CycleTLS test ${Date.now()}`);
    console.log(`- Tweet ID: ${result.tweetId}`);

    if (result.tweetId) {
      console.log(`- URL: https://x.com/i/status/${result.tweetId}`);

      // Clean up
      await scraper.deleteTweet(result.tweetId);
      console.log('- Deleted test tweet');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    cycleTLSExit();
  }
};

main();
