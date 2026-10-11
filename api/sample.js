// Vercel serverless function: PDF text -> flashcards, for signed-in approved members only.
// Needs env vars in Vercel: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
module.exports = async function (req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    var url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY, ak = process.env.ANTHROPIC_API_KEY;
    if (!url || !key || !ak) return res.status(500).json({ error: 'Server is not configured' });
    var auth = req.headers.authorization || '';
    var u = await fetch(url + '/auth/v1/user', { headers: { apikey: key, Authorization: auth } });
    if (!u.ok) return res.status(401).json({ error: 'Sign in first' });
    var user = await u.json();
    var m = await fetch(url + '/rest/v1/docs?select=data&path=eq.' + encodeURIComponent('roster/' + user.id), { headers: { apikey: key, Authorization: auth } });
    var rows = m.ok ? await m.json() : [];
    var p = await fetch(url + '/rest/v1/profiles?select=is_owner&id=eq.' + user.id, { headers: { apikey: key, Authorization: auth } });
    var pr = p.ok ? await p.json() : [];
    var ok = (rows[0] && rows[0].data && rows[0].data.status === 'member') || (pr[0] && pr[0].is_owner);
    if (!ok) return res.status(403).json({ error: 'Members only' });
    var body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    var prompt = String(body.prompt || '').slice(0, 40000);
    if (!prompt) return res.status(400).json({ error: 'Empty prompt' });
    var r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ak, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-haiku-5-5', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] })
    });
    var j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j && j.error && j.error.message) || 'AI error' });
    var text = (j.content || []).map(function (c) { return c.text || '' }).join('');
    res.status(200).json({ text: text });
  } catch (e) { res.status(500).json({ error: String(e && e.message || e) }) }
};
