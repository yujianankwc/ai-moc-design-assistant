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
