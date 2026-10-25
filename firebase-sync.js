// ============================================================
//  কল্যাণী সরকারি প্রাথমিক বিদ্যালয় — Firebase লগইন, ক্লাউড সিঙ্ক ও জিপিএস হাজিরা সিঙ্ক
//  • লগইন/লগআউট : Firebase Authentication (ইমেইল-পাসওয়ার্ড)
//  • তথ্য সিঙ্ক   : Realtime Database  (localStorage ↔ schools/<SCHOOL_ID>/data)
//  • হাজিরা       : schools/<SCHOOL_ID>/att/<id>  (প্রতিটি রেকর্ড আলাদা, শিক্ষক শুধু নিজেরটি লিখতে পারেন)
//  • ছবি ও PDF    : Firebase Storage (IndexedDB: কল্যাণী গ্যালারি ও ফাইল)
//  সাইটের সাথে চুক্তি: window.fbsAuth {user, role, applying, openPanel()}, ইভেন্ট 'fbs-auth' ও 'fbs-sync',
//  এবং window.onRemoteData(Set<key>)।  কনফিগ না বসালে এই ফাইল কিছুই করে না (সাইট আগের মতো খোলা থাকে)।
// ============================================================
import { firebaseConfig, SCHOOL_ID, ADMIN_EMAILS } from './firebase-config.js';

const V = '10.12.2', CDN = 'https://www.gstatic.com/firebasejs/' + V + '/';
const enabled = firebaseConfig && firebaseConfig.apiKey && !/YOUR_|REPLACE/.test(firebaseConfig.apiKey + firebaseConfig.projectId);
if (enabled) boot().catch(e => console.warn('[fbs] চালু করা যায়নি:', e));

