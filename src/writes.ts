// Write operations — sendTweet, likeTweet, retweet, followUser
// Ported from agent-twitter-client, adapted for @the-convocation/twitter-scraper auth
// All GraphQL mutations route through requestApi() for full anti-bot header coverage.

import { Headers } from 'headers-polyfill';
import { TwitterAuth, TwitterGuestAuth } from './auth';
import { requestApi, bearerToken2 } from './api';
import { updateCookieJar } from './requests';
import { getUserIdByScreenName } from './profile';
import { generateTransactionId } from './xctxid';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Throw on Twitter's "200 OK with errors" pattern (e.g. error 226). */
function throwOnSoftErrors(data: any, operation: string): void {
  const errors = data?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    throw new Error(
      `${operation}: ${first.message ?? JSON.stringify(first)} (code ${
        first.code ?? 'unknown'
      })`,
    );
  }
}

// ── sendTweet (+ reply support) ───────────────────────────────────────────

const CREATE_TWEET_URL =
  'https://x.com/i/api/graphql/jm93VcEnLxM7My_CL9C_EA/CreateTweet';

const CREATE_TWEET_FEATURES = {
  interactive_text_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  responsive_web_text_conversations_enabled: false,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
    false,
  vibe_api_enabled: false,
  rweb_lists_timeline_redesign_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  longform_notetweets_rich_text_read_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  subscriptions_verification_info_enabled: true,
  subscriptions_verification_info_reason_enabled: true,
  subscriptions_verification_info_verified_since_enabled: true,
  super_follow_badge_privacy_enabled: false,
  super_follow_exclusive_tweet_notifications_enabled: false,
  super_follow_tweet_api_enabled: false,
  super_follow_user_api_enabled: false,
  android_graphql_skip_api_media_color_palette: false,
  creator_subscriptions_subscription_count_enabled: false,
  blue_business_profile_image_shape_enabled: false,
  unified_cards_ad_metadata_container_dynamic_card_content_query_enabled: false,
  rweb_video_timestamps_enabled: false,
  c9s_tweet_anatomy_moderator_badge_enabled: false,
  responsive_web_twitter_article_tweet_consumption_enabled: false,
};

export interface SendTweetResult {
  tweetId?: string;
  response: Record<string, unknown>;
}

/**
 * Send a tweet or reply to a tweet.
 * @param text The tweet text
 * @param auth Authenticated TwitterAuth instance
 * @param replyToTweetId Optional tweet ID to reply to
 */
export async function sendTweet(
  text: string,
  auth: TwitterAuth,
  replyToTweetId?: string,
): Promise<SendTweetResult> {
  const variables: Record<string, any> = {
    tweet_text: text,
    dark_request: false,
    media: {
      media_entities: [],
      possibly_sensitive: false,
    },
    semantic_annotation_ids: [],
  };

  if (replyToTweetId) {
    variables.reply = { in_reply_to_tweet_id: replyToTweetId };
  }

  const res = await requestApi<any>(
    CREATE_TWEET_URL,
    auth,
    'POST',
    undefined,
    undefined,
    bearerToken2,
    { variables, features: CREATE_TWEET_FEATURES, fieldToggles: {} },
  );

  if (!res.success) throw res.err;
  throwOnSoftErrors(res.value, 'sendTweet');

  const tweetResult = res.value?.data?.create_tweet?.tweet_results?.result;
  const tweetId = tweetResult?.rest_id ?? tweetResult?.tweet?.rest_id;

  return { tweetId, response: res.value ?? {} };
}

// ── likeTweet ─────────────────────────────────────────────────────────────

const LIKE_TWEET_URL =
  'https://x.com/i/api/graphql/lI07N6Otwv1PhnEgXILM7A/FavoriteTweet';

/**
 * Like a tweet.
 * @param tweetId The tweet ID to like
 * @param auth Authenticated TwitterAuth instance
 */
export async function likeTweet(
  tweetId: string,
  auth: TwitterAuth,
): Promise<void> {
  const res = await requestApi<any>(
    LIKE_TWEET_URL,
    auth,
    'POST',
    undefined,
    undefined,
    bearerToken2,
    { variables: { tweet_id: tweetId } },
  );
  if (!res.success) throw res.err;
  throwOnSoftErrors(res.value, 'likeTweet');
}

// ── retweet ───────────────────────────────────────────────────────────────

const RETWEET_URL =
  'https://x.com/i/api/graphql/ojPdsZsimiJrUGLR1sjUtA/CreateRetweet';

/**
 * Retweet a tweet.
 * @param tweetId The tweet ID to retweet
 * @param auth Authenticated TwitterAuth instance
 */
