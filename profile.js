async function loadProfile() {
  const response = await fetch("/api/profile", { credentials: "same-origin" });
  if (!response.ok) {
    window.location.href = "login.html?next=/profile.html";
    return null;
  }

  return response.json();
}

function renderProfileSummary(result) {
  const summary = document.getElementById("profileSummary");
  if (!summary) {
    return;
  }

  summary.innerHTML = `
    <p><strong>Username:</strong> ${escapeHtml(result.user.username || result.user.name)}</p>
    <p><strong>Plan:</strong> ${escapeHtml(result.user.plan)}</p>
    <p><strong>Role:</strong> ${escapeHtml(result.user.role)}</p>
    <p><strong>Email Verified:</strong> ${result.user.emailVerified ? "Yes" : "No"}</p>
    <p><strong>Created:</strong> ${escapeHtml(new Date(result.createdAt).toLocaleString())}</p>
  `;
}

async function initProfileForm() {
  const form = document.getElementById("profileForm");
  if (!form) {
    return;
  }

  const message = document.getElementById("profileFormMessage");
  const result = await loadProfile();
  if (!result) {
    return;
  }

  form.name.value = result.user.name;
  form.email.value = result.user.email;
  renderProfileSummary(result);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    message.className = "auth-message";

    const payload = Object.fromEntries(new FormData(form).entries());
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });

    const updateResult = await response.json();
    if (!response.ok) {
      message.textContent = updateResult.error || "Unable to update profile.";
      message.className = "auth-message error";
      return;
    }

    message.textContent = updateResult.message;
    message.className = "auth-message success";
    form.currentPassword.value = "";
    form.newPassword.value = "";

    renderProfileSummary({
      user: updateResult.user,
      createdAt: result.createdAt
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

document.addEventListener("DOMContentLoaded", initProfileForm);
