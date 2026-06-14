# Deployment (planned)

- **Static viewer (HTML/JS/CSS):** GitHub Pages from `gh-pages`
  branch, served from a custom domain if configured.
- **DZI tile pyramid:** Cloudflare R2 bucket `isometric-berlin`,
  served behind a worker that adds cache headers.

For the Regierungsviertel MVP the DZI pyramid will be small enough
(low hundreds of source tiles → a few thousand pyramid tiles at all
zoom levels) that even direct GitHub Pages hosting is realistic.
