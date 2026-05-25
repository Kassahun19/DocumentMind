- [ ] Add JSON parse-error middleware + ensure JSON error responses for auth routes
- [ ] Add local logging for /api/auth/login and /api/auth/register to confirm req.body is received
- [x] Re-run local auth (npm run dev) and verify UI shows real backend error (not just “Authentication failed”)

- [ ] If login still fails: inspect logged server.log output and patch the exact failing auth logic/route wiring
- [x] Added JSON parse-error middleware + debug logs to confirm req.body parsing

