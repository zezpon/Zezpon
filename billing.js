async function initBillingUi() {
  const basicButton = document.getElementById("basicCheckoutButton");
  const premiumButton = document.getElementById("premiumCheckoutButton");
  const billingNote = document.getElementById("billingSetupNote");
  const signupPlan = document.getElementById("signupPlan");
  const signupBillingNote = document.getElementById("signupBillingNote");
  const selectedSignupPlan = getSelectedSignupPlan();

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

  const hasPendingMembership = sessionUser && String(sessionUser.billingStatus || "").toLowerCase() === "pending";

  if (basicButton instanceof HTMLAnchorElement) {
    if (hasPendingMembership && String(sessionUser.plan || "").toLowerCase() === "basic" && config.basicCheckoutConfigured) {
      basicButton.href = "/api/billing/checkout-link?plan=basic";
      basicButton.textContent = "Complete Basic Checkout";
      basicButton.addEventListener("click", handleHostedCheckoutLinkClick);
    } else {
      basicButton.href = "/signup.html?plan=basic";
      basicButton.textContent = "Join Basic";
    }
  }

  if (premiumButton instanceof HTMLAnchorElement) {
    if (hasPendingMembership && String(sessionUser.plan || "").toLowerCase() === "premium" && config.premiumCheckoutConfigured) {
      premiumButton.href = "/api/billing/checkout-link?plan=premium";
      premiumButton.textContent = "Complete Premium Checkout";
      premiumButton.addEventListener("click", handleHostedCheckoutLinkClick);
    } else if (!sessionUser) {
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
    const billingPending = new URLSearchParams(window.location.search).get("billing") === "pending";
    billingNote.textContent = billingPending
      ? "Your account is waiting for payment confirmation. Complete checkout for your selected plan to unlock member access."
      : config.basicCheckoutConfigured || config.premiumCheckoutConfigured
        ? `Hosted checkout is connected through ${config.provider}.`
        : "Billing must be connected before new member accounts can be created.";
  }

  if (signupPlan instanceof HTMLSelectElement) {
    if (selectedSignupPlan === "basic" || selectedSignupPlan === "premium") {
      signupPlan.value = selectedSignupPlan;
    }
  } else if (signupPlan instanceof HTMLInputElement) {
    signupPlan.value = selectedSignupPlan;
  }

  updateSignupPlanPricing(selectedSignupPlan);

  if (signupBillingNote) {
    signupBillingNote.textContent = config.basicCheckoutConfigured || config.premiumCheckoutConfigured
      ? `Account setup continues through secure checkout for the selected paid plan via ${config.provider}.`
      : "Billing must be connected before new member accounts can be created.";
  }
}

function getSelectedSignupPlan() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("plan") || "").trim().toLowerCase() === "premium" ? "premium" : "basic";
}

function updateSignupPlanPricing(plan) {
  const title = document.getElementById("signupPlanTitle");
  const description = document.getElementById("signupPlanDescription");
  const pricing = document.getElementById("signupPlanPricing");
  if (!title || !description || !pricing) {
    return;
  }

  const selectedPlan = plan === "premium" ? "premium" : "basic";
  const planDetails = selectedPlan === "premium"
    ? {
        title: "Premium",
        description: "Premium adds videos, featured member content, and deeper lesson pathways.",
        options: [["Monthly", "$24/month"], ["3 months", "$68"], ["6 months", "$132"], ["Yearly", "$240"]]
      }
    : {
        title: "Basic",
        description: "Basic gives access to the core member experience, guides, news, results, and account tools.",
        options: [["Monthly", "$12/month"], ["3 months", "$34"], ["6 months", "$66"], ["Yearly", "$120"]]
      };

  title.textContent = planDetails.title;
  description.textContent = planDetails.description;
  pricing.innerHTML = planDetails.options
    .map(([label, price]) => `<div><span>${label}</span><strong>${price}</strong></div>`)
    .join("");
}

function updatePriceLabel(elementId, priceLabel) {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }
  const value = String(priceLabel || "").trim();
  if (value) {
    if (element.classList.contains("home-plan-price") && value.includes("/")) {
      const [price, ...suffixParts] = value.split("/");
      element.textContent = price;
      const suffix = document.createElement("span");
      suffix.textContent = `/${suffixParts.join("/")}`;
      element.appendChild(suffix);
      return;
    }

    element.textContent = value;
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

async function handleHostedCheckoutLinkClick(event) {
  event.preventDefault();
  const button = event.currentTarget;
  if (!(button instanceof HTMLAnchorElement)) {
    return;
  }

  const targetHref = button.getAttribute("href") || "";
  const originalText = button.textContent;
  button.textContent = "Opening Checkout...";

  try {
    const response = await fetch(targetHref, { credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) {
      button.textContent = result.error || "Checkout unavailable";
      return;
    }

    if (result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
      return;
    }
  } catch {
    button.textContent = "Checkout unavailable";
    return;
  }

  button.textContent = originalText;
}

document.addEventListener("DOMContentLoaded", initBillingUi);
