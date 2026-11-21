// ميزان - مجدول إيميلات النتائج (GitHub Actions)
// يقرأ exam_subs/homework_subs عبر Firestore REST، يكتشف التسليمات المصححة حديثًا،
// يرسل إيميل HTML عبر Brevo، ويسجل المُرسل في result_emails لمنع التكرار.
const API_KEY = 'AIzaSyAmkCOrSaklhUiDdDfZCpSDQNmMYP-Gdw0'; // مفتاح الويب العام للموقع (نفس الموجود في login.html)
const BREVO = process.env.BREVO_API_KEY || '';
const FROM = 'منصة ميزان | MEEZAN <tagrbatagrba888@gmail.com>';
const SITE = 'https://mee7an.vercel.app';
const LOGO_URL = 'https://i.ibb.co/ymXPqr46/file-00000000af0c820aa687a3c3181a6a24.png';
const BASE = 'https://firestore.googleapis.com/v1/projects/qanon-c716d/databases/(default)/documents';

const EXAM_CFG = { kind: 'exam', kindLabel: 'الاختبار', coll: 'exam_subs', idKey: 'examId', nameKey: 'examName', prefix: 'exam', resultsPath: 'results.html' };
const HW_CFG = { kind: 'homework', kindLabel: 'الواجب', coll: 'homework_subs', idKey: 'homeworkId', nameKey: 'homeworkName', prefix: 'hw', resultsPath: 'results.html' };

function gradeMessage(pct) {
  if (pct >= 90) return { label: 'ممتاز', msg: 'أداء رائع! استمر على هذا المستوى المتميز 🌟', color: '#1a7f4b' };
  if (pct >= 75) return { label: 'جيد جدًا', msg: 'نتيجة قوية، وأنت قريب جدًا من القمة 💪', color: '#2e7d32' };
  if (pct >= 50) return { label: 'جيد', msg: 'نتيجة جيدة، ومع مراجعة بسيطة ستتحسن أكثر 📚', color: '#b8860b' };
  return { label: 'تحتاج مراجعة', msg: 'لا بأس! راجع الدرس وحاول مرة أخرى، أنت قادر 🌱', color: '#b23b3b' };
}