export async function retweet(
  tweetId: string,
  auth: TwitterAuth,
): Promise<void> {
  const res = await requestApi<any>(
    RETWEET_URL,
    auth,
    'POST',
    undefined,
    undefined,
    bearerToken2,
    { variables: { tweet_id: tweetId, dark_request: false } },
  );
  if (!res.success) throw res.err;
  throwOnSoftErrors(res.value, 'retweet');
}

// ── followUser ────────────────────────────────────────────────────────────

const FOLLOW_URL = 'https://api.x.com/1.1/friendships/create.json';

/**
 * Follow a user by username.
 * @param username The username (without @) to follow
 * @param auth Authenticated TwitterAuth instance
 */
export async function followUser(
  username: string,
  auth: TwitterAuth,
): Promise<void> {
  if (!(await auth.isLoggedIn())) {
    throw new Error('Must be logged in to follow users');
  }

  const userIdResult = await getUserIdByScreenName(username, auth);
  if (!userIdResult.success) {
    throw new Error(
      `Failed to resolve @${username}: ${userIdResult.err.message}`,
    );
  }

  const headers = new Headers();
  await auth.installTo(headers, FOLLOW_URL, bearerToken2);
  headers.set('content-type', 'application/x-www-form-urlencoded');
  headers.set('referer', `https://x.com/${username}`);

  // Transaction ID — same logic as requestApi()
  if (
    auth instanceof TwitterGuestAuth &&
    (auth as any).options?.experimental?.xClientTransactionId
  ) {
    try {
      const txId = await generateTransactionId(
        FOLLOW_URL,
        auth.fetch.bind(auth),
        'POST',
      );
      headers.set('x-client-transaction-id', txId);
    } catch {
      // Non-fatal
    }
  }

  const body = new URLSearchParams({
    include_profile_interstitial_type: '1',
    skip_status: 'true',
    user_id: userIdResult.value,
  });

  const response = await auth.fetch(FOLLOW_URL, {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  await updateCookieJar(auth.cookieJar(), response.headers);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `followUser failed (${response.status}): ${errText.slice(0, 300)}`,
    );
  }
}

// ── unlikeTweet ──────────────────────────────────────────────────────────

const UNLIKE_TWEET_URL =
  'https://x.com/i/api/graphql/ZYKSe-w7KEslx3JhSIk5LA/UnfavoriteTweet';

/**
 * Unlike a previously liked tweet.
 * @param tweetId The tweet ID to unlike
 * @param auth Authenticated TwitterAuth instance
 */
export async function unlikeTweet(
  tweetId: string,
  auth: TwitterAuth,
): Promise<void> {
  const res = await requestApi<any>(
    UNLIKE_TWEET_URL,
    auth,
    'POST',
    undefined,
    undefined,
    bearerToken2,
    { variables: { tweet_id: tweetId } },
  );
  if (!res.success) throw res.err;
  throwOnSoftErrors(res.value, 'unlikeTweet');
}

// ── undoRetweet ──────────────────────────────────────────────────────────

const UNDO_RETWEET_URL =
  'https://x.com/i/api/graphql/iQtK4dl5hBmXewYZuEOKVw/DeleteRetweet';

/**
 * Undo a retweet.
 * @param tweetId The tweet ID to un-retweet
 * @param auth Authenticated TwitterAuth instance
 */
export async function undoRetweet(
  tweetId: string,
  auth: TwitterAuth,
): Promise<void> {
  const res = await requestApi<any>(
    UNDO_RETWEET_URL,
    auth,
    'POST',
    undefined,
    undefined,
    bearerToken2,
    { variables: { source_tweet_id: tweetId, dark_request: false } },
  );
  if (!res.success) throw res.err;
  throwOnSoftErrors(res.value, 'undoRetweet');
}

// ── deleteTweet ──────────────────────────────────────────────────────────

const DELETE_TWEET_URL =
  'https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet';

/**
 * Delete a tweet.
 * @param tweetId The tweet ID to delete
 * @param auth Authenticated TwitterAuth instance
 */
export async function deleteTweet(
  tweetId: string,
  auth: TwitterAuth,
): Promise<void> {
  const res = await requestApi<any>(
    DELETE_TWEET_URL,
    auth,
    'POST',
    undefined,
    undefined,
    bearerToken2,
    { variables: { tweet_id: tweetId, dark_request: false } },
  );
  if (!res.success) throw res.err;
  throwOnSoftErrors(res.value, 'deleteTweet');
}

// ── unfollowUser ─────────────────────────────────────────────────────────

const UNFOLLOW_URL = 'https://api.x.com/1.1/friendships/destroy.json';

