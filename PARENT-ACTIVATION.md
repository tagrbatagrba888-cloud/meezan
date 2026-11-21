# Parent feature: safety hold

This commit is a disabled preview, not a completed or activated parent service.

- Parent login and registration are disabled in login.html independently of remote settings.
- Production parent.html and amr.html stop before accessing parent data.
- The child linking card is disabled.
- The parent reports workflow cannot run, has no schedule, and its script does not execute the report pipeline.
- No Firestore rules deployment is part of this Git push.

## Staged rules

Parent lists, parent account mutations, code mappings and link mutations require Firebase Auth admin UID 4KbUOO6wrHf3jzzKvGIltsNyzFX2. A PIN cannot authorize these operations. Existing email collections retain the same authenticated-admin restriction. Emulator tests cover these gates, related-child reads and revocation, not the security of the whole legacy platform.

Legacy collections remain open in this draft. In particular users/all and exam_subs/all hold broad student data. Blocking student_results does not isolate information duplicated in legacy collections. Do not claim parent isolation or deploy this rules file as a full security migration.

## Required before activation

1. Migrate legacy user/student authentication and sensitive shared all-documents to identity-scoped access. Verify all paths containing student data, not only the new result projection.
2. Implement authenticated parent/child link requests resolved by an authenticated admin or a backend with validated ownership. Direct client link writes remain denied.
3. Replace amr.html's old PIN-only preview with Firebase Auth admin sign-in and verify admin-only lists and mutations end-to-end. No open parent-list alternative is allowed.
4. Replace public-key Firestore report access with scoped authenticated backend access. Implement durable per-channel retry, audit and consent checks before enabling report sends.
5. Deliver parent notices in a private collection, not the legacy publicly readable notifications documents.
6. Verify migration and rollback against current deployed rules, preserving email admin restrictions. Run emulator adversarial tests and full browser flows before asking to activate.
7. Configure and test the email sender, Telegram bot and a persistent WhatsApp host/pairing session. None is established by this push.

The earlier 21-test suite accepted code-as-capability and PIN-only writes. Those expectations were unsafe and have been replaced by 32 passing deny-by-default tests. Earlier screenshots show a preview, not production access-control assurance.

## Local follow-up after the safety-held push

Local only, not yet approved for another push: admin-auth amr, pending link requests with admin approval, private owner/per-child notification paths, and Admin SDK projection/channel-proof/delivery-job building blocks. The new suite has 48 rules tests and 10 backend tests plus a browser flow. Provider routes, new enrollment and the full legacy migration are still unfinished. See PARENT-MIGRATION-CHOICES.md and services/parent-backend/README.md.