function buildResultEmail({ studentName, itemName, kindLabel, score, total, submittedAt, siteUrl, resultsPath, ctaLabel, ctaUrl }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const g = gradeMessage(pct);
  const dateStr = new Date(submittedAt || Date.now()).toLocaleString('ar-EG', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const subject = `نتيجتك في ${kindLabel}: ${itemName} — ${score}/${total}`;
  const link = ctaUrl || (siteUrl + '/' + resultsPath);
  const ctaText = ctaLabel || 'عرض النتيجة في المنصة';

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 12px;">
    <div style="background:#0B3D2E;border-radius:16px 16px 0 0;padding:28px 24px;text-align:center;">
      <img src="${LOGO_URL}" alt="ميزان" width="72" height="72" style="border-radius:16px;display:inline-block;">
      <h1 style="color:#ffffff;font-size:22px;margin:12px 0 4px;">منصة ميزان التعليمية</h1>
      <p style="color:#c9a227;font-size:13px;margin:0;letter-spacing:1px;">MEEZAN</p>
    </div>
    <div style="background:#ffffff;padding:32px 28px;border-radius:0 0 16px 16px;">
      <p style="font-size:17px;color:#222;margin:0 0 6px;">أهلًا <strong>${escapeHtml(studentName)}</strong> 👋</p>
      <p style="font-size:15px;color:#555;margin:0 0 22px;">تم رصد نتيجتك في ${kindLabel} <strong>${escapeHtml(itemName)}</strong></p>
      <div style="background:#f8f5ec;border:1px solid #e8ddc0;border-radius:14px;padding:24px;text-align:center;margin-bottom:22px;">
        <div style="font-size:13px;color:#777;margin-bottom:6px;">درجتك</div>
        <div style="font-size:40px;font-weight:bold;color:#0B3D2E;line-height:1;">${score}<span style="font-size:20px;color:#999;"> / ${total}</span></div>
        <div style="margin-top:10px;display:inline-block;background:${g.color};color:#fff;font-size:14px;font-weight:bold;border-radius:999px;padding:6px 18px;">${g.label} — ${pct}٪</div>
      </div>
      <p style="font-size:14px;color:#555;margin:0 0 6px;">${g.msg}</p>
      <p style="font-size:12.5px;color:#999;margin:0 0 22px;">تاريخ التسليم: ${dateStr}</p>
      <div style="text-align:center;margin-bottom:8px;">
        <a href="${link}" style="display:inline-block;background:#0B3D2E;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;border-radius:12px;padding:14px 36px;">${ctaText}</a>
      </div>
    </div>
    <p style="text-align:center;font-size:12px;color:#999;margin:18px 0 0;">
      هذا إيميل تلقائي من منصة ميزان التعليمية، لا ترد عليه.<br>© ميزان | MEEZAN
    </p>
  </div>
</body>
</html>`;

  const text = `أهلًا ${studentName}\nتم رصد نتيجتك في ${kindLabel}: ${itemName}\nدرجتك: ${score} من ${total} (${pct}٪ - ${g.label})\n${g.msg}\nعرض النتيجة: ${link}`;
  return { subject, html, text };
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ------------------------------------------------------------
// إرسال عبر Brevo (Transactional Email API)
// ------------------------------------------------------------
function parseFrom(v) {
  const m = /^(.*)<([^>]+)>\s*$/.exec(v);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { email: v.trim() };
}


// ---------- Firestore REST ----------
function fromFs(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = fromFs(x); return o; }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs);
  return undefined;
}
function toFs(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  const fields = {}; for (const [k, x] of Object.entries(v)) fields[k] = toFs(x);
  return { mapValue: { fields } };
}
async function fsGet(path) {
  const r = await fetch(`${BASE}/${path}?key=${API_KEY}`, {headers: authHeaders()});
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore GET ${path}: ${r.status}`);
  return r.json();
}
async function fsCreate(coll, docId, data) {
  const fields = {}; for (const [k, v] of Object.entries(data)) fields[k] = toFs(v);
  const r = await fetch(`${BASE}/${coll}?documentId=${encodeURIComponent(docId)}&key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ fields })
  });
  if (r.status === 409) return null; // موجود بالفعل = تم إرساله/تسجيله
  if (!r.ok) throw new Error(`Firestore create ${docId}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function fsPatch(path, data, expectedUpdateTime) {
  const fields = {}; for (const [k, v] of Object.entries(data)) fields[k] = toFs(v);
  const mask = Object.keys(data).map((k) => '&updateMask.fieldPaths=' + encodeURIComponent(k)).join('');
  const condition = expectedUpdateTime ? '&currentDocument.updateTime=' + encodeURIComponent(expectedUpdateTime) : '';
  const r = await fetch(`${BASE}/${path}?key=${API_KEY}${mask}${condition}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ fields })
  });
  if (expectedUpdateTime && [409, 412].includes(r.status)) return null;
  if (!r.ok) throw new Error(`Firestore patch ${path}: ${r.status}`);
  return r.json();
}
function itemsOf(doc) {
  const arr = doc && doc.fields && doc.fields.items && doc.fields.items.arrayValue;
  return arr && arr.values ? arr.values.map((v) => fromFs(v)) : [];
}

// ---------- الإرسال عبر Brevo ----------
async function sendEmail(to, mail) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: parseFrom(FROM), to: [{ email: to }], subject: mail.subject, textContent: mail.text, htmlContent: mail.html })
  });
  if (!res.ok) { const error = new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`); error.providerRejected = true; error.status = res.status; throw error; }
  return res.json();
}

let AUTH_TOKEN = '';
let ADMIN_UID = '';
async function authenticateMailer() {
  const email = process.env.MEEZAN_ADMIN_EMAIL;
  const password = process.env.MEEZAN_ADMIN_PASSWORD;
  if (!email || !password || !process.env.MEEZAN_ADMIN_UID) throw new Error('Admin authentication configuration missing; refusing to send');
  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API_KEY, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password, returnSecureToken: true})
  });
  if (!response.ok) throw new Error('Mailer authentication failed: ' + response.status);
  const result = await response.json();
  if (result.localId !== process.env.MEEZAN_ADMIN_UID) throw new Error('Unexpected mailer identity');
  ADMIN_UID = result.localId;
  AUTH_TOKEN = result.idToken;
}
function authHeaders() { return {'Authorization': 'Bearer ' + AUTH_TOKEN}; }
let SETTINGS = {};
async function loadSettings() {
  try {
    const d = await fsGet('result_emails_meta/settings');
    if (d && d.fields) for (const [k, v] of Object.entries(d.fields)) SETTINGS[k] = fromFs(v);
  } catch (e) { /* defaults */ }
}

