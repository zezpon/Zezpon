async function initBillingUi() {
  const basicButton = document.getElementById("basicCheckoutButton");
  const premiumButton = document.getElementById("premiumCheckoutButton");
  const billingNote = document.getElementById("billingSetupNote");
  const signupPlan = document.getElementById("signupPlan");
  const signupBillingNote = document.getElementById("signupBillingNote");

  let config = null;
  let sessionUser = null;
  try {
    const [configResponse, sessionResponse] = await Promise.all([
      fetch("/api/billing/config", { credentials: "same-origin" }),
      fetch("/api/session", { credentials: "same-origin" })
    ]);

    if (configResponse.ok) {
      config = await configResponse.json();
    }
    if (sessionResponse.ok) {
      const sessionResult = await sessionResponse.json();
      sessionUser = sessionResult.user || null;
    }
  } catch {
    return;
  }

  if (!config) {
    return;
  }

  updatePriceLabel("basicPlanPrice", config.basicPriceLabel);
  updatePriceLabel("premiumPlanPrice", config.premiumPriceLabel);

  if (basicButton instanceof HTMLAnchorElement) {
    basicButton.href = "/signup.html?plan=basic";
    basicButton.textContent = "Join Basic";
  }

  if (premiumButton instanceof HTMLAnchorElement) {
    if (!sessionUser) {
      premiumButton.href = "/signup.html?plan=premium";
      premiumButton.textContent = "Join Premium";
    } else if (String(sessionUser.plan || "").toLowerCase() === "premium") {
      premiumButton.href = "/dashboard.html";
      premiumButton.textContent = "Premium Active";
    } else if (config.premiumCheckoutConfigured) {
      premiumButton.href = "#";
      premiumButton.textContent = "Upgrade To Premium";
      premiumButton.addEventListener("click", handlePremiumUpgradeClick);
    } else {
      premiumButton.href = "/contact.html";
      premiumButton.textContent = "Premium Setup Pending";
    }
  }

  if (billingNote) {
    billingNote.textContent = config.basicCheckoutConfigured || config.premiumCheckoutConfigured
      ? `Hosted checkout is connected through ${config.provider}.`
      : "Membership continues through the account flow before checkout.";
  }

  if (signupPlan instanceof HTMLSelectElement) {
    const params = new URLSearchParams(window.location.search);
    const plan = String(params.get("plan") || "").trim().toLowerCase();
    if (plan === "basic" || plan === "premium") {
      signupPlan.value = plan;
    }
  } else if (signupPlan instanceof HTMLInputElement) {
    const params = new URLSearchParams(window.location.search);
    const plan = String(params.get("plan") || "").trim().toLowerCase();
    signupPlan.value = plan === "premium" ? "premium" : "basic";
  }

  if (signupBillingNote) {
    signupBillingNote.textContent = config.basicCheckoutConfigured || config.premiumCheckoutConfigured
      ? `After account creation, secure checkout will open for the selected plan through ${config.provider}.`
      : "After account creation, the selected plan continues through the membership flow.";
  }
}

function updatePriceLabel(elementId, priceLabel) {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }
  const value = String(priceLabel || "").trim();
  element.textContent = value || "Set price before launch";
}

async function handlePremiumUpgradeClick(event) {
  event.preventDefault();
  const button = event.currentTarget;
  if (!(button instanceof HTMLAnchorElement)) {
    return;
  }

  const originalText = button.textContent;
  button.textContent = "Opening Checkout...";

  try {
    const response = await fetch("/api/billing/upgrade-link", { credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) {
      button.textContent = result.error || "Upgrade unavailable";
      return;
    }

    window.location.href = result.checkoutUrl;
    return;
  } catch {
    button.textContent = "Upgrade unavailable";
  }

  button.textContent = originalText;
}

document.addEventListener("DOMContentLoaded", initBillingUi);
