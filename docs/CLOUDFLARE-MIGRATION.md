# Sri Palani Textiles — Vercel → Cloudflare Workers (OpenNext)

Production hosting is **Cloudflare Workers** via `@opennextjs/cloudflare`. Vercel is **deprecated** for this project.

## Strict comparison

| Area | Vercel (old) | Cloudflare Workers (current) | Industry standard |
|------|----------------|------------------------------|-------------------|
| **Next.js runtime** | Vercel Fluid / Node serverless | OpenNext on Workers (`nodejs_compat`) | Edge-first OpenNext or vinext |
| **Static assets** | Vercel CDN | Workers Assets binding (`run_worker_first: false`) | CDN + origin separation |
| **ISR / cache** | Vercel cache | R2 incremental cache + DO queue | External cache (R2/KV) required on CF |
| **Media uploads** | App + R2 proxy | R2 in-bucket **promote** (no bytes through app) | Direct-to-storage + server-side copy |
| **Database** | Supabase pooler `:6543` | Same Supabase (unchanged) | Managed Postgres + pooler |
| **Cron** | Vercel cron / external | GitHub Actions → `/api/cron/*` + `CRON_SECRET` | Scheduled HTTP or Workers cron |
| **Custom domain** | Vercel DNS | Cloudflare **Custom Domain** on Worker | CF Custom Domain or route |
| **Security headers** | `vercel.json` | `next.config.mjs` + `security-headers.mjs` | App-level headers |
| **Deploy command** | `vercel deploy` | `npm run deploy` | `wrangler deploy` / CI |
| **Preview URLs** | `*.vercel.app` | `*.workers.dev` (redirects to shop domain) | Platform preview subdomain |

## Why Cloudflare for SPT

1. **R2 + Worker already own media** — promote path is industry-standard and faster than SSR/Vercel re-upload.
2. **Single vendor** — app, CDN, cache bucket, media proxy on one account (`aaa80267f9d75b8a485ef7139a1e9256`).
3. **OpenNext ISR bindings** — `MEDIA_BUCKET`, `NEXT_INC_CACHE_R2_BUCKET`, `NEXT_CACHE_DO_QUEUE` prevent Error 1102 CPU storms.
4. **No Vercel Fluid CPU limits** on admin uploads when promote path is used.

## Architecture (production)

```
Browser → sripalanitextiles.com (CF Custom Domain)
       → Worker: sri-palani-textiles (.open-next/worker.js)
       → R2 assets / ISR cache / DO queue
       → Supabase (xsatfugvvorelzeyyzwp, ap-south-1 pooler :6543)

Media PUT → media.sripalanitextiles.com (spt-media worker) → R2 spt-cdn
```

## Deploy (local or CI)

```bash
npm run identity:validate
npm run validate:wrangler
npm test
npm run deploy   # opennextjs-cloudflare build + wrangler deploy
```

**Required:** Wrangler logged in (`npx wrangler login` as `sripalanitextilesonline@gmail.com`) or `CLOUDFLARE_API_TOKEN` in CI.

**GitHub Actions secrets (repo → Settings → Secrets):**
- `CLOUDFLARE_API_TOKEN` — SPT account Workers + R2 deploy
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — build-time GraphQL client key
- `CRON_SECRET` — warm/nightly cron callers

**Worker secrets:** Set all production env vars in Cloudflare dashboard → Workers → sri-palani-textiles → Settings → Variables and Secrets (mirror `.env.local` production values; never commit them).

## DNS cutover (one-time)

1. Deploy Worker with custom domains (wrangler `routes` + `custom_domain: true`).
2. In Cloudflare dashboard → Worker → Domains: confirm `sripalanitextiles.com` + `www`.
3. Remove Vercel domain assignment (or leave DNS until CF custom domain is live).
4. Verify: `curl -I https://sripalanitextiles.com/api/health?deep=0`
5. Update Cashfree/PhonePe webhook URLs if they pointed at `*.vercel.app` (should use canonical domain).

## Validation checklist

- [ ] `npm run identity:validate`
- [ ] `npm run validate:wrangler`
- [ ] `npm test` + `npx tsc --noEmit`
- [ ] `npm run deploy` succeeds
- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] Admin product upload → `promoted: true` in complete response
- [ ] Checkout Cashfree/PhonePe redirect + webhook
- [ ] `www` and apex serve same shop; `*.workers.dev` redirects to canonical

## References

- [OpenNext on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- SPT OpenNext config: `open-next.config.ts`
- Wrangler production config: `wrangler.workers.new-account.jsonc`
