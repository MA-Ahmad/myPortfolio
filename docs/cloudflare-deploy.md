# Deploying to Cloudflare Workers

The site runs on Cloudflare Workers through the OpenNext adapter (`@opennextjs/cloudflare`).
`opennextjs-cloudflare build` runs `pnpm build` (`next build`) and turns `.next/` into a Worker in
`.open-next/`: `worker.js` plus the static files in `.open-next/assets`. Config lives in
`wrangler.jsonc` (bindings) and `open-next.config.ts` (caching).

The Theme Studio presence relay in `workers/presence/` is a separate Worker with its own
`wrangler.jsonc`, login and deploy (`pnpm deploy` there). Nothing here changes it.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next dev server, as before (no Worker involved) |
| `pnpm cf:build` | `next build` + OpenNext build into `.open-next/` |
| `pnpm cf:preview` | Build, then serve the Worker locally in workerd at http://localhost:8787, with a local R2 bucket and Images binding (`.wrangler/state`) |
| `pnpm cf:login` / `pnpm cf:whoami` | Log in to Cloudflare. The login is stored in `.cloudflare/` in this repo (gitignored), like the presence worker's |
| `pnpm cf:deploy` | Build, upload the prerendered pages to the R2 cache, and deploy the Worker |

## One-time setup in Cloudflare

1. **Log in**: `pnpm cf:login`.
2. **R2 bucket for the ISR cache.** Create it once:

   ```bash
   XDG_CONFIG_HOME=.cloudflare pnpm wrangler r2 bucket create myportfolio-opennext-cache
   ```

   The name must match `r2_buckets[0].bucket_name` in `wrangler.jsonc`. To use another name,
   change it there; the binding name `NEXT_INC_CACHE_R2_BUCKET` is fixed by OpenNext. R2 needs to
   be enabled on the account (Dashboard → R2, free tier: 10 GB storage).
3. **Images.** The `IMAGES` binding (Cloudflare Images transformations) serves `next/image`
   (`/_next/image`), which resizes blog covers from the Dev.to hosts in `images.remotePatterns`
   (`next.config.js`). It needs no resource to create. Transformations are billed per unique
   transformation after the free monthly allowance (Dashboard → Images). Without the binding, the
   Worker returns the original image unresized.
4. **Worker name.** `name` in `wrangler.jsonc` is `myportfolio`. The `WORKER_SELF_REFERENCE`
   service binding must name the same Worker. Change both together if you rename it. The first
   `pnpm cf:deploy` creates the Worker.
5. **Environment variables** (below).
6. **Custom domain.** Dashboard → Workers & Pages → `myportfolio` → Settings → Domains & Routes →
   Add → Custom domain, `mahmad.me` (the zone has to be on Cloudflare DNS; Cloudflare creates the
   DNS record). Remove the domain from Vercel and cut DNS over only once the Worker answers
   correctly on its `*.workers.dev` URL.

Then deploy with `pnpm cf:deploy`.

## Environment variables

| Variable | Read when | Where to set it |
| --- | --- | --- |
| `NEXT_PUBLIC_PRESENCE_URL` | Build only: inlined into the client bundle | The build environment: your shell or `.env.local` for `pnpm cf:deploy`, or the Workers Builds build variables |
| `GA_TRACKING_ID` | Build only: inlined through `env` in `next.config.js` | Same as above |
| `DEVTO_USERNAME` | Build (prerender) **and** runtime (ISR re-renders and unknown blog slugs on the Worker) | Build environment **and** the Worker's variables (Dashboard → Worker → Settings → Variables and Secrets, as text) |
| `MICROSOFT_CLARITY` | Build **and** runtime (read while rendering the document) | Build environment **and** the Worker's variables |

`wrangler.jsonc` sets `keep_vars: true`, so deploys keep the Worker variables set in the
dashboard. For `pnpm cf:preview`, put runtime values in `.dev.vars` (gitignored), for example
`DEVTO_USERNAME=...`.

## Analytics

`@vercel/analytics` only works on Vercel and has been removed. Google Analytics and Microsoft
Clarity are unchanged. If you want a Vercel-style, cookie-free page view counter, **Cloudflare Web
Analytics** can be turned on for the custom domain in the dashboard (Analytics & Logs → Web
Analytics), with no code change for a proxied zone. That isn't enabled here.

## Branch previews (optional): Workers Builds

Dashboard → `myportfolio` → Settings → Build → Connect to the GitHub repo:

- Build command: `pnpm cf:build`
- Deploy command (production branch `main`): `pnpm exec opennextjs-cloudflare deploy`
- Non-production branch deploy command: `pnpm exec opennextjs-cloudflare upload` (uploads a
  version with a preview URL without promoting it)
- Build variables: `NEXT_PUBLIC_PRESENCE_URL`, `GA_TRACKING_ID`, `DEVTO_USERNAME`,
  `MICROSOFT_CLARITY`, and `NODE_VERSION=22` (`scripts/generate-content.mjs` needs Node 22.18 or
  newer)

Preview versions share the production R2 cache bucket.

## How the Worker differs from `next start`

- **No project filesystem at runtime.** `scripts/generate-content.mjs` (run by `pnpm dev`, `build`
  and `typecheck`) turns the local posts, the block source files and a full Prism into modules in
  `lib/generated/` (gitignored). Code that used to read `data/posts` or `blocks/` at request or ISR
  time imports those instead. Restart `pnpm dev` after adding or editing a post or a block file.
- **Blog code highlighting** uses `lib/remark-prism.ts`, a port of `remark-prism` without
  jsdom, `vm` or `fs`, none of which a Worker has. Its output is byte-identical to `remark-prism`.
- **ISR**: pages with `revalidate` are cached in R2. A stale page is served while the Worker
  re-renders it in the background, through the `WORKER_SELF_REFERENCE` binding (OpenNext's memory
  queue). The cache is per deploy: `cf:deploy` uploads the freshly prerendered pages.
- **Compression** is done by Cloudflare's edge, so responses don't carry Next's own
  `Vary: Accept-Encoding`. `Vary: Accept` on `/` is kept.
- **`keep_names: false`** in `wrangler.jsonc`: wrangler's esbuild would otherwise put `__name()`
  calls into functions that the server inlines as scripts via `toString()` (next-themes), which
  breaks the theme script on every page the Worker renders.

## Limits

The Worker must stay under **3 MiB gzip on the Workers Free plan** and **10 MiB on Workers Paid**.
Check the size without deploying:

```bash
pnpm cf:build && pnpm wrangler deploy --dry-run --outdir /tmp/worker-dry-run
# Total Upload: 11810.11 KiB / gzip: 2824.52 KiB   (November 2026)
```

That leaves about 250 KiB of headroom on the free plan. The biggest additions of this migration
are the bundled block sources (~220 KiB gzip, in two server chunks) and the full Prism (~220 KiB
gzip). If the Worker outgrows the free plan, upgrade to Workers Paid ($5/month) or trim those.

## Versions

`@opennextjs/cloudflare` 1.20.16+ requires Next.js 16.4.5 or newer (the Nov 3, 2026 Next.js
security release), so this migration moved Next from 16.3.8 to 16.4.6. Keep `next` at or above
the adapter's floor when upgrading either one.