async function boot() {
  const [{ initializeApp }, AU, DB, ST] = await Promise.all([
    import(CDN + 'firebase-app.js'), import(CDN + 'firebase-auth.js'),
    import(CDN + 'firebase-database.js'), import(CDN + 'firebase-storage.js')]);
  const app = initializeApp(firebaseConfig), auth = AU.getAuth(app), db = DB.getDatabase(app), store = ST.getStorage(app);
  const base = 'schools/' + SCHOOL_ID, ek = e => String(e || '').toLowerCase().replace(/\./g, ',');
  const ATT = 'kalyani_attendance', TSK = 'kalyani_fbs_ts', SEEN = 'kalyani_fbs_idbseen';
  const EXCL = /^(kalyani_(bio_|last_update|hv_last_teacher|old_|ls_migrated|idb_migrated|fbs_|attendance$)|ngps_)/;
  const synced = k => k === 'students' || k === 'lessonPlans' || (k.indexOf('kalyani_') === 0 && !EXCL.test(k));
  const oSet = Storage.prototype.setItem, oRem = Storage.prototype.removeItem;
  const rj = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const enc = k => encodeURIComponent(k).replace(/\./g, '%2E');
  const api = { user: null, role: 'viewer', applying: false, ready: false, lastSync: 0, openPanel: () => panel(true), signOut: () => AU.signOut(auth), syncNow: () => fullSync() };
  window.fbsAuth = api;
  const fire = n => window.dispatchEvent(new Event(n));
  const isAdmin = () => api.role === 'admin';
  const ts = rj(TSK, {}); const saveTs = () => { try { oSet.call(localStorage, TSK, JSON.stringify(ts)); } catch (e) {} };

  // ---------- রিমোট থেকে আসা বদল জমিয়ে একবারে জানানো ----------
  let pend = new Set(), pt = 0;
  function notify(k) { pend.add(k); clearTimeout(pt); pt = setTimeout(() => { const s = pend; pend = new Set(); api.lastSync = Date.now(); try { if (typeof window.onRemoteData === 'function') window.onRemoteData(s); } catch (e) { console.warn(e); } fire('fbs-sync'); panel(); }, 250); }
  function applyLocal(k, v) { api.applying = true; try { if (v == null) oRem.call(localStorage, k); else oSet.call(localStorage, k, v); } finally { api.applying = false; } }

  // ---------- localStorage হুক: লেখা হলেই ক্লাউডে পাঠানো ----------
  const timers = {};
  Storage.prototype.setItem = function (k, v) { const r = oSet.apply(this, arguments); if (this === window.localStorage && !api.applying) changed(k); return r; };
  Storage.prototype.removeItem = function (k) { const r = oRem.apply(this, arguments); if (this === window.localStorage && !api.applying) changed(k); return r; };
  function changed(k) {
    if (k === ATT) { clearTimeout(timers[k]); timers[k] = setTimeout(pushAtt, 600); return; }
    if (!synced(k)) return;
    ts[k] = Date.now(); saveTs();
    clearTimeout(timers[k]); timers[k] = setTimeout(() => pushKey(k), 700);
  }
  async function pushKey(k) {
    if (!api.user || !isAdmin()) return;
    const v = localStorage.getItem(k), r = DB.ref(db, base + '/data/' + enc(k));
    try { if (v == null) await DB.remove(r); else await DB.set(r, { v, t: ts[k] || Date.now(), by: api.user.uid }); status('সিঙ্ক হয়েছে'); } catch (e) { status('সিঙ্ক ব্যর্থ: ' + (e.code || e.message), 1); }
  }

  // ---------- জিপিএস হাজিরা: রেকর্ড ধরে ধরে ----------
  const sentAtt = {};
  const canAtt = r => isAdmin() || (api.role === 'teacher' && String(r.email || '').toLowerCase() === String(api.user.email).toLowerCase());
  async function pushAtt() {
    if (!api.user) return;
    for (const r of rj(ATT, [])) {
      if (!r || !r.id || !canAtt(r)) continue;
      const js = JSON.stringify(r); if (sentAtt[r.id] === js) continue;
      try { await DB.set(DB.ref(db, base + '/att/' + enc(r.id)), JSON.parse(js)); sentAtt[r.id] = js; status('হাজিরা সিঙ্ক হয়েছে'); } catch (e) { status('হাজিরা সিঙ্ক ব্যর্থ: ' + (e.code || e.message), 1); }
    }
  }
  function mergeRec(a, b) {
    if (!a) return b; const m = Object.assign({}, a, b);
    if (a.del || b.del) m.del = true;
    if (a.inAt && b.inAt) m.inAt = Math.min(a.inAt, b.inAt);
    if (a.outAt || b.outAt) { m.outAt = Math.max(a.outAt || 0, b.outAt || 0); m.outGeo = (b.outAt || 0) >= (a.outAt || 0) ? (b.outGeo || a.outGeo) : (a.outGeo || b.outGeo); }
    return m;
  }
  function attRemote(snap) {
    const r = snap.val(); if (!r || !r.id) return; sentAtt[r.id] = JSON.stringify(r);
    const list = rj(ATT, []), i = list.findIndex(x => x && x.id === r.id), m = mergeRec(i >= 0 ? list[i] : null, r);
    if (i >= 0 && JSON.stringify(list[i]) === JSON.stringify(m)) return;
    if (i >= 0) list[i] = m; else list.push(m);
    applyLocal(ATT, JSON.stringify(list)); notify(ATT);
  }

  // ---------- সাধারণ তথ্য: রিমোট → লোকাল ----------
  const dec = k => decodeURIComponent(k);
  function dataRemote(snap) {
    const k = dec(snap.key), r = snap.val(); if (!r || typeof r.v !== 'string' || !synced(k)) return;
    if (localStorage.getItem(k) === r.v) { ts[k] = r.t || ts[k]; return; }
    if (isAdmin() && (ts[k] || 0) > (r.t || 0)) return; // অ্যাডমিনের নতুন লোকাল বদল আগে যাবে
    ts[k] = r.t || Date.now(); saveTs(); applyLocal(k, r.v); notify(k);
  }
  function dataRemoved(snap) { const k = dec(snap.key); if (!synced(k) || localStorage.getItem(k) == null) return; delete ts[k]; saveTs(); applyLocal(k, null); notify(k); }

  let offs = [];
  async function startSync() {
    stopSync(); status('সিঙ্ক চলছে…');
    try {
      // শুরুতে একবার মিলিয়ে নেওয়া: অ্যাডমিনের নতুন লোকাল তথ্য ক্লাউডে, বাকি সব ক্লাউড থেকে
      const snap = await DB.get(DB.ref(db, base + '/data')), remote = snap.val() || {};
      if (isAdmin()) for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (synced(k) && !remote[enc(k)]) { ts[k] = ts[k] || Date.now(); await pushKey(k); } }
    } catch (e) { status('পড়া যায়নি: ' + (e.code || e.message), 1); }
    const D = DB.ref(db, base + '/data'), A = DB.ref(db, base + '/att');
    offs = [DB.onChildAdded(D, dataRemote), DB.onChildChanged(D, dataRemote), DB.onChildRemoved(D, dataRemoved),
            DB.onChildAdded(A, attRemote), DB.onChildChanged(A, attRemote)];
    pushAtt(); idbStart(); status('সিঙ্ক চালু'); fire('fbs-sync');
  }
  function stopSync() { offs.forEach(f => { try { f(); } catch (e) {} }); offs = []; idbStop(); }
  async function fullSync() { if (!api.user) return; status('সিঙ্ক চলছে…'); for (const k of Object.keys(localStorage)) if (synced(k) && isAdmin()) { ts[k] = Date.now(); await pushKey(k); } await pushAtt(); await idbScan(); status('সিঙ্ক সম্পন্ন'); }

  // ---------- ছবি ও PDF (IndexedDB ↔ Firebase Storage) ----------
  const IDBS = [{ n: 'kalyani_gallery', v: 2, stores: ['photos', 'photos_full'] }, { n: 'kalyani_files', v: 1, stores: ['files'] }];
  const openDb = d => new Promise((res, rej) => { const r = indexedDB.open(d.n, d.v); r.onupgradeneeded = () => d.stores.forEach(s => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' }); }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = (h, s, m, f) => new Promise((res, rej) => { const t = h.transaction(s, m); let out; Promise.resolve(f(t.objectStore(s))).then(v => { out = v; }); t.oncomplete = () => res(out); t.onerror = () => rej(t.error); });
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const b2d = b => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = () => rej(f.error); f.readAsDataURL(b); });
  async function ser(v) {
    if (v instanceof Blob) return { __blob: await b2d(v) };
    if (v instanceof ArrayBuffer) return { __ab: await b2d(new Blob([v])) };
    if (ArrayBuffer.isView(v)) return { __ab: await b2d(new Blob([v.buffer])), view: v.constructor.name };
    if (Array.isArray(v)) return Promise.all(v.map(ser));
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = await ser(v[k]); return o; }
    return v;
  }
  async function des(v) {
    if (Array.isArray(v)) return Promise.all(v.map(des));
    if (v && typeof v === 'object') {
      if (v.__blob) return (await fetch(v.__blob)).blob();
      if (v.__ab) { const ab = await (await fetch(v.__ab)).arrayBuffer(); return v.view && self[v.view] ? new self[v.view](ab) : ab; }
      const o = {}; for (const k of Object.keys(v)) o[k] = await des(v[k]); return o;
    }
    return v;
  }
  const size = v => v == null ? 0 : typeof v === 'string' ? v.length : v.byteLength != null ? v.byteLength : v.size != null && typeof v !== 'object' ? 0 : v instanceof Blob ? v.size : typeof v === 'object' ? Object.keys(v).reduce((a, k) => a + size(v[k]), 0) : 8;
  const fp = r => r.id + '|' + (r.updatedAt || r.t || r.time || r.date || '') + '|' + size(r);
  const idbPath = (d, s, id) => base + '/files/' + d.n + '__' + s + '/' + enc(String(id));
  let idbTimer = 0, idbOffs = [], seen = rj(SEEN, {});
  async function idbScan() {
    if (!api.user) return;
    for (const d of IDBS) {
      let h; try { h = await openDb(d); } catch (e) { continue; }
      for (const s of d.stores) {
        const key = d.n + '__' + s, local = await tx(h, s, 'readonly', st => rq(st.getAll())), ids = new Set(local.map(r => String(r.id)));
        if (isAdmin()) {
          let idx = {}; try { idx = (await DB.get(DB.ref(db, base + '/files/' + key))).val() || {}; } catch (e) {}
          for (const r of local) {
            const id = String(r.id), f = fp(r); if (idx[enc(id)] && idx[enc(id)].fp === f) continue;
            try { const body = new Blob([JSON.stringify(await ser(r))], { type: 'application/json' }), p = 'schools/' + SCHOOL_ID + '/idb/' + key + '/' + enc(id) + '.json';
              await ST.uploadBytes(ST.ref(store, p), body); await DB.set(DB.ref(db, idbPath(d, s, id)), { fp: f, p, t: Date.now() }); } catch (e) { status('ফাইল সিঙ্ক ব্যর্থ: ' + (e.code || e.message), 1); }
          }
          for (const id of (seen[key] || [])) if (!ids.has(id) && idx[enc(id)]) { try { await ST.deleteObject(ST.ref(store, idx[enc(id)].p)); } catch (e) {} await DB.remove(DB.ref(db, idbPath(d, s, id))); }
        }
        seen[key] = Array.from(ids);
      }
      h.close();
    }
    try { oSet.call(localStorage, SEEN, JSON.stringify(seen)); } catch (e) {}
  }
  async function idbRemote(d, s, snap) {
    const m = snap.val(); if (!m || !m.p) return; const id = dec(snap.key);
    try {
      const h = await openDb(d), cur = (await tx(h, s, 'readonly', st => rq(st.getAll()))).find(r => String(r.id) === id);
      if (!cur || fp(cur) !== m.fp) {
        const url = await ST.getDownloadURL(ST.ref(store, m.p)), rec = await des(await (await fetch(url)).json());
        await tx(h, s, 'readwrite', st => rq(st.put(rec))); notify('idb:' + d.n);
      }
      h.close();
    } catch (e) { console.warn('[fbs] ফাইল নামানো যায়নি', e); }
  }
  async function idbGone(d, s, snap) { if (isAdmin()) return; const id = dec(snap.key); try { const h = await openDb(d), k = (await tx(h, s, 'readonly', st => rq(st.getAllKeys()))).find(x => String(x) === id); if (k != null) await tx(h, s, 'readwrite', st => rq(st.delete(k))); h.close(); notify('idb:' + d.n); } catch (e) {} }
  function idbStart() {
    for (const d of IDBS) for (const s of d.stores) { const R = DB.ref(db, base + '/files/' + d.n + '__' + s); idbOffs.push(DB.onChildAdded(R, x => idbRemote(d, s, x)), DB.onChildChanged(R, x => idbRemote(d, s, x)), DB.onChildRemoved(R, x => idbGone(d, s, x))); }
    setTimeout(idbScan, 5000); idbTimer = setInterval(idbScan, 60000);
  }
  function idbStop() { idbOffs.forEach(f => { try { f(); } catch (e) {} }); idbOffs = []; clearInterval(idbTimer); }

  // ---------- লগইন অবস্থা ----------
  async function loadRole(u) {
    const em = String(u.email || '').toLowerCase();
    if (ADMIN_EMAILS.map(x => x.toLowerCase()).includes(em)) return 'admin';
    try { const v = (await DB.get(DB.ref(db, base + '/roles/' + ek(em)))).val(); return v === 'admin' || v === 'teacher' ? v : 'viewer'; } catch (e) { return 'viewer'; }
  }
  AU.onAuthStateChanged(auth, async u => {
    api.user = u || null; api.role = u ? await loadRole(u) : 'viewer'; api.ready = true;
    fire('fbs-auth'); panel();
    if (u) startSync(); else stopSync();
  });

  // ---------- লগইন/অ্যাকাউন্ট প্যানেল ----------
  let msg = '', msgBad = false; const status = (t, bad) => { msg = t; msgBad = !!bad; panel(); };
  const ROLE = { admin: 'অ্যাডমিন', teacher: 'শিক্ষক', viewer: 'দর্শক (শুধু দেখা)' };
  const ERR = { 'auth/invalid-credential': 'ইমেইল বা পাসওয়ার্ড ভুল।', 'auth/invalid-email': 'ইমেইল সঠিক নয়।', 'auth/user-not-found': 'এই ইমেইলে অ্যাকাউন্ট নেই।', 'auth/wrong-password': 'পাসওয়ার্ড ভুল।', 'auth/email-already-in-use': 'এই ইমেইলে অ্যাকাউন্ট আগেই আছে।', 'auth/weak-password': 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের দিন।', 'auth/too-many-requests': 'অনেকবার চেষ্টা হয়েছে, একটু পরে আবার দিন।', 'auth/network-request-failed': 'ইন্টারনেট সংযোগ নেই।' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let el = null, open = false, roles = {};
  const css = '#fbsBg{position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:14px;font-family:"Noto Sans Bengali",system-ui,sans-serif}#fbsBox{background:#fff;border-radius:18px;max-width:420px;width:100%;max-height:92vh;overflow:auto;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.4);color:#0f172a}#fbsBox h3{margin:0 0 4px;color:#0a4d33;font-size:1.15rem}#fbsBox input,#fbsBox select{width:100%;padding:9px 11px;margin:5px 0;border:1px solid #cbd5e1;border-radius:10px;font-size:.95rem}#fbsBox button{padding:9px 14px;border-radius:10px;border:0;font-weight:700;cursor:pointer;font-size:.9rem;margin:3px 3px 3px 0;background:#e2e8f0;color:#0f172a}#fbsBox button.p{background:#0a4d33;color:#fff}#fbsBox button.d{background:#be123c;color:#fff}#fbsBox .m{font-size:.82rem;margin:6px 0}#fbsBox .r{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding:5px 0;font-size:.85rem}';
  function panel(show) {
    if (show === true) open = true; if (!open) return;
    if (!el) { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); el = document.createElement('div'); el.id = 'fbsBg'; document.body.appendChild(el); el.addEventListener('click', onClick); el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'fbsPw') go('login'); if (e.key === 'Escape') shut(); }); }
    const u = api.user, m = msg ? '<div class="m" style="color:' + (msgBad ? '#be123c' : '#15803d') + '">' + esc(msg) + '</div>' : '';
    let h = '<div id="fbsBox"><h3>কল্যাণী সরকারি প্রাথমিক বিদ্যালয়</h3>';
    if (!u) h += '<div class="m" style="color:#475569">ক্লাউড লগইন (শিক্ষক / অ্যাডমিন)</div><input id="fbsEm" type="email" placeholder="ইমেইল" autocomplete="username"><input id="fbsPw" type="password" placeholder="পাসওয়ার্ড" autocomplete="current-password">' + m + '<button class="p" data-a="login">লগইন</button><button data-a="signup">নতুন অ্যাকাউন্ট</button><button data-a="reset">পাসওয়ার্ড ভুলে গেছি</button><button data-a="close">বন্ধ</button><div class="m" style="color:#64748b">নতুন অ্যাকাউন্ট খুললে প্রথমে “দর্শক” থাকে; অ্যাডমিন অনুমতি দিলে “শিক্ষক” হবেন।</div>';
    else {
      h += '<div class="m"><b>' + esc(u.email) + '</b><br>ভূমিকা: <b>' + ROLE[api.role] + '</b>' + (api.lastSync ? '<br>সর্বশেষ সিঙ্ক: ' + new Date(api.lastSync).toLocaleTimeString('bn-BD') : '') + '</div>' + m +
        '<button class="p" data-a="sync">এখনই সিঙ্ক</button><button class="d" data-a="logout">লগআউট</button><button data-a="close">বন্ধ</button>';
      if (api.role === 'admin') {
        h += '<hr style="margin:12px 0"><div class="m"><b>শিক্ষক / অ্যাডমিন যোগ করুন</b></div><input id="fbsRe" type="email" placeholder="শিক্ষকের ইমেইল"><select id="fbsRr"><option value="teacher">শিক্ষক (হাজিরা দিতে পারবেন)</option><option value="admin">অ্যাডমিন (সব সম্পাদনা)</option></select><button class="p" data-a="addrole">যোগ করুন</button>' +
          Object.keys(roles).map(k => '<div class="r"><span>' + esc(k.replace(/,/g, '.')) + ' — ' + esc(ROLE[roles[k]] || roles[k]) + '</span><button class="d" data-a="delrole" data-k="' + esc(k) + '">×</button></div>').join('');
      }
    }
    const keep = {}; ['fbsEm', 'fbsPw', 'fbsRe'].forEach(i => { const x = document.getElementById(i); if (x && x.value) keep[i] = x.value; });
    el.innerHTML = h + '</div>';
    Object.keys(keep).forEach(i => { const x = document.getElementById(i); if (x) x.value = keep[i]; });
  }
  function shut() { open = false; if (el) { el.remove(); el = null; } }
  async function loadRoles() { try { roles = (await DB.get(DB.ref(db, base + '/roles'))).val() || {}; } catch (e) { roles = {}; } panel(); }
  const val = id => { const x = document.getElementById(id); return x ? x.value.trim() : ''; };
  async function go(a, t) {
    try {
      if (a === 'login') await AU.signInWithEmailAndPassword(auth, val('fbsEm'), val('fbsPw'));
      else if (a === 'signup') { await AU.createUserWithEmailAndPassword(auth, val('fbsEm'), val('fbsPw')); }
      else if (a === 'reset') { await AU.sendPasswordResetEmail(auth, val('fbsEm')); status('পাসওয়ার্ড রিসেটের ইমেইল পাঠানো হয়েছে।'); }
      else if (a === 'logout') { await AU.signOut(auth); status(''); }
      else if (a === 'sync') await fullSync();
      else if (a === 'close') shut();
      else if (a === 'addrole') { const em = val('fbsRe').toLowerCase(); if (!em) return; await DB.set(DB.ref(db, base + '/roles/' + ek(em)), val('fbsRr')); status('যোগ হয়েছে: ' + em); loadRoles(); }
      else if (a === 'delrole') { await DB.remove(DB.ref(db, base + '/roles/' + t)); loadRoles(); }
    } catch (e) { status(ERR[e.code] || ('ত্রুটি: ' + (e.code || e.message)), 1); }
  }
  function onClick(e) { if (e.target === el) return shut(); const b = e.target.closest('button[data-a]'); if (b) go(b.dataset.a, b.dataset.k); }
  const op = api.openPanel; api.openPanel = () => { panel(true); if (isAdmin()) loadRoles(); }; void op;
}
