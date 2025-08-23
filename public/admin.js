// admin.js (nav hidden until login)
import { supabase } from './supabase-client.js';
import { scheduleSessionRefresh, setupVisibilityHandlers } from './session-guard.js';

const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
function on(target, event, handler, options){ const el=(typeof target==='string')?$(target):target; if(!el) return false; el.addEventListener(event,handler,options); return true; }

function DOM(){
  return {
    views: { gate: $('#gate'), app: $('#app') },
    toast: $('#toast'),
    loginForm: $('#login-form'),
    loginBtn: $('#login-btn'),
    logoutBtn: $('#logout-btn'),
    promotionForm: $('#promotion-form'),
    promotionsTableBody: $('#promotions-table tbody'),
    saveBtn: $('#save-btn'),
    clearBtn: $('#clear-btn'),
    bankSelect: $('#bank_id'),
    ratesContainer: $('#interest-rates-container'),
    addRateYearBtn: $('#add-rate-year-btn'),
    confirmModal: $('#confirm-modal'),
    modalText: $('#modal-text'),
    modalConfirmBtn: $('#modal-confirm-btn'),
    modalCancelBtn: $('#modal-cancel-btn'),
  };
}

let state = { isEditing:false, editingId:null, banks:[], promotions:[] };
let appBooted = false;

const N = (v)=> (v===''||v==null||isNaN(parseFloat(v)))?null:parseFloat(v);
const D = (v)=> (v===''||v==null)?null:v;

const showToast=(m,err=false)=>{ const t=DOM().toast; if(!t) return; t.textContent=m; t.className=err?'error':''; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); };
const setAuthed=(flag)=> document.body.classList.toggle('authed', !!flag);
const showView=(name)=>{ const v=DOM().views; Object.values(v).forEach(x=>x&&x.classList.remove('active')); v[name]&&v[name].classList.add('active'); };

async function fetchBanks(){ const { bankSelect }=DOM(); const r=await supabase.from('banks').select('id,name').order('name'); if(r.error){showToast('โหลดธนาคารไม่สำเร็จ',true);return;} state.banks=r.data||[]; if(!bankSelect) return; bankSelect.innerHTML='<option value="" disabled selected>-- เลือกธนาคาร --</option>'; state.banks.forEach(b=>{ const op=document.createElement('option'); op.value=b.id; op.textContent=b.name; bankSelect.appendChild(op); }); }
async function fetchPromotions(){ const r=await supabase.from('promotions').select('*, banks(name)').order('created_at',{ascending:false}); if(r.error){showToast('โหลดโปรโมชันไม่สำเร็จ',true);return;} state.promotions=r.data||[]; renderPromotionsTable(state.promotions); }

function renderInterestRateInputs(rates=[null,null,null,'']){ const {ratesContainer}=DOM(); if(!ratesContainer) return; ratesContainer.innerHTML=''; rates.forEach((rate,i)=>{ const y=i+1; const last=i===rates.length-1; const row=document.createElement('div'); row.className='rate-year-row'; row.dataset.year=y; const label= last?`ปีที่ ${y} เป็นต้นไป:`:`ปีที่ ${y} (%):`; const input= last?`<input type="text" class="rate-input" placeholder="เช่น MRR-1.50" value="${rate??''}">`:`<input type="number" step="0.01" class="rate-input" placeholder="เช่น 3.25" value="${rate??''}">`; row.innerHTML=`<label>${label}</label>${input}`; ratesContainer.appendChild(row); }); }

function renderPromotionsTable(list){ const tb=DOM().promotionsTableBody; if(!tb) return; tb.innerHTML=''; if(!list||!list.length){ tb.innerHTML='<tr><td colspan="4" style="text-align:center;">ยังไม่มีข้อมูล</td></tr>'; return;} list.forEach(p=>{ const rates=(p.interest_rates||[]).slice(0,3).map(r=>typeof r==='number'?r:N(r)).filter(r=>r!=null); const avg=rates.length? (rates.reduce((a,b)=>a+b,0)/rates.length).toFixed(2):'N/A'; const tr=document.createElement('tr'); tr.innerHTML=`<td>${p.banks?.name||'N/A'}</td><td class="promo-name">${p.promotion_name}<small>${p.loan_type}</small></td><td>${avg}</td><td><button class="btn btn-sm edit-btn" data-id="${p.id}">แก้ไข</button> <button class="btn btn-sm" data-del="${p.id}">ลบ</button></td>`; tb.appendChild(tr); }); }

