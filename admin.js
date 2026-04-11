async function loadAdminOverview() {
  const response = await fetch("/api/admin/overview", { credentials: "same-origin" });
  if (response.status === 401) {
    window.location.href = "login.html?next=/admin.html";
    return null;
  }
  if (response.status === 403) {
    window.location.href = "dashboard.html";
    return null;
  }
  return response.json();
}

function setAdminMessage(text, tone) {
  const message = document.getElementById("adminMessage");
  if (!message) {
    return;
  }

  message.textContent = text;
  message.className = tone ? `auth-message ${tone}` : "auth-message";
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderAdminStats(stats) {
  const target = document.getElementById("adminStats");
  if (!target) {
    return;
  }

  target.innerHTML = `
    <article class="card"><p class="panel-label">Members</p><h3>${stats.totalUsers}</h3><p>Total accounts in the system.</p></article>
    <article class="card"><p class="panel-label">Basic</p><h3>${stats.basicUsers}</h3><p>Members with Basic access.</p></article>
    <article class="card"><p class="panel-label">Premium</p><h3>${stats.premiumUsers}</h3><p>Members with Premium access.</p></article>
    <article class="card"><p class="panel-label">Admins</p><h3>${stats.adminUsers}</h3><p>Accounts with admin controls enabled.</p></article>
  `;
}

function renderAdminInsights(insights) {
  const target = document.getElementById("adminInsights");
  if (!target) {
    return;
  }

  target.innerHTML = `
    <article class="card">
      <p class="panel-label">Video Views</p>
      <h3>${Number(insights?.totalViews || 0)}</h3>
      <p>Total tracked video views across the library.</p>
    </article>
    <article class="card">
      <p class="panel-label">Featured</p>
      <h3>${Number(insights?.featuredVideos || 0)}</h3>
      <p>Videos currently pinned into featured areas.</p>
    </article>
    <article class="card">
      <p class="panel-label">Top Video</p>
      <h3>${escapeHtml(insights?.topVideos?.[0]?.title || "None yet")}</h3>
      <p>${escapeHtml(insights?.topVideos?.[0]?.durationText || "Waiting for view data.")}</p>
    </article>
  `;
}

function renderAdminUsers(users) {
  const target = document.getElementById("adminUserList");
  if (!target) {
    return;
  }

  target.innerHTML = users.map((user) => `
    <form class="card admin-user-card" data-user-id="${user.id}">
      <p class="panel-label">${escapeHtml(user.role)}</p>
      <h3>${escapeHtml(user.name)}</h3>
      <p>${escapeHtml(user.email)}</p>
      <p>Created: ${escapeHtml(new Date(user.createdAt).toLocaleString())}</p>
      <div class="admin-control-row">
        <div class="field-block">
          <label>Plan</label>
          <select name="plan">
            <option value="basic" ${user.plan === "basic" ? "selected" : ""}>Basic</option>
            <option value="premium" ${user.plan === "premium" ? "selected" : ""}>Premium</option>
          </select>
        </div>
        <div class="field-block">
          <label>Role</label>
          <select name="role">
            <option value="member" ${user.role === "member" ? "selected" : ""}>Member</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary" type="submit">Save Access</button>
    </form>
  `).join("");
}

function renderAdminContent(items) {
  const target = document.getElementById("adminContentList");
  if (!target) {
    return;
  }

  target.innerHTML = items.map((item) => `
    <article class="card admin-content-card" data-content-id="${item.id}">
      <p class="panel-label">${escapeHtml(item.type)} | ${escapeHtml(item.accessLevel)} | ${escapeHtml(item.status)}</p>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <p><strong>Slug:</strong> ${escapeHtml(item.slug)}</p>
      <p><strong>Featured:</strong> ${item.isFeatured ? "Yes" : "No"}</p>
      <p><strong>Category:</strong> ${escapeHtml(item.categoryLabel || "General")}</p>
      <p><strong>Duration:</strong> ${escapeHtml(item.durationText || "Not set")}</p>
      <p><strong>Module:</strong> ${escapeHtml(item.moduleLabel || "Video Library Only")}</p>
      <p><strong>Guide:</strong> ${escapeHtml(item.guideLabel || "Not linked")}</p>
      <p><strong>Order:</strong> ${escapeHtml(String(item.displayOrder ?? 100))}</p>
      <p><strong>Views:</strong> ${escapeHtml(String(item.viewCount ?? 0))}</p>
      <div class="form-actions">
        <button class="btn btn-secondary" type="button" data-action="edit-content">Edit</button>
      </div>
    </article>
  `).join("");
}

function renderAuditLog(entries) {
  const target = document.getElementById("adminAuditLog");
  if (!target) {
    return;
  }

  target.innerHTML = entries.map((entry) => `
    <li>
      <strong>${escapeHtml(entry.action)}</strong><br />
      ${escapeHtml(new Date(entry.createdAt).toLocaleString())}
    </li>
  `).join("");
}

function populateContentForm(item) {
  const form = document.getElementById("contentForm");
  if (!form) {
    return;
  }

  form.contentId.value = item?.id || "";
  form.type.value = item?.type || "video";
  form.status.value = item?.status || "draft";
  form.title.value = item?.title || "";
  form.slug.value = item?.slug || "";
  form.summary.value = item?.summary || "";
  form.body.value = item?.body || "";
  form.mediaUrl.value = item?.mediaUrl || "";
  form.posterUrl.value = item?.posterUrl || "";
  form.categorySlug.value = item?.categorySlug || "";
  form.durationText.value = item?.durationText || "";
  form.moduleSlug.value = item?.moduleSlug || "";
  form.guideSlug.value = item?.guideSlug || "";
  form.displayOrder.value = String(item?.displayOrder ?? 100);
  form.isFeatured.checked = Boolean(item?.isFeatured);
  form.accessLevel.value = item?.accessLevel || "public";
  form.dataset.slugEdited = item?.slug ? "true" : "false";

  if (form.contentUpload) {
    form.contentUpload.value = "";
  }
}

async function initAdminTools() {
  const result = await loadAdminOverview();
  if (!result) {
    return;
  }

  renderAdminStats(result.stats);
  renderAdminInsights(result.contentInsights || {});
  renderAdminUsers(result.users);
  renderAdminContent(result.contentItems || []);
  renderAuditLog(result.recentAuditLogs || []);
}

function syncContentFormState(form) {
  const type = String(form.type?.value || "video");
  const moduleSelect = form.moduleSlug;
  const guideSelect = form.guideSlug;

  if (moduleSelect instanceof HTMLSelectElement) {
    moduleSelect.disabled = type !== "video";
    if (type !== "video") {
      moduleSelect.value = "";
    }
  }

  if (guideSelect instanceof HTMLSelectElement) {
    guideSelect.disabled = type !== "video";
    if (type !== "video") {
      guideSelect.value = "";
    }
  }

  if (form.categorySlug instanceof HTMLSelectElement) {
    form.categorySlug.disabled = type !== "video";
    if (type !== "video") {
      form.categorySlug.value = "";
    }
  }

  if (form.durationText instanceof HTMLInputElement) {
    form.durationText.disabled = type !== "video";
    if (type !== "video") {
      form.durationText.value = "";
    }
  }

  if (form.posterUrl instanceof HTMLInputElement) {
    form.posterUrl.disabled = type !== "video";
    if (type !== "video") {
      form.posterUrl.value = "";
    }
  }

  if (form.isFeatured instanceof HTMLInputElement) {
    form.isFeatured.disabled = type !== "video";
    if (type !== "video") {
      form.isFeatured.checked = false;
    }
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

document.addEventListener("DOMContentLoaded", initAdminTools);

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.classList.contains("admin-user-card")) {
    return;
  }

  event.preventDefault();

  const userId = form.dataset.userId;
  const payload = Object.fromEntries(new FormData(form).entries());
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });

  const updateResult = await response.json();
  if (!response.ok) {
    setAdminMessage(updateResult.error || "Unable to update member access.", "error");
    return;
  }

  setAdminMessage(updateResult.message, "success");
  initAdminTools();
});

