function setContactMessage(text, tone) {
  const target = document.getElementById("contactMessageState");
  if (!target) {
    return;
  }

  target.textContent = text;
  target.className = tone ? `auth-message ${tone}` : "auth-message";
}

async function loadContactConfig() {
  try {
    const response = await fetch("/api/contact/config", { credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Unable to load contact details.");
    }

    const emailLink = document.getElementById("supportEmailLink");
    const replyTarget = document.getElementById("supportReplyTime");
    if (emailLink instanceof HTMLAnchorElement && result.supportEmail) {
      emailLink.textContent = result.supportEmail;
      emailLink.href = `mailto:${result.supportEmail}`;
    }
    if (replyTarget instanceof HTMLElement && result.replyTimeText) {
      replyTarget.textContent = result.replyTimeText;
    }
  } catch {
    // Keep fallback contact details already rendered in HTML.
  }
}

async function prefillContactForm() {
  const form = document.getElementById("contactForm");
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  try {
    const response = await fetch("/api/session", { credentials: "same-origin" });
    const result = response.ok ? await response.json() : { user: null };
    if (result.user) {
      if (form.name instanceof HTMLInputElement && !form.name.value.trim()) {
        form.name.value = result.user.name || result.user.username || "";
      }
      if (form.email instanceof HTMLInputElement && !form.email.value.trim()) {
        form.email.value = result.user.email || "";
      }
      if (form.username instanceof HTMLInputElement && !form.username.value.trim()) {
        form.username.value = result.user.username || "";
      }
    }
  } catch {
    // Keep form usable if session lookup fails.
  }
}

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "contactForm") {
    return;
  }

  event.preventDefault();
  setContactMessage("", "");

  const payload = {
    name: String(form.name.value || "").trim(),
    email: String(form.email.value || "").trim(),
    enquiryType: String(form.enquiryType.value || "").trim(),
    username: String(form.username.value || "").trim(),
    message: String(form.message.value || "").trim(),
    privacyConfirmed: form.privacyConfirmed.checked ? "yes" : "no"
  };

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton?.setAttribute("disabled", "true");

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Unable to send your message right now.");
    }

    form.reset();
    await prefillContactForm();
    setContactMessage(result.message || "Your message has been sent successfully.", "success");
  } catch (error) {
    setContactMessage(error.message || "Unable to send your message right now.", "error");
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  await loadContactConfig();
  await prefillContactForm();
});
