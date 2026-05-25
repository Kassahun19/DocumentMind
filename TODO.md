# TODO

## Auth fix for Vercel FUNCTION_INVOCATION_FAILED

- [x] Investigated Express-based `server.ts` auth routes and confirmed they do not start on Vercel.
- [x] Added Vercel serverless handler `api/auth/login/index.ts` to properly handle `/api/auth/login`.
- [x] Added Vercel serverless handler `api/auth/register/index.ts` to properly handle `/api/auth/register`.
- [ ] Deploy to Vercel and verify login/register from UI.
- [ ] If still failing, add `api/auth/me/index.ts` as well and/or ensure Vercel routing is not rewritten to Express.
