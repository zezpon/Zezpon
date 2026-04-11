function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getSlugFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("slug") || "").trim().toLowerCase();
}

function isPlayableMediaUrl(url) {
  return /^\/media\//.test(url) || /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

async function loadVideoDetail() {
  const slug = getSlugFromQuery();
  if (!slug) {
    window.location.href = "videos.html";
    return;
  }

  const response = await fetch(`/api/content-item/${encodeURIComponent(slug)}`, {
    credentials: "same-origin"
  });

  if (response.status === 401) {
    window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return;
  }

  if (!response.ok) {
    document.getElementById("videoTitle").textContent = "Video unavailable";
    document.getElementById("videoSubtitle").textContent = "This lesson could not be loaded.";
    document.getElementById("videoFallback").innerHTML = `<p class="auth-message error">Unable to load this video right now.</p>`;
    return;
  }

  const result = await response.json();
  const item = result.item;
  document.title = `${item.title} | Zezpon`;
  document.getElementById("videoTitle").textContent = item.title;
  document.getElementById("videoSubtitle").textContent = item.summary;
  document.getElementById("videoOpenDirect").href = item.mediaUrl || "videos.html";

  const meta = [
    item.categoryLabel,
    item.durationText,
    item.moduleLabel,
    item.guideLabel
  ].filter(Boolean);
  document.getElementById("videoMeta").innerHTML = meta.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("");
  document.getElementById("videoBody").innerHTML = item.body
    ? `<p>${escapeHtml(item.body)}</p>`
    : `<p>${escapeHtml(item.summary)}</p>`;

  const sidebarNotes = [];
  if (item.isFeatured) {
    sidebarNotes.push("This video is currently featured in the library.");
  }
  if (typeof item.viewCount === "number") {
    sidebarNotes.push(`${item.viewCount} tracked views so far.`);
  }
  document.getElementById("videoSidebarNotes").textContent = sidebarNotes.join(" ");

  const player = document.getElementById("videoPlayer");
  const fallback = document.getElementById("videoFallback");
  if (isPlayableMediaUrl(item.mediaUrl)) {
    player.src = item.mediaUrl;
    player.poster = item.posterUrl || "";
    player.hidden = false;
    fallback.hidden = true;
  } else {
    fallback.innerHTML = `
      <p>This lesson opens on its dedicated page or source link.</p>
      <a class="btn btn-primary" href="${escapeHtml(item.mediaUrl || "videos.html")}">Open lesson</a>
    `;
  }

  const relatedTarget = document.getElementById("relatedVideos");
  if (!Array.isArray(result.relatedItems) || !result.relatedItems.length) {
    relatedTarget.innerHTML = `<p class="auth-message">No related videos yet.</p>`;
  } else {
    relatedTarget.innerHTML = result.relatedItems.map((relatedItem) => `
      <a class="card card-link compact-card" href="${escapeHtml(relatedItem.detailUrl || relatedItem.mediaUrl || "videos.html")}">
        <p class="panel-label">${escapeHtml(relatedItem.categoryLabel || "Video")}</p>
        <h3>${escapeHtml(relatedItem.title)}</h3>
        <p>${escapeHtml(relatedItem.summary)}</p>
      </a>
    `).join("");
  }

  fetch(`/api/content-item/${encodeURIComponent(slug)}/view`, {
    method: "POST",
    credentials: "same-origin"
  }).catch(() => {});
}

document.addEventListener("DOMContentLoaded", loadVideoDetail);
