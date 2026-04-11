# Zezpon Deployment

## What This Build Includes

- Server-rendered static pages with real login and signup
- SQLite-backed storage
- Member dashboard and profile settings
- Admin-only tools page
- Admin-managed videos and news items
- Local or S3-compatible media storage
- Protected media delivery through the app server
- Environment-based admin bootstrap
- Password reset, email verification, and audit logging
- SMTP-based email delivery

## Local Run

1. Install Node.js 20+.
2. Copy `.env.example` values into your environment.
3. Set a real admin email and password.
4. Choose your storage mode:
   `STORAGE_PROVIDER=local` for local testing
   `STORAGE_PROVIDER=s3` for cloud media storage
5. Set SMTP values if you want real email delivery.
6. Run `npm install`.
7. Run `npm start`.
8. Open `http://localhost:3000`.
9. Review `LAUNCH_CHECKLIST.md` before going live.

## Important Environment Variables

- `PORT`: Server port.
- `NODE_ENV`: Set this to `production` on the live host.
- `ZEZPON_DATA_DIR`: Folder for the SQLite database and compatibility JSON files.
- `ZEZPON_ADMIN_NAME`: Display name for the bootstrap admin.
- `ZEZPON_ADMIN_USERNAME`: Optional bootstrap admin username.
- `ZEZPON_ADMIN_EMAIL`: Admin login email created on startup if missing.
- `ZEZPON_ADMIN_PASSWORD`: Admin password created on startup if missing.
- `PUBLIC_BASE_URL`: Public site URL used in verification and password reset links.
- `MAIL_FROM`: Sender address for account emails.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: SMTP settings for real email delivery.
- `SMTP_SECURE`: Use `true` for implicit TLS, usually port 465.
- `SMTP_REQUIRE_TLS`: Use `true` when your provider expects STARTTLS on ports like 587.
- `STORAGE_PROVIDER`: `local` or `s3`.
- `STORAGE_BUCKET`, `STORAGE_REGION`: Required when `STORAGE_PROVIDER=s3`.
- `STORAGE_ENDPOINT`: Optional for S3-compatible providers such as Cloudflare R2, Backblaze B2, or MinIO.
- `STORAGE_PUBLIC_BASE_URL`: Optional CDN or public media domain for uploaded video URLs.
- `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`: S3-compatible credentials.
- `STORAGE_FORCE_PATH_STYLE`: Use `true` for providers that require path-style addressing.
- `SHOW_DEBUG_TOKENS`: Set to `false` in production. Only use `true` for local testing.

## Media Storage

### Local storage

Use this for development or a small single-server deployment.

- Set `STORAGE_PROVIDER=local`
- Uploaded files are written to `ZEZPON_DATA_DIR/uploads`
- Your server disk becomes your media store, so keep backups and enough free space
- Member media is served through the app so plan-based access rules still apply

### S3-compatible storage

Use this for production if you expect regular video uploads.

- Set `STORAGE_PROVIDER=s3`
- Set `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, and `STORAGE_SECRET_ACCESS_KEY`
- Set `STORAGE_ENDPOINT` if you are using an S3-compatible vendor instead of AWS S3
- Set `STORAGE_PUBLIC_BASE_URL` if you want media served from a CDN or custom domain like `https://media.zezpon.com`
- Media requests are still checked by the Zezpon app before the object is streamed to the member

Supported deployment pattern:

- AWS S3
- Cloudflare R2
- Backblaze B2 S3
- MinIO

## Email Provider

The app already sends verification and password reset emails through SMTP.

Typical production choices:

- Postmark
- SendGrid SMTP
- Amazon SES SMTP
- Mailgun SMTP

Recommended minimum:

- set `MAIL_FROM`
- set `PUBLIC_BASE_URL`
- set all `SMTP_*` values
- test signup, verification, and password reset before launch
- test email-change verification from the profile page before launch

Local development note:

- when SMTP is not configured, forgot-password returns a direct reset link for local testing
- this debug-style reset link behavior should not be relied on for production

## Recommended Hosting Paths

### Option 1: VPS

Use a small Linux VPS if you want the simplest long-term setup and full control.

1. Install Node.js and Nginx.
2. Create a service user and persistent data folder, for example `/var/lib/zezpon`.
3. Copy the project to `/srv/zezpon/current`.
4. Copy [.env.production.example](C:\Projects\ZEZPOn\.env.production.example) to `/etc/zezpon/zezpon.env` and replace all example values.
5. Run `npm ci --omit=dev`.
6. Start the app with PM2 using [ecosystem.config.js](C:\Projects\ZEZPOn\ecosystem.config.js) or install the systemd unit from [deploy/zezpon.service](C:\Projects\ZEZPOn\deploy\zezpon.service).
7. Put Nginx in front of the app using [deploy/nginx.conf](C:\Projects\ZEZPOn\deploy\nginx.conf).
8. Enable HTTPS with Let's Encrypt.
9. Point `ZEZPON_DATA_DIR` at a persistent folder outside the app release directory.
10. Configure SMTP and your storage provider.
11. Add backups for the database and any local media that remains on disk.

### Option 2: Docker Host

Use the included `Dockerfile`.

1. Copy [.env.production.example](C:\Projects\ZEZPOn\.env.production.example) to `.env.production` and replace the example values.
2. Build with `docker compose build`.
3. Start with `docker compose up -d`.
4. Put a reverse proxy with HTTPS in front of the container.
5. Mount runtime data on persistent storage and back it up regularly.
6. If you use S3 storage, local disk only needs to persist SQLite and session compatibility files.

### Option 3: Platform Host

Choose a host that supports persistent disk storage. Plain static hosting is not enough for this version because login, sessions, and admin tools require a running Node server and writable storage.

Good fits:

- Render with a persistent disk
- Railway with persistent volume support
- Fly.io with attached volume
- Any managed VPS

## Security Notes Before Going Live

- Replace the bootstrap admin password immediately after first login.
- Use HTTPS only.
- Keep the database on persistent storage, not temporary build storage.
- Store uploads on persistent disk or move them to object storage before heavy video usage.
- Replace placeholder contact details before public launch.
- Move from SQLite to Postgres when you expect higher traffic or multiple app instances.
- Verify `/api/health` reports the storage and email modes you expect before launch.
- Confirm direct media URLs are not exposed outside the protected `/media/...` route.
- Keep the live project and runtime data off OneDrive or other sync-locked folders.
