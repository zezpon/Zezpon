const express = require("express");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");
const multer = require("multer");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");

const app = express();
app.disable("x-powered-by");
const ROOT = __dirname;
const APP_DATA_ROOT = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const DATA_DIR = resolveDataDirectory();
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const DB_FILE = path.join(DATA_DIR, "zezpon.db");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const STORAGE_PROVIDER = String(process.env.STORAGE_PROVIDER || "local").trim().toLowerCase();
const SESSION_COOKIE = "zezpon_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const PORT = process.env.PORT || 3000;
const TEST_EMAILS = new Set(["premium@example.com", "free@example.com"]);
const AUTH_WINDOW_MS = 1000 * 60 * 15;
const AUTH_MAX_ATTEMPTS = 25;
const ADMIN_WINDOW_MS = 1000 * 60 * 5;
const ADMIN_MAX_ATTEMPTS = 120;
const rateLimitStore = new Map();
const MODULE_OPTIONS = [
  { slug: "asx-workouts", label: "ASX Workouts" },
  { slug: "cpi-calendar", label: "CPI Calendar" },
  { slug: "video-blogs", label: "Video Blogs" },
  { slug: "budget-systems", label: "Budget Systems" }
];
const GUIDE_OPTIONS = [
  { slug: "asx-basics", label: "ASX Basics" }
];
const VIDEO_CATEGORY_OPTIONS = [
  { slug: "markets", label: "Markets" },
  { slug: "economy", label: "Economy" },
  { slug: "budgeting", label: "Budgeting" },
  { slug: "beginner", label: "Beginner" },
  { slug: "strategy", label: "Strategy" }
];

const PUBLIC_FILES = new Set([
  "Zezpon.html",
  "contact.html",
  "guides.html",
  "membership.html",
  "modules.html",
  "news-asx.html",
  "news-budget.html",
  "news-cpi.html",
  "news-watchlist.html",
  "news.html",
  "privacy.html",
  "security.html",
  "terms.html",
  "login.html",
  "signup.html",
  "forgot-password.html",
  "reset-password.html",
  "verify-email.html"
]);

const MEMBER_FILES = new Set([
  "dashboard.html",
  "profile.html",
  "results.html",
  "guide-asx.html",
  "guide-budget.html",
  "guide-cpi.html",
  "guide-rates.html",
  "guide-watchlist.html",
  "module-intro.html",
  "module-budget.html"
]);

const ADMIN_FILES = new Set([
  "admin.html"
]);

const PREMIUM_FILES = new Set([
  "module-asx.html",
  "module-cpi.html",
  "module-rates.html",
  "module-routine.html",
  "module-watchlist.html",
  "module-video-blogs.html",
  "videos.html",
  "video-detail.html",
  "video-asx.html",
  "video-cpi.html",
  "video-budget.html"
]);

const MEMBERSHIP_REDIRECT_FILES = new Set([]);

const OLD_REDIRECTS = new Map([
  ["/previews.html", "/videos.html"],
  ["/preview-asx.html", "/video-asx.html"],
  ["/preview-cpi.html", "/video-cpi.html"],
  ["/preview-budget.html", "/video-budget.html"]
]);

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
ensureDataFile(USERS_FILE, []);
ensureDataFile(SESSIONS_FILE, []);

const db = new Database(DB_FILE);
const storageProvider = createStorageProvider();
const mailTransport = createMailTransport();
const mailTransportState = {
  configured: Boolean(mailTransport),
  verified: false,
  mode: mailTransport ? "smtp" : "fallback",
  lastError: null
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 250
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = new Set([
      "video/mp4",
      "video/webm",
      "video/quicktime"
    ]);
    if (allowedTypes.has(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error("Only MP4, WebM, and MOV uploads are allowed."));
  }
});
initDatabase();
migrateLegacyData();
purgeTestAccounts();
cleanupSessions();
ensureAdminAccount();
backfillUsernames();
backfillManagedContentMetadata();
seedManagedContent();
migrateVideoAccessToPremium();
verifyMailTransport();

app.set("trust proxy", 1);
app.use(setSecurityHeaders);
app.use(createRateLimit({
  windowMs: ADMIN_WINDOW_MS,
  max: ADMIN_MAX_ATTEMPTS,
  key: (req) => `global:${getRequestIp(req)}`
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use("/styles.css", express.static(path.join(ROOT, "styles.css")));
app.use("/site.js", express.static(path.join(ROOT, "site.js")));
app.use("/auth.js", express.static(path.join(ROOT, "auth.js")));
app.use("/dashboard.js", express.static(path.join(ROOT, "dashboard.js")));
app.use("/profile.js", express.static(path.join(ROOT, "profile.js")));
app.use("/admin.js", express.static(path.join(ROOT, "admin.js")));
app.use("/content-feed.js", express.static(path.join(ROOT, "content-feed.js")));
app.use("/video-detail.js", express.static(path.join(ROOT, "video-detail.js")));
app.use("/videos.js", express.static(path.join(ROOT, "videos.js")));
app.use("/billing.js", express.static(path.join(ROOT, "billing.js")));

for (const [from, to] of OLD_REDIRECTS.entries()) {
  app.get(from, (_req, res) => res.redirect(301, to));
}

app.get("/", (req, res) => handlePageRequest(req, res, "Zezpon.html"));

app.get("/:page", (req, res, next) => {
  const page = req.params.page;
  if (!page.endsWith(".html")) {
    return next();
  }
  handlePageRequest(req, res, page);
});

app.get("/media/:provider", async (req, res) => {
  const provider = String(req.params.provider || "").trim().toLowerCase();
  const key = String(req.query.key || "").trim();
  if (!provider || !key) {
    return res.status(400).send("Invalid media request.");
  }

  const mediaUrl = buildProtectedMediaUrl(provider, key);
  const contentItem = findContentItemByMediaUrl(mediaUrl);
  if (!contentItem || contentItem.status !== "published") {
    return res.status(404).send("Not found");
  }

  const user = getSessionUser(req);
  const allowedAccess = getAllowedAccessLevels(user);
  if (!allowedAccess.includes(contentItem.access_level)) {
    if (!user) {
      return res.status(401).send("Login required.");
    }
    return res.status(403).send("Access denied.");
  }

  try {
    if (provider === "local") {
      const normalizedKey = path.basename(key);
      const filePath = path.join(UPLOAD_DIR, normalizedKey);
      if (!fs.existsSync(filePath)) {
        return res.status(404).send("Not found");
      }

      res.type(getMimeTypeForFilename(normalizedKey));
      return res.sendFile(filePath);
    }

    if (provider === "s3") {
      if (storageProvider.name !== "s3") {
        return res.status(404).send("Not found");
      }

      const objectResponse = await storageProvider.client.send(new GetObjectCommand({
        Bucket: storageProvider.bucket,
        Key: key
      }));

      if (objectResponse.ContentType) {
        res.setHeader("Content-Type", objectResponse.ContentType);
      }
      res.setHeader("Cache-Control", "private, no-store");

      if (objectResponse.Body?.pipe) {
        objectResponse.Body.pipe(res);
        return;
      }

      const body = await objectResponse.Body?.transformToByteArray?.();
      if (body) {
        return res.end(Buffer.from(body));
      }
    }

    return res.status(404).send("Not found");
  } catch (error) {
    console.error("Protected media request failed:", error.message);
    return res.status(404).send("Not found");
  }
});

app.post("/api/auth/signup", createRateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX_ATTEMPTS,
  key: (req) => `signup:${getRequestIp(req)}`
}), (req, res) => {
  const username = normalizeUsername(req.body.username);
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const requestedPlan = String(req.body.plan || "").toLowerCase() === "premium" ? "premium" : "basic";
  const plan = "basic";

  if (!username || !name || !email || !password) {
    return res.status(400).json({ error: "Please complete all fields." });
  }

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: "Username must be 3-24 characters using letters, numbers, hyphens, or underscores." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: "Password must be at least 6 characters and include one number and one symbol." });
  }

  if (TEST_EMAILS.has(email)) {
    return res.status(400).json({ error: "Please choose a different email address." });
  }

  if (findUserByEmail(email)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  if (findUserByUsername(username)) {
    return res.status(409).json({ error: "That username is already in use." });
  }

  const user = {
    id: crypto.randomUUID(),
    username,
    name,
    email,
    plan,
    role: "member",
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    emailVerifiedAt: null
  };

  insertUser(user);
  const verification = createEmailVerificationToken(user.id);
  sendEmail({
    to: user.email,
    subject: "Verify your Zezpon email",
    text: buildVerificationEmailText(verification.token)
  });

  const session = createSession(user.id, req);
  setSessionCookie(res, session.token);

  logAuditEvent({
    actorUserId: user.id,
    targetUserId: user.id,
    action: "auth.signup",
    metadata: { plan: user.plan, requestedPlan }
  });

  return res.status(201).json({
    user: sanitizeUser(user),
    redirectTo: "/dashboard.html",
    billingRequired: Boolean(getCheckoutLinkForPlan(requestedPlan)),
    billingUrl: getCheckoutLinkForPlan(requestedPlan) || "",
    verificationToken: process.env.SHOW_DEBUG_TOKENS === "true" ? verification.token : undefined
  });
});

