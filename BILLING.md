# Billing

## Current integration

The site now supports hosted checkout handoff through environment variables.

Set:

- `BILLING_PROVIDER`
- `BASIC_PLAN_CHECKOUT_URL`
- `PREMIUM_PLAN_CHECKOUT_URL`

## How it works

1. A visitor creates an account and starts on `Basic`
2. If `BASIC_PLAN_CHECKOUT_URL` is configured, signup can hand off to hosted checkout for the Basic plan
3. Logged-in Basic members can use the upgrade flow from the dashboard or membership page
4. If `PREMIUM_PLAN_CHECKOUT_URL` is configured, the upgrade button sends them to hosted checkout for Premium

## Recommended providers

- Stripe Payment Links
- PayPal subscription links
- Paddle checkout links

## Before launch

- Use real provider checkout URLs
- Confirm Basic signup opens the correct checkout, if you want paid signup immediately
- Confirm Premium upgrade opens the correct checkout from both the dashboard and membership page
- Decide how successful payment will update long-term billing records
- Confirm cancellation, refund, and failed-payment handling for your chosen provider

## Current limitation

This setup handles secure hosted checkout redirection, but it does not yet verify subscription status back from the payment provider. If you want true recurring billing enforcement, the next step is adding provider webhooks or another server-to-server subscription verification step.

## Recommended next billing step

For a production launch, add:

- provider webhook verification
- a billing status field tied to the user account
- upgrade and downgrade handling
- cancellation handling
- admin visibility into billing state
