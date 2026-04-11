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

  if (basicButton instanceof HTMLAnchorElement) {
    basicButton.href = "/signup.html";
    basicButton.textContent = "Join Basic";
  }

  if (premiumButton instanceof HTMLAnchorElement) {
    if (!config.premiumCheckoutConfigured) {
      premiumButton.href = "/contact.html";
      premiumButton.textContent = "Ask About Premium";
      premiumButton.classList.remove("btn-primary");
      premiumButton.classList.add("btn-secondary");
    } else if (!sessionUser) {
      premiumButton.href = "/signup.html";
      premiumButton.textContent = "Start With Basic";
    } else if (String(sessionUser.plan || "").toLowerCase() === "premium") {
      premiumButton.href = "/dashboard.html";
      premiumButton.textContent = "Premium Active";
    } else {
      premiumButton.href = "#";
      premiumButton.textContent = "Upgrade To Premium";
      premiumButton.addEventListener("click", handlePremiumUpgradeClick);
    }
  }

  if (billingNote) {
    if (config.mode === "hosted-checkout") {
      billingNote.textContent = `Hosted checkout is connected through ${config.provider}.`;
    } else {
      billingNote.textContent = "Accounts are live, but hosted billing still needs to be connected before launch.";
    }
  }

  if (signupPlan instanceof HTMLSelectElement) {
    const params = new URLSearchParams(window.location.search);
    const plan = String(params.get("plan") || "").trim().toLowerCase();
    if (plan === "basic" || plan === "premium") {
      signupPlan.value = plan;
    }
  }

  if (signupBillingNote) {
    signupBillingNote.textContent = config.basicCheckoutConfigured
      ? `After account creation, secure checkout will open for Basic through ${config.provider}.`
      : "All new accounts begin on Basic. Hosted billing can be connected before launch.";
  }
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