app.post("/api/auth/login", createRateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX_ATTEMPTS,
  key: (req) => `login:${getRequestIp(req)}`
}), (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = findUserByEmail(email);

  if (!user) {
    return res.status(401).json({ error: "No account was found for that email address." });
  }

  if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "That password is incorrect. Please try again." });
  }

  const session = createSession(user.id, req);
  setSessionCookie(res, session.token);

  return res.json({
    user: sanitizeUser(user),
    redirectTo: "/dashboard.html"
  });
});

app.post("/api/auth/logout", (req, res) => {
  const token = getCookie(req, SESSION_COOKIE);
  if (token) {
    deleteSession(token);
  }
  clearSessionCookie(res);
  return res.json({ success: true });
});

app.get("/api/session", (req, res) => {
  const sessionUser = getSessionUser(req);
  return res.json({ user: sessionUser ? sanitizeUser(sessionUser) : null });
});

app.get("/api/billing/config", (_req, res) => {
  return res.json({
    provider: getBillingProvider(),
    basicPriceLabel: getPlanPriceLabel("basic"),
    premiumPriceLabel: getPlanPriceLabel("premium"),
    mode: getBillingMode(),
    basicCheckoutConfigured: Boolean(getCheckoutLinkForPlan("basic")),
    premiumCheckoutConfigured: Boolean(getCheckoutLinkForPlan("premium"))
  });
});

app.get("/api/billing/checkout-link", (req, res) => {
  const plan = String(req.query.plan || "").trim().toLowerCase() === "premium" ? "premium" : "basic";
  const checkoutUrl = getCheckoutLinkForPlan(plan);
  if (!checkoutUrl) {
    return res.status(404).json({ error: `No ${plan} checkout link is configured yet.` });
  }

  return res.json({
    provider: getBillingProvider(),
    plan,
    checkoutUrl
  });
});

app.get("/api/billing/upgrade-link", (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Login required." });
  }

  if (user.plan === "premium") {
    return res.status(409).json({ error: "Your account already has Premium access." });
  }

  const checkoutUrl = getCheckoutLinkForPlan("premium");
  if (!checkoutUrl) {
    return res.status(404).json({ error: "Premium checkout is not available right now." });
  }

  return res.json({
    provider: getBillingProvider(),
    plan: "premium",
    checkoutUrl
  });
});

app.post("/api/auth/request-password-reset", createRateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX_ATTEMPTS,
  key: (req) => `reset-request:${getRequestIp(req)}`
}), (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const user = findUserByEmail(email);
  const exposeDebugTokens = process.env.SHOW_DEBUG_TOKENS === "true" || process.env.NODE_ENV !== "production" || !mailTransportState.configured;

  if (user) {
    const tokenRecord = createPasswordResetToken(user.id);
    sendEmail({
      to: user.email,
      subject: "Reset your Zezpon password",
      text: buildPasswordResetEmailText(tokenRecord.token)
    });
    logAuditEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      action: "auth.password_reset_requested",
      metadata: {}
    });

    return res.json({
      success: true,
      message: exposeDebugTokens
        ? "Reset link prepared. Use the link below to continue."
        : "If an account exists for that email, a reset link has been prepared.",
      resetToken: exposeDebugTokens ? tokenRecord.token : undefined,
      resetUrl: exposeDebugTokens ? buildPasswordResetUrl(tokenRecord.token) : undefined
    });
  }

  return res.json({
    success: true,
    message: "If an account exists for that email, a reset link has been prepared."
  });
});

app.post("/api/auth/reset-password", createRateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX_ATTEMPTS,
  key: (req) => `reset:${getRequestIp(req)}`
}), (req, res) => {
  const token = String(req.body.token || "").trim();
  const newPassword = String(req.body.password || "");

  if (!token || !isStrongPassword(newPassword)) {
    return res.status(400).json({ error: "Password must be at least 6 characters and include one number and one symbol." });
  }

  const tokenRecord = consumePasswordResetToken(token);
  if (!tokenRecord) {
    return res.status(400).json({ error: "That reset link is invalid or expired." });
  }

  const user = findUserById(tokenRecord.user_id);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const passwordHash = hashPassword(newPassword);
  updateUserProfile(user.id, {
    name: user.name,
    email: user.email,
    passwordHash
  });
  deleteSessionsForUser(user.id);
  logAuditEvent({
    actorUserId: user.id,
    targetUserId: user.id,
    action: "auth.password_reset_completed",
    metadata: {}
  });

  return res.json({
    success: true,
    message: "Password reset successfully. Please log in with your new password."
  });
});

app.post("/api/auth/verify-email", createRateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX_ATTEMPTS,
  key: (req) => `verify:${getRequestIp(req)}`
}), (req, res) => {
  const token = String(req.body.token || "").trim();
  const tokenRecord = consumeEmailVerificationToken(token);
  if (!tokenRecord) {
    return res.status(400).json({ error: "That verification link is invalid or expired." });
  }

  markEmailVerified(tokenRecord.user_id);
  logAuditEvent({
    actorUserId: tokenRecord.user_id,
    targetUserId: tokenRecord.user_id,
    action: "auth.email_verified",
    metadata: {}
  });

  return res.json({
    success: true,
    message: "Email verified successfully."
  });
});

app.get("/api/dashboard", (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Login required." });
  }

  return res.json(buildDashboardPayload(user));
});

app.get("/api/content", (req, res) => {
  const type = String(req.query.type || "").toLowerCase();
  if (!["video", "news"].includes(type)) {
    return res.status(400).json({ error: "Invalid content type." });
  }

  const user = getSessionUser(req);
  const allowedAccess = getAllowedAccessLevels(user);
  const moduleSlug = normalizeModuleSlug(req.query.moduleSlug);
  const guideSlug = normalizeGuideSlug(req.query.guideSlug);
  const groupBy = String(req.query.groupBy || "").trim().toLowerCase();
  const featuredOnly = String(req.query.featured || "").trim().toLowerCase() === "true";
  const category = normalizeVideoCategory(req.query.category);
  const limitRaw = Number.parseInt(String(req.query.limit || "0"), 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 24) : 0;
  const placeholders = allowedAccess.map(() => "?").join(", ");
  const filters = ["type = ?", "status = 'published'", `access_level IN (${placeholders})`];
  const params = [type, ...allowedAccess];

  if (moduleSlug) {
    filters.push("module_slug = ?");
    params.push(moduleSlug);
  }

  if (guideSlug) {
    filters.push("guide_slug = ?");
    params.push(guideSlug);
  }

  if (type === "video" && featuredOnly) {
    filters.push("is_featured = 1");
  }

  if (type === "video" && category) {
    filters.push("category_slug = ?");
    params.push(category);
  }

  const limitClause = limit ? `LIMIT ${limit}` : "";
  const rows = db.prepare(`
    SELECT *
    FROM content_items
    WHERE ${filters.join(" AND ")}
    ORDER BY display_order ASC, updated_at DESC
    ${limitClause}
  `).all(...params);

  const items = rows.map(serializeContentItem);
  const responsePayload = { items };

  if (type === "video" && groupBy === "module") {
    responsePayload.groups = buildContentGroupsByModule(items);
  }

  return res.json(responsePayload);
});