async function main() {
  if (!BREVO) throw new Error('BREVO_API_KEY missing');
  await loadSettings();
  if (SETTINGS.resultEmailsEnabled === false) { console.log('result emails disabled by admin settings; skipping'); return; }
  const meta = await fsGet('result_emails_meta/state');
  const baseline = !meta; // أول تشغيل: تسجيل الموجود بدون إرسال
  const users = itemsOf(await fsGet('users/all'));
  const byId = new Map(users.map((u) => [String(u.id), u]));
  let sent = 0, claimed = 0, skipped = 0;

  for (const cfg of [EXAM_CFG, HW_CFG]) {
    const subs = itemsOf(await fsGet(`${cfg.coll}/all`));
    for (const s of subs) {
      if (!s || !s[cfg.idKey] || !s.userId || !s.corrected) continue;
      if (typeof s.score !== 'number' || typeof s.totalScore !== 'number') continue;
      const itemId = String(s[cfg.idKey]);
      const docId = `${cfg.prefix}_${itemId}_${s.userId}`.replace(/[^\w-]/g, '_');
      const claim = await fsCreate('result_emails', docId, {
        kind: cfg.kind, itemId, userId: String(s.userId),
        itemName: s[cfg.nameKey] || '', score: s.score, totalScore: s.totalScore,
        status: baseline ? 'baseline' : 'sending', createdAt: new Date().toISOString()
      });
      if (!claim) continue; // مسجل مسبقًا
      claimed++;
      if (baseline) continue;

      const u = byId.get(String(s.userId));
      const email = ((u && u.email) || '').trim();
      const studentName = s.userName || (u && (u.fullName || u.username)) || 'الطالب';
      if (!email) { await fsPatch(`result_emails/${docId}`, { status: 'skipped_no_email' }); skipped++; continue; }

      const mail = buildResultEmail({
        studentName, itemName: s[cfg.nameKey] || cfg.kindLabel, kindLabel: cfg.kindLabel,
        score: s.score, total: s.totalScore, submittedAt: s.correctedAt || s.submittedAt,
        siteUrl: SITE, resultsPath: cfg.resultsPath,
        ctaLabel: SETTINGS.resultCtaLabel, ctaUrl: SETTINGS.resultCtaUrl
      });
      try {
        const r = await sendEmail(email, mail);
        await fsPatch(`result_emails/${docId}`, { status: 'sent', to: email, sentAt: new Date().toISOString(), messageId: (r && r.messageId) || '' });
        sent++;
        console.log('sent', docId, '->', email);
      } catch (e) {
        await fsPatch(`result_emails/${docId}`, { status: 'error', error: String(e.message || e) });
        console.error('send failed', docId, e.message);
      }
    }
  }
  if (baseline) {
    await fsPatch('result_emails_meta/state', { baselineDoneAt: new Date().toISOString(), baselineCount: claimed });
    console.log(`BASELINE: registered ${claimed} existing corrected submission(s) without emailing.`);
  }
  console.log(`done. claimed=${claimed} sent=${sent} skipped_no_email=${skipped} baseline=${baseline}`);
}

