/* ═══════════════════════════════════════════════════════
   EventHub Admin · admin1.js
   ─────────────────────────────────────────────────────
   HubDB 欄位（直接對應）：
     category → 類別
     event    → 活動名稱
     date     → 日期
     contact  → 聯絡人
     status   → approved | pending
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ── State ── */
let allRows      = [];
let currentFilter = 'approved';   // 預設顯示「已發佈」
let pendingDeleteId = null;
let pendingEditId   = null;
let batchRowCount   = 0;


/* ════════════════════════════════════════════════════════
   Sidebar
   ════════════════════════════════════════════════════════ */
function toggleMenu(menuId, btnEl) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const isOpen = menu.classList.toggle('open');
  btnEl.classList.toggle('open', isOpen);
}


/* ════════════════════════════════════════════════════════
   Batch Add Form
   ════════════════════════════════════════════════════════ */
function toggleForm() {
  const section = document.getElementById('batchSection');
  if (!section) return;
  const willOpen = section.classList.contains('hidden');
  section.classList.toggle('hidden');

  /* 開啟時若尚無列，自動加一行 */
  if (willOpen) {
    const rows = document.getElementById('batchRows');
    if (rows && rows.children.length === 0) addBatchRow();
  }

  /* 同步按鈕文字 */
  const btn = document.getElementById('btnAdd');
  if (btn) {
    if (willOpen) {
      btn.style.background = '#555555';
    } else {
      btn.style.background = '';
    }
  }
}

