const menuButton = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const navActions = document.querySelector(".nav-actions");
const siteHeader = document.querySelector(".site-header");
const siteFooter = document.querySelector(".site-footer");

if (menuButton && siteNav) {
  menuButton.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
}

function ensureUtilityBar() {
  if (!siteHeader) {
    return null;
  }

  let utilityBar = document.querySelector(".utility-bar");
  if (!utilityBar) {
    utilityBar = document.createElement("div");
    utilityBar.className = "utility-bar";
    siteHeader.before(utilityBar);
  }

  utilityBar.innerHTML = `
    <div class="container utility-wrap">
      <div class="utility-links">
        <a href="news.html">Latest News</a>
        <a href="guides.html">Guides</a>
        <a href="membership.html">Membership</a>
      </div>
      <div class="utility-links utility-actions">
        <a href="security.html">Security</a>
        <a href="privacy.html">Privacy</a>
        <a href="contact.html">Contact</a>
        <div class="utility-auth"></div>
      </div>
    </div>
  `;

  return utilityBar.querySelector(".utility-auth");
}

function standardizeNavActions() {
  if (!navActions) {
    return;
  }

  navActions.innerHTML = "";
  navActions.hidden = true;
}

function ensureFooterCopyright() {
  if (!siteFooter || siteFooter.querySelector(".footer-bottom")) {
    return;
  }

  const footerBottom = document.createElement("div");
  footerBottom.className = "container footer-bottom";
  footerBottom.innerHTML = `<p>&copy; ${new Date().getFullYear()} Zezpon. All rights reserved.</p>`;
  siteFooter.appendChild(footerBottom);
}

function buildAuthLinks(user) {
  if (user) {
    return `
      <span class="auth-chip">${escapeHtml(user.username || user.name)} | ${escapeHtml(user.plan)}</span>
      <a class="btn btn-secondary" href="dashboard.html">Dashboard</a>
      <button class="btn btn-primary" type="button" id="logoutButton">Logout</button>
    `;
  }

  return `
    <a class="btn btn-secondary" href="login.html">Login</a>
    <a class="btn btn-primary" href="signup.html">Join Zezpon</a>
  `;
}

function applyPremiumLinkAccess(user) {
  const premiumLockedLinks = document.querySelectorAll("[data-premium-required='true']");
  if (!premiumLockedLinks.length) {
    return;
  }

  const hasPremiumAccess = Boolean(
    user &&
    String(user.plan || "").toLowerCase() === "premium" &&
    String(user.billingStatus || "").toLowerCase() === "active"
  );

  for (const link of premiumLockedLinks) {
    if (!(link instanceof HTMLAnchorElement)) {
      continue;
    }

    const premiumHref = link.getAttribute("data-premium-href") || "membership.html";
    link.href = hasPremiumAccess ? premiumHref : "membership.html";
    link.setAttribute("aria-disabled", hasPremiumAccess ? "false" : "true");
  }
}

async function enhanceAuthNav() {
  const authTarget = ensureUtilityBar();
  standardizeNavActions();

  if (!authTarget) {
    return;
  }

  try {
    const response = await fetch("/api/session", { credentials: "same-origin" });
    const result = response.ok ? await response.json() : { user: null };
    authTarget.innerHTML = buildAuthLinks(result.user);
    applyPremiumLinkAccess(result.user);

    const logoutButton = authTarget.querySelector("#logoutButton");
    logoutButton?.addEventListener("click", async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin"
      });
      window.location.href = "login.html";
    });
  } catch {
    authTarget.innerHTML = buildAuthLinks(null);
    applyPremiumLinkAccess(null);
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

ensureFooterCopyright();
enhanceAuthNav();