async function isAdminAuthenticated(session){
  try{
    if(!session) throw new Error('No active session provided.');
    const uid=session.user.id;
    const { data:profile, error }=await supabase.from('profiles').select('role,status').eq('id',uid).single();
    if(error) throw error;
    if(!profile || profile.role!=='admin' || profile.status!=='approved') throw new Error('Access Denied.');
    return true;
  }catch(e){
    console.warn('[AUTH] Admin check failed:', e.message);
    await supabase.auth.signOut();
    return false;
  }
}

async function boot(session){
  console.log('[BOOT] Initializing...');
  if(await isAdminAuthenticated(session)){
    setAuthed(true);
    showView('app');
    await fetchBanks();
    await fetchPromotions();
  }else{
    setAuthed(false);
    showView('gate');
  }
}

async function handleFormSubmit(e){
  e.preventDefault();
  const {promotionForm, ratesContainer, saveBtn}=DOM();
  if(saveBtn) saveBtn.disabled=true;
  try{
    const { data:{ session } }=await supabase.auth.getSession();
    if(!await isAdminAuthenticated(session)){ showToast('Session ไม่ถูกต้อง, กรุณาล็อกอินใหม่', true); setTimeout(()=>location.reload(),1500); return; }
    const fd=new FormData(promotionForm||document.createElement('form'));
    const promo={};
    ['bank_id','promotion_name','loan_type','start_date','end_date'].forEach(k=> promo[k]=fd.get(k)||null);
    const inputs= ratesContainer? ratesContainer.querySelectorAll('.rate-input'):[];
    promo.interest_rates= Array.from(inputs).map(inp=> inp.type==='number'?N(inp.value): (inp.value||null)).filter(v=>v!==null);
    const op= state.isEditing? supabase.from('promotions').update(promo).eq('id',state.editingId): supabase.from('promotions').insert([promo]);
    const { error }=await op; if(error) throw error;
    showToast(state.isEditing?'แก้ไขสำเร็จ':'เพิ่มโปรโมชันสำเร็จ');
    state.isEditing=false; state.editingId=null;
    renderInterestRateInputs(); (DOM().promotionForm||{}).reset?.(); await fetchPromotions();
  }catch(err){ console.error(err); showToast('เกิดข้อผิดพลาด: '+err.message,true); }
  finally{ if(saveBtn) saveBtn.disabled=false; }
}

function setupEventListeners(){
  const { loginForm, loginBtn, logoutBtn, clearBtn, promotionForm, addRateYearBtn }=DOM();
  on(loginForm,'submit', async (e)=>{
    e.preventDefault();
    if(loginBtn){ loginBtn.disabled=true; loginBtn.textContent='กำลังเข้าสู่ระบบ...'; }
    const email= loginForm?.email?.value, password= loginForm?.password?.value;
    const { error }= await supabase.auth.signInWithPassword({ email, password });
    if(error) showToast(error.message, true);
    if(loginBtn){ loginBtn.disabled=false; loginBtn.textContent='เข้าสู่ระบบ'; }
  });
  on(logoutBtn,'click', ()=> supabase.auth.signOut());
  on(clearBtn,'click', ()=>{ (DOM().promotionForm||{}).reset?.(); renderInterestRateInputs(); });
  on(promotionForm,'submit', handleFormSubmit);

  on(addRateYearBtn,'click', ()=>{
    const c=DOM().ratesContainer; if(!c) return;
    const inputs=Array.from(c.querySelectorAll('.rate-input'));
    const current=inputs.map(inp=> inp.type==='number'?N(inp.value): (inp.value||null));
    const last=current.pop(); current.push(null); current.push(last);
    renderInterestRateInputs(current);
  });

  supabase.auth.onAuthStateChange((event, session)=>{
    console.log(`[AUTH] Event: ${event}, Session available:`, !!session);
    scheduleSessionRefresh(session);
    if(event==='SIGNED_IN'){ setAuthed(true); if(!appBooted){ appBooted=true; boot(session); } }
    else if(event==='SIGNED_OUT'){ setAuthed(false); appBooted=false; showView('gate'); showToast('ออกจากระบบแล้ว'); }
  });
}

document.addEventListener('DOMContentLoaded', async ()=>{
  setupEventListeners();
  setupVisibilityHandlers();
  renderInterestRateInputs();
  const { data:{ session } }= await supabase.auth.getSession();
  setAuthed(!!session);
  boot(session);
});
