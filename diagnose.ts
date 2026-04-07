/**
 * Diagnostic script: Exercises every scraper operation and generates a full report.
 *
 * Usage:
 *   npx tsx diagnose.ts
 *   npx tsx diagnose.ts --with-cookies   (if you have TWITTER_COOKIES in .env.local)
 *
 * Output:
 *   - Real-time colored terminal logs
 *   - reports/diagnose-*.jsonl  (structured JSON lines for AI agents)
 *   - reports/diagnose-*.md    (human-readable markdown report)
 *   - reports/diagnose-*.json  (machine-readable session metrics)
 *   - reports/diagnose-*.csv   (spreadsheet-friendly event log)
 */

// PLATFORM_NODE is normally defined by Rollup's esbuild plugin at build time.
// When running .ts files directly with tsx, we must define it manually.
(globalThis as any).PLATFORM_NODE = true;

import { Scraper } from './src/scraper';
import {
  ConsoleTransport,
  JsonLinesTransport,
  ReportTransport,
  CallbackTransport,
} from './src/logger-transports';
import { ReportTransport as ReportT } from './src/logger-reports';
import { SearchMode } from './src/search';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { Cookie } from 'tough-cookie';

dotenv.config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const USE_COOKIES = process.argv.includes('--with-cookies');
const REPORTS_DIR = path.join(process.cwd(), 'reports');

interface DiagResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  durationMs: number;
  detail: string;
  error?: string;
}

