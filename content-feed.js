const MODULE_PAGE_LINKS = {
  "asx-workouts": "module-asx.html",
  "cpi-calendar": "module-cpi.html",
  "video-blogs": "module-video-blogs.html",
  "budget-systems": "module-budget.html"
};

async function loadManagedContentFeeds() {
  const feeds = Array.from(document.querySelectorAll("[data-content-feed], #managedContentFeed"));
  if (!feeds.length) {
    return;
  }

  for (const feed of feeds) {
    await loadSingleFeed(feed);
  }
}

async function loadSingleFeed(feed) {
  const type = String(feed.dataset.type || "").trim().toLowerCase();
  if (!type) {
    return;
  }

  const params = new URLSearchParams({ type });
  if (feed.dataset.module) {
    params.set("moduleSlug", feed.dataset.module);
  }
  if (feed.dataset.guide) {
    params.set("guideSlug", feed.dataset.guide);
  }
  if (feed.dataset.groupBy) {
    params.set("groupBy", feed.dataset.groupBy);
  }
  if (feed.dataset.featured) {
    params.set("featured", feed.dataset.featured);
  }
  if (feed.dataset.category) {
    params.set("category", feed.dataset.category);
  }
  if (feed.dataset.limit) {
    params.set("limit", feed.dataset.limit);
  }

  const response = await fetch(`/api/content?${params.toString()}`, {
    credentials: "same-origin"
  });

  if (!response.ok) {
    feed.innerHTML = `<p class="auth-message error">Unable to load content right now.</p>`;
    return;
  }

  const result = await response.json();
  const items = Array.isArray(result.items) ? result.items : [];
  if (!items.length) {
    if (type === "video" && feed.dataset.module) {
      feed.innerHTML = renderModuleVideoPlaceholders(feed.dataset.emptyMessage);
      return;
    }
    feed.innerHTML = `<p class="auth-message">${escapeHtml(feed.dataset.emptyMessage || `No ${type} items are available yet.`)}</p>`;
    return;
  }

  if (type === "video" && feed.dataset.groupBy === "module" && Array.isArray(result.groups)) {
    feed.innerHTML = result.groups.map((group) => renderModuleGroup(group)).join("");
    return;
  }

  feed.innerHTML = `<div class="card-grid cols-3">${items.map((item) => renderContentCard(item)).join("")}</div>`;
}

function renderModuleVideoPlaceholders(message) {
  const labels = ["Lesson video", "Walkthrough", "Member example"];
  return `
    <div class="video-placeholder-wrap">
      <p class="auth-message">${escapeHtml(message || "Module videos will appear here.")}</p>
      <div class="card-grid cols-3">
        ${labels.map((label) => renderVideoPlaceholderCard(label)).join("")}
      </div>
    </div>
  `;
}

function renderVideoPlaceholderCard(label) {
  return `
    <article class="card compact-card content-card video-placeholder-card" aria-label="${escapeAttribute(label)} upload placeholder">
      <div class="video-placeholder-thumb">
        <span class="video-placeholder-play" aria-hidden="true"></span>
      </div>
      <p class="panel-label">${escapeHtml(label)}</p>
      <h3>Video upload space</h3>
      <p>Upload a recording from the admin tools and it will appear in this module automatically.</p>
    </article>
  `;
}

function renderModuleGroup(group) {
  const moduleHref = MODULE_PAGE_LINKS[group.slug] || "modules.html";
  return `
    <section class="content-cluster">
      <div class="section-head content-cluster-head">
        <div>
          <p class="eyebrow">Module</p>
          <h2>${escapeHtml(group.label)}</h2>
        </div>
        <a class="text-link" href="${escapeHtml(moduleHref)}">Open module</a>
      </div>
      <div class="card-grid cols-3">
        ${group.items.map((item) => renderContentCard(item)).join("")}
      </div>
    </section>
  `;
}

function renderContentCard(item) {
  const labelParts = [escapeHtml(item.accessLevel)];
  if (item.moduleLabel) {
    labelParts.push(escapeHtml(item.moduleLabel));
  }
  if (item.categoryLabel) {
    labelParts.push(escapeHtml(item.categoryLabel));
  }
  const cardHref = item.detailUrl || item.mediaUrl || "#";
  const posterMarkup = item.posterUrl
    ? `<div class="media-thumb media-thumb-image"><img class="media-poster" src="${escapeAttribute(item.posterUrl)}" alt="${escapeAttribute(item.title)} poster" /></div>`
    : "";

  return `
    <article class="card compact-card content-card" data-title="${escapeAttribute(item.title)}" data-summary="${escapeAttribute(item.summary)}" data-category="${escapeAttribute(item.categorySlug || "")}">
      ${posterMarkup}
      <p class="panel-label">${labelParts.join(" | ")}</p>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <div class="content-card-meta">
        <span>${escapeHtml(item.durationText || item.guideLabel || (item.moduleLabel ? "Module lesson" : "Video library"))}</span>
        <a class="text-link" href="${escapeAttribute(cardHref)}">${item.type === "video" ? "Open video" : "Open item"}</a>
      </div>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

document.addEventListener("DOMContentLoaded", loadManagedContentFeeds);