app.get("/api/content-item/:slug", (req, res) => {
  const slug = String(req.params.slug || "").trim().toLowerCase();
  if (!slug) {
    return res.status(400).json({ error: "Invalid content slug." });
  }

  const item = findContentItemBySlug(slug);
  if (!item || item.status !== "published") {
    return res.status(404).json({ error: "Content item not found." });
  }

  const user = getSessionUser(req);
  const allowedAccess = getAllowedAccessLevels(user);
  if (!allowedAccess.includes(item.access_level)) {
    if (!user) {
      return res.status(401).json({ error: "Login required." });
    }
    return res.status(403).json({ error: "Access denied." });
  }

  const relatedItems = db.prepare(`
    SELECT *
    FROM content_items
    WHERE id != ?
      AND type = ?
      AND status = 'published'
      AND access_level IN (${allowedAccess.map(() => "?").join(", ")})
      AND (
        (module_slug != '' AND module_slug = ?)
        OR
        (guide_slug != '' AND guide_slug = ?)
        OR
        (category_slug != '' AND category_slug = ?)
      )
    ORDER BY is_featured DESC, display_order ASC, updated_at DESC
    LIMIT 6
  `).all(
    item.id,
    item.type,
    ...allowedAccess,
    item.module_slug || "",
    item.guide_slug || "",
    item.category_slug || ""
  ).map(serializeContentItem);

  return res.json({
    item: serializeContentItem(item),
    relatedItems
  });
});

app.post("/api/content-item/:slug/view", (req, res) => {
  const slug = String(req.params.slug || "").trim().toLowerCase();
  if (!slug) {
    return res.status(400).json({ error: "Invalid content slug." });
  }

  const item = findContentItemBySlug(slug);
  if (!item || item.status !== "published") {
    return res.status(404).json({ error: "Content item not found." });
  }

  const user = getSessionUser(req);
  const allowedAccess = getAllowedAccessLevels(user);
  if (!allowedAccess.includes(item.access_level)) {
    if (!user) {
      return res.status(401).json({ error: "Login required." });
    }
    return res.status(403).json({ error: "Access denied." });
  }

  incrementContentView(item.id, user?.id || null);
  return res.json({ success: true });
});

app.get("/api/profile", (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Login required." });
  }

  return res.json({
    user: sanitizeUser(user),
    createdAt: user.created_at
  });
});

app.post("/api/profile", createRateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX_ATTEMPTS,
  key: (req) => `profile:${getRequestIp(req)}`
}), (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Login required." });
  }

  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  if (TEST_EMAILS.has(email)) {
    return res.status(400).json({ error: "Please choose a different email address." });
  }

  const existingUser = findUserByEmail(email);
  if (existingUser && existingUser.id !== user.id) {
    return res.status(409).json({ error: "That email address is already in use." });
  }

  const emailChanged = email !== user.email;
  let passwordHash = user.password_hash;
  if (newPassword || emailChanged) {
    if (!currentPassword || !verifyPassword(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }
  }

  if (newPassword) {
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ error: "New password must be at least 6 characters and include one number and one symbol." });
    }
    passwordHash = hashPassword(newPassword);
  }

  const emailVerifiedAt = emailChanged ? null : user.email_verified_at;
  updateUserProfile(user.id, { name, email, passwordHash, emailVerifiedAt });

  if (emailChanged) {
    const verification = createEmailVerificationToken(user.id);
    sendEmail({
      to: email,
      subject: "Verify your updated Zezpon email",
      text: buildVerificationEmailText(verification.token)
    });
  }

  if (emailChanged || newPassword) {
    deleteSessionsForUser(user.id);
    const session = createSession(user.id, req);
    setSessionCookie(res, session.token);
  }

  const refreshedUser = findUserById(user.id);
  logAuditEvent({
    actorUserId: user.id,
    targetUserId: user.id,
    action: "profile.updated",
    metadata: {
      emailChanged,
      passwordChanged: Boolean(newPassword)
    }
  });

  return res.json({
    user: sanitizeUser(refreshedUser),
    message: emailChanged
      ? "Profile updated successfully. Please verify your new email address."
      : "Profile updated successfully."
  });
});

app.get("/api/admin/overview", (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Login required." });
  }
  if (normalizeRole(user.role) !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }

  return res.json(buildAdminPayload());
});

app.get("/api/admin/content", (req, res) => {
  const currentUser = getSessionUser(req);
  if (!currentUser) {
    return res.status(401).json({ error: "Login required." });
  }
  if (normalizeRole(currentUser.role) !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }

  return res.json({
    items: getAllManagedContent()
  });
});

app.post("/api/admin/content", createRateLimit({
  windowMs: ADMIN_WINDOW_MS,
  max: ADMIN_MAX_ATTEMPTS,
  key: (req) => `admin-content-create:${getRequestIp(req)}`
}), (req, res) => {
  const currentUser = getSessionUser(req);
  if (!currentUser) {
    return res.status(401).json({ error: "Login required." });
  }
  if (normalizeRole(currentUser.role) !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }

  const payload = validateContentPayload(req.body);
  if (payload.error) {
    return res.status(400).json({ error: payload.error });
  }

  const contentItem = {
    id: crypto.randomUUID(),
    ...payload.value,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  insertContentItem(contentItem);
  logAuditEvent({
    actorUserId: currentUser.id,
    targetUserId: null,
    action: "content.created",
    metadata: { contentId: contentItem.id, title: contentItem.title, type: contentItem.type }
  });

  return res.status(201).json({
    message: "Content item created successfully.",
    item: serializeContentItem(findContentItemById(contentItem.id))
  });
});

app.post("/api/admin/content/:id", createRateLimit({
  windowMs: ADMIN_WINDOW_MS,
  max: ADMIN_MAX_ATTEMPTS,
  key: (req) => `admin-content-update:${getRequestIp(req)}`
}), (req, res) => {
  const currentUser = getSessionUser(req);
  if (!currentUser) {
    return res.status(401).json({ error: "Login required." });
  }
  if (normalizeRole(currentUser.role) !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }

  const existingItem = findContentItemById(req.params.id);
  if (!existingItem) {
    return res.status(404).json({ error: "Content item not found." });
  }

  const payload = validateContentPayload(req.body);
  if (payload.error) {
    return res.status(400).json({ error: payload.error });
  }

  updateContentItem(req.params.id, payload.value);
  logAuditEvent({
    actorUserId: currentUser.id,
    targetUserId: null,
    action: "content.updated",
    metadata: { contentId: req.params.id, title: payload.value.title, type: payload.value.type }
  });

  return res.json({
    message: "Content item updated successfully.",
    item: serializeContentItem(findContentItemById(req.params.id))
  });
});

app.post("/api/admin/upload", createRateLimit({
  windowMs: ADMIN_WINDOW_MS,
  max: 30,
  key: (req) => `admin-upload:${getRequestIp(req)}`
}), (req, res) => {
  const currentUser = getSessionUser(req);
  if (!currentUser) {
    return res.status(401).json({ error: "Login required." });
  }
  if (normalizeRole(currentUser.role) !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }

  upload.single("file")(req, res, async (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || "Upload failed." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded." });
    }

    try {
      const storedUpload = await persistUploadedFile(req.file);
      logAuditEvent({
        actorUserId: currentUser.id,
        targetUserId: null,
        action: "content.uploaded",
        metadata: { filename: storedUpload.filename, mediaUrl: storedUpload.mediaUrl, provider: storedUpload.provider }
      });

      return res.json({
        message: "Upload completed successfully.",
        mediaUrl: storedUpload.mediaUrl,
        originalName: req.file.originalname,
        provider: storedUpload.provider
      });
    } catch (uploadError) {
      console.error("Upload failed:", uploadError.message);
      return res.status(500).json({ error: "Unable to store the uploaded file right now." });
    }
  });
});

