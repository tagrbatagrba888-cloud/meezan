# Remaining product choices and effects

Local only. This is planning, not authorization to change any production account or rules.

## Recommended behavior

- Parent or child enters the other code to request a link. The admin verifies the relationship and approves it. Codes are identifiers, not permission to read results.
- New parents verify their own email and wait for admin approval. Nobody receives a generated plaintext password from the admin page.
- Existing students and teachers are re-enrolled once after the admin verifies account ownership. Preserve their application ID, results and links. Never match by name or a client-supplied email alone.
- Telegram and WhatsApp each require proving control of the private receiving account with a short-lived one-use challenge. A parent code is not a channel password.

## Owner decisions, stated without implementation burden

1. Enrollment: may existing students/teachers be required to reactivate their account once and set a new password, while keeping their results? Recommend yes rather than trusting the old browser-readable passwords as identity proof. The alternate is an admin-supervised individual enrollment process, which is slower. Neither silently resets or emails everyone.
2. Cutover timing: after staging is complete, may the site have a planned maintenance window to switch login and permissions together? Recommend a planned window, after a private backup and tested rollback. Old sessions stop working at cutover. No duration is promised until the complete migration has been tested.
3. Channel setup: use a bot the owner chooses/creates, collected through a secure credential link, and a dedicated persistent WhatsApp host. No paid host is selected or approved. A temporary session is not reliable 24-hour service.

No need to ask the owner to choose a Firebase schema or write rules. Those are implementation work. Each further repo push and the production cutover still need their own approval.

## What is verified locally

The authenticated admin can list parent accounts; non-admin sign-in is rejected. A parent can submit a USR request but cannot directly grant access. Admin approval creates both link records atomically, then the parent sees only its linked test child's results. Admin unlink revokes result and private per-child notice reads. Synthetic emulator fixtures only.

## What is not finished

The old site still reads shared users/all, exam_subs/all, homework_subs/all and other sensitive collections. Full identity mapping, sensitive-data projection, compatible student/teacher page changes, enrollment UI, live rules audit/backup/cutover, external provider adapters and host setup remain. This is a wider legacy migration than adding a parent screen. The current production holds must stay until it is done.
