# Billing

## Current integration

The site now supports hosted checkout handoff through environment variables.

Set:

- `BILLING_PROVIDER`
- `BASIC_PLAN_PRICE_LABEL`
- `PREMIUM_PLAN_PRICE_LABEL`
- `BASIC_PLAN_CHECKOUT_URL`
- `PREMIUM_PLAN_CHECKOUT_URL`

## How it works

1. A visitor chooses `Basic` or `Premium`
2. They create their account
3. If a checkout URL exists for that plan, signup redirects them to hosted checkout
4. Logged-in Basic members can still use the Premium upgrade flow from the dashboard or membership page
5. Until provider webhooks are added, Premium access should be confirmed through admin review after payment

## Recommended providers

- Stripe Payment Links
- PayPal subscription links
- Paddle checkout links

## Before launch

- Use real provider checkout URLs
- Confirm the correct plan opens from signup and membership
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
