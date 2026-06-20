# bookfinder-alert

Watches books on bookfinder.com **and** viaLibri.net, alerts via Discord webhook when the lowest price across either source drops below a threshold.

## Setup

1. `cp .env.example .env`
2. `npm install`
3. `npm run hash-password -- 'your-password'` → paste output into `AUTH_PASSWORD_HASH` in `.env`
4. Set `SESSION_SECRET` (any random string) and `DISCORD_WEBHOOK_URL` in `.env`
5. `npm start` (local) or `docker compose up -d --build` (Docker)

## Notes

- bookfinder.com sits behind an AWS WAF JS challenge — plain HTTP requests get blocked. Scraping uses Playwright (headless Chromium) to pass the challenge. Docker image is `node:20-slim` + `playwright install --with-deps chromium` (chromium only, not the full multi-browser Playwright image — keeps the image ~550MB instead of ~2.8GB).
- bookfinder URL is built deterministically from author/title/isbn (`viewAll=true` skips its edition-disambiguation page). viaLibri has no such param-based URL — its search results are server-signed (`&s=...`), so its URL is only known after Playwright actually drives the form; it has no dedicated ISBN field either, so ISBN searches go through its free-text field. Both sources' result links are shown per-book in the UI so you can verify what's being matched.
- Each check cycle queries both sources per book and takes the lower price; the Discord alert names which source had it.
- Price check: every 6h via cron (`CHECK_INTERVAL_CRON` in `.env`), or on-demand via "Check now" in the UI.
- Alert logic: fires once when the lowest price drops below threshold; re-fires only if price drops further, or after it recovers above threshold and drops again.
- Data stored in `data/books.json` (gitignored, volume-mounted in Docker).