// ---------- صندوق الأدمن: إيميلات جماعية من صفحة الأدمن ----------
async function processAdminOutbox(onlyId) {
  let docs;
  if (onlyId) {
    // Scoped release: read exactly one outbox document by id. No listing, so no other queued mail can be touched.
    const one = await fetch(`${BASE}/admin_outbox/${encodeURIComponent(onlyId)}?key=${API_KEY}`, {headers: authHeaders()});
    if (one.status === 404) throw new Error('release outbox document not found: ' + onlyId);
    if (!one.ok) throw new Error('release outbox read failed: ' + one.status);
    docs = [await one.json()];
  } else {
    const res = await fetch(`${BASE}/admin_outbox?pageSize=50&key=${API_KEY}`, {headers: authHeaders()});
    if (!res.ok) { console.error('outbox list failed', res.status); return; }
    docs = (await res.json()).documents || [];
  }
  for (const d of docs) {
    const id = d.name.split('/').pop();
    const f = {}; for (const [k, v] of Object.entries(d.fields || {})) f[k] = fromFs(v);
    if (onlyId) {
      // Scoped release docs are staged as scoped_pending, a status the broad queued filter below never matches.
      if (f.kind !== 'release_email' || id !== onlyId) throw new Error('release doc kind/id check failed: ' + id);
      if (f.status === 'done') {
        const dl = Array.isArray(f.deliveries) ? f.deliveries : [];
        const rs = new Set((f.recipients || []).map((r) => String(r && r.email).toLowerCase()));
        if (f.sent > 0 && !f.failed && dl.length === f.sent && dl.every((x) => x && x.messageId && rs.has(String(x.email).toLowerCase()))) { console.log(`release ${id} already done with receipts: sent=${f.sent}`); continue; }
        throw new Error('release doc marked done but receipts do not verify: ' + id);
      }
      if (f.status !== 'scoped_pending') throw new Error('release doc not claimable, status=' + f.status);
      // Fresh send-time checks: named content must be published and the cohort is re-derived from current profiles. Only narrows, never widens.
      await assertReleaseContent(f.contentChecks, f.releaseGrade);
      const cur = new Map();
      for (const u of itemsOf(await fsGet('users/all'))) if (u && u.grade === f.releaseGrade && u.isDisabled !== true) cur.set(String(u.email || '').trim().toLowerCase(), u);
      const before = (f.recipients || []).length;
      f.recipients = (f.recipients || []).filter((r) => r && cur.has(String(r.email).toLowerCase()));
      console.log(`send-time cohort check: ${f.recipients.length} of ${before} staged recipients still eligible`);
    } else if (f.status !== 'queued') continue;
    if (f.createdBy !== ADMIN_UID) {
      await fsPatch(`admin_outbox/${id}`, {status: 'rejected', note: 'Missing verified admin ownership'});
      continue;
    }
    const recips = (f.recipients || []).filter((r) => r && r.email);
    if (onlyId && !recips.length) throw new Error('release has no eligible recipients; nothing claimed');
    if (!recips.length) { await fsPatch(`admin_outbox/${id}`, { status: 'done', sent: 0, failed: 0, note: 'no recipients' }); continue; }
    if (!d.updateTime) throw new Error('Missing queue version; refusing unsafe claim');
    const claim = await fsPatch(`admin_outbox/${id}`, { status: 'sending', total: recips.length, sent: 0, failed: 0 }, d.updateTime);
    if (!claim) { console.log('outbox changed or already claimed', id); continue; }
    let sentN = 0, failedN = 0;
    const deliveries = [];
    for (const r of recips) {
      const nm = r.name || 'الطالب';
      const nmHtml = onlyId ? nm.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : nm;
      const html = String(f.html || '').split('{{name}}').join(nmHtml);
      const text = String(f.text || '').split('{{name}}').join(nm);
      let receipt;
      try {
        receipt = await sendEmail(r.email, { subject: f.subject || 'رسالة من منصة ميزان', html, text });
      } catch (e) {
        if (!e.providerRejected) {
          await fsPatch(`admin_outbox/${id}`, {status:'delivery_unknown',sent:sentN,failed:failedN,deliveries,note:'Provider request outcome unknown; reconcile before retry'});
          throw e;
        }
        failedN++;
        await fsPatch(`admin_outbox/${id}`, {status:'failed',sent:sentN,failed:failedN,deliveries,note:'Provider rejected request; remaining recipients not attempted',error:String(e.message)});
        throw e; // Stop on quota/rate/provider error. No retry, no next job.
      }
      deliveries.push({email:r.email,messageId:receipt.messageId || '',acceptedAt:new Date().toISOString()});
      sentN++;
      // Receipt persistence is outside the provider catch. A storage failure must
      // never be mislabeled as failed delivery or trigger an automatic retry.
      await fsPatch(`admin_outbox/${id}`, {sent:sentN,failed:failedN,deliveries});
      // Sequential and receipt-first, without the former fixed 350ms delay.
    }
    await fsPatch(`admin_outbox/${id}`, { status: 'done', doneAt: new Date().toISOString() });
    console.log(`outbox ${id}: sent=${sentN} failed=${failedN}`);
  }
}

