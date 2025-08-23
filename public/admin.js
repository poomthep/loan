
import { supabase } from './supabase-client.js';

const $ = (s, r=document)=> r.querySelector(s);
const on = (el, ev, fn)=> el && el.addEventListener(ev, fn);

const views = { gate: $('#gate'), app: $('#app') };
const setAuthed = (flag)=> document.body.classList.toggle('authed', !!flag);
const showView = (name)=> {
  Object.values(views).forEach(v=> v && v.classList.remove('active'));
  views[name]?.classList.add('active');
};

async function isAdminAuthenticated(session){
  try{
    if(!session) throw new Error('No active session');
    const uid = session.user.id;
    const { data: profile, error } = await supabase.from('profiles').select('role,status').eq('id', uid).single();
    if(error) throw error;
    if(!profile || profile.role!=='admin' || profile.status!=='approved') throw new Error('Access denied');
    return true;
  }catch(e){
    console.warn('[AUTH] Admin check failed:', e.message);
    await supabase.auth.signOut();
    return false;
  }
}

async function boot(session){
  if(await isAdminAuthenticated(session)){
    setAuthed(true);
    showView('app');
    // fetch initial data here if needed
  } else {
    setAuthed(false);
    showView('gate');
  }
}

function setupEvents(){
  const loginForm = $('#login-form');
  const loginBtn = $('#login-btn');
  const logoutBtn = $('#logout-btn');

  on(loginForm, 'submit', async (e)=>{
    e.preventDefault();
    if (loginBtn) loginBtn.disabled = true;
    const email = loginForm.email.value;
    const password = loginForm.password.value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if(error){ alert(error.message); if (loginBtn) loginBtn.disabled=false; }
  });

  on(logoutBtn, 'click', ()=> supabase.auth.signOut());

  supabase.auth.onAuthStateChange(async (ev, session)=>{
    console.log(`[AUTH] Event: ${ev}, Session available:`, !!session);
    if(ev==='SIGNED_IN'){ await boot(session); }
    if(ev==='SIGNED_OUT'){ setAuthed(false); showView('gate'); }
  });
}

document.addEventListener('DOMContentLoaded', async ()=>{
  setupEvents();
  const { data:{ session } } = await supabase.auth.getSession();
  setAuthed(!!session);
  await boot(session);
});
