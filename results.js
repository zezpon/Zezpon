const memberWinState = {
  items: [],
  activeFilter: "all"
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCategoryLabel(slug) {
  const labels = {
    saving: "Saving",
    budgeting: "Budgeting",
    debt: "Debt",
    "investing-basics": "Investing Basics",
    "side-income": "Side Income",
    mindset: "Mindset"
  };
  return labels[slug] || "General";
}

function renderCounters(stats) {
  const target = document.getElementById("memberWinCounters");
  if (!target || !stats) {
    return;
  }

  target.innerHTML = `
    <article class="stat-card">
      <span class="stat-label">Stories Shared</span>
      <strong>${Number(stats.publishedStories || 0)}</strong>
      <span>Published member stories.</span>
    </article>
    <article class="stat-card">
      <span class="stat-label">Smart Money Moves</span>
      <strong>${Number(stats.approvedMoves || 0)}</strong>
      <span>Approved progress updates.</span>
    </article>
    <article class="stat-card">
      <span class="stat-label">Budgeting Wins This Month</span>
      <strong>${Number(stats.budgetingWinsThisMonth || 0)}</strong>
      <span>Budgeting stories approved this month.</span>
    </article>
  `;
}

function buildMemberWinCard(item, featured = false) {
  const verificationCopy = item.verificationStatus === "verified"
    ? '<span class="win-meta-chip verified">Verified by supporting information provided by the member.</span>'
    : '<span class="win-meta-chip">Self-reported by member.</span>';
  const amountBlock = item.amountText
    ? `<p><strong>Progress:</strong> ${escapeHtml(item.amountText)}</p>`
    : "";

  return `
    <article class="member-win-card ${featured ? "featured" : ""}">
      <div class="member-win-top">
        <span class="access-badge">${escapeHtml(formatCategoryLabel(item.categorySlug))}</span>
        ${verificationCopy}
      </div>
      <h3>${escapeHtml(item.displayHeadline)}</h3>
      <p class="member-win-quote">"${escapeHtml(item.changeText)}"</p>
      <div class="member-win-details">
        <p><strong>Member:</strong> ${escapeHtml(item.publicName)}</p>
        <p><strong>Money move:</strong> ${escapeHtml(item.moneyMove)}</p>
        ${amountBlock}
        <p><strong>Timeframe:</strong> ${escapeHtml(item.timeframeText)}</p>
      </div>
      <p class="member-win-note">Individual experience. Not financial advice.</p>
    </article>
  `;
}

function renderFeaturedWins(items) {
  const target = document.getElementById("featuredMemberWins");
  if (!target) {
    return;
  }

  if (!items.length) {
    target.innerHTML = `
      <article class="member-win-card featured member-win-empty">
        <h3>Your first member win can start this wall.</h3>
        <p>There are no approved featured stories yet. Share a practical money move once you are ready.</p>
      </article>
    `;
    return;
  }

  target.innerHTML = items.map((item) => buildMemberWinCard(item, true)).join("");
}

function renderMemberWinGrid() {
  const target = document.getElementById("memberWinGrid");
  if (!target) {
    return;
  }

  const filteredItems = memberWinState.activeFilter === "all"
    ? memberWinState.items
    : memberWinState.items.filter((item) => item.categorySlug === memberWinState.activeFilter);

  if (!filteredItems.length) {
    target.innerHTML = `
      <article class="member-win-card member-win-empty">
        <h3>No stories in this category yet.</h3>
        <p>Try another filter or be the first member to share a progress update here.</p>
      </article>
    `;
    return;
  }

  target.innerHTML = filteredItems.map((item) => buildMemberWinCard(item)).join("");
}

function setMemberWinMessage(text, tone) {
  const target = document.getElementById("memberWinMessage");
  if (!target) {
    return;
  }

  target.textContent = text;
  target.className = tone ? `auth-message ${tone}` : "auth-message";
}

async function loadMemberWins() {
  try {
    const response = await fetch("/api/member-wins", { credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Unable to load member wins.");
    }

    memberWinState.items = Array.isArray(result.items) ? result.items : [];
    renderCounters(result.stats || {});
    renderFeaturedWins(Array.isArray(result.featuredItems) ? result.featuredItems : []);
    renderMemberWinGrid();
  } catch (error) {
    setMemberWinMessage(error.message || "Unable to load member wins right now.", "error");
  }
}

async function prefillMemberWinForm() {
  const form = document.getElementById("memberWinForm");
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  try {
    const response = await fetch("/api/session", { credentials: "same-origin" });
    const result = response.ok ? await response.json() : { user: null };
    if (result.user && form.displayName instanceof HTMLInputElement && !form.displayName.value.trim()) {
      form.displayName.value = result.user.username || result.user.name || "";
    }
  } catch {
    // Keep form usable even if session lookup fails.
  }
}

function applyMemberWinFilter(filterValue) {
  memberWinState.activeFilter = filterValue || "all";
  document.querySelectorAll("#memberWinFilters .filter-chip").forEach((chip) => {
    const isActive = chip.getAttribute("data-filter") === memberWinState.activeFilter;
    chip.classList.toggle("active", isActive);
    chip.setAttribute("aria-pressed", String(isActive));
  });
  renderMemberWinGrid();
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest("#memberWinFilters [data-filter]");
  if (!(button instanceof HTMLElement)) {
    return;
  }

  applyMemberWinFilter(button.getAttribute("data-filter") || "all");
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "memberWinForm") {
    return;
  }

  event.preventDefault();
  setMemberWinMessage("", "");

  const payload = {
    displayName: String(form.displayName.value || "").trim(),
    categorySlug: String(form.categorySlug.value || "").trim(),
    beforeText: String(form.beforeText.value || "").trim(),
    moneyMove: String(form.moneyMove.value || "").trim(),
    changeText: String(form.changeText.value || "").trim(),
    amountText: String(form.amountText.value || "").trim(),
    timeframeText: String(form.timeframeText.value || "").trim(),
    publishConsent: String(form.publishConsent.value || "").trim(),
    nameConsent: String(form.nameConsent.value || "").trim(),
    honestyConfirmed: form.honestyConfirmed.checked ? "yes" : "no"
  };

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton?.setAttribute("disabled", "true");

  try {
    const response = await fetch("/api/member-wins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Unable to submit your story.");
    }

    form.reset();
    await prefillMemberWinForm();
    setMemberWinMessage(result.message || "Your member win has been submitted for review.", "success");
  } catch (error) {
    setMemberWinMessage(error.message || "Unable to submit your story right now.", "error");
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  await prefillMemberWinForm();
  await loadMemberWins();
  applyMemberWinFilter(memberWinState.activeFilter);
});