app.get("/api/health", (_req, res) => {
  return res.json({
    ok: true,
    service: "zezpon",
    timestamp: new Date().toISOString(),
    storage: {
      provider: storageProvider.name,
      configured: storageProvider.configured
    },
    email: {
      mode: mailTransportState.mode,
      configured: mailTransportState.configured,
      verified: mailTransportState.verified
    }
  });
});

app.post("/api/admin/users/:id", createRateLimit({
  windowMs: ADMIN_WINDOW_MS,
  max: ADMIN_MAX_ATTEMPTS,
  key: (req) => `admin-user-update:${getRequestIp(req)}`
}), (req, res) => {
  const currentUser = getSessionUser(req);
  if (!currentUser) {
    return res.status(401).json({ error: "Login required." });
  }
  if (normalizeRole(currentUser.role) !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }

  const targetUser = findUserById(req.params.id);
  if (!targetUser) {
    return res.status(404).json({ error: "User not found." });
  }

  const plan = String(req.body.plan || "").toLowerCase() === "premium" ? "premium" : "basic";
  const role = String(req.body.role || "").toLowerCase() === "admin" ? "admin" : "member";

  if (targetUser.id === currentUser.id && role !== "admin") {
    return res.status(400).json({ error: "You cannot remove your own admin access." });
  }

  updateUserAccess(targetUser.id, { plan, role });
  return res.json({
    message: "Member updated successfully.",
    user: sanitizeUser(findUserById(targetUser.id))
  });
});

app.listen(PORT, () => {
  console.log(`Zezpon server running at http://localhost:${PORT}`);
});

function resolveDataDirectory() {
  const explicitDir = String(process.env.ZEZPON_DATA_DIR || "").trim();
  if (explicitDir) {
    ensureDirectoryWritable(explicitDir);
    return explicitDir;
  }

  const preferredDir = path.join(APP_DATA_ROOT, "Zezpon", "data");
  try {
    ensureDirectoryWritable(preferredDir);
    return preferredDir;
  } catch {
    try {
      const tempFallbackDir = path.join(os.tmpdir(), "Zezpon", "data");
      ensureDirectoryWritable(tempFallbackDir);
      return tempFallbackDir;
    } catch {
      const workspaceFallbackDir = path.join(ROOT, ".zezpon-data");
      ensureDirectoryWritable(workspaceFallbackDir);
      return workspaceFallbackDir;
    }
  }
}

function ensureDirectoryWritable(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const probeFile = path.join(targetDir, ".write-test");
  fs.writeFileSync(probeFile, "ok");
  try {
    fs.unlinkSync(probeFile);
  } catch {
    // Some synced folders can briefly lock new files; a successful write is enough for our fallback check.
  }
}

function handlePageRequest(req, res, page) {
  const filePath = path.join(ROOT, page);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Not found");
  }

  if (ADMIN_FILES.has(page)) {
    const user = getSessionUser(req);
    if (!user) {
      return res.redirect(`/login.html?next=/${page}`);
    }
    if (normalizeRole(user.role) !== "admin") {
      return res.redirect("/dashboard.html");
    }
  } else if (MEMBERSHIP_REDIRECT_FILES.has(page)) {
    return res.redirect("/membership.html");
  } else if (MEMBER_FILES.has(page)) {
    const user = getSessionUser(req);
    if (!user) {
      return res.redirect(`/login.html?next=/${page}`);
    }
  } else if (PREMIUM_FILES.has(page)) {
    const user = getSessionUser(req);
    if (!user) {
      return res.redirect(`/login.html?next=/${page}`);
    }
    if (user.plan !== "premium") {
      return res.redirect("/membership.html");
    }
  } else if (!PUBLIC_FILES.has(page)) {
    return res.status(404).send("Not found");
  }

  return res.sendFile(filePath);
}

function buildDashboardPayload(user) {
  const safeUser = sanitizeUser(user);
  const featuredVideos = db.prepare(`
    SELECT *
    FROM content_items
    WHERE type = 'video' AND status = 'published' AND access_level IN (${getAllowedAccessLevels(user).map(() => "?").join(", ")})
    ORDER BY is_featured DESC, view_count DESC, updated_at DESC
    LIMIT 3
  `).all(...getAllowedAccessLevels(user)).map(serializeContentItem);
  const commonCards = [
    { title: "Profile Settings", description: "Update your name, email, and password.", href: "/profile.html" }
  ];

  if (safeUser.role === "admin") {
    commonCards.push({
      title: "Admin Tools",
      description: "Manage members, plans, and the current access mix.",
      href: "/admin.html"
    });
  }

  if (safeUser.plan === "premium") {
    return {
      user: safeUser,
      cards: [
        { title: "Home", description: "Return to the main site and member entry points.", href: "/Zezpon.html" },
        { title: "News", description: "Read market stories and public updates.", href: "/news.html" },
        { title: "Results", description: "Open your member results page.", href: "/results.html" },
        { title: "Guides", description: "Open the member guide library.", href: "/guides.html" },
        { title: "Contact", description: "Reach support, partnerships, or account help.", href: "/contact.html" },
        ...commonCards
      ],
      notes: [
        safeUser.emailVerified ? "Your email address has been verified." : "Verify your email address to keep your account fully secured.",
        "Members can access the home page, news, results, contact, and the guide library.",
        "Your account is stored securely on the server."
      ],
      featuredVideos
    };
  }

  return {
    user: safeUser,
    cards: [
      { title: "Home", description: "Return to the main site and member entry points.", href: "/Zezpon.html" },
      { title: "News", description: "Read market stories and public updates.", href: "/news.html" },
      { title: "Results", description: "Open your member results page.", href: "/results.html" },
      { title: "Guides", description: "Open the member guide library.", href: "/guides.html" },
      { title: "Contact", description: "Reach support, partnerships, or account help.", href: "/contact.html" },
      ...commonCards
    ],
    notes: [
      safeUser.emailVerified ? "Your email address has been verified." : "Verify your email address to keep your account fully secured.",
      "Members can access the home page, news, results, contact, and the guide library.",
      "Upgrade to Premium when you want the full video library."
    ],
    featuredVideos
  };
}

function getSessionUser(req) {
  cleanupSessions();
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) {
    return null;
  }

  const sessionUser = db.prepare(`
    SELECT users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ? AND sessions.expires_at > ?
  `).get(token, Date.now());

  return sessionUser || null;
}

