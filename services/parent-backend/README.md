# Staged parent backend building blocks

Not deployed. No production sends. A native HTTP handler is implemented and emulator-tested in api.mjs, but it is not mounted or deployed. No scheduled workflow runs it.

- `admin.mjs`: explicit production activation flag, project-bound Firebase Admin initialization, verified/revocation-checked Firebase ID tokens and exact admin UID boundary.
- `channels.mjs`: 256-bit single-use, ten-minute channel proofs. Only a verified inbound sender in a private Telegram/WhatsApp chat can consume one. A PAR code cannot authorize a destination. Proof text must not be logged or stored in a public URL.
- `reports.mjs`: private per-child notices, deduplicated versioned results, persistent per-recipient/per-channel jobs, access and consent rechecked at delivery claim, conservative retries. Ambiguous provider outcomes need reconciliation, not blind resend.
- `backend.test.mjs`: Firebase emulator tests. No external providers are contacted.

Implemented: revocation-checked ID-token HTTP routes for parent profile/children/results, rate-limited link requests, admin-reviewed atomic linking/unlinking and proof issuance. Still required: deployment mounting, proof issuance UI, verified inbound Telegram/WhatsApp adapters, verified-email enrollment, provider delivery adapters and per-provider receipt reconciliation, scheduled dispatch, monitoring, and full legacy access migration.

Do not mount a generic authenticated REST proxy or expose the Admin SDK credentials to browsers. Backend methods must derive identity from a verified token, never a caller-provided UID. Report source corrections must be protected from student and parent writes before activation.

Run only against emulators until a separate production cutover approval. `npm test` refuses to run without both emulator hosts. The production activation flag alone is not a permission grant.
