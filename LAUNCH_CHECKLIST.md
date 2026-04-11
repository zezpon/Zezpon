# Zezpon Launch Checklist

## Must Fix Before Launch

- Push the clean project from `C:\Projects\ZEZPOn` to a GitHub repository.
- Deploy the GitHub repository to Render using `render.yaml`.
- Add a Render persistent disk mounted at `/app/runtime-data`.
- Replace the placeholder contact email addresses in `contact.html`.
- Set the real admin email and password through environment variables.
- Disable `SHOW_DEBUG_TOKENS` in production.
- Configure a real SMTP provider and verify email delivery works.
- Move video uploads to cloud object storage before large media usage.
- Review all public-facing copy and remove any remaining placeholder wording.
- Confirm HTTPS, backups, and persistent storage are enabled on the live host.
- Document and test the restore process from [BACKUPS.md](./BACKUPS.md).
- Review privacy, billing, and refund terms before accepting payments.
- Configure hosted checkout links or a full billing provider. See [BILLING.md](./BILLING.md).
- Confirm uploaded member media is only reachable through the protected media route.

## Product Checks

- Public pages load without login.
- Videos require a paid member account.
- Premium-only pages stay behind the Premium paywall.
- New accounts start on Basic.
- Premium upgrade opens from the dashboard and membership page when checkout is configured.
- Password reset and email verification flows are tested.
- Admin can manage members and content without touching the database manually.
- Storage is writing to the intended local disk or S3-compatible bucket.
- Email changes require password confirmation and trigger re-verification.

## Local Cleanup Before GitHub

- Do not commit runtime folders such as `runtime-data`, `.qa-data`, `.zezpon-data`, or `test-runtime`.
- Do not commit cookie files, test logs, `.env` files, or sample uploads.
- Keep `package-lock.json`, `render.yaml`, `Dockerfile`, and deployment docs committed.