function createSession(userId, req) {
  cleanupSessions();
  const session = {
    id: crypto.randomUUID(),
    userId,
    token: crypto.randomBytes(32).toString("hex"),
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    ipAddress: getRequestIp(req),
    userAgent: String(req?.headers["user-agent"] || "").slice(0, 255)
  };

  db.prepare(`
    INSERT INTO sessions (id, user_id, token, created_at, expires_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(session.id, session.userId, session.token, session.createdAt, session.expiresAt, session.ipAddress, session.userAgent);

  return session;
}

function deleteSession(token) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

function deleteSessionsForUser(userId) {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

function cleanupSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      target_user_id TEXT,
      action TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_views (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL,
      user_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (content_id) REFERENCES content_items (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS content_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      body TEXT NOT NULL,
      media_url TEXT NOT NULL,
      poster_url TEXT NOT NULL DEFAULT '',
      category_slug TEXT NOT NULL DEFAULT '',
      duration_text TEXT NOT NULL DEFAULT '',
      is_featured INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      module_slug TEXT NOT NULL DEFAULT '',
      guide_slug TEXT NOT NULL DEFAULT '',
      display_order INTEGER NOT NULL DEFAULT 100,
      access_level TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  addColumnIfMissing("users", "username", "TEXT");
  addColumnIfMissing("users", "email_verified_at", "TEXT");
  addColumnIfMissing("sessions", "ip_address", "TEXT");
  addColumnIfMissing("sessions", "user_agent", "TEXT");
  addColumnIfMissing("content_items", "module_slug", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("content_items", "guide_slug", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("content_items", "display_order", "INTEGER NOT NULL DEFAULT 100");
  addColumnIfMissing("content_items", "poster_url", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("content_items", "category_slug", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("content_items", "duration_text", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("content_items", "is_featured", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("content_items", "view_count", "INTEGER NOT NULL DEFAULT 0");
}

function migrateLegacyData() {
  const legacyUsers = readJson(USERS_FILE, []);
  const legacySessions = readJson(SESSIONS_FILE, []);

  for (const legacyUser of legacyUsers) {
    const email = String(legacyUser.email || "").trim().toLowerCase();
    if (!email || TEST_EMAILS.has(email) || findUserByEmail(email)) {
      continue;
    }

    insertUser({
      id: legacyUser.id || crypto.randomUUID(),
      username: generateUniqueUsername(legacyUser.username || legacyUser.name || email.split("@")[0] || "member"),
      name: String(legacyUser.name || "Member").trim() || "Member",
      email,
      plan: legacyUser.plan === "premium" ? "premium" : "basic",
      role: normalizeRole(legacyUser.role),
      passwordHash: String(legacyUser.passwordHash || ""),
      createdAt: legacyUser.createdAt || new Date().toISOString(),
      emailVerifiedAt: new Date().toISOString()
    });
  }

  for (const legacySession of legacySessions) {
    if (!legacySession || !legacySession.userId || !legacySession.token) {
      continue;
    }

    const user = findUserById(legacySession.userId);
    if (!user) {
      continue;
    }

    db.prepare(`
      INSERT OR REPLACE INTO sessions (id, user_id, token, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      legacySession.id || crypto.randomUUID(),
      legacySession.userId,
      legacySession.token,
      Number(legacySession.createdAt) || Date.now(),
      Number(legacySession.expiresAt) || Date.now() + SESSION_TTL_MS
    );
  }

  writeJson(USERS_FILE, []);
  writeJson(SESSIONS_FILE, []);
}

function purgeTestAccounts() {
  const testUsers = db.prepare("SELECT id FROM users WHERE email IN (?, ?)").all("premium@example.com", "free@example.com");
  for (const user of testUsers) {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
  }

  db.prepare("DELETE FROM users WHERE email IN (?, ?)").run("premium@example.com", "free@example.com");
  writeJson(USERS_FILE, []);
  writeJson(SESSIONS_FILE, []);
}

function backfillUsernames() {
  const users = db.prepare("SELECT id, username, name, email FROM users ORDER BY created_at ASC").all();
  for (const user of users) {
    if (isValidUsername(user.username)) {
      continue;
    }

    const username = generateUniqueUsername(user.name || user.email || "member", user.id);
    db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, user.id);
  }

  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)");
}

function insertUser(user) {
  const username = normalizeUsername(user.username) || generateUniqueUsername(user.name || user.email || "member");
  db.prepare(`
    INSERT INTO users (id, username, name, email, plan, role, password_hash, created_at, email_verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, username, user.name, user.email, user.plan, user.role, user.passwordHash, user.createdAt, user.emailVerifiedAt || null);
}

function updateUserProfile(userId, payload) {
  db.prepare(`
    UPDATE users
    SET name = ?, email = ?, password_hash = ?, email_verified_at = ?
    WHERE id = ?
  `).run(payload.name, payload.email, payload.passwordHash, payload.emailVerifiedAt || null, userId);
}

function updateUserAccess(userId, payload) {
  db.prepare(`
    UPDATE users
    SET plan = ?, role = ?
    WHERE id = ?
  `).run(payload.plan, payload.role, userId);
}

function markEmailVerified(userId) {
  db.prepare(`
    UPDATE users
    SET email_verified_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), userId);
}

function findUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) || null;
}

function findUserByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(normalizeUsername(username)) || null;
}

function findUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) || null;
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function isValidUsername(value) {
  return /^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$|^[a-z0-9]{3}$/.test(String(value || "").trim().toLowerCase());
}

function buildUsernameBase(value) {
  const source = String(value || "").includes("@")
    ? String(value || "").split("@")[0]
    : String(value || "");
  const normalized = normalizeUsername(source);
  if (normalized.length >= 3) {
    return normalized.slice(0, 24);
  }

  const compact = normalizeUsername(source.replace(/[^a-z0-9]/gi, "")) || "member";
  return compact.padEnd(3, "x").slice(0, 24);
}

function generateUniqueUsername(value, excludeUserId = "") {
  const base = buildUsernameBase(value);
  let candidate = base;
  let attempt = 1;

  while (true) {
    const existingUser = findUserByUsername(candidate);
    if (!existingUser || existingUser.id === excludeUserId) {
      return candidate;
    }

    attempt += 1;
    const suffix = String(attempt);
    candidate = `${base.slice(0, Math.max(3, 24 - suffix.length))}${suffix}`;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, originalHash] = String(storedHash || "").split(":");
  if (!salt || !originalHash) {
    return false;
  }

  const derivedHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(originalHash, "hex"), Buffer.from(derivedHash, "hex"));
}

function isStrongPassword(password) {
  const value = String(password || "");
  return value.length >= 6 && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    plan: user.plan,
    role: normalizeRole(user.role),
    emailVerified: Boolean(user.email_verified_at)
  };
}

function normalizeRole(role) {
  return String(role || "").toLowerCase() === "admin" ? "admin" : "member";
}

function ensureAdminAccount() {
  const email = String(process.env.ZEZPON_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ZEZPON_ADMIN_PASSWORD || "");
  const name = String(process.env.ZEZPON_ADMIN_NAME || "Zezpon Admin").trim() || "Zezpon Admin";
  const username = normalizeUsername(process.env.ZEZPON_ADMIN_USERNAME) || generateUniqueUsername(name || email.split("@")[0] || "admin");

  if (!email || !password) {
    return;
  }

  const existingUser = findUserByEmail(email);
  if (existingUser) {
    if (normalizeRole(existingUser.role) !== "admin" || existingUser.plan !== "premium") {
      updateUserAccess(existingUser.id, { plan: "premium", role: "admin" });
    }
    return;
  }

    insertUser({
      id: crypto.randomUUID(),
      username,
      name,
      email,
      plan: "premium",
    role: "admin",
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    emailVerifiedAt: new Date().toISOString()
  });
}