// ---------- Scoped release email: stage (recipients from the exact grade, one doc, never "queued") ----------
async function assertReleaseContent(checks, grade) {
  if (!Array.isArray(checks) || !checks.length) throw new Error('release needs contentChecks');
  if (typeof grade !== 'string' || !grade) throw new Error('release needs a grade');
  const seen = new Set();
  for (const c of checks) {
    if (!c || (c.kind !== 'library_summary' && c.kind !== 'homework') || c.id === undefined || String(c.id) === '') throw new Error('bad contentCheck');
    seen.add(c.kind);
    if (c.kind === 'library_summary') {
      const lib = itemsOf(await fsGet('settings/library')).find((x) => x && String(x.id) === String(c.id));
      if (!lib || lib.type !== 'summary' || lib.published !== true) throw new Error('summary card not published: ' + c.id);
      if (!Array.isArray(lib.grades) || !lib.grades.includes(grade)) throw new Error('summary card grade mismatch: ' + c.id);
      const minParts = Number(c.minParts);
      if (!(minParts >= 1)) throw new Error('summary check needs minParts');
      const sd = await fsGet('summaries/' + encodeURIComponent(String(c.id)));
      const parts = sd && sd.fields && sd.fields.parts ? fromFs(sd.fields.parts) : null;
      if (!Array.isArray(parts) || parts.length < minParts || Number(lib.partsCount) !== parts.length) throw new Error('summary parts missing or count mismatch: ' + c.id);
      if (!parts.every((x) => x && typeof x.content === 'string' && x.content.trim().length > 20)) throw new Error('summary part empty: ' + c.id);
    } else {
      const hw = itemsOf(await fsGet('homeworks/all')).find((x) => x && String(x.id) === String(c.id));
      if (!hw || hw.status !== 'published' || hw.archived === true) throw new Error('homework not published: ' + c.id);
      if (hw.grade !== grade) throw new Error('homework grade mismatch: ' + c.id);
      const n = Number(c.questions);
      if (!(n >= 1) || !Array.isArray(hw.questions) || hw.questions.length !== n) throw new Error('homework question count mismatch: ' + c.id);
      if (!hw.questions.every((q) => q && q.title && Array.isArray(q.options) && q.options.filter((o) => o && o.correct === true).length === 1)) throw new Error('homework question malformed: ' + c.id);
    }
  }
  if (!seen.has('library_summary') || !seen.has('homework')) throw new Error('release needs both a summary and a homework check');
}
async function stageRelease(releaseId) {
  const fsmod = await import('node:fs');
  const tpl = JSON.parse(fsmod.readFileSync(new URL('./release-emails/' + releaseId + '.json', import.meta.url), 'utf8'));
  if (!tpl || typeof tpl.grade !== 'string' || !tpl.grade || !tpl.subject || !tpl.html || !tpl.text) throw new Error('release template needs grade, subject, html, text');
  await assertReleaseContent(tpl.contentChecks, tpl.grade);
  const users = itemsOf(await fsGet('users/all'));
  const seen = new Set(), recipients = []; let held = 0;
  for (const u of users) {
    const email = String((u && u.email) || '').trim().toLowerCase();
    if (!u || u.grade !== tpl.grade || u.isDisabled === true) continue;
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) { held++; continue; }
    if (seen.has(email)) continue;
    seen.add(email);
    recipients.push({ email, name: String(u.fullName || u.username || '').slice(0, 80) });
  }
  const created = await fsCreate('admin_outbox', releaseId, {
    status: 'scoped_pending', kind: 'release_email', releaseGrade: tpl.grade, contentChecks: tpl.contentChecks, subject: tpl.subject, text: tpl.text, html: tpl.html,
    recipients, createdAt: new Date().toISOString(), createdBy: ADMIN_UID
  });
  if (created) { console.log(`staged ${releaseId}: ${recipients.length} recipients, ${held} held for invalid email (not repaired), status scoped_pending`); return; }
  const ex = await fsGet('admin_outbox/' + releaseId);
  const ef = {}; for (const [k, v] of Object.entries((ex && ex.fields) || {})) ef[k] = fromFs(v);
  const same = ef.kind === 'release_email' && ef.createdBy === ADMIN_UID && ef.releaseGrade === tpl.grade && ef.subject === tpl.subject && ef.text === tpl.text && ef.html === tpl.html && JSON.stringify(ef.contentChecks) === JSON.stringify(tpl.contentChecks);
  console.log(`release doc already exists, nothing staged: ${releaseId} status=${ef.status}, matches template=${same}`);
  if (!same || (ef.status !== 'scoped_pending' && ef.status !== 'done')) throw new Error('existing release doc differs from template or is in state ' + ef.status + ', needs manual check');
}

