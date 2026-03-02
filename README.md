# AI MOC Design Assistant

Minimal MVP scaffold built with Next.js App Router, TypeScript, and Tailwind CSS.

## Run locally

```bash
npm install
npm run dev
```

## MVP database setup (step 7)

1. Create a Supabase project.
2. Run SQL in:
   - `supabase/migrations/0001_mvp_users_projects.sql`
   - `supabase/migrations/0002_mvp_project_outputs.sql`
   - `supabase/migrations/0003_mvp_service_requests.sql`
   - `supabase/migrations/0004_projects_status_closure.sql`
3. Copy `.env.example` to `.env.local` and fill:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AI_API_KEY`
   - `AI_MODEL`
   - `AI_BASE_URL` (optional, defaults to OpenAI API)
   - `AI_IMAGE_MODEL` (optional, defaults to `AI_MODEL`, used for quick preview image generation)
   - `AI_IMAGE_SIZE` (optional, default `2048x2048`; required by some image models)
   - `SCENIC_5A_CSV_PATH` (optional, path to 5A scenic dataset csv; used to anchor scenic idea generation)

## Scenic knowledge dataset (optional but recommended)

For scenic-spot idea generation quality, provide a CSV file where each attraction line follows:

```text
景区名 | 地址 | 简介
```

Recommended location: `data/scenic-5a.csv`, or set `SCENIC_5A_CSV_PATH` in `.env.local`.

Import helper:

```bash
npm run import:scenic-5a
```

Or with custom source path:

```bash
npm run import:scenic-5a -- "/absolute/path/to/your.csv"
```
