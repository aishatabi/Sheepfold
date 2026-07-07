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

## You're the administrator, BLs only see their own bacenta

After the initial setup, run one more script: **`migration-add-roles.sql`** in
Supabase's SQL Editor (same way as the schema — paste it all, Run). This adds:

- **Administrator** role — sees and edits everything, exactly like now
- **Bacenta Leader** role — only sees, adds, and edits members (and their
  attendance/visits) within their own bacenta

Then, two things:

1. **Make yourself admin.** At the bottom of `migration-add-roles.sql` there's
   one commented-out line — copy it out, replace the email with the one you
   sign into Sheepfold with, and run just that line by itself.
2. **Assign each BL's bacenta.** Sign into the app → a new **Team** tab appears
   in the bottom bar (only visible to admins). For each leader listed there,
   set their role (Administrator / Bacenta Leader) and type their bacenta name
   — it'll suggest names already used in Members.

Until a BL's bacenta is set, they'll see an empty app with a note asking them
to contact you. Once you set it, their data appears immediately.

## Adding a Bacenta Leader (you're the administrator)

Nobody can create their own account — sign-ups are switched off. You add every
leader yourself, and you set their password:

1. Supabase dashboard → **Authentication → Users** → **Add user**.
2. Enter their email address.
3. Enter a password for them (anything — e.g. `Sheepfold2026`). Turn
   **Auto Confirm User** ON, then create.
4. Tell them their email and password (WhatsApp, text, in person — whatever's
   easiest). They open the app, enter both, and tap **Sign in**. First time
   in, it'll ask their name once.

If someone gets their email or password wrong, they'll see "incorrect email
or password" — they're locked out until you help them.

To reset someone's password: **Authentication → Users** → find them → the
**⋯** menu → **Reset password**, or delete and re-add them with a new one.

To remove someone's access entirely: **Authentication → Users** → find them → **Delete user**.

## Exporting PDF reports

A new **Export** tab lets anyone download a PDF report for a chosen date range:

- **You (admin):** pick "Whole church" or any single bacenta
- **BLs:** always export their own bacenta only

Each report includes: a status summary (Critical/Mild/Lost/Weak/Struggling/Active
counts), the full member list, every visit logged in that date range, and
attendance for each service date in range. No setup needed — it just works
once you've redeployed with these files.

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
