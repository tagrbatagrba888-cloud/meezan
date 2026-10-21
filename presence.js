// ============================================================
// 🟢 حالة الاتصال — ضعه في كل صفحات المستخدم:
// <script type="module" src="presence.js"></script>
// متصل = المستخدم داخل الموقع والتبويب ظاهر أمامه
// غير متصل = غادر الموقع / أغلق التبويب / التبويب في الخلفية / سجّل خروج
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmkCOrSaklhUiDdDfZCpSDQNmMYP-Gdw0",
  authDomain: "qanon-c716d.firebaseapp.com",
  projectId: "qanon-c716d",
  storageBucket: "qanon-c716d.firebasestorage.app",
  messagingSenderId: "757756130875",
  appId: "1:757756130875:web:63c53534c6843e2a29ce1e",
  measurementId: "G-8FZGTC779Y"
};

const SHARDS = 10;          // يجب أن يطابق لوحة المستخدمين
const BEAT_MS = 25000;      // نبضة كل 25 ثانية
const app = initializeApp(firebaseConfig, 'meezan-presence');
const db = getFirestore(app);

const S = sessionStorage;
const shardOf = (id) => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % SHARDS; };

let timer = null;
let lastState = null;

function identity() {
  if (S.getItem('meezan_logged_in') !== 'true') return null;
  const id = S.getItem('meezan_user_id');
  const role = S.getItem('meezan_role') || 'student';
  if (!id || role === 'admin' || role === 'guest') return null;
  return { id, col: role === 'teacher' ? 'teachers' : 'users' };
}

function send(on) {
  const me = identity();
  if (!me) return false;
  setDoc(doc(db, me.col, 'presence_' + shardOf(me.id)),
    { ['u_' + me.id]: { on, t: serverTimestamp() } }, { merge: true }).catch(() => {});
  return true;
}

function isActive() { return !document.hidden; }

function beat() {
  if (!isActive()) return;
  if (!send(true)) stop();
}

function start() {
  if (timer || !identity()) return;
  beat();
  timer = setInterval(beat, BEAT_MS);
}

function stop() {
  clearInterval(timer); timer = null;
}

function goOffline() {
  stop();
  if (lastState !== false) { send(false); lastState = false; }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) goOffline();
  else { lastState = true; start(); }
});
window.addEventListener('pagehide', goOffline);
window.addEventListener('beforeunload', goOffline);
window.addEventListener('online', () => { if (isActive()) { lastState = true; start(); } });
window.addEventListener('offline', stop);

// بعد تسجيل الدخول/الخروج من نفس التبويب
setInterval(() => { if (!identity()) { if (timer) goOffline(); } else if (!timer && isActive()) start(); }, 5000);

if (isActive()) { lastState = true; start(); }