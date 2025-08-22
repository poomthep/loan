# Deploy Guide (Edge Function + Base/Spread)

## What’s inside
- `public/` : Frontend assets (with Base+Spread UI for MRR/MLR/MOR)
- `api/config.js` : Edge Function providing `/config.js` using runtime ENV (no secrets committed)
- `vercel.json` : Rewrite `/config.js` → `/api/config`
- `package.json` : No build step required

## Deploy (GitHub → Vercel)
1. Push this project to the GitHub repo that your Vercel project connects to.
2. In Vercel Project Settings → Environment Variables, set:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   (set for Production / Preview / Development as needed)
3. After deploy, open `https://<your-domain>/config.js` to verify it returns exported constants.

## Local (optional)
- Using Vercel CLI:
  ```bash
  vercel link
  vercel env pull .env.local
  vercel dev
  ```

## Notes
- Service Worker cache name bumped to force fresh assets for users.
