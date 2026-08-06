# Project Identity

`project.identity.json` is the non-secret source of truth for this repository.

It pins:
- canonical site URLs and allowed auth callback origins
- Supabase project ref and URL
- Cloudflare account, worker names, R2 bucket names, and CDN URL
- Vercel project IDs
- canonical GitHub owner/repo/remote
- forbidden legacy identifiers that must not reappear

Rules:
- Never store secrets in `project.identity.json`.
- Update this file first when the project identity changes.
- Run `npm run identity:validate` before auth, deploy, or config changes.
- Prefer importing the shared helpers instead of hardcoding domains, refs, worker names, or bucket names.

Main files:
- `project.identity.json`
- `project.identity.schema.json`
- `src/lib/project/identity.ts`
- `scripts/lib/project-identity.mjs`
- `scripts/validate-project-identity.mjs`
