async function loadDashboard() {
  const intro = document.getElementById("dashboardIntro");
  const cards = document.getElementById("dashboardCards");
  const notes = document.getElementById("dashboardNotes");
  const summary = document.getElementById("dashboardSummary");
  const featuredVideos = document.getElementById("dashboardFeaturedVideos");
  const featuredLabel = document.getElementById("dashboardFeaturedLabel");
  const upgradeButton = document.getElementById("dashboardUpgradeButton");

  if (!intro || !cards || !notes || !summary || !featuredVideos || !featuredLabel || !upgradeButton) {
    return;
  }

  const response = await fetch("/api/dashboard", { credentials: "same-origin" });
  if (!response.ok) {
    window.location.href = "login.html?next=/dashboard.html";
    return;
  }
  let billingConfig = null;
  try {
    const billingResponse = await fetch("/api/billing/config", { credentials: "same-origin" });
    if (billingResponse.ok) {
      billingConfig = await billingResponse.json();
    }
  } catch {
    billingConfig = null;
  }

  const result = await response.json();
  intro.textContent = `${result.user.username || result.user.name}, this dashboard reflects your current ${result.user.plan} plan access.`;

  cards.innerHTML = result.cards.map((card) => `
    <a class="card card-link" href="${card.href}">
      <h3>${escapeHtml(card.title)}</h3>
      <p>${escapeHtml(card.description)}</p>
    </a>
  `).join("");

  if (result.user.plan === "premium") {
    featuredLabel.textContent = "Featured Videos";
    featuredVideos.innerHTML = (result.featuredVideos || []).map((video) => `
      <a class="card card-link" href="${escapeHtml(video.detailUrl || video.mediaUrl || "videos.html")}">
        <p class="panel-label">${escapeHtml(video.categoryLabel || "Video")}</p>
        <h3>${escapeHtml(video.title)}</h3>
        <p>${escapeHtml(video.summary)}</p>
      </a>
    `).join("") || `<p class="auth-message">Featured videos will appear here.</p>`;
    upgradeButton.hidden = true;
  } else {
    featuredLabel.textContent = "Premium Upgrade";
    featuredVideos.innerHTML = `
      <div class="card">
        <p class="panel-label">Premium</p>
        <h3>Unlock the video library</h3>
        <p>Upgrade when you want full access to featured videos, video detail pages, and the wider member library.</p>
      </div>
    `;
    upgradeButton.hidden = false;
    if (billingConfig?.premiumCheckoutConfigured) {
      upgradeButton.textContent = "Upgrade To Premium";
      upgradeButton.href = "membership.html";
      upgradeButton.addEventListener("click", handleUpgradeClick);
    } else {
      upgradeButton.textContent = "Ask About Premium";
      upgradeButton.href = "contact.html";
    }
  }

  notes.innerHTML = result.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");

  summary.innerHTML = `
    <p><strong>Username:</strong> ${escapeHtml(result.user.username || result.user.name)}</p>
    <p><strong>Plan:</strong> ${escapeHtml(result.user.plan)}</p>
    <p><strong>Role:</strong> ${escapeHtml(result.user.role)}</p>
  `;
}

async function handleUpgradeClick(event) {
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
  } catch {
    button.textContent = "Upgrade unavailable";
    return;
  }

  button.textContent = originalText;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

document.addEventListener("DOMContentLoaded", loadDashboard);
