/*! admin-manager-supabase.module.js (ESM, ES5-compatible)
 * Admin Console – Loan App
 * ต้องมี window.supabase (จาก supabase-init.js) โหลดก่อน
 */
function sbClient() {
  var sb = typeof window !== 'undefined' && window.supabase;
  if (!sb || typeof sb.from !== 'function') {
    throw new Error('Supabase client not initialized');
  }
  return sb;
}

function log(){ try{ console.log.apply(console, arguments);}catch(e){} }
function warn(){ try{ console.warn.apply(console, arguments);}catch(e){} }
function err(){ try{ console.error.apply(console, arguments);}catch(e){} }
function toNumber(v, def){ if(v===null||v===undefined||v==='')return def||0; var n=Number(v); return isNaN(n)?(def||0):n; }
function val(el){ return el && 'value' in el ? el.value : ''; }

var PROMO_TABLE = 'promotions';  // <-- ชื่อจริงของตารางโปรโมชัน
var BANKS_TABLE = 'banks';

var AdminManager = {
  _cache: { banks: null, promos: null },
  _ui: {
    bankSelect:null, productSelect:null, titleInput:null, detailInput:null,
    bpsInput:null, fixedRateInput:null, firstMonthInput:null, yearRateInput:null,
    gridTbody:null, form:null, saveBtn:null, deleteBtn:null, filterInput:null
  },

  // ================= INIT =================
  init: function () {
    try {
      this._mapUI();
      this._bindUI();

      var self = this;
      this.loadBanks()
        .then(function(){ return self.loadPromotions(); })
        .then(function(){ self.renderGrid(); log('[Admin] Ready'); })
        .catch(function(e){ err('[Admin] init failed:', e); });
    } catch(e){ err('[Admin] init error:', e); }
  },

  _mapUI: function(){
    var $ = function(sel){ return document.querySelector(sel); };
    this._ui.bankSelect      = $('#admin-bank-select') || $('[name="bank_id"]');
    this._ui.productSelect   = $('#admin-product-select') || $('[name="product_type"]');
    this._ui.titleInput      = $('#admin-title') || $('[name="title"]');
    this._ui.detailInput     = $('#admin-detail') || $('[name="detail"]');
    this._ui.bpsInput        = $('#admin-bps') || $('[name="bps_discount"]');
    this._ui.fixedRateInput  = $('#admin-fixed') || $('[name="fixed_rate"]');
    this._ui.firstMonthInput = $('#admin-first-month') || $('[name="first_month"]');
    this._ui.yearRateInput   = $('#admin-year-rate') || $('[name="year_rate"]');
    this._ui.gridTbody       = document.querySelector('#admin-promotions-table tbody');
    this._ui.form            = document.querySelector('#admin-promo-form') || document.querySelector('form#admin-form');
    this._ui.saveBtn         = document.getElementById('btn-admin-save');
    this._ui.deleteBtn       = document.getElementById('btn-admin-delete');
    this._ui.filterInput     = document.getElementById('admin-filter');
  },

  _bindUI: function(){
    var self = this;

    if(this._ui.form){
      this._ui.form.addEventListener('submit', function(e){
        e.preventDefault();
        self.saveCurrent().then(function(ok){
          if(ok){
            self.resetForm();
            self.loadPromotions().then(function(){ self.renderGrid(); });
          }
        });
      });
    }

    if(this._ui.deleteBtn){
      this._ui.deleteBtn.addEventListener('click', function(e){
        e.preventDefault();
        var id = self._ui.form ? self._ui.form.getAttribute('data-id') : '';
        if(!id){ alert('ยังไม่ได้เลือกโปรโมชันที่จะลบ'); return; }
        if(!confirm('ลบโปรโมชันนี้?')) return;
        self.deletePromotion(id).then(function(ok){
          if(ok){
            self.resetForm();
            self.loadPromotions().then(function(){ self.renderGrid(); });
          }
        });
      });
    }

    if(this._ui.filterInput){
      this._ui.filterInput.addEventListener('input', function(){ self.renderGrid(); });
    }

    if(this._ui.gridTbody){
      this._ui.gridTbody.addEventListener('click', function(e){
        var t = e.target || e.srcElement;
        if(!t) return;
        var isEdit = (t.matches && t.matches('.btn-edit')) || ((t.className||'').indexOf('btn-edit')!==-1);
        if(isEdit){
          var tr = t.closest ? t.closest('tr') : null;
          if(!tr) return;
          var id = tr.getAttribute('data-id');
          self.fillFormById(id);
        }
      });
    }
  },

  resetForm: function(){
    var ui=this._ui;
    if(ui.form) ui.form.removeAttribute('data-id');
    if(ui.bankSelect) ui.bankSelect.value='';
    if(ui.productSelect) ui.productSelect.value='MORTGAGE';
    if(ui.titleInput) ui.titleInput.value='';
    if(ui.detailInput) ui.detailInput.value='';
    if(ui.bpsInput) ui.bpsInput.value='';
    if(ui.fixedRateInput) ui.fixedRateInput.value='';
    if(ui.firstMonthInput) ui.firstMonthInput.value='';
    if(ui.yearRateInput) ui.yearRateInput.value='';
  },

  // ================= DATA =================
  loadBanks: function(){
    var self=this, sb=sbClient();
    return sb.from(BANKS_TABLE)
      .select('id,name,short_name')
      .order('short_name', { ascending:true })
      .then(function(res){
        if(res.error) throw res.error;
        var list = Array.isArray(res.data)?res.data:[];
        self._cache.banks = list.map(function(b){
          if(typeof b.name==='undefined' && typeof b.bank_name!=='undefined') b.name=b.bank_name;
          if(typeof b.short_name==='undefined' && typeof b.code!=='undefined') b.short_name=b.code;
          return b;
        });
        self._renderBankOptions();
        return self._cache.banks;
      })
      .catch(function(e){
        err('[Admin] loadBanks error:', e);
        self._cache.banks=[]; self._renderBankOptions(); return [];
      });
  },

  _renderBankOptions: function(){
    var sel=this._ui.bankSelect; if(!sel) return;
    var list=this._cache.banks||[];
    var html='<option value="">เลือกธนาคาร</option>';
    for(var i=0;i<list.length;i++){
      var b=list[i];
      html+='<option value="'+(b.id||'')+'">'+(b.short_name||b.name||'-')+'</option>';
    }
    sel.innerHTML=html;
  },

  loadPromotions: function(){
    var self=this, sb=sbClient();
    return sb.from(PROMO_TABLE)
      .select('*')
      .order('updated_at', { ascending:false })
      .then(function(res){
        if(res.error) throw res.error;
        self._cache.promos = Array.isArray(res.data)?res.data:[];
        return self._cache.promos;
      })
      .catch(function(e){
        err('[Admin] loadPromotions error:', e);
        self._cache.promos=[]; return [];
      });
  },

  saveCurrent: function(){
    var ui=this._ui;
    var id = ui.form ? ui.form.getAttribute('data-id') : null;

    var payload = {
      id: id || undefined,
      bank_id: val(ui.bankSelect),
      product_type: val(ui.productSelect) || 'MORTGAGE',
      title: val(ui.titleInput),
      detail: val(ui.detailInput),
      bps_discount: toNumber(val(ui.bpsInput),0),
      fixed_rate: toNumber(val(ui.fixedRateInput),0),
      first_month: toNumber(val(ui.firstMonthInput),0),
      year_rate: toNumber(val(ui.yearRateInput),0),
      updated_at: new Date().toISOString()
    };

    if(!payload.bank_id || !payload.title){
      alert('กรุณาเลือกธนาคารและกรอกชื่อโปรโมชัน'); return Promise.resolve(false);
    }

    var sb=sbClient();
    return sb.from(PROMO_TABLE)
      .upsert(payload, { onConflict:'id' })
      .select('*').limit(1).maybeSingle()
      .then(function(res){
        if(res.error) throw res.error;
        alert('บันทึกสำเร็จ'); return true;
      })
      .catch(function(e){
        err('[Admin] saveCurrent error:', e);
        alert('บันทึกไม่สำเร็จ: '+(e&&e.message?e.message:'ไม่ทราบสาเหตุ'));
        return false;
      });
  },

  deletePromotion: function(id){
    if(!id) return Promise.resolve(false);
    var sb=sbClient();
    return sb.from(PROMO_TABLE)
      .delete().eq('id', id)
      .then(function(res){
        if(res.error) throw res.error;
        alert('ลบแล้ว'); return true;
      })
      .catch(function(e){
        err('[Admin] deletePromotion error:', e);
        alert('ลบไม่สำเร็จ: '+(e&&e.message?e.message:'ไม่ทราบสาเหตุ'));
        return false;
      });
  },

  // ================= UI =================
  fillFormById: function(id){
    if(!id) return;
    var list=this._cache.promos||[];
    var p=null;
    for(var i=0;i<list.length;i++){ if(String(list[i].id)===String(id)){ p=list[i]; break; } }
    if(!p) return;
    var ui=this._ui;
    if(ui.form) ui.form.setAttribute('data-id', p.id);
    if(ui.bankSelect) ui.bankSelect.value = p.bank_id || '';
    if(ui.productSelect) ui.productSelect.value = p.product_type || 'MORTGAGE';
    if(ui.titleInput) ui.titleInput.value = p.title || '';
    if(ui.detailInput) ui.detailInput.value = p.detail || '';
    if(ui.bpsInput) ui.bpsInput.value = (p.bps_discount!=null?p.bps_discount:'');
    if(ui.fixedRateInput) ui.fixedRateInput.value = (p.fixed_rate!=null?p.fixed_rate:'');
    if(ui.firstMonthInput) ui.firstMonthInput.value = (p.first_month!=null?p.first_month:'');
    if(ui.yearRateInput) ui.yearRateInput.value = (p.year_rate!=null?p.year_rate:'');
  },

  renderGrid: function(){
    var tbody=this._ui.gridTbody; if(!tbody) return;
    var q = this._ui.filterInput ? String(this._ui.filterInput.value||'').toLowerCase() : '';
    var banks=this._cache.banks||[], promos=this._cache.promos||[];

    function bankShortName(id){
      for(var i=0;i<banks.length;i++){
        var b=banks[i]; if(String(b.id)===String(id)) return b.short_name||b.name||'-';
      }
      return '-';
    }

    var rows=[], i, p;
    for(i=0;i<promos.length;i++){
      p=promos[i];
      var text=(p.title||'')+' '+(p.detail||'')+' '+bankShortName(p.bank_id);
      if(q && text.toLowerCase().indexOf(q)===-1) continue;

      rows.push(
        '<tr data-id="'+(p.id||'')+'">'+
          '<td>'+bankShortName(p.bank_id)+'</td>'+
          '<td>'+(p.product_type||'')+'</td>'+
          '<td>'+(p.title||'')+'</td>'+
          '<td>'+(p.detail||'')+'</td>'+
          '<td class="text-right">'+(p.bps_discount!=null?p.bps_discount:'')+'</td>'+
          '<td class="text-right">'+(p.fixed_rate!=null?p.fixed_rate:'')+'</td>'+
          '<td class="text-right">'+(p.first_month!=null?p.first_month:'')+'</td>'+
          '<td class="text-right">'+(p.year_rate!=null?p.year_rate:'')+'</td>'+
          '<td><button type="button" class="btn-edit">แก้ไข</button></td>'+
        '</tr>'
      );
    }

    tbody.innerHTML = rows.join('') || '<tr><td colspan="9" class="text-center text-gray-500">ไม่มีข้อมูล</td></tr>';
  }
};

export default AdminManager;
