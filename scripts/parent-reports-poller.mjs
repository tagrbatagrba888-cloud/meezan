// ميزان - مجدول تقارير أولياء الأمور (GitHub Actions)
// يقرأ exam_subs/homework_subs عبر Firestore REST، وعند نتيجة مصححة جديدة:
//  1) يحدّث student_results/{studentId} (تقرأه بوابة ولي الأمر)
//  2) إشعار داخل المنصة لكل ولي أمر مرتبط
//  3) إيميل HTML عبر Brevo   4) تيليجرام   5) واتساب عبر الجسر
// ويعالج رسائل بوت تيليجرام (ربط الحساب بالكود) عبر getUpdates.
// أول تشغيل: يبني student_results للنتائج الموجودة بدون إرسال أي إشعارات.
const API_KEY = 'AIzaSyAmkCOrSaklhUiDdDfZCpSDQNmMYP-Gdw0'; // نفس مفتاح الويب العام للموقع
const BREVO = process.env.BREVO_API_KEY || '';
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const WA_URL = (process.env.WHATSAPP_BRIDGE_URL || '').replace(/\/$/, '');
const WA_TOKEN = process.env.WHATSAPP_BRIDGE_TOKEN || '';
const FROM = 'منصة ميزان | MEEZAN <tagrbatagrba888@gmail.com>';
const SITE = 'https://mee7an.vercel.app';
const LOGO_URL = 'https://i.ibb.co/ymXPqr46/file-00000000af0c820aa687a3c3181a6a24.png';
const BASE = 'https://firestore.googleapis.com/v1/projects/qanon-c716d/databases/(default)/documents';

const SOURCES = [
  { kind: 'exam', kindLabel: 'الاختبار', coll: 'exam_subs', idKey: 'examId', nameKey: 'examName' },
  { kind: 'homework', kindLabel: 'الواجب', coll: 'homework_subs', idKey: 'homeworkId', nameKey: 'homeworkName' }
];

