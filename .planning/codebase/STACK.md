# Technology Stack

**Analysis Date:** 2026-04-07

## Languages

**Primary:**
- TypeScript 5.0.4 - All source code in `src/`

**Secondary:**
- JavaScript (ES modules) - Rollup configuration and build scripts

## Runtime

**Environment:**
- Node.js >= 16.0.0 (specified in `package.json` engines field)

**Package Manager:**
- Yarn 1.22.19 (specified via packageManager field)
- Lockfile: `yarn.lock` present

## Frameworks

**Core:**
- Cross-fetch 4.0.0-alpha.5 - Portable fetch implementation for HTTP requests (`src/auth.ts`, `src/scraper.ts`)

**Build/Transpilation:**
- Rollup 4.18.0 - Module bundler for building multiple distribution formats (`rollup.config.mjs`)
  - rollup-plugin-esbuild 6.1.1 - TypeScript/JavaScript transpiler
  - rollup-plugin-dts 6.1.1 - TypeScript declaration bundler
- esbuild 0.21.5 - Fast JavaScript/TypeScript bundler (used via rollup-plugin-esbuild)

**Testing:**
- Jest 29.5.0 - Test runner (`jest.config.js`)
- ts-jest 29.1.0 - TypeScript support for Jest
- Test environment: node

**Linting & Formatting:**
- ESLint 8.41.0 - JavaScript linter with TypeScript plugin
  - @typescript-eslint/eslint-plugin 5.59.7
  - @typescript-eslint/parser 5.59.7
  - eslint-plugin-prettier 4.2.1 - Prettier integration for ESLint
  - eslint-config-prettier 8.8.0 - Disables ESLint rules conflicting with Prettier
- Prettier 2.8.8 - Code formatter (config: `.prettierrc`)
- Husky 8.0.3 - Git hooks for pre-commit linting
- lint-staged 13.2.2 - Run linters on staged files

**Documentation:**
- TypeDoc 0.27.6 - TypeScript documentation generator (`typedoc.json`, `docs:generate` script)
- gh-pages 5.0.0 - GitHub Pages deployment

**Git & Commits:**
- commitlint 17.6.3 - Enforce conventional commits
  - commitlint/config-conventional 17.6.3 - Conventional Commits ruleset
- cz-conventional-changelog 3.3.0 - Commitizen adapter for conventional commits

**Utilities:**
- rimraf 5.0.7 - Cross-platform file removal utility
- dotenv 16.3.1 - Environment variable loading (dev dependency)

## Key Dependencies

**Critical for API Communication:**
- tough-cookie 4.1.2 - Cookie handling for HTTP requests (`src/requests.ts`)
- set-cookie-parser 2.6.0 - Parse Set-Cookie headers
- headers-polyfill 3.1.2 - Cross-platform Headers API polyfill

**Data Validation & Serialization:**
- @sinclair/typebox 0.32.20 - JSON Schema type generation and validation (`src/auth-user.ts`)
- json-stable-stringify 1.0.2 - Deterministic JSON serialization

**DOM & Parsing:**
- linkedom 0.18.12 - Lightweight DOM API implementation for Node.js (`src/auth-user.ts`, `src/xctxid.ts`)
  - Used for DOM emulation in JavaScript instrumentation during Twitter login

**Authentication & Security:**
- otpauth 9.2.2 - One-Time Password (OTP) authentication for 2FA (`src/auth-user.ts`)
- x-client-transaction-id 0.2.0 - Generate transaction IDs for Twitter API

**Debugging:**
- debug 4.4.1 - Lightweight debug logging (namespaced across modules)

**Type Definitions:**
- @types/debug 4.1.12
- @types/jest 29.5.1
- @types/json-stable-stringify 1.0.34
- @types/set-cookie-parser 2.4.2
- @types/tough-cookie 4.0.2
- @tsconfig/node16 16.1.0 - TypeScript config preset for Node 16

**Optional Peer Dependencies:**
- cycletls 2.0.5 - CycleTLS fetch implementation for TLS fingerprint spoofing (`src/cycletls-fetch.ts`)
  - Optional peer dependency; required only if using CycleTLS integration
  - Bypasses Cloudflare bot detection with Chrome-like TLS fingerprints
  - https-proxy-agent 7.0.2 - HTTPS proxy support (used with CycleTLS in tests)

**tslib 2.5.2** - TypeScript helper library for emitted code

## Configuration

**Environment:**
- `.env` files supported via dotenv (dev environment only)
- Environment variables used in tests: `TWITTER_PASSWORD`, `TWITTER_USERNAME`
- No public env config file; secrets managed externally

**Build:**
- TypeScript compiler: `tsconfig.json`
  - Extends @tsconfig/node16
  - Target: ES2021 with DOM library (for Node 16 compatibility)
  - Strict mode enabled
  - Source maps and declaration files generated
- Prettier config: `.prettierrc` (single quotes, trailing commas, semicolons)
- ESLint config: `.eslintrc.js` (TypeScript + Prettier integration)
- Jest config: `jest.config.js` (ts-jest preset with ESM support)
- Rollup config: `rollup.config.mjs` (multiple entry points and outputs)

## Distribution Outputs

The build system produces multiple distribution formats for different environments:

**Default (Browser/Universal):**
- CJS: `dist/default/cjs/index.js`
- ESM: `dist/default/esm/index.mjs`

**Node.js Optimized:**
- CJS: `dist/node/cjs/index.cjs`
- ESM: `dist/node/esm/index.mjs`

**CycleTLS (Node.js only):**
- CJS: `dist/cycletls/cjs/index.cjs`
- ESM: `dist/cycletls/esm/index.mjs`

**Type Definitions:**
- `dist/types/index.d.ts`
- `dist/cycletls/index.d.ts`

Entry point configured in `package.json` exports field with conditional exports based on environment.

## Platform Requirements

**Development:**
- Node.js >= 16.0.0
- Yarn 1.22.19
- Git (for Husky pre-commit hooks)

**Production:**
- Node.js >= 16.0.0
- No external services required (library only)

**Browser Usage:**
- Requires CORS proxy configuration for frontend applications
- Recommended proxies: corsproxy.io (works well), corsproxy.org (not recommended)

---

*Stack analysis: 2026-04-07*
