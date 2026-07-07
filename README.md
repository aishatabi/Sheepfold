# Sheepfold — deploy guide

A real, hosted version of the tracker with per-leader login and a shared live database.
Total cost: £0 (Supabase and Vercel free tiers cover this comfortably).

## 1. Create the database (Supabase) — 5 min

1. Go to supabase.com → Sign up → New project (any name, e.g. `sheep-seeking`).
2. Wait for it to finish provisioning (~2 min).
3. In the left sidebar: **SQL Editor** → New query → paste the entire contents of
   `supabase-schema.sql` from this folder → Run.
4. In the left sidebar: **Authentication → Providers** → make sure **Email** is enabled.
   Under **Authentication → URL Configuration**, you don't need to change anything yet —
   come back here after step 3 to add your live URL.
5. Also in **Authentication → Providers → Email**: turn **OFF "Allow new users to sign up"**.
   This is what makes you the administrator — nobody can create their own account;
   you add every leader yourself (see "Adding a Bacenta Leader" below).
6. In the left sidebar: **Project Settings → API**. Copy two values, you'll need them next:
   - **Project URL**
   - **anon public** key

## 2. Put the code on GitHub — 5 min

1. Go to github.com → New repository → name it `sheep-seeking-tracker` → Create.
2. Upload every file in this folder to that repo (drag-and-drop works fine on GitHub's
   web UI — use "Add file → Upload files").

## 3. Deploy (Vercel) — 5 min

1. Go to vercel.com → Sign up with GitHub → **New Project** → import `sheep-seeking-tracker`.
2. Before deploying, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → paste the Project URL from step 1.5
   - `VITE_SUPABASE_ANON_KEY` → paste the anon public key from step 1.5
3. Click **Deploy**. In ~1 minute you'll get a live URL like
   `sheep-seeking-tracker.vercel.app`.
4. Copy that URL. Back in Supabase → **Authentication → URL Configuration**, set
   **Site URL** to it (and add it under Redirect URLs too). This makes the sign-in
   email links point to your real app instead of localhost.

## 4. Try it

Open your Vercel URL, enter your email, and check your inbox for the sign-in link.
First time in, it'll ask your name — that's how you show up as a Bacenta Leader.
Every BL who signs in this way sees and edits the same live member list.

## Adding a Bacenta Leader (you're the administrator)

Nobody can create their own account — sign-ups are switched off. You add every
leader yourself:

1. Supabase dashboard → **Authentication → Users** → **Add user**.
2. Enter their email address.
3. Turn **Auto Confirm User** ON, then create.
4. That's it — no password needed. Tell them to open the app, enter that exact
   email, and tap "Send me a sign-in link." They'll get a magic-link email and
   be straight in. First time in, it'll ask their name once.

If someone who isn't added tries to sign in, they'll see "we couldn't find an
account for that email" — they're locked out until you add them.

To remove someone's access later: **Authentication → Users** → find them → **Delete user**.

## Day-to-day use

- **Take attendance** each Sunday from the Attendance tab — tap each member Present/Absent
  and hit save. The missed-service count (and Mild/Critical flags) are now calculated
  automatically from this, not typed in by hand.
- **Add members** individually from the Members tab, or use **Import** to bulk-add from
  a CSV (see `members-import-template.csv`).
- **Visitation Week**: set the date range each month from the banner at the top; the
  progress bar and BL accountability tab track against it automatically.
- Everything updates live — if one BL takes attendance or logs a visit, everyone else's
  screen updates within a couple of seconds.

## Already deployed before attendance tracking existed?

Run `migration-add-attendance.sql` in the Supabase SQL Editor (not the full
`supabase-schema.sql` again — that will error on things that already exist). Then
re-upload the updated `src/` files to your GitHub repo; Vercel redeploys automatically.

## If something breaks

Paste the error here (or the Vercel build log) and I'll fix it. If you'd rather someone
drive the terminal parts directly, Claude Code can do the GitHub push and Vercel CLI
deploy for you step by step.

## Custom domain (optional)

If First Love Beds has its own domain, add it under Vercel → your project →
**Settings → Domains** — free, takes a few minutes.
