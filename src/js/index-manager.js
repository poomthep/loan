import { supabase } from "../config/supabaseClient.js";

async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.href = "/loan.html";
  }
}

async function login(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) alert(error.message);
  else window.location.href = "/loan.html";
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  checkSession();
});
