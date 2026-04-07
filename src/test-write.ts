// Define Rollup build constant for tsx execution from source
(globalThis as any).PLATFORM_NODE = true;

import { Scraper } from './scraper';
import {
  initCycleTLSFetch,
  cycleTLSFetch,
  cycleTLSExit,
} from './cycletls-fetch';

const pass = (op: string) => console.log(`  [PASS] ${op}`);
const fail = (op: string, e: any) =>
  console.error(`  [FAIL] ${op}: ${e.message}`);

async function main() {
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

  let failures = 0;

  // 1. sendTweet
  let tweetId: string | undefined;
  try {
    const result = await scraper.sendTweet(`write ops test ${Date.now()}`);
    tweetId = result.tweetId;
    pass(`sendTweet → ${tweetId}`);
  } catch (e: any) {
    fail('sendTweet', e);
    failures++;
  }

  if (!tweetId) {
    console.log('\nCannot test remaining ops without a tweet. Exiting.');
    cycleTLSExit();
    process.exit(1);
  }

  // 2. likeTweet
  try {
    await scraper.likeTweet(tweetId);
    pass('likeTweet');
  } catch (e: any) {
    fail('likeTweet', e);
    failures++;
  }

  // 3. unlikeTweet
  try {
    await scraper.unlikeTweet(tweetId);
    pass('unlikeTweet');
  } catch (e: any) {
    fail('unlikeTweet', e);
    failures++;
  }

  // 4. retweet
  try {
    await scraper.retweet(tweetId);
    pass('retweet');
  } catch (e: any) {
    fail('retweet', e);
    failures++;
  }

  // 5. undoRetweet
  try {
    await scraper.undoRetweet(tweetId);
    pass('undoRetweet');
  } catch (e: any) {
    fail('undoRetweet', e);
    failures++;
  }

  // 6. bookmarkTweet
  try {
    await scraper.bookmarkTweet(tweetId);
    pass('bookmarkTweet');
  } catch (e: any) {
    fail('bookmarkTweet', e);
    failures++;
  }

  // 7. unbookmarkTweet
  try {
    await scraper.unbookmarkTweet(tweetId);
    pass('unbookmarkTweet');
  } catch (e: any) {
    fail('unbookmarkTweet', e);
    failures++;
  }

  // 8. deleteTweet (cleanup)
  try {
    await scraper.deleteTweet(tweetId);
    pass('deleteTweet');
  } catch (e: any) {
    fail('deleteTweet', e);
    failures++;
  }

  // Note: followUser/unfollowUser not tested to avoid side effects on real accounts

  console.log(
    `\n${
      failures === 0 ? 'ALL PASSED' : `${failures} FAILED`
    } (8 operations tested)`,
  );
  cycleTLSExit();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
