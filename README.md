# Humor Project · Control Center

Admin area for [Humor Project](https://github.com/meifactor/humor-project), the app where
people upload photos, get AI-written captions from Gemini, and react 💀 😂 😬 🤨.
It uses the same Supabase database and Google sign-in.

- **Dashboard:** reaction mix over time, vibe showdown, hall of fame/shame, and community &
  AI health (top creators and reactors, busiest hours, which Gemini model wrote captions).
- **Media:** create (upload + Gemini), read, update (context, vibe, caption text) and delete
  AI-generated photos and captions.
- **Images:** upload, view, replace and delete photos in Supabase Storage.
- **Users:** read every account, with sign-up and sign-in dates and activity counts.
- **Ratings:** read every reaction, filterable by type.
- **Prompt chains:** read each chain and its steps; read/update the chain mix (how often each
  chain is picked). Captions are written by a chain such as "describe the photo → write captions".
- **Terms / AI generation examples:** create, read, update and delete the local terms and
  example captions that are mixed into every prompt.
- **LLM models / providers:** create, read, update and delete the models the pipeline tries
  (in priority order, with automatic fallback) and their providers.
- **Generation requests / LLM responses:** read every caption attempt and every AI call it
  made: prompt, response, model, latency and errors, plus per-model success rates.
- **Signup domains / whitelisted emails:** create, read, update and delete who may create an
  account in the main app. Enforced by a database trigger on `auth.users`.

## Who can get in

Every route is behind Google sign-in, and only accounts with `profiles.is_superadmin = true`
can see anything. The check happens at four levels:

1. `src/proxy.ts` sends signed-out visitors to `/login`.
2. Every admin page and Server Action calls `requireSuperadmin()` (`src/lib/admin.ts`);
   signed-in non-admins go to `/not-authorized`.
3. Row level security in the database: only superadmins can read everyone's reactions or
   create, edit and delete media (`supabase/admin.sql`).
4. Column privileges stop anyone from setting `is_superadmin` on themselves through the
   public API; users can only write their own name and photo columns.

### "Won't I be locked out?" — bootstrapping the first admin

`is_superadmin` defaults to false, and the API won't let anyone change it, so the app can
never make the first admin. Instead, use access the app doesn't depend on: the Supabase
dashboard's **SQL Editor** runs as the database owner, which bypasses RLS and column
privileges. Sign in to the main app once (so your profile exists), then run:

```sql
update public.profiles set is_superadmin = true
where id = (select id from auth.users where email = 'YOUR_EMAIL@gmail.com');
```

## Setup

1. Run `supabase/admin.sql` and then `supabase/observability.sql` in the Supabase SQL Editor
   (after the main app's SQL files), then the bootstrap query above.
2. Create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   GEMINI_API_KEY=...
   ```
   No service-role key is needed: admins act through their own session and RLS.
3. In Supabase → Authentication → URL Configuration, add this app's `/auth/callback` URLs
   to the Redirect URLs.
4. `npm install` and `npm run dev`.