function addBatchRow() {
  const container = document.getElementById('batchRows');
  if (!container) return;

  batchRowCount++;
  const id = `br_${batchRowCount}`;

  const div = document.createElement('div');
  div.className = 'batch-row';
  div.id = id;
  div.innerHTML = `
    <input class="field-no"      type="text" placeholder="編號（選填）">
    <select class="field-category">
      <option value="採洽會">採洽會</option>
      <option value="海外展覽">海外展覽</option>
      <option value="國內展覽">國內展覽</option>
      <option value="其他">其他</option>
    </select>
    <input class="field-event"   type="text" placeholder="輸入活動名稱（必填）">
    <input class="field-date"    type="text" placeholder="2025/01/01 - 2025/01/05">
    <input class="field-contact" type="text" placeholder="聯絡人姓名（必填）">
    <button class="btn-remove-row" onclick="removeBatchRow('${id}')" title="移除">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;
  container.appendChild(div);

  /* 聚焦到活動名稱欄 */
  div.querySelector('.field-event').focus();
}

function removeBatchRow(rowId) {
  const el = document.getElementById(rowId);
  if (el) el.remove();
}

async function submitBatch(btn) {
  const rowEls = document.querySelectorAll('#batchRows .batch-row');
  if (!rowEls.length) {
    showToast('❌ 請先新增至少一行資料', 'error');
    return;
  }

  /* 收集並驗證 */
  const items = [];
  let hasError = false;

  rowEls.forEach(row => {
    const no       = row.querySelector('.field-no').value.trim();
    const category = row.querySelector('.field-category').value.trim();
    const event    = row.querySelector('.field-event').value.trim();
    const date     = row.querySelector('.field-date').value.trim();
    const contact  = row.querySelector('.field-contact').value.trim();

    if (!event || !contact) {
      row.querySelector('.field-event').style.borderColor   = event   ? '' : '#EF4444';
      row.querySelector('.field-contact').style.borderColor = contact ? '' : '#EF4444';
      hasError = true;
    } else {
      row.querySelector('.field-event').style.borderColor   = '';
      row.querySelector('.field-contact').style.borderColor = '';
      items.push({ no, category, event, date, contact });
    }
  });

  if (hasError) {
    showToast('❌ 請填寫所有必填欄位（活動名稱、聯絡人）', 'error');
    return;
  }

  btn.disabled    = true;
  btn.textContent = '送出中…';

  let ok = 0, fail = 0;

  for (const item of items) {
    try {
      const res  = await fetch('/.netlify/functions/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          itemNo:       item.no,
          itemCategory: item.category,
          itemEvent:    item.event,
          itemDate:     item.date,
          itemContact:  item.contact
        })
      });
      const data = await res.json();
      if (res.ok && data.success) ok++;
      else fail++;
    } catch { fail++; }
  }

  btn.disabled    = false;
  btn.textContent = '送出並加到待審核';

  if (ok > 0) {
    showToast(`✅ 成功送出 ${ok} 筆，已加入待審核`, 'success');
    document.getElementById('batchRows').innerHTML = '';
    batchRowCount = 0;
    document.getElementById('batchSection').classList.add('hidden');
    const addBtn = document.getElementById('btnAdd');
    if (addBtn) addBtn.style.background = '';
    setTimeout(loadRows, 700);
  }
  if (fail > 0) {
    showToast(`❌ ${fail} 筆送出失敗，請稍後重試`, 'error');
  }
}


/* ════════════════════════════════════════════════════════
   Load & Render
   ════════════════════════════════════════════════════════ */
async function loadRows() {
  setTableLoading();
  try {
    const res  = await fetch('/.netlify/functions/get-rows');
    const data = await res.json();
    if (!data.success) { showTableError('載入失敗：' + data.error); return; }
    allRows = data.rows || [];
    updateBadge();
    renderTable();
  } catch (err) {
    showTableError(`連線錯誤：${err.message}<br><small>請確認 netlify dev 正在執行</small>`);
  }
}

function setTableLoading() {
  document.getElementById('mainTable').innerHTML =
    `<tr><td colspan="6" class="empty">
       <div class="loading-spinner"></div>
       <p>載入中…</p>
     </td></tr>`;
}

function updateBadge() {
  const pendingCount = allRows.filter(r => r.values?.status !== 'approved').length;
  const badge = document.getElementById('pendingBadge');
  if (badge) {
    badge.textContent     = pendingCount;
    badge.style.display   = pendingCount > 0 ? 'inline-flex' : 'none';
  }
}

function setFilter(filter, tabEl) {
  currentFilter = filter;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  renderTable();
}

function renderTable() {
  const filtered = allRows.filter(r => {
    if (currentFilter === 'approved') return r.values?.status === 'approved';
    if (currentFilter === 'pending')  return r.values?.status !== 'approved';
    return true;
  });

  const label = document.getElementById('rowCountLabel');
  if (label) label.textContent = `共 ${filtered.length} 筆資料`;

  const tbody = document.getElementById('mainTable');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">目前沒有資料</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((row, idx) => {
    const v = row.values || {};

    /* ── 直接讀取 HubDB 欄位 ── */
    const no        = escHtml(v.no       || '');
    const category  = v.category || '其他';
    const dateRange = v.date     || '';
    const eventName = escHtml(v.event   || '-');
    const contact   = escHtml(v.contact || '-');

    /* ── Category Badge ── */
    const catClass = getCatClass(category);
    const catBadge = `<span class="cat-badge ${catClass}">${escHtml(category)}</span>`;

    /* ── Status Action Button ── */
    const isApproved = v.status === 'approved';
    const statusBtn  = isApproved
      ? `<button class="btn-icon btn-unpublish" title="下架" onclick="updateStatus('${row.id}','pending',this)">
           ${svgIcon('arrow-down-circle')}
         </button>`
      : `<button class="btn-icon btn-approve" title="上架" onclick="updateStatus('${row.id}','approved',this)">
           ${svgIcon('check-circle')}
         </button>`;

    /* ── Escape for onclick ── */
    const safeNo       = escAttr(v.no       || '');
    const safeEvent    = escAttr(v.event    || '');
    const safeContact  = escAttr(v.contact  || '');
    const safeCategory = escAttr(category);
    const safeDate     = escAttr(dateRange);

    return `
      <tr>
        <td class="td-no">${no || (idx + 1)}</td>
        <td>${catBadge}</td>
        <td><div class="event-name">${eventName}</div></td>
        <td class="td-date">${dateRange || '—'}</td>
        <td class="td-contact">${contact}</td>
        <td class="td-actions">
          <div class="action-group">
            ${statusBtn}
            <button class="btn-icon btn-edit" title="編輯"
              onclick="openEditDialog('${row.id}','${safeNo}','${safeEvent}','${safeContact}','${safeCategory}','${safeDate}')">
              ${svgIcon('pencil')}
            </button>
            <button class="btn-icon btn-del" title="刪除"
              onclick="openDeleteDialog('${row.id}','${safeEvent}')">
              ${svgIcon('trash-2')}
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}


