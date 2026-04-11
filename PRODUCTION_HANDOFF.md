# Zezpon Production Handoff

## Current State

The app is running correctly from `C:\Projects\ZEZPOn` and the core auth flow has been verified locally:

- signup
- login
- forgot password
- reset password
- protected route redirects

## What You Need To Fill In

Before production deployment, provide real values for:

- `BILLING_PROVIDER`
- `BASIC_PLAN_CHECKOUT_URL`
- `PREMIUM_PLAN_CHECKOUT_URL`
- `MAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `PUBLIC_BASE_URL`
- `ZEZPON_ADMIN_NAME`
- `ZEZPON_ADMIN_USERNAME`
- `ZEZPON_ADMIN_EMAIL`
- `ZEZPON_ADMIN_PASSWORD`

If using cloud media:

- `STORAGE_PROVIDER=s3`
- `STORAGE_BUCKET`
- `STORAGE_REGION`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- optional `STORAGE_ENDPOINT`
- optional `STORAGE_PUBLIC_BASE_URL`

## Recommended Launch Order

1. Pick the production host.
2. Create `.env.production` from `.env.production.example`.
3. Fill in real admin, billing, email, and storage values.
4. Set `SHOW_DEBUG_TOKENS=false`.
5. Start the app on persistent storage outside the app release folder.
6. Put HTTPS and a reverse proxy in front of the app.
7. Test signup, login, password reset, dashboard, membership, and videos on the live URL.
8. Confirm backups and restore steps.

## Suggested Host Shape

For a simple first production deployment:

- app code in `/srv/zezpon/current`
- runtime data in `/var/lib/zezpon`
- environment file in `/etc/zezpon/zezpon.env`
- reverse proxy with Nginx
- HTTPS with Let's Encrypt

If you choose Render instead of a VPS:

- use [render.yaml](C:\Projects\ZEZPOn\render.yaml)
- mount a persistent disk at `/app/runtime-data`
- set `ZEZPON_DATA_DIR=/app/runtime-data`
- add all real billing, email, admin, and storage env vars in the Render dashboard
- review [RENDER.md](C:\Projects\ZEZPOn\RENDER.md)

## Final Pre-Launch Checks

- `contact.html` has real contact details
- `privacy.html` has final legal wording
- `terms.html` has final legal wording
- billing links open the correct checkout pages
- Premium upgrade works from both dashboard and membership
- email verification and password reset work with the real SMTP provider
- uploads persist to the intended storage target
- `/api/health` shows the expected email and storage mode
