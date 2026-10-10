# Operation REE 2027

A private study club web app for Electrical Engineering board exam review: flashcards (terms, formulas, problems) under EE, ESAS and MATH, timed problem solving, a daily 10, quiz battles, study insights, calendar, subjects checklist, chat, rankings, and owner-controlled membership.

- `index.html` is the whole app (single file, no build step).
- `offline-template.html` is the template the app uses to export a deck as a standalone offline file.

The app was built to run as a Claude Artifact, which provides the database, user identity, PDF-to-cards sampling and file downloads (`window.claude.use('db' | 'user' | 'sample' | 'downloads')`). Opened elsewhere (for example from GitHub Pages) it renders, but shared data, sign-in and quiz battles will not work without those capabilities.