/* ════════════════════════════════════════════════════════
   Update Status (上架 / 下架)
   ════════════════════════════════════════════════════════ */
async function updateStatus(rowId, status, btn) {
  const prev = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = svgIcon('loader-2', 'spin-icon');

  try {
    const res  = await fetch('/.netlify/functions/update-status', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ rowId, status })
    });
    const data = await res.json();

    if (data.success) {
      showToast(status === 'approved' ? '✅ 已成功上架！' : '⬇️ 已成功下架！', 'success');
      setTimeout(loadRows, 700);
    } else {
      showToast('❌ 操作失敗：' + (data.error || '未知錯誤'), 'error');
      btn.disabled = false;
      btn.innerHTML = prev;
    }
  } catch (err) {
    showToast('❌ 連線錯誤', 'error');
    btn.disabled  = false;
    btn.innerHTML = prev;
  }
}


/* ════════════════════════════════════════════════════════
   Edit Dialog
   ════════════════════════════════════════════════════════ */
function openEditDialog(rowId, no, name, contact, category, date) {
  pendingEditId = rowId;
  document.getElementById('editRowId').value     = rowId;
  document.getElementById('editNo').value        = no;
  document.getElementById('editEventName').value = name;
  document.getElementById('editContact').value   = contact;
  document.getElementById('editDate').value      = date;

  /* set category select */
  const sel = document.getElementById('editCategory');
  [...sel.options].forEach(opt => { opt.selected = opt.value === category; });

  document.getElementById('editDialog').classList.add('open');
  setTimeout(() => document.getElementById('editEventName').focus(), 50);
}

function closeEditDialog() {
  document.getElementById('editDialog').classList.remove('open');
  pendingEditId = null;
}

async function executeEdit() {
  const rowId    = document.getElementById('editRowId').value;
  const no       = document.getElementById('editNo').value.trim();
  const category = document.getElementById('editCategory').value.trim();
  const event    = document.getElementById('editEventName').value.trim();
  const date     = document.getElementById('editDate').value.trim();
  const contact  = document.getElementById('editContact').value.trim();

  if (!event || !contact) {
    document.getElementById('editEventName').style.borderColor = event   ? '' : '#EF4444';
    document.getElementById('editContact').style.borderColor   = contact ? '' : '#EF4444';
    showToast('❌ 活動名稱與聯絡人為必填', 'error');
    return;
  }

  const btn = document.getElementById('confirmEditBtn');
  btn.disabled    = true;
  btn.textContent = '儲存中…';

  try {
    const res  = await fetch('/.netlify/functions/update-row', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
        rowId,
        itemNo:       no,
        itemCategory: category,
        itemEvent:    event,
        itemDate:     date,
        itemContact:  contact
      })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      /* 同步更新本機快取 */
      const localRow = allRows.find(r => r.id === rowId);
      if (localRow) {
        localRow.values.no       = no;
        localRow.values.category = category;
        localRow.values.event    = event;
        localRow.values.date     = date;
        localRow.values.contact  = contact;
      }
      closeEditDialog();
      showToast('✏️ 已成功更新資料', 'success');
      updateBadge();
      renderTable();
    } else {
      showToast('❌ 更新失敗：' + (data.error || '未知錯誤'), 'error');
    }
  } catch (err) {
    showToast('❌ 連線錯誤：' + err.message, 'error');
  }

  btn.disabled    = false;
  btn.textContent = '儲存變更';
}