function gradeMessage(pct) {
  if (pct >= 90) return { label: 'ممتاز', msg: 'أداء رائع! 🌟', color: '#1a7f4b' };
  if (pct >= 75) return { label: 'جيد جدًا', msg: 'نتيجة قوية وقريبة من القمة 💪', color: '#2e7d32' };
  if (pct >= 50) return { label: 'جيد', msg: 'نتيجة جيدة وستتحسن بالمراجعة 📚', color: '#b8860b' };
  return { label: 'تحتاج مراجعة', msg: 'الدرس يحتاج مراجعة إضافية 🌱', color: '#b23b3b' };
}
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- Firestore REST ----------
function fromFs(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
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
  const r = await fetch(`${BASE}/${path}?key=${API_KEY}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore GET ${path}: ${r.status}`);
  return r.json();
}
async function fsCreate(coll, docId, data) {
  const fields = {}; for (const [k, v] of Object.entries(data)) fields[k] = toFs(v);
  const r = await fetch(`${BASE}/${coll}?documentId=${encodeURIComponent(docId)}&key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields })
  });
  if (r.status === 409) return null;
  if (!r.ok) throw new Error(`Firestore create ${coll}/${docId}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function fsPatch(path, data) {
  const fields = {}; for (const [k, v] of Object.entries(data)) fields[k] = toFs(v);
  const r = await fetch(`${BASE}/${path}?key=${API_KEY}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields })
  });
  if (!r.ok) throw new Error(`Firestore patch ${path}: ${r.status}`);
  return r.json();
}
function docToObj(d) { const o = {}; for (const [k, v] of Object.entries((d && d.fields) || {})) o[k] = fromFs(v); return o; }
function itemsOf(doc) {
  const arr = doc && doc.fields && doc.fields.items && doc.fields.items.arrayValue;
  return arr && arr.values ? arr.values.map((v) => fromFs(v)) : [];
}

// ---------- القنوات ----------
function parseFrom(v) { const m = /^(.*)<([^>]+)>\s*$/.exec(v); return m ? { name: m[1].trim(), email: m[2].trim() } : { email: v.trim() }; }
async function sendEmail(to, mail) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': BREVO, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: parseFrom(FROM), to: [{ email: to }], subject: mail.subject, textContent: mail.text, htmlContent: mail.html })
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
async function sendTelegram(chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
async function sendWhatsApp(toE164, text) {
  const res = await fetch(`${WA_URL}/send`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + WA_TOKEN },
    body: JSON.stringify({ to: toE164, text })
  });
  if (!res.ok) throw new Error(`WA bridge ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// ---------- إشعار داخل المنصة ----------
async function notifyInSite(userId, title, body, targetLabel) {
  const notifId = 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  await fsCreate('notifications', notifId, {
    id: notifId, title, body, type: 'text', senderId: 'system', senderName: 'منصة ميزان',
    createdAt: new Date().toISOString(), target: 'custom', targetLabel: targetLabel || '',
    recipients: [String(userId)], recipientsCount: 1
  });
  const refPath = `user_notifications/${userId}`;
  const cur = await fsGet(refPath);
  const d = cur ? docToObj(cur) : {};
  let ids = d.notifIds || [];
  if (!ids.includes(notifId)) ids = [notifId, ...ids].slice(0, 100);
  await fsPatch(refPath, { userId: String(userId), notifIds: ids, readIds: d.readIds || [], updatedAt: new Date().toISOString() });
}

// ---------- إيميل ولي الأمر ----------
function buildParentEmail({ parentName, studentName, itemName, kindLabel, score, total, correctedAt }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const g = gradeMessage(pct);
  const dateStr = new Date(correctedAt || Date.now()).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const subject = `نتيجة ${studentName} في ${kindLabel}: ${itemName} — ${score}/${total}`;
  const link = SITE + '/parent.html';
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 12px;">
    <div style="background:#0B3D2E;border-radius:16px 16px 0 0;padding:28px 24px;text-align:center;">
      <img src="${LOGO_URL}" alt="ميزان" width="72" height="72" style="border-radius:16px;display:inline-block;">
      <h1 style="color:#ffffff;font-size:22px;margin:12px 0 4px;">منصة ميزان التعليمية</h1>
      <p style="color:#c9a227;font-size:13px;margin:0;letter-spacing:1px;">تقرير ولي الأمر</p>
    </div>
    <div style="background:#ffffff;padding:32px 28px;border-radius:0 0 16px 16px;">
      <p style="font-size:17px;color:#222;margin:0 0 6px;">أهلًا <strong>${escapeHtml(parentName || 'ولي الأمر')}</strong> 👋</p>
      <p style="font-size:15px;color:#555;margin:0 0 22px;">صدرت نتيجة جديدة لابنك <strong>${escapeHtml(studentName)}</strong> في ${kindLabel} <strong>${escapeHtml(itemName)}</strong></p>
      <div style="background:#f8f5ec;border:1px solid #e8ddc0;border-radius:14px;padding:24px;text-align:center;margin-bottom:22px;">
        <div style="font-size:13px;color:#777;margin-bottom:6px;">الدرجة</div>
        <div style="font-size:40px;font-weight:bold;color:#0B3D2E;line:1;line-height:1;">${score}<span style="font-size:20px;color:#999;"> / ${total}</span></div>
        <div style="margin-top:10px;display:inline-block;background:${g.color};color:#fff;font-size:14px;font-weight:bold;border-radius:999px;padding:6px 18px;">${g.label} — ${pct}٪</div>
      </div>
      <p style="font-size:14px;color:#555;margin:0 0 6px;">${g.msg}</p>
      <p style="font-size:12.5px;color:#999;margin:0 0 22px;">تاريخ التصحيح: ${dateStr}</p>
      <div style="text-align:center;margin-bottom:8px;">
        <a href="${link}" style="display:inline-block;background:#0B3D2E;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;border-radius:12px;padding:14px 36px;">فتح بوابة ولي الأمر</a>
      </div>
    </div>
    <p style="text-align:center;font-size:12px;color:#999;margin:18px 0 0;">
      وصلك هذا البريد لأن حسابك مرتبط بحساب الطالب ${escapeHtml(studentName)} على منصة ميزان.<br>© ميزان | MEEZAN
    </p>
  </div>
</body>
</html>`;
  const text = `أهلًا ${parentName || 'ولي الأمر'}\nصدرت نتيجة جديدة لابنك ${studentName} في ${kindLabel}: ${itemName}\nالدرجة: ${score} من ${total} (${pct}٪ - ${g.label})\nبوابة ولي الأمر: ${link}`;
  return { subject, html, text };
}

// ---------- نشر نتيجة لأولياء الأمور ----------
async function fanoutResult(cfg, s, baseline) {
  const itemId = String(s[cfg.idKey]);
  const docId = `${cfg.kind}_${itemId}_${s.userId}`.replace(/[^\w-]/g, '_');
  const claim = await fsCreate('parent_result_events', docId, {
    kind: cfg.kind, itemId, userId: String(s.userId),
    status: baseline ? 'baseline' : 'processing', createdAt: new Date().toISOString()
  });
  if (!claim) return { claimed: false };

  const studentId = String(s.userId);
  const studentName = s.userName || 'الطالب';
  const score = s.score, total = s.totalScore || 0;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const now = new Date().toISOString();

  // 1) student_results — دائمًا (حتى في البيسلاين، لعرض النتائج الموجودة في البوابة)
  const resPath = `student_results/${studentId}`;
  const resDoc = await fsGet(resPath);
  let items = resDoc ? (itemsOf(resDoc)) : [];
  const key = cfg.kind + '_' + itemId;
  items = items.filter((r) => r.key !== key);
  items.unshift({ key, kind: cfg.kind, itemId, itemName: s[cfg.nameKey] || cfg.kindLabel, score, totalScore: total, percent: pct, correctedAt: s.correctedAt || s.submittedAt || now });
  await fsPatch(resPath, { studentId, items: items.slice(0, 200), updatedAt: now });

  if (baseline) return { claimed: true, notified: 0 };

  // 2) الأوصياء المرتبطون
  const linksDoc = await fsGet(`student_links/${studentId}`);
  const parentsMap = (linksDoc && docToObj(linksDoc).parents) || {};
  const parentUids = Object.keys(parentsMap);
  let notified = 0;
  for (const puid of parentUids) {
    const pDoc = await fsGet(`parents/${puid}`);
    if (!pDoc) continue;
    const parent = docToObj(pDoc);
    if (parent.status && parent.status !== 'approved') continue;

    const title = `📊 نتيجة جديدة: ${studentName}`;
    const body = `حصل ${studentName} على ${score}/${total} (${pct}%) في ${cfg.kindLabel} «${s[cfg.nameKey] || ''}».`;
    await notifyInSite(puid, title, body, 'نتيجة جديدة').catch((e) => console.error('insite', puid, e.message));

    const mail = buildParentEmail({ parentName: parent.fullName, studentName, itemName: s[cfg.nameKey] || cfg.kindLabel, kindLabel: cfg.kindLabel, score, total, correctedAt: s.correctedAt || s.submittedAt });
    if (BREVO && parent.email) await sendEmail(parent.email, mail).catch((e) => console.error('brevo', puid, e.message));

    const g = gradeMessage(pct);
    const tgText = `📊 <b>نتيجة جديدة لابنك ${escapeHtml(studentName)}</b>\n\n${cfg.kindLabel}: ${escapeHtml(s[cfg.nameKey] || '')}\nالدرجة: <b>${score}/${total}</b> (${pct}٪ — ${g.label})\n${g.msg}\n\n— منصة ميزان`;
    if (TG_TOKEN && parent.telegramChatId) await sendTelegram(parent.telegramChatId, tgText).catch((e) => console.error('tg', puid, e.message));
    if (WA_URL && WA_TOKEN && parent.whatsapp) await sendWhatsApp(parent.whatsapp, tgText.replace(/<[^>]+>/g, '*').replace(/\*+/g, '*')).catch((e) => console.error('wa', puid, e.message));
    notified++;
  }
  await fsPatch(`parent_result_events/${docId}`, { status: 'done', notified, doneAt: new Date().toISOString() });
  return { claimed: true, notified };
}

// ---------- بوت تيليجرام: ربط الحساب بالكود ----------
async function processTelegramUpdates() {
  if (!TG_TOKEN) { console.log('telegram: no token, skipping'); return; }
  const metaPath = 'parent_reports_meta/telegram';
  const meta = await fsGet(metaPath);
  const offset = meta && docToObj(meta).offset ? Number(docToObj(meta).offset) : 0;
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offset, timeout: 0, allowed_updates: ['message'] })
  });
  if (!r.ok) { console.error('tg getUpdates', r.status); return; }
  const updates = ((await r.json()).result) || [];
  let maxId = offset;
  for (const u of updates) {
    maxId = Math.max(maxId, u.update_id + 1);
    const msg = u.message;
    if (!msg || !msg.chat || !msg.text) continue;
    const chatId = msg.chat.id;
    const text = String(msg.text).trim();

    if (/\/(stop|unlink)/i.test(text)) {
      await unlinkTelegram(chatId);
      await sendTelegram(chatId, 'تم إلغاء ربط حسابك. لن تصلك تقارير على تيليجرام.').catch(() => {});
      continue;
    }
    const m = /PAR-[0-9]{4,8}/i.exec(text);
    if (!m) {
      if (/\/start/i.test(text)) await sendTelegram(chatId, 'أهلًا بك في بوت منصة ميزان لأولياء الأمور 🌿\n\nأرسل كود ولي الأمر الخاص بك (يبدأ بـ PAR) لربط حسابك واستلام نتائج أبنائك هنا فور صدورها.').catch(() => {});
      continue;
    }
    const code = m[0].toUpperCase();
    const found = await findParentByCode(code);
    if (!found) { await sendTelegram(chatId, 'هذا الكود غير موجود. تأكد من كود ولي الأمر في بوابة ولي الأمر ثم أعد المحاولة.').catch(() => {}); continue; }
    await fsPatch(`parents/${found.id}`, { telegramChatId: String(chatId), telegramUsername: (msg.from && msg.from.username) || '', updatedAt: new Date().toISOString() });
    await sendTelegram(chatId, `✅ تم ربط حسابك بنجاح يا ${found.name || 'ولي الأمر'}!\n\nستصلك نتائج أبنائك هنا فور صدورها، بجانب إشعارات المنصة والبريد الإلكتروني.`).catch(() => {});
    await notifyInSite(found.id, '✅ تم ربط تيليجرام', 'تم ربط حساب تيليجرام الخاص بك بنجاح. ستصلك نتائج أبنائك هنا أيضًا.', 'تيليجرام').catch(() => {});
    console.log('telegram linked:', code, '->', chatId);
  }
  await fsPatch(metaPath, { offset: maxId, updatedAt: new Date().toISOString() });
}
async function findParentByCode(code) {
  const r = await fetch(`${BASE}/parents?pageSize=300&key=${API_KEY}`);
  if (!r.ok) return null;
  const docs = (await r.json()).documents || [];
  for (const d of docs) {
    const o = docToObj(d);
    if (String(o.code || '').toUpperCase() === code) return { id: d.name.split('/').pop(), ...o };
  }
  return null;
}
async function unlinkTelegram(chatId) {
  const r = await fetch(`${BASE}/parents?pageSize=300&key=${API_KEY}`);
  if (!r.ok) return;
  const docs = (await r.json()).documents || [];
  for (const d of docs) {
    const o = docToObj(d);
    if (String(o.telegramChatId || '') === String(chatId)) {
      await fsPatch(`parents/${d.name.split('/').pop()}`, { telegramChatId: '', updatedAt: new Date().toISOString() });
    }
  }
}

async function run() {
  const meta = await fsGet('parent_reports_meta/state');
  const baseline = !meta;
  let claimed = 0, notifiedTotal = 0;
  for (const cfg of SOURCES) {
    const subs = itemsOf(await fsGet(`${cfg.coll}/all`));
    for (const s of subs) {
      if (!s || !s[cfg.idKey] || !s.userId || !s.corrected) continue;
      if (typeof s.score !== 'number' || typeof s.totalScore !== 'number') continue;
      const r = await fanoutResult(cfg, s, baseline);
      if (r && r.claimed) { claimed++; notifiedTotal += r.notified || 0; }
    }
  }
  if (baseline) {
    await fsPatch('parent_reports_meta/state', { baselineDoneAt: new Date().toISOString(), baselineCount: claimed });
    console.log(`BASELINE: student_results built for ${claimed} corrected submission(s), no notifications sent.`);
  }
  console.log(`parent results done. claimed=${claimed} notified=${notifiedTotal} baseline=${baseline}`);
  await processTelegramUpdates();
}
console.log('Parent reports disabled pending authenticated backend migration.');
