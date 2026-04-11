# Next Launch Steps

## 1. GitHub

Git is installed and the first local commit has been created:

- `815a479 Initial Zezpon launch-ready site`

Before pushing:

- create a private GitHub repository
- add the GitHub remote to the project at `C:\Projects\ZEZPOn`
- push the committed project to GitHub
- confirm ignored runtime/test files are not included

Commit these important files:

- `server.js`
- `package.json`
- `package-lock.json`
- `Dockerfile`
- `render.yaml`
- `.env.example`
- `.env.production.example`
- all `.html`, `.js`, and `.css` site files
- deployment docs

Do not commit:

- `.env`
- runtime folders
- cookie files
- log files
- sample upload files

## 2. Render

Create a Render Blueprint or Docker web service from the GitHub repository.

Use:

- runtime: `Docker`
- persistent disk mount path: `/app/runtime-data`
- health check path: `/api/health`
- `ZEZPON_DATA_DIR=/app/runtime-data`

## 3. Email

Pick a production email provider such as Postmark, SendGrid, Mailgun, or Amazon SES.

Then set:

- `MAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE`
- `SMTP_REQUIRE_TLS`

## 4. Billing

Pick the billing provider and add hosted checkout URLs.

Set:

- `BILLING_PROVIDER`
- `BASIC_PLAN_CHECKOUT_URL`
- `PREMIUM_PLAN_CHECKOUT_URL`

## 5. Domain

Set:

- `PUBLIC_BASE_URL=https://your-domain.com`

Then connect the domain in Render and verify HTTPS.

## 6. Final QA

Test these flows on the live Render URL:

- signup
- login
- forgot password
- reset password
- Basic member access
- Premium upgrade
- admin upload
- mobile layout
