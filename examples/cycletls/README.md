# CycleTLS Cloudflare Bypass Example

This example demonstrates how to use the `@the-convocation/twitter-scraper/cycletls` entrypoint to bypass Cloudflare bot detection when authenticating with X (formerly Twitter).

## Problem

X's authentication endpoints may be protected by Cloudflare's bot detection, which analyzes TLS fingerprints to detect non-browser clients. Standard Node.js TLS handshakes can trigger `403 Forbidden` errors during login.

## Solution

This example uses [CycleTLS](https://github.com/Danny-Dasilva/CycleTLS) to mimic Chrome browser TLS fingerprints, allowing requests to pass through Cloudflare's protection.

> **Note:** Cookie-based authentication is the recommended approach and avoids most Cloudflare issues entirely. See the main README for details.

## Installation

```sh
yarn install
```

## Configuration

Create a `.env` file in this directory with your X credentials:

```
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
TWITTER_EMAIL=your_email
```

## Usage

```sh
yarn start
```

## How it works

The example imports the `cycleTLSFetch` function from the `/cycletls` subpath:

```ts
import { Scraper } from '@the-convocation/twitter-scraper';
import { cycleTLSFetch, cycleTLSExit } from '@the-convocation/twitter-scraper/cycletls';

const scraper = new Scraper({
  fetch: cycleTLSFetch,
});
```

This replaces the default fetch implementation with one that uses Chrome-like TLS fingerprints, bypassing Cloudflare's detection.
