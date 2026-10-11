# Operation REE 2027

Private study club for the EE board exam: decks (terms / formulas / problems), quizzes, Daily 10, quiz battles, chat, calendar, rankings.

Two ways to run it from the same code:

- **Claude artifact** – `app.html` is published as the artifact (uses Claude's built-in database and sign-in).
- **Vercel + Supabase** – `index.html` (generated) + `claude-shim.js` + `config.js` + `supabase/schema.sql` + `api/sample.js`.

Edit `app.html`, then run `python3 build.py` to regenerate `index.html`.

## Supabase setup
1. Create a free project at supabase.com.
2. SQL Editor -> paste `supabase/schema.sql` (owner email is on the `insert into app_config` line) -> Run.
3. Authentication -> Providers -> Email: turn **Confirm email OFF** (otherwise the free email limit blocks sign-ups).
4. Project Settings -> API: copy the Project URL and the anon public key into `config.js`.
5. Deploy on Vercel. **Sign up with the owner email first**, before sharing the link: that account becomes the owner.
6. Optional PDF -> flashcards: add `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` in Vercel env vars and set `AI_ENABLED: true` in `config.js`.
