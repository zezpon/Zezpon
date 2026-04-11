function applyVideoFilters() {
  const searchInput = document.getElementById("videoSearch");
  const categorySelect = document.getElementById("videoCategoryFilter");
  const feed = document.getElementById("managedContentFeed");
  const message = document.getElementById("videoFilterMessage");

  if (!(searchInput instanceof HTMLInputElement) || !(categorySelect instanceof HTMLSelectElement) || !feed || !message) {
    return;
  }

  const query = searchInput.value.trim().toLowerCase();
  const category = categorySelect.value.trim().toLowerCase();
  const cards = Array.from(feed.querySelectorAll(".content-card"));

  let visibleCount = 0;
  for (const card of cards) {
    const title = String(card.getAttribute("data-title") || "").toLowerCase();
    const summary = String(card.getAttribute("data-summary") || "").toLowerCase();
    const cardCategory = String(card.getAttribute("data-category") || "").toLowerCase();
    const matchesQuery = !query || title.includes(query) || summary.includes(query);
    const matchesCategory = !category || cardCategory === category;
    const matches = matchesQuery && matchesCategory;
    card.hidden = !matches;
    if (matches) {
      visibleCount += 1;
    }
  }

  message.textContent = cards.length && !visibleCount
    ? "No videos match the current filters."
    : "";
}

function initVideoFilters() {
  const searchInput = document.getElementById("videoSearch");
  const categorySelect = document.getElementById("videoCategoryFilter");
  const feed = document.getElementById("managedContentFeed");

  if (!(searchInput instanceof HTMLInputElement) || !(categorySelect instanceof HTMLSelectElement) || !feed) {
    return;
  }

  searchInput.addEventListener("input", applyVideoFilters);
  categorySelect.addEventListener("change", applyVideoFilters);

  const observer = new MutationObserver(() => {
    applyVideoFilters();
  });
  observer.observe(feed, { childList: true, subtree: true });
}

document.addEventListener("DOMContentLoaded", initVideoFilters);
