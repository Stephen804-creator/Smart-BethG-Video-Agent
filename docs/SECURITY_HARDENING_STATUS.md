# Security Hardening Status

This branch closes the current application-security review findings.

- Owner authorization is enforced for project, entity-event, generation, and job access.
- Persisted generations and production executions require an authenticated owner.
- Bearer authentication is deliberately identity-less and cannot access owner-scoped resources.
- Security headers include CSP, nosniff, frame protection, referrer policy, permissions policy, and production HSTS.
- Production authentication requires PostgreSQL-backed sessions; individual sessions can be revoked server-side.
- Password hashing uses asynchronous scrypt with timing-safe comparison.
- Registration and password-reset responses avoid account enumeration.
- MFA setup/enable/disable and password-reset flows are server-side controls.
- Rate limiting uses Express proxy-aware client IP handling and the durable database bucket when configured.
- Uploads require an extension/MIME allowlist and are validated with ffprobe restricted to the local file protocol.
- FFmpeg/ffprobe local media processing is restricted to the file protocol.
- Rejected and failed uploads clean up temporary files.
- Regression coverage includes two-user isolation, bearer identity rejection, headers, registration enumeration, session revocation, upload rejection/cleanup, render/export, API authorization, and browser flow.