function buildAdminPayload() {
  const users = db.prepare(`
      SELECT id, username, name, email, plan, role, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();

  const stats = {
    totalUsers: users.length,
    basicUsers: users.filter((user) => user.plan === "basic").length,
    premiumUsers: users.filter((user) => user.plan === "premium").length,
    adminUsers: users.filter((user) => normalizeRole(user.role) === "admin").length
  };

  return {
    stats,
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        plan: user.plan,
      role: normalizeRole(user.role),
      createdAt: user.created_at
    })),
    contentConfig: {
      modules: MODULE_OPTIONS,
      guides: GUIDE_OPTIONS,
      videoCategories: VIDEO_CATEGORY_OPTIONS
    },
    contentItems: getAllManagedContent(),
    recentAuditLogs: getRecentAuditLogs(),
    contentInsights: getContentInsights()
  };
}

function createEmailVerificationToken(userId) {
  deleteTokensForUser("email_verification_tokens", userId);
  const tokenRecord = {
    id: crypto.randomUUID(),
    userId,
    token: crypto.randomBytes(32).toString("hex"),
    createdAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 24
  };

  db.prepare(`
    INSERT INTO email_verification_tokens (id, user_id, token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(tokenRecord.id, tokenRecord.userId, tokenRecord.token, tokenRecord.expiresAt, tokenRecord.createdAt);

  return tokenRecord;
}

function consumeEmailVerificationToken(token) {
  const record = db.prepare(`
    SELECT *
    FROM email_verification_tokens
    WHERE token = ? AND expires_at > ?
  `).get(token, Date.now());

  if (!record) {
    return null;
  }

  db.prepare("DELETE FROM email_verification_tokens WHERE id = ?").run(record.id);
  return record;
}

function createPasswordResetToken(userId) {
  deleteTokensForUser("password_reset_tokens", userId);
  const tokenRecord = {
    id: crypto.randomUUID(),
    userId,
    token: crypto.randomBytes(32).toString("hex"),
    createdAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 30
  };

  db.prepare(`
    INSERT INTO password_reset_tokens (id, user_id, token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(tokenRecord.id, tokenRecord.userId, tokenRecord.token, tokenRecord.expiresAt, tokenRecord.createdAt);

  return tokenRecord;
}

function consumePasswordResetToken(token) {
  const record = db.prepare(`
    SELECT *
    FROM password_reset_tokens
    WHERE token = ? AND expires_at > ?
  `).get(token, Date.now());

  if (!record) {
    return null;
  }

  db.prepare("DELETE FROM password_reset_tokens WHERE id = ?").run(record.id);
  return record;
}

function deleteTokensForUser(tableName, userId) {
  db.prepare(`DELETE FROM ${tableName} WHERE user_id = ?`).run(userId);
}

function logAuditEvent({ actorUserId, targetUserId, action, metadata }) {
  db.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, target_user_id, action, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    actorUserId || null,
    targetUserId || null,
    action,
    JSON.stringify(metadata || {}),
    new Date().toISOString()
  );
}

function getRecentAuditLogs() {
  return db.prepare(`
    SELECT action, metadata_json, created_at
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 10
  `).all().map((row) => ({
    action: row.action,
    metadata: safeJsonParse(row.metadata_json, {}),
    createdAt: row.created_at
  }));
}

function getContentInsights() {
  const topVideos = db.prepare(`
    SELECT *
    FROM content_items
    WHERE type = 'video'
    ORDER BY is_featured DESC, view_count DESC, updated_at DESC
    LIMIT 6
  `).all().map(serializeContentItem);

  const totalViews = db.prepare(`
    SELECT COALESCE(SUM(view_count), 0) AS total
    FROM content_items
    WHERE type = 'video'
  `).get().total;

  const featuredVideos = db.prepare(`
    SELECT COUNT(*) AS count
    FROM content_items
    WHERE type = 'video' AND is_featured = 1
  `).get().count;

  return {
    totalViews: Number(totalViews || 0),
    featuredVideos: Number(featuredVideos || 0),
    topVideos
  };
}

function getAllowedAccessLevels(user) {
  if (!user) {
    return ["public"];
  }
  if (user.plan === "premium") {
    return ["public", "basic", "premium"];
  }
  return ["public", "basic"];
}

function normalizeVideoCategory(value) {
  const slug = String(value || "").trim().toLowerCase();
  if (!slug) {
    return "";
  }
  return VIDEO_CATEGORY_OPTIONS.some((option) => option.slug === slug) ? slug : "";
}

function normalizeModuleSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  if (!slug) {
    return "";
  }
  return MODULE_OPTIONS.some((option) => option.slug === slug) ? slug : "";
}

function normalizeGuideSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  if (!slug) {
    return "";
  }
  return GUIDE_OPTIONS.some((option) => option.slug === slug) ? slug : "";
}

function getModuleLabel(moduleSlug) {
  return MODULE_OPTIONS.find((option) => option.slug === moduleSlug)?.label || "General";
}

function getGuideLabel(guideSlug) {
  return GUIDE_OPTIONS.find((option) => option.slug === guideSlug)?.label || "";
}

function getVideoCategoryLabel(categorySlug) {
  return VIDEO_CATEGORY_OPTIONS.find((option) => option.slug === categorySlug)?.label || "";
}

function buildContentGroupsByModule(items) {
  return MODULE_OPTIONS.map((moduleOption) => {
    const moduleItems = items.filter((item) => item.moduleSlug === moduleOption.slug);
    if (!moduleItems.length) {
      return null;
    }

    return {
      slug: moduleOption.slug,
      label: moduleOption.label,
      items: moduleItems
    };
  }).filter(Boolean);
}

function validateContentPayload(input) {
  const type = String(input.type || "").toLowerCase();
  const title = String(input.title || "").trim();
  const slug = String(input.slug || "").trim().toLowerCase();
  const summary = String(input.summary || "").trim();
  const body = String(input.body || "").trim();
  const mediaUrl = String(input.mediaUrl || "").trim();
  const posterUrl = String(input.posterUrl || "").trim();
  const categorySlug = normalizeVideoCategory(input.categorySlug);
  const durationText = String(input.durationText || "").trim().slice(0, 40);
  const isFeatured = String(input.isFeatured || "").trim().toLowerCase() === "true";
  const moduleSlug = normalizeModuleSlug(input.moduleSlug);
  const guideSlug = normalizeGuideSlug(input.guideSlug);
  const displayOrderRaw = Number.parseInt(String(input.displayOrder || "100"), 10);
  const displayOrder = Number.isFinite(displayOrderRaw) ? Math.max(0, displayOrderRaw) : 100;
  const accessLevel = type === "video"
    ? "premium"
    : (["public", "basic", "premium"].includes(String(input.accessLevel || "").toLowerCase())
      ? String(input.accessLevel || "").toLowerCase()
      : "public");
  const status = ["draft", "published"].includes(String(input.status || "").toLowerCase())
    ? String(input.status || "").toLowerCase()
    : "draft";

  if (!["video", "news"].includes(type)) {
    return { error: "Content type must be video or news." };
  }
  if (!title || !slug || !summary) {
    return { error: "Title, slug, and summary are required." };
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: "Slug may only include lowercase letters, numbers, and hyphens." };
  }
  return {
    value: {
      type,
      title,
      slug,
      summary,
      body,
      mediaUrl,
      posterUrl,
      categorySlug,
      durationText,
      isFeatured,
      moduleSlug,
      guideSlug,
      displayOrder,
      accessLevel,
      status
    }
  };
}

function insertContentItem(item) {
  db.prepare(`
    INSERT INTO content_items (
      id, type, title, slug, summary, body, media_url, poster_url, category_slug, duration_text, is_featured, view_count, module_slug, guide_slug, display_order, access_level, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.id,
    item.type,
    item.title,
    item.slug,
    item.summary,
    item.body,
    item.mediaUrl,
    item.posterUrl,
    item.categorySlug,
    item.durationText,
    item.isFeatured ? 1 : 0,
    item.viewCount || 0,
    item.moduleSlug,
    item.guideSlug,
    item.displayOrder,
    item.accessLevel,
    item.status,
    item.createdAt,
    item.updatedAt
  );
}

function updateContentItem(contentId, payload) {
  db.prepare(`
    UPDATE content_items
    SET type = ?, title = ?, slug = ?, summary = ?, body = ?, media_url = ?, poster_url = ?, category_slug = ?, duration_text = ?, is_featured = ?, module_slug = ?, guide_slug = ?, display_order = ?, access_level = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(
    payload.type,
    payload.title,
    payload.slug,
    payload.summary,
    payload.body,
    payload.mediaUrl,
    payload.posterUrl,
    payload.categorySlug,
    payload.durationText,
    payload.isFeatured ? 1 : 0,
    payload.moduleSlug,
    payload.guideSlug,
    payload.displayOrder,
    payload.accessLevel,
    payload.status,
    new Date().toISOString(),
    contentId
  );
}

function findContentItemById(contentId) {
  return db.prepare("SELECT * FROM content_items WHERE id = ?").get(contentId) || null;
}

function findContentItemBySlug(slug) {
  return db.prepare("SELECT * FROM content_items WHERE slug = ?").get(slug) || null;
}

function findContentItemByMediaUrl(mediaUrl) {
  return db.prepare("SELECT * FROM content_items WHERE media_url = ?").get(mediaUrl) || null;
}

function serializeContentItem(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: row.body,
    mediaUrl: row.media_url,
    posterUrl: row.poster_url || "",
    categorySlug: row.category_slug || "",
    categoryLabel: getVideoCategoryLabel(row.category_slug),
    durationText: row.duration_text || "",
    isFeatured: Boolean(row.is_featured),
    viewCount: Number(row.view_count || 0),
    detailUrl: row.type === "video" ? `/video-detail.html?slug=${encodeURIComponent(row.slug)}` : row.media_url,
    moduleSlug: row.module_slug || "",
    moduleLabel: getModuleLabel(row.module_slug),
    guideSlug: row.guide_slug || "",
    guideLabel: getGuideLabel(row.guide_slug),
    displayOrder: Number(row.display_order || 0),
    accessLevel: row.access_level,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function incrementContentView(contentId, userId) {
  db.prepare(`
    INSERT INTO content_views (id, content_id, user_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    contentId,
    userId || null,
    new Date().toISOString()
  );

  db.prepare(`
    UPDATE content_items
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = ?
  `).run(contentId);
}

function getAllManagedContent() {
  return db.prepare(`
    SELECT *
    FROM content_items
    ORDER BY type ASC, is_featured DESC, module_slug ASC, display_order ASC, updated_at DESC
  `).all().map(serializeContentItem);
}

function seedManagedContent() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM content_items").get().count;
  if (count > 0) {
    return;
  }

  const seedItems = [
    {
      id: crypto.randomUUID(),
      type: "video",
      title: "ASX Beginner Video",
      slug: "asx-beginner-video",
      summary: "A practical lesson on sectors, sentiment, and market basics.",
      body: "Short lesson covering how the market is structured and how to read broad movement.",
      mediaUrl: "video-asx.html",
      posterUrl: "",
      categorySlug: "beginner",
      durationText: "8 min",
      isFeatured: true,
      viewCount: 0,
      moduleSlug: "asx-workouts",
      guideSlug: "asx-basics",
      displayOrder: 10,
      accessLevel: "premium",
      status: "published"
    },
    {
      id: crypto.randomUUID(),
      type: "video",
      title: "CPI Explained Video",
      slug: "cpi-explained-video",
      summary: "A short visual primer on inflation data and what it means.",
      body: "Break down CPI in plain language and connect it to rates and household budgets.",
      mediaUrl: "video-cpi.html",
      posterUrl: "",
      categorySlug: "economy",
      durationText: "6 min",
      isFeatured: true,
      viewCount: 0,
      moduleSlug: "cpi-calendar",
      guideSlug: "",
      displayOrder: 20,
      accessLevel: "premium",
      status: "published"
    },
    {
      id: crypto.randomUUID(),
      type: "video",
      title: "Budget Like A Pro Video",
      slug: "budget-like-a-pro-video",
      summary: "Simple systems for planning, tracking, and adjusting each month.",
      body: "A practical budgeting lesson designed around routines and review habits.",
      mediaUrl: "video-budget.html",
      posterUrl: "",
      categorySlug: "budgeting",
      durationText: "7 min",
      isFeatured: true,
      viewCount: 0,
      moduleSlug: "budget-systems",
      guideSlug: "",
      displayOrder: 30,
      accessLevel: "premium",
      status: "published"
    },
    {
      id: crypto.randomUUID(),
      type: "news",
      title: "ASX Today: Key Movers",
      slug: "asx-today-key-movers",
      summary: "Follow the names and sectors driving the day.",
      body: "A plain-English market recap focused on leadership and laggards.",
      mediaUrl: "news-asx.html",
      posterUrl: "",
      categorySlug: "markets",
      durationText: "",
      isFeatured: false,
      viewCount: 0,
      moduleSlug: "asx-workouts",
      guideSlug: "",
      displayOrder: 10,
      accessLevel: "public",
      status: "published"
    },
    {
      id: crypto.randomUUID(),
      type: "news",
      title: "CPI This Month",
      slug: "cpi-this-month",
      summary: "Track inflation pressure and what it means for households.",
      body: "A summary of CPI themes with context around rates and spending.",
      mediaUrl: "news-cpi.html",
      posterUrl: "",
      categorySlug: "economy",
      durationText: "",
      isFeatured: false,
      viewCount: 0,
      moduleSlug: "cpi-calendar",
      guideSlug: "",
      displayOrder: 20,
      accessLevel: "public",
      status: "published"
    }
  ];

  for (const item of seedItems) {
    insertContentItem({
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}

function migrateVideoAccessToPremium() {
  db.prepare(`
    UPDATE content_items
    SET access_level = 'premium', updated_at = ?
    WHERE type = 'video' AND access_level != 'premium'
  `).run(new Date().toISOString());
}

function backfillManagedContentMetadata() {
  const rows = db.prepare(`
    SELECT id, slug, media_url, type, module_slug, guide_slug, display_order
    FROM content_items
  `).all();

  const fallbackMap = new Map([
    ["asx-beginner-video", { moduleSlug: "asx-workouts", guideSlug: "asx-basics", displayOrder: 10 }],
    ["video-asx.html", { moduleSlug: "asx-workouts", guideSlug: "asx-basics", displayOrder: 10 }],
    ["asx-today-key-movers", { moduleSlug: "asx-workouts", guideSlug: "", displayOrder: 10 }],
    ["news-asx.html", { moduleSlug: "asx-workouts", guideSlug: "", displayOrder: 10 }],
    ["cpi-explained-video", { moduleSlug: "cpi-calendar", guideSlug: "", displayOrder: 20 }],
    ["video-cpi.html", { moduleSlug: "cpi-calendar", guideSlug: "", displayOrder: 20 }],
    ["cpi-this-month", { moduleSlug: "cpi-calendar", guideSlug: "", displayOrder: 20 }],
    ["news-cpi.html", { moduleSlug: "cpi-calendar", guideSlug: "", displayOrder: 20 }],
    ["budget-like-a-pro-video", { moduleSlug: "budget-systems", guideSlug: "", displayOrder: 30 }],
    ["video-budget.html", { moduleSlug: "budget-systems", guideSlug: "", displayOrder: 30 }]
  ]);

  const updateStatement = db.prepare(`
    UPDATE content_items
    SET module_slug = ?, guide_slug = ?, display_order = ?, category_slug = COALESCE(NULLIF(category_slug, ''), ?), duration_text = COALESCE(NULLIF(duration_text, ''), ?), is_featured = CASE WHEN is_featured IS NULL OR is_featured = 0 THEN ? ELSE is_featured END
    WHERE id = ?
  `);

  const fallbackVideoMeta = new Map([
    ["asx-beginner-video", { categorySlug: "beginner", durationText: "8 min", isFeatured: 1 }],
    ["video-asx.html", { categorySlug: "beginner", durationText: "8 min", isFeatured: 1 }],
    ["cpi-explained-video", { categorySlug: "economy", durationText: "6 min", isFeatured: 1 }],
    ["video-cpi.html", { categorySlug: "economy", durationText: "6 min", isFeatured: 1 }],
    ["budget-like-a-pro-video", { categorySlug: "budgeting", durationText: "7 min", isFeatured: 1 }],
    ["video-budget.html", { categorySlug: "budgeting", durationText: "7 min", isFeatured: 1 }]
  ]);

  for (const row of rows) {
    const fallback = fallbackMap.get(row.slug) || fallbackMap.get(row.media_url);
    const fallbackVideo = fallbackVideoMeta.get(row.slug) || fallbackVideoMeta.get(row.media_url) || { categorySlug: "", durationText: "", isFeatured: 0 };
    if (row.module_slug && Number(row.display_order) > 0 && fallbackVideo.isFeatured === 0) {
      continue;
    }

    if (!fallback) {
      db.prepare(`
        UPDATE content_items
        SET category_slug = COALESCE(NULLIF(category_slug, ''), ?),
            duration_text = COALESCE(NULLIF(duration_text, ''), ?),
            is_featured = CASE WHEN is_featured IS NULL OR is_featured = 0 THEN ? ELSE is_featured END
        WHERE id = ?
      `).run(fallbackVideo.categorySlug, fallbackVideo.durationText, fallbackVideo.isFeatured, row.id);
      continue;
    }

    updateStatement.run(
      row.module_slug || fallback.moduleSlug,
      row.guide_slug || fallback.guideSlug,
      Number(row.display_order) > 0 ? row.display_order : fallback.displayOrder,
      fallbackVideo.categorySlug,
      fallbackVideo.durationText,
      fallbackVideo.isFeatured,
      row.id
    );
  }
}

function addColumnIfMissing(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function setSecurityHeaders(_req, res, next) {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

function createRateLimit({ windowMs, max, key }) {
  return (req, res, next) => {
    const bucketKey = key(req);
    const now = Date.now();
    const existing = rateLimitStore.get(bucketKey);
    if (!existing || existing.resetAt <= now) {
      rateLimitStore.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (existing.count >= max) {
      return res.status(429).json({ error: "Too many requests. Please try again shortly." });
    }

    existing.count += 1;
    return next();
  };
}

function getRequestIp(req) {
  const forwardedFor = String(req?.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return String(req?.ip || forwardedFor || req?.socket?.remoteAddress || "unknown");
}

function safeJsonParse(value, fallbackValue) {
  try {
    return JSON.parse(value);
  } catch {
    return fallbackValue;
  }
}

function getBillingProvider() {
  return String(process.env.BILLING_PROVIDER || "hosted-links").trim().toLowerCase() || "hosted-links";
}

function getBillingMode() {
  if (getCheckoutLinkForPlan("basic") || getCheckoutLinkForPlan("premium")) {
    return "hosted-checkout";
  }
  return "account-only";
}

function getCheckoutLinkForPlan(plan) {
  if (String(plan || "").trim().toLowerCase() === "premium") {
    return String(process.env.PREMIUM_PLAN_CHECKOUT_URL || "").trim();
  }
  return String(process.env.BASIC_PLAN_CHECKOUT_URL || "").trim();
}

function getPlanPriceLabel(plan) {
  if (String(plan || "").trim().toLowerCase() === "premium") {
    return String(process.env.PREMIUM_PLAN_PRICE_LABEL || "$24/month").trim();
  }
  return String(process.env.BASIC_PLAN_PRICE_LABEL || "$12/month").trim();
}

function createStorageProvider() {
  if (STORAGE_PROVIDER === "s3") {
    const bucket = String(process.env.STORAGE_BUCKET || "").trim();
    const region = String(process.env.STORAGE_REGION || "").trim();
    const accessKeyId = String(process.env.STORAGE_ACCESS_KEY_ID || "").trim();
    const secretAccessKey = String(process.env.STORAGE_SECRET_ACCESS_KEY || "").trim();
    const endpoint = String(process.env.STORAGE_ENDPOINT || "").trim();
    const publicBaseUrl = String(process.env.STORAGE_PUBLIC_BASE_URL || "").trim();

    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      console.warn("S3 storage is selected but missing required configuration. Falling back to local uploads.");
    } else {
      return {
        name: "s3",
        configured: true,
        bucket,
        region,
        endpoint,
        publicBaseUrl,
        client: new S3Client({
          region,
          endpoint: endpoint || undefined,
          forcePathStyle: endpoint ? String(process.env.STORAGE_FORCE_PATH_STYLE || "false").trim() === "true" : false,
          credentials: {
            accessKeyId,
            secretAccessKey
          }
        })
      };
    }
  }

  return {
    name: "local",
    configured: true,
    directory: UPLOAD_DIR
  };
}

async function persistUploadedFile(file) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;

  if (storageProvider.name === "s3") {
    const key = `videos/${filename}`;
    await storageProvider.client.send(new PutObjectCommand({
      Bucket: storageProvider.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: "public, max-age=31536000, immutable"
    }));

    return {
      provider: "s3",
      filename,
      key,
      mediaUrl: buildProtectedMediaUrl("s3", key)
    };
  }

  const destinationPath = path.join(storageProvider.directory, filename);
  fs.writeFileSync(destinationPath, file.buffer);
  return {
    provider: "local",
    filename,
    key: filename,
    mediaUrl: buildProtectedMediaUrl("local", filename)
  };
}

function buildS3MediaUrl(provider, key) {
  if (provider.publicBaseUrl) {
    return `${provider.publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }

  if (provider.endpoint) {
    return `${provider.endpoint.replace(/\/+$/, "")}/${provider.bucket}/${key}`;
  }

  return `https://${provider.bucket}.s3.${provider.region}.amazonaws.com/${key}`;
}

function buildProtectedMediaUrl(provider, key) {
  return `/media/${encodeURIComponent(provider)}?key=${encodeURIComponent(key)}`;
}

function getMimeTypeForFilename(filename) {
  const extension = path.extname(filename || "").toLowerCase();
  if (extension === ".mp4") {
    return "video/mp4";
  }
  if (extension === ".webm") {
    return "video/webm";
  }
  if (extension === ".mov") {
    return "video/quicktime";
  }
  return "application/octet-stream";
}

function createMailTransport() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  const from = String(process.env.MAIL_FROM || "").trim();
  const secure = String(process.env.SMTP_SECURE || "").trim() === "true" || port === 465;
  const requireTls = String(process.env.SMTP_REQUIRE_TLS || "").trim() === "true";

  if (!host || !port || !from) {
    return null;
  }

  const transportOptions = {
    host,
    port,
    secure,
    requireTLS: requireTls
  };

  if (user && pass) {
    transportOptions.auth = {
      user,
      pass
    };
  }

  return nodemailer.createTransport(transportOptions);
}

function verifyMailTransport() {
  if (!mailTransport) {
    return;
  }

  mailTransport.verify()
    .then(() => {
      mailTransportState.verified = true;
      mailTransportState.lastError = null;
    })
    .catch((error) => {
      mailTransportState.verified = false;
      mailTransportState.lastError = error.message;
      console.error("SMTP verification failed:", error.message);
    });
}

function sendEmail({ to, subject, text }) {
  const from = String(process.env.MAIL_FROM || "").trim();
  if (!to) {
    return;
  }

  if (!mailTransport || !from) {
    console.log(`[mail:fallback] To: ${to} | Subject: ${subject}\n${text}`);
    return;
  }

  mailTransport.sendMail({ from, to, subject, text }).catch((error) => {
    mailTransportState.lastError = error.message;
    mailTransportState.verified = false;
    console.error("Email delivery failed:", error.message);
  });
}

function buildVerificationEmailText(token) {
  const baseUrl = String(process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`);
  return [
    "Welcome to Zezpon.",
    "",
    `Verify your email by visiting: ${baseUrl}/verify-email.html?token=${token}`,
    "",
    "If you did not create this account, you can ignore this message."
  ].join("\n");
}

function buildPasswordResetUrl(token) {
  const baseUrl = String(process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`);
  return `${baseUrl}/reset-password.html?token=${token}`;
}

function buildPasswordResetEmailText(token) {
  return [
    "A password reset was requested for your Zezpon account.",
    "",
    `Reset your password here: ${buildPasswordResetUrl(token)}`,
    "",
    "If you did not request this, you can ignore this message."
  ].join("\n");
}

function setSessionCookie(res, token) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

function getCookie(req, name) {
  const rawCookie = req.headers.cookie || "";
  const cookies = rawCookie.split(";").map((entry) => entry.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return cookie.slice(name.length + 1);
    }
  }
  return "";
}

function ensureDataFile(filePath, fallbackValue) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2));
  }
}

function readJson(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallbackValue;
  }
}

function writeJson(filePath, value) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
  } catch (error) {
    if (error && (error.code === "EPERM" || error.code === "EACCES")) {
      return;
    }
    throw error;
  }
}
