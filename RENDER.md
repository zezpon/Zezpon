# Render Setup

## Recommended Render Shape

Use a single Docker-based web service with a persistent disk.

- service type: `Web Service`
- runtime: `Docker`
- plan: `Starter` or higher
- persistent disk: required
- disk mount path: `/app/runtime-data`

This project already includes [render.yaml](C:\Projects\ZEZPOn\render.yaml) to make that setup easier.

## What To Set In Render

Create the service from the repo and set:

- `NODE_ENV=production`
- `PORT=3000`
- `ZEZPON_DATA_DIR=/app/runtime-data`
- `SHOW_DEBUG_TOKENS=false`

Then add your real values for:

- `PUBLIC_BASE_URL`
- `ZEZPON_ADMIN_NAME`
- `ZEZPON_ADMIN_USERNAME`
- `ZEZPON_ADMIN_EMAIL`
- `ZEZPON_ADMIN_PASSWORD`
- `BILLING_PROVIDER`
- `BASIC_PLAN_CHECKOUT_URL`
- `PREMIUM_PLAN_CHECKOUT_URL`
- `MAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE`
- `SMTP_REQUIRE_TLS`

If you are using cloud media, also add:

- `STORAGE_PROVIDER=s3`
- `STORAGE_BUCKET`
- `STORAGE_REGION`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- optional `STORAGE_ENDPOINT`
- optional `STORAGE_PUBLIC_BASE_URL`
- optional `STORAGE_FORCE_PATH_STYLE`

## Important Render Notes

- do not run this app without a persistent disk
- Render's root filesystem is ephemeral, so the disk is what keeps SQLite and uploads alive
- keep `ZEZPON_DATA_DIR` on the mounted disk
- use object storage for heavier long-term video usage

## If You Change Hosts Later

No, it should not be difficult if you keep a few things clean:

- keep app config in environment variables
- keep runtime data in `ZEZPON_DATA_DIR`
- move media to S3-compatible storage instead of local disk when possible
- later move SQLite to Postgres if you want easier scaling

If you do those things, moving from Render to a VPS, Railway, Fly.io, or another host is mostly:

1. copy the code
2. copy the env vars
3. move the runtime data or database
4. point the domain at the new host

## Best Migration Path Later

To make a future host change easier, I’d recommend:

- start on Render now
- use S3-compatible storage for videos as soon as practical
- keep billing and email fully env-driven
- move from SQLite to Postgres only when traffic or complexity justifies it
