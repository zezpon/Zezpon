# Zezpon Launch Audit

## Current Working Copy

- Primary project path: `C:\Projects\ZEZPOn`
- Old OneDrive copy is retired and should not be used for future edits or runtime data.
- Runtime verification was performed against a live local server started from `C:\Projects\ZEZPOn`.

## Live QA Checks Completed

- `GET /api/health` returns `200 OK`
- `GET /Zezpon.html` returns `200 OK`
- `GET /signup.html` returns `200 OK`
- Logged-out access to `/dashboard.html` redirects to `/login.html?next=/dashboard.html`
- Logged-out access to `/videos.html` redirects to `/login.html?next=/videos.html`
- Signup works with the current username + password rules
- Login works with the current account flow
- Forgot-password works
- Reset-password works
- Login with the newly reset password works
- A signed-in Basic member can open `/results.html`
- A signed-in Basic member can open `/guide-asx.html`
- A signed-in Basic member is redirected from `/videos.html` to `/membership.html`

## Auth And Billing State

- New accounts begin on `Basic`
- Premium access is handled as an upgrade path
- Membership and dashboard UI now reflect whether hosted checkout is actually configured
- In local or fallback-email mode, forgot-password returns a direct reset link for testing
- Current billing config on the updated app reports `provider=hosted-links`, `mode=account-only`, `basicCheckoutConfigured=false`, and `premiumCheckoutConfigured=false`
- Production still needs real SMTP and hosted billing values

## Deployment Readiness

- `Dockerfile` is production-oriented and uses a non-root runtime user
- `docker-compose.yml` expects a real `.env.production` file and persistent runtime storage
- `ecosystem.config.js` is ready for PM2-based deployment
- `deploy/nginx.conf` and `deploy/zezpon.service` provide a workable VPS baseline
- `.env.production.example` now includes the bootstrap admin username as well as app, email, and storage settings

## Remaining Launch Blockers

- Real contact/business details
- Final legal/privacy/terms review
- Real billing provider values
- Real SMTP provider values
- Real storage provider values if using cloud media
- HTTPS and reverse proxy setup on the live host
- Backups and restore testing on the final host

## Hosting Notes

- Do not keep the live SQLite database inside OneDrive or another syncing folder
- Keep runtime data on persistent local disk or move core storage to managed services
- Enable HTTPS and test the reverse proxy before launch
- Confirm `/api/health` reports the expected email and storage configuration