/**
 * Unfollow a user by username.
 * @param username The username (without @) to unfollow
 * @param auth Authenticated TwitterAuth instance
 */
export async function unfollowUser(
  username: string,
  auth: TwitterAuth,
): Promise<void> {
  if (!(await auth.isLoggedIn())) {
    throw new Error('Must be logged in to unfollow users');
  }

  const userIdResult = await getUserIdByScreenName(username, auth);
  if (!userIdResult.success) {
    throw new Error(
      `Failed to resolve @${username}: ${userIdResult.err.message}`,
    );
  }

  const headers = new Headers();
  await auth.installTo(headers, UNFOLLOW_URL, bearerToken2);
  headers.set('content-type', 'application/x-www-form-urlencoded');
  headers.set('referer', `https://x.com/${username}`);

  // Transaction ID — same logic as requestApi()
  if (
    auth instanceof TwitterGuestAuth &&
    (auth as any).options?.experimental?.xClientTransactionId
  ) {
    try {
      const txId = await generateTransactionId(
        UNFOLLOW_URL,
        auth.fetch.bind(auth),
        'POST',
      );
      headers.set('x-client-transaction-id', txId);
    } catch {
      // Non-fatal
    }
  }

  const body = new URLSearchParams({
    include_profile_interstitial_type: '1',
    skip_status: 'true',
    user_id: userIdResult.value,
  });

  const response = await auth.fetch(UNFOLLOW_URL, {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  await updateCookieJar(auth.cookieJar(), response.headers);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `unfollowUser failed (${response.status}): ${errText.slice(0, 300)}`,
    );
  }
}

// ── quoteTweet ───────────────────────────────────────────────────────────

/**
 * Quote-tweet another tweet.
 * @param text The commentary text for the quote tweet
 * @param quotedTweetId The tweet ID being quoted
 * @param quotedTweetUsername The username of the quoted tweet's author
 * @param auth Authenticated TwitterAuth instance
 */
export async function quoteTweet(
  text: string,
  quotedTweetId: string,
  quotedTweetUsername: string,
  auth: TwitterAuth,
): Promise<SendTweetResult> {
  const variables: Record<string, any> = {
    tweet_text: text,
    dark_request: false,
    media: {
      media_entities: [],
      possibly_sensitive: false,
    },
    semantic_annotation_ids: [],
    attachment_url: `https://x.com/${quotedTweetUsername}/status/${quotedTweetId}`,
  };

  const res = await requestApi<any>(
    CREATE_TWEET_URL,
    auth,
    'POST',
    undefined,
    undefined,
    bearerToken2,
    { variables, features: CREATE_TWEET_FEATURES, fieldToggles: {} },
  );

  if (!res.success) throw res.err;
  throwOnSoftErrors(res.value, 'quoteTweet');

  const tweetResult = res.value?.data?.create_tweet?.tweet_results?.result;
  const tweetId = tweetResult?.rest_id ?? tweetResult?.tweet?.rest_id;

  return { tweetId, response: res.value ?? {} };
}

// ── bookmarkTweet ────────────────────────────────────────────────────────

const BOOKMARK_URL =
  'https://x.com/i/api/graphql/aoDbu3RHznuiSkQ9aNM67Q/CreateBookmark';

/**
 * Bookmark a tweet.
 * @param tweetId The tweet ID to bookmark
 * @param auth Authenticated TwitterAuth instance
 */
export async function bookmarkTweet(
  tweetId: string,
  auth: TwitterAuth,
): Promise<void> {
  const res = await requestApi<any>(
    BOOKMARK_URL,
    auth,
    'POST',
    undefined,
    undefined,
    bearerToken2,
    { variables: { tweet_id: tweetId } },
  );
  if (!res.success) throw res.err;
  throwOnSoftErrors(res.value, 'bookmarkTweet');
}

// ── unbookmarkTweet ──────────────────────────────────────────────────────

const UNBOOKMARK_URL =
  'https://x.com/i/api/graphql/Wlmlj2-xISyz1NhUWsBPCA/DeleteBookmark';

/**
 * Remove a bookmark from a tweet.
 * @param tweetId The tweet ID to unbookmark
 * @param auth Authenticated TwitterAuth instance
 */
export async function unbookmarkTweet(
  tweetId: string,
  auth: TwitterAuth,
): Promise<void> {
  const res = await requestApi<any>(
    UNBOOKMARK_URL,
    auth,
    'POST',
    undefined,
    undefined,
    bearerToken2,
    { variables: { tweet_id: tweetId } },
  );
  if (!res.success) throw res.err;
  throwOnSoftErrors(res.value, 'unbookmarkTweet');
}