const results: DiagResult[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runTest(
  name: string,
  requiresAuth: boolean,
  fn: () => Promise<string>,
): Promise<void> {
  if (requiresAuth && !USE_COOKIES) {
    results.push({ name, status: 'skip', durationMs: 0, detail: 'Requires auth (use --with-cookies)' });
    console.log(`  [SKIP] ${name} (requires auth)`);
    return;
  }

  const start = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - start;
    results.push({ name, status: 'pass', durationMs: ms, detail });
    console.log(`  [PASS] ${name} (${ms}ms) - ${detail}`);
  } catch (err: any) {
    const ms = Date.now() - start;
    const msg = err?.message ?? String(err);
    results.push({ name, status: 'fail', durationMs: ms, detail: '', error: msg });
    console.log(`  [FAIL] ${name} (${ms}ms) - ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Twitter Scraper Diagnostic ===\n');
  console.log(`Mode: ${USE_COOKIES ? 'Authenticated (cookies)' : 'Anonymous'}`);
  console.log(`Reports dir: ${REPORTS_DIR}\n`);

  // Ensure reports dir
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  // Setup JSONL output
  const jsonlPath = path.join(REPORTS_DIR, `diagnose-${Date.now()}.jsonl`);
  const jsonlStream = fs.createWriteStream(jsonlPath, { flags: 'a' });

  // Create scraper with full logging
  const scraper = new Scraper({
    logging: {
      transports: [
        new ConsoleTransport({ minLevel: 'info', colorize: true }),
        new JsonLinesTransport({
          writeLine: (line) => jsonlStream.write(line + '\n'),
        }),
        new ReportT({
          outputDir: REPORTS_DIR,
          formats: ['md', 'json', 'csv'],
        }),
      ],
    },
    experimental: {
      xClientTransactionId: true,
      xpff: true,
    },
  });

  // Auth setup
  if (USE_COOKIES) {
    const cookiesJson = process.env['TWITTER_COOKIES'];
    if (!cookiesJson) {
      console.error('ERROR: --with-cookies specified but TWITTER_COOKIES not in .env.local');
      process.exit(1);
    }
    console.log('Setting cookies...');
    try {
      const cookies = JSON.parse(cookiesJson).map((c: any) =>
        typeof c === 'string' ? c : Cookie.fromJSON(c),
      );
      await scraper.setCookies(cookies);
      console.log(`Cookies set. Logged in: ${await scraper.isLoggedIn()}\n`);
    } catch (err: any) {
      console.error(`Cookie auth failed: ${err.message}\n`);
    }
  }

  // =========================================================================
  // ANONYMOUS TESTS (no auth required)
  // =========================================================================

  console.log('\n--- Anonymous Operations ---\n');

  // 1. Get a known public tweet
  await runTest('getTweet (public)', false, async () => {
    const tweet = await scraper.getTweet('1585338303800578049');
    if (!tweet) throw new Error('Tweet not found');
    return `id=${tweet.id}, text="${tweet.text?.slice(0, 60)}..."`;
  });

  // 2. Get a profile
  await runTest('getProfile', false, async () => {
    const profile = await scraper.getProfile('twitter');
    if (!profile) throw new Error('Profile not found');
    return `@${profile.username}, followers=${profile.followersCount}`;
  });

  // 3. Get user ID from screen name
  await runTest('getUserIdByScreenName', false, async () => {
    const id = await scraper.getUserIdByScreenName('twitter');
    return `userId=${id}`;
  });

  // 4. Search tweets (requires auth since ~March 2026)
  await runTest('searchTweets (Top)', true, async () => {
    let count = 0;
    for await (const tweet of scraper.searchTweets('javascript', 5, SearchMode.Top)) {
      count++;
      if (count >= 5) break;
    }
    return `${count} tweets found`;
  });

  // 5. Search tweets (Latest)
  await runTest('searchTweets (Latest)', true, async () => {
    let count = 0;
    for await (const tweet of scraper.searchTweets('typescript', 5, SearchMode.Latest)) {
      count++;
      if (count >= 5) break;
    }
    return `${count} tweets found`;
  });

  // 6. Get user tweets
  await runTest('getTweets', false, async () => {
    let count = 0;
    for await (const tweet of scraper.getTweets('twitter', 5)) {
      count++;
      if (count >= 5) break;
    }
    return `${count} tweets fetched`;
  });

  // 7. Get tweets and replies
  await runTest('getTweetsAndReplies', false, async () => {
    let count = 0;
    for await (const tweet of scraper.getTweetsAndReplies('twitter', 5)) {
      count++;
      if (count >= 5) break;
    }
    return `${count} tweets+replies fetched`;
  });

  // 8. Get trends
  await runTest('getTrends', false, async () => {
    const trends = await scraper.getTrends();
    return `${trends.length} trends: ${trends.slice(0, 3).join(', ')}...`;
  });

  // 9. Fetch search tweets (paginated)
  await runTest('fetchSearchTweets (paginated)', true, async () => {
    const res = await scraper.fetchSearchTweets('AI', 10, SearchMode.Top);
    return `${res.tweets.length} tweets, cursor=${res.next ? 'yes' : 'no'}`;
  });

  // 10. Search profiles (requires auth)
  await runTest('searchProfiles', true, async () => {
    let count = 0;
    for await (const profile of scraper.searchProfiles('openai', 3)) {
      count++;
      if (count >= 3) break;
    }
    return `${count} profiles found`;
  });

  // 11. Get followers (may require auth for some accounts)
  await runTest('getFollowers', false, async () => {
    const userId = await scraper.getUserIdByScreenName('twitter');
    let count = 0;
    for await (const profile of scraper.getFollowers(userId, 3)) {
      count++;
      if (count >= 3) break;
    }
    return `${count} followers fetched`;
  });

  // 12. Get following
  await runTest('getFollowing', false, async () => {
    const userId = await scraper.getUserIdByScreenName('twitter');
    let count = 0;
    for await (const profile of scraper.getFollowing(userId, 3)) {
      count++;
      if (count >= 3) break;
    }
    return `${count} following fetched`;
  });

  // 13. Get latest tweet
  await runTest('getLatestTweet', false, async () => {
    const tweet = await scraper.getLatestTweet('elonmusk', false, 10);
    if (!tweet) throw new Error('No tweet found');
    return `id=${tweet.id}, text="${tweet.text?.slice(0, 60)}..."`;
  });

  // 14. Author metadata (our feature, uses search so requires auth)
  await runTest('Author metadata on tweets', true, async () => {
    let found = false;
    for await (const tweet of scraper.searchTweets('from:elonmusk', 3)) {
      if (tweet.authorFollowersCount !== undefined) {
        found = true;
        return `followers=${tweet.authorFollowersCount}, verified=${tweet.authorIsBlueVerified}`;
      }
    }
    if (!found) throw new Error('No author metadata found on tweets');
    return '';
  });

  // =========================================================================
  // AUTHENTICATED TESTS (requires cookies)
  // =========================================================================

  console.log('\n--- Authenticated Operations ---\n');

  // 15. Check login status
  await runTest('isLoggedIn', true, async () => {
    const loggedIn = await scraper.isLoggedIn();
    return `loggedIn=${loggedIn}`;
  });

  // 16. Get liked tweets
  await runTest('getLikedTweets', true, async () => {
    const username = process.env['TWITTER_USERNAME'] ?? '';
    let count = 0;
    for await (const tweet of scraper.getLikedTweets(username, 3)) {
      count++;
      if (count >= 3) break;
    }
    return `${count} liked tweets`;
  });

  // 17. Get DM inbox
  await runTest('getDmInbox', true, async () => {
    const inbox = await scraper.getDmInbox();
    const convCount = Object.keys(inbox.conversations ?? {}).length;
    return `${convCount} conversations`;
  });

  // 18. Fetch list tweets
  await runTest('fetchListTweets', true, async () => {
    // Twitter's official "Spaces" list
    const res = await scraper.fetchListTweets('1580670546498768897', 5);
    return `${res.tweets.length} list tweets`;
  });

  // =========================================================================
  // Generate reports
  // =========================================================================

  console.log('\n--- Generating Reports ---\n');

  // Flush logger to generate report files
  await scraper.logger.flush();
  jsonlStream.end();

  // Print session metrics
  const metrics = scraper.logger.getMetrics();
  console.log(`Session ID: ${metrics.sessionId}`);
  console.log(`Total HTTP requests: ${metrics.totalRequests}`);
  console.log(`Successful: ${metrics.successfulRequests}`);
  console.log(`Failed: ${metrics.failedRequests}`);
  console.log(`Rate limits hit: ${metrics.rateLimitsHit}`);
  console.log(`Errors: ${metrics.errors.length}`);

  // Print results summary
  console.log('\n=== DIAGNOSTIC RESULTS ===\n');

  const passed = results.filter((r) => r.status === 'pass');
  const failed = results.filter((r) => r.status === 'fail');
  const skipped = results.filter((r) => r.status === 'skip');

  console.log(`PASS: ${passed.length}  FAIL: ${failed.length}  SKIP: ${skipped.length}\n`);

  if (failed.length > 0) {
    console.log('Failed tests:');
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }

  // Write results JSON
  const resultsPath = path.join(REPORTS_DIR, `diagnose-results-${Date.now()}.json`);
  fs.writeFileSync(
    resultsPath,
    JSON.stringify({ results, metrics, timestamp: new Date().toISOString() }, null, 2),
  );
  console.log(`\nResults written to: ${resultsPath}`);
  console.log(`JSONL log: ${jsonlPath}`);
  console.log(`Reports: ${REPORTS_DIR}/report-*.{md,json,csv}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
