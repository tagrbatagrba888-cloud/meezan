# Parent backend: local, disabled by default

Not deployed. No production report sends. No proven scheduled invocation. Do not call the parent subsystem operational from source or emulator results.

## Selected limited path

- Existing student/teacher login and passwords are unchanged. No extra legacy login code is mounted.
- New parents use the shared login and verified Firebase email. Profile and parent/student relationships need authenticated admin approval.
- `firestore.parent-only.rules` is the current limited candidate. It protects new parent data and preserves inherited legacy behavior, including public legacy source access. It is not deployed and is not a whole-site isolation fix.
- `client-store.mjs` uses the existing authenticated Firebase admin identity and honors rules. No privileged key is exposed to the browser.
- `worker.mjs` reads legacy results/homework and stages private projections/notices and durable delivery jobs. It never sends externally. `scripts/parent-reports-poller.mjs --stage-only` is an explicit staging runner, not a scheduler.

Legacy shared academic records remain broadly writable/readable under the inherited fallback. Their contents cannot be described as tamper-proof. The experimental strict rules and academic migration source are not the selected rollout and have not been integrated into legacy pages.

## Report controls

`settings.mjs` normalizes `parent_report_settings/global`, schemaVersion 1. Types are exam_result, homework_result, homework_published and homework_unsolved. Channels are inSite, email, whatsapp and telegram. Missing/invalid settings default to disabled. The worker consumes explicit enabled/type/channel booleans during staging.

The unsolved delay is fixed at 48 hours. Submitted homework suppresses a reminder even if uncorrected. Publication starts at first observation because legacy homework lacks reliable publishedAt. Baseline and events observed while disabled are not backfilled. Results still update the linked-child projection with notices disabled. There is no running delivery dispatcher; toggles do not authorize sending pending jobs.

`reports.mjs` stages result projections and jobs. `homework.mjs` stages publication/reminder notices and jobs. Recipient access and consent are rechecked on claim. External provider acceptance is not proof of delivery.

## Manual-channel contract

`manual-queue.mjs` handles WhatsApp/Telegram `channel_outbox` requests, freezing approved message text, verified parent recipients and payload hash. Recipient states distinguish queued, sending, accepted, delivered, failed and held_unknown. Unknown transport outcomes never blind-retry. `processManualQueue` is disabled by default and requires an injected sender and explicit channel readiness. Only fake transports have been exercised.

The UI must show exact text and recipients for confirmation. Save draft is not approval_requested. Current UI for undeployed channels must stay draft-only. The parent settings, readiness, outbox root and recipient documents are admin-only under the limited candidate rules, not under deployed rules yet.

`readiness(channel)` returns a disconnected safe default. No operational readiness probe/updater is mounted. Intended UI document is `messaging_channels/{channel}`; UI may not mark itself connected. Email keeps its separate existing outbox implementation.

## Providers and channel linking

`channels.mjs` implements 256-bit, single-use, ten-minute private channel proofs; a PAR code is not authority. `inbound.mjs` needs an authenticated trusted provider call-site, not a browser assertion. No public provider webhook is mounted.

`providers.mjs` is disabled by default. Tests inject fake transports. Manual channel text is sent exactly as approved, without an added heading. Email requires a verified sender. The WhatsApp bridge source uses payload-bound durable idempotency and holds uncertain sends, but requires durable storage, a single bridge process, hosting and dedicated account pairing before operation. No Telegram bot connection is configured here.

## API and experiments

`api.mjs` is an unmounted authenticated HTTP handler for parent profile/results/children, bounded link requests, admin review/unlink and channel proof issuance. No legacy extra-proof session route is mounted. `legacy-session.mjs` is retained only as a synthetic test experiment; do not activate it. Broad legacy migration is stopped.

## Validation and activation

Tests require Firestore and Auth emulators and refuse normal production execution. They cover the tested local scope only. A production activation environment flag is a mechanical gate, never permission to send, deploy, spend or push. Separate source-grounded approval is still required for those actions.