async function run() {
  await authenticateMailer();
  if (process.env.MAILER_MODE === 'health') {
    await fsGet('users/all');
    await fsGet('exam_subs/all');
    await fsGet('homework_subs/all');
    await fsGet('result_emails_meta/state');
    const queue = await fetch(`${BASE}/admin_outbox?pageSize=1&key=${API_KEY}`, {headers: authHeaders()});
    if (!queue.ok) throw new Error('Queue health read failed: '+queue.status);
    console.log('HEALTH OK: authenticated data reads verified; no writes or email sends performed.');
    return;
  }
  if (process.env.MAILER_MODE === 'release-stage') {
    const rid = process.env.MAILER_RELEASE_ID || '';
    if (!/^[-A-Za-z0-9_]{1,160}$/.test(rid)) throw new Error('release-stage needs a valid MAILER_RELEASE_ID');
    await stageRelease(rid);
    return;
  }
  if (process.env.MAILER_MODE === 'release') {
    // Scoped mode: one named outbox document only. The result-email sweep and every other queued document are skipped.
    const releaseId = process.env.MAILER_RELEASE_ID || '';
    if (!/^[-A-Za-z0-9_]{1,160}$/.test(releaseId)) throw new Error('release mode needs a valid MAILER_RELEASE_ID');
    await processAdminOutbox(releaseId);
    return;
  }
  await fsPatch('result_emails_meta/heartbeat', {lastStartedAt:new Date().toISOString(), runUrl:process.env.MAILER_RUN_URL || ''});
  let failure = null;
  try { await main(); } catch (e) { console.error('result poller error:', e); failure = e; }
  try { await processAdminOutbox(); } catch (e) { failure = failure || e; }
  await fsPatch('result_emails_meta/heartbeat', {lastCompletedAt:new Date().toISOString(), status:failure?'error':'ok', error:failure?String(failure.message):''});
  if (failure) throw failure;
}
run().catch((e) => { console.error(e); process.exit(1); });
