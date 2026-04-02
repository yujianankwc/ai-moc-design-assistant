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
   - `supabase/migrations/0007_intent_quote_mvp.sql`
   - `supabase/migrations/0009_showcase_interactions.sql`
   - `supabase/migrations/0010_service_requests_status_flow.sql`
   - `supabase/migrations/0011_intent_orders_delivery_status_flow.sql`
3. Copy `.env.example` to `.env.local` and fill:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_API_TOKEN` (optional, required only when you want to protect `/api/admin/*` intent/quote endpoints)
   - `AI_API_KEY`
   - `AI_IMAGE_API_KEY` (optional, defaults to `AI_API_KEY`; use dedicated image provider key if needed)
   - `AI_MODEL`
   - `AI_BASE_URL` (optional, defaults to OpenAI API)
   - `AI_IMAGE_BASE_URL` (optional, defaults to `AI_BASE_URL`; use this when image provider endpoint differs)
   - `AI_IMAGE_ENDPOINT` (optional; full image generation endpoint, e.g. when provider is not `/images/generations`)
   - `AI_IMAGE_MODEL` (optional, defaults to `AI_MODEL`, used for quick preview image generation)
   - `AI_IMAGE_API_KEY_NANO_BANNER` (optional; dedicated key for nano-banner provider)
   - `AI_IMAGE_BASE_URL_NANO_BANNER` (optional; dedicated base URL for nano-banner provider)
   - `AI_IMAGE_ENDPOINT_NANO_BANNER` (optional; full endpoint override for nano-banner provider)
   - `AI_IMAGE_MODEL_NANO_BANNER` (optional; legacy nano alias model ID for quick switching)
   - `AI_IMAGE_API_KEY_NANO_BANANA` (optional; dedicated key for nano-banana provider)
   - `AI_IMAGE_BASE_URL_NANO_BANANA` (optional; dedicated base URL for nano-banana provider)
   - `AI_IMAGE_ENDPOINT_NANO_BANANA` (optional; full endpoint override for nano-banana provider)
   - `AI_IMAGE_MODEL_NANO_BANANA` (optional; nano-banana model ID for quick switching)
   - `AI_IMAGE_DEFAULT_ALIAS` (optional, `default` / `nano_banner` / `nano_banana`; controls default image model selection)
   - `AI_IMAGE_SIZE` (optional, default `2048x2048`; required by some image models)
   - `SCENIC_5A_CSV_PATH` (optional, path to 5A scenic dataset csv; used to anchor scenic idea generation)

## Intent / Quote admin console (MVP)

1. Ensure migrations `0007_intent_quote_mvp.sql` and `0011_intent_orders_delivery_status_flow.sql` are applied.
2. If you set `ADMIN_API_TOKEN` in `.env.local`, keep it handy.
3. Open `/admin/intents` locally.
4. Paste token in page input and click `保存 Token`.
5. You can now:
   - Query intents by status/source/keyword
   - Open detail
   - Update intent status
   - Append followups
   - Create draft quote sheets

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
