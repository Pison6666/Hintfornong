const API_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
const DEV_MODE = API_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';

const db = {
  HINTS_KEY: 'hints_data', PASS_KEY: 'admin_password', DEFAULT_PASS: '1234',

  async _post(body) {
    const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async _devGetAll() { const r = localStorage.getItem(this.HINTS_KEY); return r ? JSON.parse(r) : {}; },
  async _devSave(n, h) { const a = await this._devGetAll(); a[n] = h; localStorage.setItem(this.HINTS_KEY, JSON.stringify(a)); },
  async _devRemove(n) { const a = await this._devGetAll(); delete a[n]; localStorage.setItem(this.HINTS_KEY, JSON.stringify(a)); },

  async getAll() {
    if (DEV_MODE) return this._devGetAll();
    const r = await this._post({ action: 'getAll' }); if (!r.ok) throw new Error(r.error); return r.data;
  },
  async save(n, h) {
    if (DEV_MODE) return this._devSave(n, h);
    const r = await this._post({ action: 'save', number: n, hint: h, pass: sessionStorage.getItem('adminPass') || '' });
    if (!r.ok) throw new Error(r.error);
  },
  async remove(n) {
    if (DEV_MODE) return this._devRemove(n);
    const r = await this._post({ action: 'remove', number: n, pass: sessionStorage.getItem('adminPass') || '' });
    if (!r.ok) throw new Error(r.error);
  },
  async get(n) {
    if (DEV_MODE) { const a = await this._devGetAll(); return a[n]; }
    const r = await this._post({ action: 'get', number: n }); if (!r.ok) throw new Error(r.error); return r.hint || null;
  },
  async checkPassword(pass) {
    if (DEV_MODE) { return pass === (localStorage.getItem(this.PASS_KEY) || this.DEFAULT_PASS); }
    const r = await this._post({ action: 'checkPass', pass }); if (!r.ok) throw new Error(r.error);
    if (r.match) sessionStorage.setItem('adminPass', pass); return r.match;
  },
  async setPassword(newPass) {
    if (DEV_MODE) { localStorage.setItem(this.PASS_KEY, newPass); return; }
    const r = await this._post({ action: 'setPass', oldPass: sessionStorage.getItem('adminPass') || '', newPass });
    if (!r.ok) throw new Error(r.error); sessionStorage.setItem('adminPass', newPass);
  },
};

function showUserView() {
  ['adminLogin','adminPanel'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('userView').classList.remove('hidden');
}
function showAdminLogin() {
  ['userView','adminPanel'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('adminLogin').classList.remove('hidden');
  document.getElementById('adminLoginError').textContent = '';
}
function showAdminPanel() {
  ['userView','adminLogin'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('adminPanel').classList.remove('hidden');
  renderHintList();
}

async function findHint() {
  const num = document.getElementById('uNumber').value.trim();
  const result = document.getElementById('uResult');
  const btn = document.getElementById('searchBtn');
  if (!num) { result.innerHTML = '<div class="error">กรอกเลขที่ก่อนนะ</div>'; return; }
  result.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  btn.disabled = true;
  try {
    const hint = await db.get(num);
    if (hint) {
      result.innerHTML = `
        <div class="hint-box" id="hintText">${escapeHtml(hint)}</div>
        <button class="copy-btn" onclick="copyHint()">คัดลอกคำใบ้</button>`;
    } else {
      result.innerHTML = '<div class="error">ไม่พบคำใบ้สำหรับเลขที่นี้</div>';
    }
  } catch(err) {
    result.innerHTML = `<div class="error">เกิดข้อผิดพลาด: ${escapeHtml(err.message)}</div>`;
  } finally { btn.disabled = false; }
}

function copyHint() {
  const text = document.getElementById('hintText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-btn');
    btn.textContent = 'คัดลอกแล้ว ✓'; btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'คัดลอกคำใบ้'; btn.classList.remove('copied'); }, 2000);
  });
}

async function checkAdminLogin() {
  const pass = document.getElementById('adminPass').value;
  const errEl = document.getElementById('adminLoginError');
  try {
    if (await db.checkPassword(pass)) { document.getElementById('adminPass').value = ''; showAdminPanel(); }
    else errEl.textContent = 'รหัสผ่านไม่ถูกต้อง';
  } catch(err) { errEl.textContent = `เกิดข้อผิดพลาด: ${err.message}`; }
}

async function saveHint() {
  const num = document.getElementById('aNumber').value.trim();
  const hint = document.getElementById('aHint').value.trim();
  const msg = document.getElementById('adminMsg');
  if (!num || !hint) { msg.className = 'msg err'; msg.textContent = 'กรอกข้อมูลให้ครบ'; return; }
  try {
    await db.save(num, hint);
    msg.className = 'msg ok'; msg.textContent = `บันทึกเลขที่ ${num} แล้ว ✓`;
    clearForm(); renderHintList();
    setTimeout(() => { msg.textContent = ''; }, 2000);
  } catch(err) { msg.className = 'msg err'; msg.textContent = `เกิดข้อผิดพลาด: ${err.message}`; }
}

function clearForm() {
  document.getElementById('aNumber').value = '';
  document.getElementById('aHint').value = '';
  document.getElementById('adminMsg').textContent = '';
}

async function deleteHint(num) {
  try { await db.remove(num); renderHintList(); }
  catch(err) { alert(`ลบไม่สำเร็จ: ${err.message}`); }
}

function editHint(num, hint) {
  document.getElementById('aNumber').value = num;
  document.getElementById('aHint').value = hint;
  document.getElementById('aNumber').focus();
}

async function renderHintList() {
  const list = document.getElementById('hintList');
  const badge = document.getElementById('countBadge');
  list.innerHTML = '<div class="empty">กำลังโหลด…</div>';
  try {
    const all = await db.getAll();
    const keys = Object.keys(all).sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
    badge.textContent = keys.length;
    if (!keys.length) { list.innerHTML = '<div class="empty">ยังไม่มีคำใบ้</div>'; return; }
    list.innerHTML = keys.map(num => `
      <div class="list-item">
        <div class="info">
          <div class="num">เลขที่ ${escapeHtml(num)}</div>
          <div class="hint">${escapeHtml(all[num])}</div>
        </div>
        <div class="actions">
          <button onclick="editHint('${escAttr(num)}','${escAttr(all[num])}')">แก้ไข</button>
          <button class="del" onclick="deleteHint('${escAttr(num)}')">ลบ</button>
        </div>
      </div>`).join('');
  } catch(err) { list.innerHTML = `<div class="error">โหลดไม่สำเร็จ: ${escapeHtml(err.message)}</div>`; }
}

async function changeAdminPass() {
  const np = document.getElementById('newAdminPass').value.trim();
  if (!np) return;
  try { await db.setPassword(np); document.getElementById('newAdminPass').value = ''; alert('เปลี่ยนรหัสผ่านแล้ว ✓'); }
  catch(err) { alert(`ไม่สำเร็จ: ${err.message}`); }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) { return String(s).replace(/'/g, "\\'"); }

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('uNumber').addEventListener('keydown', e => { if (e.key === 'Enter') findHint(); });
});
