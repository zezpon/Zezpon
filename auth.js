function initAuthForm(formId, endpoint) {
  const form = document.getElementById(formId);
  if (!form) {
    return;
  }

  const message = document.getElementById(`${formId}Message`);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    message.className = "auth-message";

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    if ((formId === "signupForm" || formId === "resetPasswordForm") && !isStrongPassword(String(payload.password || ""))) {
      message.textContent = "Password must be at least 6 characters and include one number and one symbol.";
      message.className = "auth-message error";
      return;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    const next = new URLSearchParams(window.location.search).get("next");
    const safeNext = getSafeRelativeRedirect(next);
    const billingUrl = (formId === "signupForm" || formId === "loginForm") && result.billingRequired
      ? getSafeCheckoutRedirect(result.billingUrl)
      : "";
    const fallbackDestination = result.redirectTo || (formId === "signupForm" ? "membership.html" : "dashboard.html");
    const destination = safeNext || billingUrl || fallbackDestination;

    if (!response.ok) {
      if (billingUrl) {
        message.textContent = result.error || "Redirecting to checkout...";
        message.className = "auth-message warning";
        window.location.href = destination;
        return;
      }

      message.textContent = result.error || "Something went wrong.";
      message.className = "auth-message error";
      return;
    }

    message.textContent = formId === "signupForm"
      ? "Account saved. Redirecting to secure checkout..."
      : "Success. Redirecting...";
    message.className = "auth-message success";
    window.location.href = destination;
  });
}

function initLoginCapsLockWarning() {
  const passwordInput = document.getElementById("loginPassword");
  const capsWarning = document.getElementById("loginCapsWarning");
  if (!(passwordInput instanceof HTMLInputElement) || !capsWarning) {
    return;
  }

  const updateCapsWarning = (event) => {
    const capsOn = typeof event.getModifierState === "function" && event.getModifierState("CapsLock");
    capsWarning.hidden = !capsOn;
  };

  passwordInput.addEventListener("keydown", updateCapsWarning);
  passwordInput.addEventListener("keyup", updateCapsWarning);
  passwordInput.addEventListener("focus", updateCapsWarning);
  passwordInput.addEventListener("blur", () => {
    capsWarning.hidden = true;
  });
}

function initPasswordToggles() {
  const toggleButtons = document.querySelectorAll("[data-password-toggle]");
  for (const button of toggleButtons) {
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }

    const inputId = button.getAttribute("data-password-toggle");
    const targetInput = inputId ? document.getElementById(inputId) : null;
    if (!(targetInput instanceof HTMLInputElement)) {
      continue;
    }

    button.addEventListener("click", () => {
      const showingPassword = targetInput.type === "text";
      targetInput.type = showingPassword ? "password" : "text";
      button.textContent = showingPassword ? "Show" : "Hide";
      button.setAttribute("aria-label", showingPassword ? "Show password" : "Hide password");
    });
  }
}

function isStrongPassword(password) {
  const value = String(password || "");
  return value.length >= 6 && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

function getPasswordStrengthState(password) {
  const value = String(password || "");
  if (!value) {
    return { width: "0%", color: "var(--danger)", text: "Use at least 6 characters, including one number and one symbol." };
  }

  let score = 0;
  if (value.length >= 6) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  if (value.length >= 10) score += 1;

  if (score <= 1) {
    return { width: "25%", color: "var(--danger)", text: "Weak password" };
  }
  if (score === 2) {
    return { width: "55%", color: "#d9a441", text: "Okay password" };
  }
  if (score === 3) {
    return { width: "78%", color: "#8bcf6a", text: "Strong password" };
  }
  return { width: "100%", color: "var(--green)", text: "Very strong password" };
}

function initSignupPasswordStrength() {
  const passwordInput = document.getElementById("signupPassword");
  const fill = document.getElementById("signupPasswordStrengthFill");
  const text = document.getElementById("signupPasswordStrengthText");

  if (!(passwordInput instanceof HTMLInputElement) || !fill || !text) {
    return;
  }

  const update = () => {
    const state = getPasswordStrengthState(passwordInput.value);
    fill.style.width = state.width;
    fill.style.background = state.color;
    text.textContent = state.text;
  };

  passwordInput.addEventListener("input", update);
  update();
}

function getSafeRelativeRedirect(value) {
  if (!value || !value.startsWith("/")) {
    return "";
  }

  if (value.startsWith("//") || value.includes("\\") || value.includes("\n") || value.includes("\r")) {
    return "";
  }

  return value;
}

function getSafeCheckoutRedirect(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  if (rawValue.startsWith("/")) {
    return getSafeRelativeRedirect(rawValue);
  }

  try {
    const parsed = new URL(rawValue);
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function initSimpleAuthForm(formId, endpoint) {
  const form = document.getElementById(formId);
  if (!form) {
    return;
  }

  const message = document.getElementById(`${formId}Message`);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    message.className = "auth-message";

    const payload = Object.fromEntries(new FormData(form).entries());
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      message.textContent = result.error || "Something went wrong.";
      message.className = "auth-message error";
      return;
    }

    if (formId === "forgotPasswordForm" && result.resetUrl) {
      message.innerHTML = `${escapeHtml(result.message || "Reset link prepared.")} <a class="text-link" href="${escapeHtml(result.resetUrl)}">Open reset page</a>`;
    } else {
      message.textContent = result.message || "Success.";
    }
    message.className = "auth-message success";
  });
}

function initResetPasswordForm() {
  const form = document.getElementById("resetPasswordForm");
  if (!form) {
    return;
  }

  const tokenInput = document.getElementById("resetToken");
  const tokenFromQuery = new URLSearchParams(window.location.search).get("token");
  if (tokenInput && tokenFromQuery) {
    tokenInput.value = tokenFromQuery;
  }

  initAuthForm("resetPasswordForm", "/api/auth/reset-password");
}

document.addEventListener("DOMContentLoaded", () => {
  initAuthForm("loginForm", "/api/auth/login");
  initAuthForm("signupForm", "/api/auth/signup");
  initSimpleAuthForm("forgotPasswordForm", "/api/auth/request-password-reset");
  initSimpleAuthForm("verifyEmailForm", "/api/auth/verify-email");
  initResetPasswordForm();
  initSignupPasswordStrength();
  initLoginCapsLockWarning();
  initPasswordToggles();
});
