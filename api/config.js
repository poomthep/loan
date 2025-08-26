export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const cfg = {
      SUPABASE_URL: process.env.SUPABASE_URL || "",
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ""
    };
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: "Missing environment variables SUPABASE_URL / SUPABASE_ANON_KEY" });
    }
    return res.status(200).json(cfg);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}