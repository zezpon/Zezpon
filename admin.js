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
    <article class="card">
      <p class="panel-label">Pending Wins</p>
      <h3>${Number(insights?.pendingMemberWins || 0)}</h3>
      <p>Member stories waiting for review.</p>
    </article>
    <article class="card">
      <p class="panel-label">Approved Wins</p>
      <h3>${Number(insights?.approvedMemberWins || 0)}</h3>
      <p>Stories currently approved for the website.</p>
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

function renderAdminMemberWins(items) {
  const target = document.getElementById("adminMemberWins");
  if (!target) {
    return;
  }

  if (!items.length) {
    target.innerHTML = `
      <article class="card">
        <p class="panel-label">No submissions yet</p>
        <p>Member story submissions will appear here once members start sharing progress.</p>
      </article>
    `;
    return;
  }

  target.innerHTML = items.map((item) => `
    <form class="card admin-member-win-card" data-member-win-id="${item.id}">
      <p class="panel-label">${escapeHtml(item.status)} | ${escapeHtml(item.categoryLabel)}</p>
      <h3>${escapeHtml(item.displayName)}</h3>
      <div class="member-win-admin-meta">
        <p><strong>Username:</strong> ${escapeHtml(item.submitterUsername || "Not available")}</p>
        <p><strong>Email:</strong> ${escapeHtml(item.submitterEmail || "Not available")}</p>
      </div>
      <div class="field-block">
        <label>Submitted Name</label>
        <input name="displayName" type="text" value="${escapeHtml(item.displayName)}" />
      </div>
      <div class="field-block">
        <label>Before</label>
        <textarea name="beforeText" rows="3">${escapeHtml(item.beforeText)}</textarea>
      </div>
      <div class="field-block">
        <label>Money Move</label>
        <textarea name="moneyMove" rows="3">${escapeHtml(item.moneyMove)}</textarea>
      </div>
      <div class="field-block">
        <label>What Changed</label>
        <textarea name="changeText" rows="3">${escapeHtml(item.changeText)}</textarea>
      </div>
      <div class="admin-control-row">
        <div class="field-block">
          <label>Category</label>
          <select name="categorySlug">
            ${["saving", "budgeting", "debt", "investing-basics", "side-income", "mindset"].map((slug) => `
              <option value="${slug}" ${item.categorySlug === slug ? "selected" : ""}>${escapeHtml(formatMemberWinCategory(slug))}</option>
            `).join("")}
          </select>
        </div>
        <div class="field-block">
          <label>Status</label>
          <select name="status">
            <option value="pending" ${item.status === "pending" ? "selected" : ""}>Pending</option>
            <option value="approved" ${item.status === "approved" ? "selected" : ""}>Approved</option>
            <option value="rejected" ${item.status === "rejected" ? "selected" : ""}>Rejected</option>
          </select>
        </div>
      </div>
      <div class="admin-control-row">
        <div class="field-block">
          <label>Verification</label>
          <select name="verificationStatus">
            <option value="standard" ${item.verificationStatus === "standard" ? "selected" : ""}>Standard</option>
            <option value="verified" ${item.verificationStatus === "verified" ? "selected" : ""}>Verified</option>
          </select>
        </div>
        <div class="field-block">
          <label>Published Name</label>
          <input name="publishedName" type="text" value="${escapeHtml(item.publishedName || "")}" placeholder="Leave blank to use submitted name" />
        </div>
      </div>
      <div class="admin-control-row">
        <div class="field-block">
          <label>Amount</label>
          <input name="amountText" type="text" value="${escapeHtml(item.amountText || "")}" placeholder="Optional amount or progress note" />
        </div>
        <div class="field-block">
          <label>Timeframe</label>
          <input name="timeframeText" type="text" value="${escapeHtml(item.timeframeText)}" />
        </div>
      </div>
      <div class="admin-control-row">
        <div class="field-block">
          <label>Publish Consent</label>
          <select name="publishConsent">
            <option value="yes" ${item.publishConsent ? "selected" : ""}>Yes</option>
            <option value="no" ${!item.publishConsent ? "selected" : ""}>No</option>
          </select>
        </div>
        <div class="field-block">
          <label>Name Consent</label>
          <select name="nameConsent">
            <option value="yes" ${item.nameConsent ? "selected" : ""}>Yes</option>
            <option value="no" ${!item.nameConsent ? "selected" : ""}>No</option>
          </select>
        </div>
      </div>
      <div class="field-block">
        <label>Admin Notes</label>
        <textarea name="adminNotes" rows="3">${escapeHtml(item.adminNotes || "")}</textarea>
      </div>
      <label class="checkbox-field" for="featured-${item.id}">
        <input id="featured-${item.id}" name="isFeatured" type="checkbox" value="true" ${item.isFeatured ? "checked" : ""} />
        <span>Show this story in featured member wins</span>
      </label>
      <label class="checkbox-field" for="honesty-${item.id}">
        <input id="honesty-${item.id}" name="honestyConfirmed" type="checkbox" value="yes" ${item.honestyConfirmed ? "checked" : ""} />
        <span>Member confirmed the story is honest and not financial advice.</span>
      </label>
      <div class="admin-member-win-preview">
        <p class="panel-label">Public Preview</p>
        <div class="member-win-preview-card" data-preview-card></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" type="button" data-action="quick-approve">Quick Approve</button>
        <button class="btn btn-secondary" type="button" data-action="quick-reject">Quick Reject</button>
        <button class="btn btn-primary" type="submit">Save Review</button>
      </div>
    </form>
  `).join("");

  target.querySelectorAll(".admin-member-win-card").forEach((form) => {
    syncMemberWinPreview(form);
  });
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
  renderAdminMemberWins(result.memberWins || []);
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

function formatMemberWinCategory(slug) {
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

function buildAdminMemberWinPreview(payload) {
  const publishedName = payload.nameConsent === "yes"
    ? (payload.publishedName || payload.displayName || "Member")
    : "Anonymous member";
  const verificationCopy = payload.verificationStatus === "verified"
    ? '<span class="win-meta-chip verified">Verified by supporting information provided by the member.</span>'
    : '<span class="win-meta-chip">Self-reported by member.</span>';
  const amountBlock = payload.amountText
    ? `<p><strong>Progress:</strong> ${escapeHtml(payload.amountText)}</p>`
    : "";
  const startingPointBlock = payload.beforeText
    ? `<p><strong>Starting point:</strong> ${escapeHtml(payload.beforeText)}</p>`
    : "";

  return `
    <article class="member-win-card preview">
      <div class="member-win-top">
        <span class="access-badge">${escapeHtml(formatMemberWinCategory(payload.categorySlug))}</span>
        ${verificationCopy}
      </div>
      <h3>${escapeHtml(payload.amountText ? `${formatMemberWinCategory(payload.categorySlug)} progress` : `${formatMemberWinCategory(payload.categorySlug)} win`)}</h3>
      <p class="member-win-quote">"${escapeHtml(payload.changeText)}"</p>
      <div class="member-win-details">
        <p><strong>Member:</strong> ${escapeHtml(publishedName)}</p>
        ${startingPointBlock}
        <p><strong>Money move:</strong> ${escapeHtml(payload.moneyMove)}</p>
        ${amountBlock}
        <p><strong>Timeframe:</strong> ${escapeHtml(payload.timeframeText)}</p>
      </div>
      <p class="member-win-note">Individual experience. Not financial advice.</p>
    </article>
  `;
}

function readMemberWinFormPayload(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.isFeatured = form.querySelector('[name="isFeatured"]')?.checked ? "true" : "false";
  payload.honestyConfirmed = form.querySelector('[name="honestyConfirmed"]')?.checked ? "yes" : "no";
  return payload;
}

function syncMemberWinPreview(form) {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const previewTarget = form.querySelector("[data-preview-card]");
  if (!(previewTarget instanceof HTMLElement)) {
    return;
  }

  previewTarget.innerHTML = buildAdminMemberWinPreview(readMemberWinFormPayload(form));
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

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.classList.contains("admin-member-win-card")) {
    return;
  }

  event.preventDefault();

  const memberWinId = form.dataset.memberWinId;
  const rawPayload = readMemberWinFormPayload(form);

  const response = await fetch(`/api/admin/member-wins/${memberWinId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(rawPayload)
  });

  const updateResult = await response.json();
  if (!response.ok) {
    setAdminMessage(updateResult.error || "Unable to update member win.", "error");
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

  if (button.matches('[data-action="quick-approve"], [data-action="quick-reject"]')) {
    const form = button.closest(".admin-member-win-card");
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    form.status.value = button.getAttribute("data-action") === "quick-approve" ? "approved" : "rejected";
    if (button.getAttribute("data-action") === "quick-approve") {
      form.publishConsent.value = "yes";
    }
    syncMemberWinPreview(form);
    form.requestSubmit();
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
    const memberWinForm = target instanceof HTMLElement ? target.closest(".admin-member-win-card") : null;
    if (memberWinForm instanceof HTMLFormElement) {
      syncMemberWinPreview(memberWinForm);
    }
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
    const memberWinForm = target instanceof HTMLElement ? target.closest(".admin-member-win-card") : null;
    if (memberWinForm instanceof HTMLFormElement) {
      syncMemberWinPreview(memberWinForm);
    }
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
