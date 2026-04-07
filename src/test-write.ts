import { Scraper } from './scraper';

async function main() {
  const scraper = new Scraper({
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

  // Test sendTweet
  const result = await scraper.sendTweet(`write test ${Date.now()}`);
  console.log('Tweet ID:', result.tweetId);

  if (result.tweetId) {
    console.log(`SUCCESS: https://x.com/i/status/${result.tweetId}`);

    // Test likeTweet
    await scraper.likeTweet(result.tweetId);
    console.log('Liked');

    // Cleanup
    await scraper.deleteTweet(result.tweetId);
    console.log('Deleted');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
