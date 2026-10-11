/* Paste the two values from Supabase: Project Settings -> API.
   The anon (public) key is safe to put here: the data is locked by the database rules in supabase/schema.sql. */
window.REE_CONFIG = {
  SUPABASE_URL: 'PASTE_YOUR_SUPABASE_URL',
  SUPABASE_ANON_KEY: 'PASTE_YOUR_SUPABASE_ANON_KEY',
  AI_ENABLED: false   // set true after adding ANTHROPIC_API_KEY in Vercel (turns on PDF -> flashcards)
};
