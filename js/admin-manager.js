// Simple Admin UI helpers built on DM (no modules)
(function(){
  if (!window.DM) { console.error("DM not loaded"); return; }

  async function ensureAdmin() {
    const role = await DM.getMyRole();
    if (role !== "admin") {
      alert("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
      window.location.assign("/");
      return false;
    }
    return true;
  }

  async function loadBanksUI() {
    const tbody = document.getElementById("banks-tbody");
    tbody.innerHTML = '<tr><td colspan="5" class="muted">กำลังโหลด…</td></tr>';
    try {
      const banks = await DM.getBanks();
      if (!banks.length) { tbody.innerHTML = '<tr><td colspan="5" class="muted">ไม่มีข้อมูล</td></tr>'; return; }
      tbody.innerHTML = "";
      for (const b of banks) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><span class="badge">${b.short_name||"-"}</span></td>
          <td>${b.name||"-"}</td>
          <td><input type="number" step="0.01" value="${b.mrr??""}" data-bank="${b.id}" data-field="mrr"></td>
          <td><input type="date" value="${(b.mrr_effective_from||"").slice(0,10)}" data-bank="${b.id}" data-field="date"></td>
          <td class="row-actions"><button class="btn btn-primary btn-save" data-id="${b.id}">บันทึก</button></td>
        `;
        tbody.appendChild(tr);
      }
      tbody.querySelectorAll(".btn-save").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          const row = btn.closest("tr");
          const id = Number(btn.dataset.id);
          const mrr = parseFloat(row.querySelector('input[data-field="mrr"]').value || "0");
          const eff = row.querySelector('input[data-field="date"]').value || null;
          btn.disabled = true;
          try {
            await DM.updateBankMRR(id, mrr, eff);
            btn.textContent = "✔︎ บันทึกแล้ว";
            setTimeout(()=>btn.textContent="บันทึก", 1200);
          } catch(e) {
            console.error(e); btn.textContent = "ผิดพลาด"; btn.classList.add("btn-danger");
            setTimeout(()=>{ btn.textContent="บันทึก"; btn.classList.remove("btn-danger"); }, 1500);
          } finally { btn.disabled = false; }
        });
      });
    } catch(e) {
      console.error(e);
      tbody.innerHTML = '<tr><td colspan="5" class="muted">โหลดข้อมูลผิดพลาด</td></tr>';
    }
  }

  let bankOptionsCache = [];
  function rebuildBankSelect() {
    const sel = document.getElementById("promo-bank");
    sel.innerHTML = "";
    for (const b of bankOptionsCache) {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = `${b.short_name||b.name||"Bank"} (#${b.id})`;
      sel.appendChild(opt);
    }
  }

  async function loadPromotions() {
    const tbody = document.getElementById("promos-tbody");
    tbody.innerHTML = '<tr><td colspan="10" class="muted">กำลังโหลด…</td></tr>';
    try {
      const promos = await DM.listPromotions();
      if (!promos.length) { tbody.innerHTML = '<tr><td colspan="10" class="muted">ไม่มีโปร</td></tr>'; return; }
      const bankMap = Object.fromEntries(bankOptionsCache.map(b => [b.id, b.short_name || b.name]));
      tbody.innerHTML = "";
      for (const p of promos) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${p.id}</td>
          <td>${bankMap[p.bank_id]||p.bank_id}</td>
          <td>${p.product_type||"-"}</td>
          <td>${p.title||"-"}</td>
          <td>${p.base||"-"}</td>
          <td>${p.y1??""}</td>
          <td>${p.y2??""}</td>
          <td>${p.y3??""}</td>
          <td>${p.active ? "✅" : "—"}</td>
          <td class="row-actions">
            <button class="btn btn-primary btn-edit" data-id="${p.id}">แก้ไข</button>
            <button class="btn btn-danger btn-del" data-id="${p.id}">ลบ</button>
          </td>
        `;
        tbody.appendChild(tr);
      }
      // edit
      tbody.querySelectorAll(".btn-edit").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const id = Number(btn.dataset.id);
          const row = btn.closest("tr").children;
          document.getElementById("promo-bank").value =
            bankOptionsCache.find(b => (b.short_name||b.name) === row[1].textContent)?.id || "";
          document.getElementById("promo-product").value = row[2].textContent.trim();
          document.getElementById("promo-title").value = row[3].textContent.trim();
          document.getElementById("promo-base").value = row[4].textContent.trim() || "";
          document.getElementById("promo-y1").value = row[5].textContent.trim();
          document.getElementById("promo-y2").value = row[6].textContent.trim();
          document.getElementById("promo-y3").value = row[7].textContent.trim();
          document.getElementById("promo-active").checked = row[8].textContent.includes("✅");
          document.getElementById("promo-save").dataset.editId = String(id);
          document.getElementById("promo-save").textContent = "อัปเดตโปร";
        });
      });
      // delete
      tbody.querySelectorAll(".btn-del").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          const id = Number(btn.dataset.id);
          if (!confirm(`ลบโปรโมชัน #${id} ?`)) return;
          btn.disabled = true;
          try { await DM.deletePromotion(id); await loadPromotions(); }
          catch(e){ console.error(e); alert("ลบไม่สำเร็จ"); }
          finally { btn.disabled = false; }
        });
      });
    } catch(e) {
      console.error(e); tbody.innerHTML = '<tr><td colspan="10" class="muted">โหลดข้อมูลผิดพลาด</td></tr>';
    }
  }

  async function initAdmin() {
    if (!(await ensureAdmin())) return;
    try { bankOptionsCache = await DM.getBanks(); rebuildBankSelect(); } catch(e){ console.error(e); }
    await loadBanksUI();
    await loadPromotions();

    document.getElementById("promo-save").addEventListener("click", async ()=>{
      const payload = {
        id: document.getElementById("promo-save").dataset.editId ? Number(document.getElementById("promo-save").dataset.editId) : undefined,
        bank_id: Number(document.getElementById("promo-bank").value),
        product_type: document.getElementById("promo-product").value,
        title: document.getElementById("promo-title").value.trim(),
        base: document.getElementById("promo-base").value || null,
        y1: document.getElementById("promo-y1").value ? Number(document.getElementById("promo-y1").value) : null,
        y2: document.getElementById("promo-y2").value ? Number(document.getElementById("promo-y2").value) : null,
        y3: document.getElementById("promo-y3").value ? Number(document.getElementById("promo-y3").value) : null,
        active: document.getElementById("promo-active").checked
      };
      const btn = document.getElementById("promo-save");
      btn.disabled = true;
      try {
        await DM.upsertPromotion(payload);
        btn.removeAttribute("data-edit-id");
        btn.textContent = "บันทึกโปร";
        document.getElementById("promo-title").value = "";
        document.getElementById("promo-base").value = "";
        document.getElementById("promo-y1").value = "";
        document.getElementById("promo-y2").value = "";
        document.getElementById("promo-y3").value = "";
        document.getElementById("promo-active").checked = true;
        await loadPromotions();
      } catch(e){ console.error(e); alert("บันทึกโปรไม่สำเร็จ"); }
      finally { btn.disabled = false; }
    });

    document.getElementById("btn-logout").addEventListener("click", ()=> logout());
  }

  window.AdminUI = { initAdmin };
})();
