// meezan WhatsApp bridge — Baileys, dedicated number, pairing-code bootstrap.
// Env:
//   WA_PHONE        dedicated number, digits only, country code first (e.g. 201108824685)
//   BRIDGE_TOKEN    bearer token the poller must send
//   PORT            listen port (default 3789)
// Behavior: conservative sending — global min gap + per-recipient cooldown, one
// message at a time, no retries storm, no bulk. Dedicated number only.
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import http from 'node:http';
import pino from 'pino';

const WA_PHONE = (process.env.WA_PHONE || '').replace(/\D/g, '');
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || '';
const PORT = Number(process.env.PORT || 3789);
if (!WA_PHONE || !BRIDGE_TOKEN) { console.error('WA_PHONE and BRIDGE_TOKEN are required'); process.exit(1); }

const logger = pino({ level: 'warn' });
let sock = null;
let ready = false;
let pairingRequested = false;

// Conservative throttle: 1 msg / 3s global, same recipient max 1 / 2 min
const GLOBAL_GAP_MS = 3000;
const PER_RECIPIENT_MS = 120000;
let lastSentAt = 0;
const perRecipient = new Map();
const queue = [];
let draining = false;

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === 'open') {
      const connectedPhone=String(sock.user?.id||'').split(':')[0].split('@')[0];
      ready=connectedPhone===WA_PHONE;
      if(ready)console.log('[bridge] dedicated WhatsApp account verified');
      else console.error('[bridge] account mismatch; all sending disabled');
    }
    if (connection === 'close') {
      ready = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) { console.log('[bridge] reconnecting…'); setTimeout(connect, 3000); }
      else console.error('[bridge] logged out — delete auth_info and pair again');
    }
  });
  if (!state.creds.registered && !pairingRequested) {
    pairingRequested = true;
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(WA_PHONE);
        console.log('\n================================================');
        console.log('  PAIRING CODE (enter in WhatsApp on the phone):');
        console.log('   ', code);
        console.log('  WhatsApp > Linked devices > Link a device >');
        console.log('  "Link with phone number instead"');
        console.log('================================================\n');
      } catch (e) { console.error('[bridge] pairing code failed:', e?.message || e); pairingRequested = false; }
    }, 3000);
  }
}

function normalizePhone(to) {
  let d = String(to || '').replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 11) d = '2' + d; // Egyptian local 01xxxxxxxxx -> 201xxxxxxxxx
  return d;
}

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const job = queue.shift();
    const now = Date.now();
    const waitGlobal = Math.max(0, lastSentAt + GLOBAL_GAP_MS - now);
    const waitRecip = Math.max(0, (perRecipient.get(job.to) || 0) + PER_RECIPIENT_MS - now);
    const wait = Math.max(waitGlobal, waitRecip);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    if (!ready) { job.reject(new Error('bridge not connected')); continue; }
    try {
      const sent = await sock.sendMessage(job.to + '@s.whatsapp.net', { text: job.text });
      if(!sent?.key?.id)throw new Error('unknown provider receipt');
      lastSentAt = Date.now();
      perRecipient.set(job.to, lastSentAt);
      job.resolve({ ok: true, messageId: sent.key.id });
    } catch (e) { job.reject(e); }
  }
  draining = false;
}

function enqueue(to, text) {
  return new Promise((resolve, reject) => {
    if (queue.length >= 50) return reject(new Error('queue full'));
    queue.push({ to, text, resolve, reject });
    drain();
  });
}

const server = http.createServer((req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET' && req.url === '/health') return send(200, { ready, queue: queue.length });
  if (req.method === 'POST' && req.url === '/send') {
    if ((req.headers.authorization || '') !== 'Bearer ' + BRIDGE_TOKEN) return send(401, { error: 'unauthorized' });
    let body = '';
    req.on('data', c => { body += c; if (body.length > 20000) req.destroy(); });
    req.on('end', async () => {
      try {
        const { to, text } = JSON.parse(body || '{}');
        const phone = normalizePhone(to);
        if (!phone || phone.length < 10 || !text || typeof text !== 'string') return send(400, { error: 'bad to/text' });
        if (text.length > 4000) return send(400, { error: 'text too long' });
        const r = await enqueue(phone, text.slice(0, 4000));
        send(200, r);
      } catch (e) { send(500, { error: String(e?.message || e) }); }
    });
    return;
  }
  send(404, { error: 'not found' });
});

server.listen(PORT, () => console.log('[bridge] HTTP on :' + PORT));
connect();