document.addEventListener("click", async (event) => {
  const button = event.target;
  if (!(button instanceof HTMLElement)) {
    return;
  }

  if (button.id === "contentReset") {
    populateContentForm(null);
    setAdminMessage("", "");
    return;
  }

  if (button.id === "uploadContentFile") {
    const form = document.getElementById("contentForm");
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const fileInput = form.querySelector("#contentUpload");
    if (!(fileInput instanceof HTMLInputElement) || !fileInput.files || fileInput.files.length === 0) {
      setAdminMessage("Choose a video file before uploading.", "error");
      return;
    }

    const uploadData = new FormData();
    uploadData.append("file", fileInput.files[0]);
    button.setAttribute("disabled", "true");

    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        credentials: "same-origin",
        body: uploadData
      });
      const result = await response.json();
      if (!response.ok) {
        setAdminMessage(result.error || "Unable to upload file.", "error");
        return;
      }

      form.mediaUrl.value = result.mediaUrl || "";
      setAdminMessage(result.message || "Upload completed successfully.", "success");
    } catch {
      setAdminMessage("Unable to upload file right now.", "error");
    } finally {
      button.removeAttribute("disabled");
    }
    return;
  }

  if (button.dataset.action !== "edit-content") {
    return;
  }

  const card = button.closest(".admin-content-card");
  const contentId = card?.getAttribute("data-content-id");
  if (!contentId) {
    return;
  }

  const overview = await loadAdminOverview();
  const item = overview?.contentItems?.find((entry) => entry.id === contentId);
  if (item) {
    populateContentForm(item);
    syncContentFormState(document.getElementById("contentForm"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "contentForm") {
    return;
  }

  event.preventDefault();

  const formData = new FormData(form);
  const contentId = String(formData.get("contentId") || "");
  formData.delete("contentId");
  formData.set("isFeatured", form.isFeatured.checked ? "true" : "false");

  const payload = Object.fromEntries(formData.entries());
  const endpoint = contentId ? `/api/admin/content/${contentId}` : "/api/admin/content";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok) {
    setAdminMessage(result.error || "Unable to save content.", "error");
    return;
  }

  setAdminMessage(result.message, "success");
  populateContentForm(null);
  syncContentFormState(form);
  initAdminTools();
});

document.addEventListener("input", (event) => {
  const target = event.target;
  const form = target instanceof HTMLElement ? target.closest("#contentForm") : null;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  if (target instanceof HTMLInputElement && target.name === "slug") {
    form.dataset.slugEdited = target.value.trim() ? "true" : "false";
    return;
  }

  if (
    target instanceof HTMLInputElement &&
    target.name === "title" &&
    form.dataset.slugEdited !== "true" &&
    form.slug
  ) {
    form.slug.value = slugify(target.value);
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  const form = target instanceof HTMLElement ? target.closest("#contentForm") : null;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  if (target instanceof HTMLSelectElement && target.name === "type") {
    syncContentFormState(form);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contentForm");
  if (form instanceof HTMLFormElement) {
    syncContentFormState(form);
  }
});
