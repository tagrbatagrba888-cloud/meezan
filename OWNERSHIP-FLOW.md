# Same-password ownership flow, proposed only

Owner requirement: keep current passwords unchanged, no required resets, one existing login.html.

The minimum user-visible extra step is account-owner confirmation, not choosing a new password:

1. The admin can verify a small pilot roster in person, or through contact details the admin already independently knows belong to those people. An email/phone copied from an unverified profile is not enough.
2. The admin records which existing student/teacher ID was verified, the method, time and a private evidence reference. The system does not auto-match by display name or a browser-supplied email.
3. Only after a separate approved protected migration can an Auth identity be bound, preserving the same user-entered password through a tested compatible path. Pending, rejected or conflicted mappings remain closed to new private data.
4. Users continue using the existing login page and their existing credential. The school may need to confirm a user's identity once. No passwords are requested in chat, displayed to the admin, exported to a web page or sent to parents.

The staging state machine does not create accounts or process credentials, even when its inputs claim permission. It demonstrates the difference between an ownership review, a technical mapping and an approved production migration.

## Minimal decision needed later

May the admin verify the identity of a pilot set of current students/teachers in person or over already trusted contact routes, without changing their passwords? Do not ask for this until the complete compatible migration is ready to test. This does not authorize contact messages, account imports or a production cutover.

## Compatibility still unknown

- Whether each legacy account has a unique stable ID, username and role, or collisions with existing Firebase identities.
- Whether the old representation is consistently reversible and each original credential can be preserved through the chosen Firebase import path. The current representation is not a supported imported hash.
- Whether historical passwords conflict with the chosen auth path. Firebase account creation has a six-character minimum; hash import behavior must be tested with synthetic short-password fixtures before declaring such accounts incompatible.
- Whether Google-linked accounts have trusted bindings to their original Google UID, rather than a matching display name/email.

None of these unknowns authorizes reading live password data. A separately approved private audit and a compatible client/rules migration are required. No existing-user resets, bulk mails or live identity changes are part of current work.