/* ════════════════════════════════════════════════════════
   Delete Dialog
   ════════════════════════════════════════════════════════ */
function openDeleteDialog(rowId, name) {
  pendingDeleteId = rowId;
  document.getElementById('deleteDialogDesc').textContent =
    `確定要刪除「${name || rowId}」嗎？此操作永久移除且無法復原。`;
  document.getElementById('confirmDeleteBtn').disabled    = false;
  document.getElementById('confirmDeleteBtn').textContent = '確認刪除';
  document.getElementById('deleteDialog').classList.add('open');
}

function closeDeleteDialog() {
  document.getElementById('deleteDialog').classList.remove('open');
  pendingDeleteId = null;
}

async function executeDelete() {
  if (!pendingDeleteId) return;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled    = true;
  btn.textContent = '刪除中…';

  try {
    const res  = await fetch('/.netlify/functions/delete-row', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ rowId: pendingDeleteId })
    });
    const data = await res.json();

    if (data.success) {
      closeDeleteDialog();
      showToast('🗑️ 已成功刪除', 'success');
      setTimeout(loadRows, 700);
    } else {
      showToast('❌ 刪除失敗：' + (data.error || '未知錯誤'), 'error');
      btn.disabled    = false;
      btn.textContent = '確認刪除';
    }
  } catch (err) {
    showToast('❌ 連線錯誤：' + err.message, 'error');
    btn.disabled    = false;
    btn.textContent = '確認刪除';
  }
}


/* ════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════ */
function getCatClass(cat) {
  const c = (cat || '').trim();
  if (c.includes('採洽') || c.toLowerCase().includes('sourcing')) return 'cat-sourcing';
  if (c.includes('海外') || c.toLowerCase().includes('overseas')) return 'cat-overseas';
  if (c.includes('國內') || c.toLowerCase().includes('domestic')) return 'cat-domestic';
  return 'cat-other';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str).replace(/'/g, '\\x27').replace(/"/g, '\\x22');
}

/* Inline SVG icons (subset of Lucide) */
const ICONS = {
  'pencil': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  'trash-2': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
  'check-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  'arrow-down-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>',
  'loader-2': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
};

function svgIcon(name, extraClass = '') {
  const raw = ICONS[name] || ICONS['pencil'];
  if (extraClass) return raw.replace('<svg ', `<svg class="${extraClass}" `);
  return raw;
}

function showToast(msg, type = 'success') {
  const toast        = document.getElementById('toast');
  toast.innerHTML    = msg;
  toast.className    = type;
  toast.style.display = 'block';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3200);
}

function showTableError(msg) {
  document.getElementById('mainTable').innerHTML =
    `<tr><td colspan="6" class="empty">❌ ${msg}</td></tr>`;
}

/* Add spin animation for loader icon */
const spinStyle = document.createElement('style');
spinStyle.textContent = '.spin-icon { animation: spin 0.7s linear infinite; }';
document.head.appendChild(spinStyle);


/* ════════════════════════════════════════════════════════
   Init
   ════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  /* Close dialogs on overlay click */
  document.getElementById('deleteDialog').addEventListener('click', function(e) {
    if (e.target === this) closeDeleteDialog();
  });
  document.getElementById('editDialog').addEventListener('click', function(e) {
    if (e.target === this) closeEditDialog();
  });

  /* ESC closes dialogs */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeDeleteDialog();
      closeEditDialog();
    }
  });

  /* Default filter = approved (已發佈) */
  currentFilter = 'approved';

  /* Load data */
  loadRows();
});
