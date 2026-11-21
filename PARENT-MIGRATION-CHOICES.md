# Remaining product choices and effects

Local only. This is planning, not authorization to change any production account or rules.

## Recommended behavior

- Parent or child enters the other code to request a link. The admin verifies the relationship and approves it. Codes are identifiers, not permission to read results.
- New parents verify their own email and wait for admin approval. Nobody receives a generated plaintext password from the admin page.
- Existing students and teachers must keep their current password and the shared login page, per the owner's latest restriction. Preserve application IDs/results/links. Independently verify ownership before binding an Auth identity. Never match by name, client-supplied email or the exposed legacy password alone.
- Telegram and WhatsApp each require proving control of the private receiving account with a short-lived one-use challenge. A parent code is not a channel password.

## Owner decisions, stated without implementation burden

1. Password policy is decided: do not change existing passwords, do not require resets. New-password reactivation was rejected. Prepare a protected server-side identity enrollment that preserves the user-entered credential, subject to compatibility and collision checks. The current reversible browser credential is not a supported imported password hash or ownership evidence. Any processing of live credentials or account creation requires separate approval. If an individual credential cannot be preserved through the tested design, stop for that account instead of resetting it. Independent ownership verification remains required.
2. Cutover timing: after staging is complete, may the site have a planned maintenance window to switch login and permissions together? Recommend a planned window, after a private backup and tested rollback. Old sessions stop working at cutover. No duration is promised until the complete migration has been tested.
3. Channel setup: use a bot the owner chooses/creates, collected through a secure credential link, and a dedicated persistent WhatsApp host. No paid host is selected or approved. A temporary session is not reliable 24-hour service.

No need to ask the owner to choose a Firebase schema or write rules. Those are implementation work. Each further repo push and the production cutover still need their own approval.

## What is verified locally

The authenticated admin can list parent accounts; non-admin sign-in is rejected. A parent can submit a USR request but cannot directly grant access. Admin approval creates both link records atomically, then the parent sees only its linked test child's results. Admin unlink revokes result and private per-child notice reads. Synthetic emulator fixtures only.

## What is not finished

The old site still reads shared users/all, exam_subs/all, homework_subs/all and other sensitive collections. Full identity mapping, sensitive-data projection, compatible student/teacher page changes, enrollment UI, live rules audit/backup/cutover, external provider adapters and host setup remain. This is a wider legacy migration than adding a parent screen. The current production holds must stay until it is done.
