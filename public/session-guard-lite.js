// session-guard-lite.js: redirect to /admin.html if not signed-in
import { supabase } from './supabase-client.js';
async function ensure(){ const { data: { session } } = await supabase.auth.getSession(); if (!session) { location.replace('/admin.html'); return; } }
ensure();
supabase.auth.onAuthStateChange((_event, session)=>{ if (!session) location.replace('/admin.html'); });
