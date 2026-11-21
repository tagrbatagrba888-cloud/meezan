# جسر واتساب لميزان (رقم مخصص)

يرسل تقارير النتائج لأولياء الأمور عبر واتساب من الرقم المخصص **+201108824685**
باستخدام مكتبة Baileys (غير رسمية). المستخدم وافق على مخاطر الحظر المحتملة لهذا
الرقم. الإرسال متحفّظ: رسالة كل 3 ثوانٍ كحد أقصى، ونفس المستلم مرة كل دقيقتين.

## التشغيل على هاتف أندرويد مخصص (Termux)

```bash
pkg update && pkg install nodejs git -y
git clone <repo> && cd meezan/services/whatsapp-bridge
npm install
export WA_PHONE=201108824685
export BRIDGE_TOKEN='كلمة-سر-طويلة-عشوائية'
termux-wake-lock   # اختياري: يمنع توقف المعالج
node index.js
```

عند أول تشغيل سيطبع **كود اقتران** من 8 أحرف. على الهاتف نفسه:
واتساب ← الأجهزة المرتبطة ← ربط جهاز ← «الربط برقم الهاتف بدلًا من ذلك» ← أدخل الكود.
يُحفَظ تسجيل الدخول في `auth_info/` — لا تحذفه ولا ترفعه لأي مكان (موجود في .gitignore).

## إتاحة الجسر للإنترنت (ضروري — GitHub Actions لا يصل لشبكة الموبايل مباشرة)

الخيار المجاني الأسهل — نفق cloudflared:

```bash
pkg install cloudflared -y
cloudflared tunnel --url http://localhost:3789
```

سيطبع رابطًا مثل `https://xxxx.trycloudflare.com` — ضعه في سرّ GitHub ‏`WHATSAPP_BRIDGE_URL`
و `WHATSAPP_BRIDGE_TOKEN` هو نفس `BRIDGE_TOKEN`.
تنبيه: رابط trycloudflare المجاني **يتغير عند إعادة التشغيل** — للثبات أنشئ نفقًا مسماً
بحساب Cloudflare مجاني، أو شغّل الجسر على أي خادم ثابت.

## الاستخدام (يقوم به poller تلقائيًا)

```bash
curl -X POST $WHATSAPP_BRIDGE_URL/send \
  -H "Authorization: Bearer $BRIDGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"2010xxxxxxxx","text":"نص التقرير"}'
```

`GET /health` يعرض `{ready, queue}`.
