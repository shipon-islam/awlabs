// Person Report UI — Full app.js (Phases 1–5 + Postman-style viewer + notification + sound)

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const stateKey = "rk-person-report-state-v1";

// Key for storing the current UI mode (single or batch) in localStorage
const modeKey = "uiMode";

// Track the current UI mode. Possible values: 'single', 'batch'.
// It is initialized on DOMContentLoaded in initMode().
let currentMode = "single";

const el = {
  form: $("#personForm"),
  name: $("#name"),
  companyName: $("#companyName"),
  linkedinUrl: $("#linkedinUrl"),
  submitBtn: $("#submitBtn"),
  resetBtn: $("#resetBtn"),

  statusSection: $("#statusSection"),
  statusText: $("#statusText"),
  countdownText: $("#countdownText"),
  requestIdText: $("#requestIdText"),
  payloadPreview: $("#payloadPreview"),
  copyIdBtn: $("#copyIdBtn"),

  resultSection: $("#resultSection"),
  resultJson: $("#resultJson"),
  resultPreview: $("#resultPreview"),

  tabJsonBtn: $("#tabJsonBtn"),
  tabPreviewBtn: $("#tabPreviewBtn"),
  copyJsonBtn: $("#copyJsonBtn"),
  copyPreviewBtn: $("#copyPreviewBtn"),

  overlay: $("#overlay"),

  resumeBanner: $("#resumeBanner"),
  resumeBtn: $("#resumeBtn"),
  clearBtn: $("#clearBtn"),
  checkAgainBtn: $("#checkAgainBtn"),

  // Mode selector elements
  modeSingleBtn: $("#modeSingleBtn"),
  modeBatchBtn: $("#modeBatchBtn"),
  singleSection: $("#singleSection"),

  // Batch upload elements
  batchSection: $("#batchSection"),
  batchFile: $("#batchFile"),
  batchSampleBtn: $("#batchSampleBtn"),
  batchStartBtn: $("#batchStartBtn"),
  batchCancelBtn: $("#batchCancelBtn"),
  batchResetBtn: $("#batchResetBtn"),
  batchDownloadBtn: $("#batchDownloadBtn"),
  batchProgress: $("#batchProgress"),
};

// ----------------------- Utilities & State -----------------------

function generateRequestId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `rk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function setError(inputId, message) {
  const p = document.querySelector(`.error[data-error-for="${inputId}"]`);
  if (p) p.textContent = message || "";
}
function clearErrors() {
  setError("name", "");
  setError("companyName", "");
  setError("linkedinUrl", "");
}
function validateForm() {
  clearErrors();
  let ok = true;
  if (!el.name.value.trim()) {
    setError("name", "Name is required.");
    ok = false;
  }
  if (!el.companyName.value.trim()) {
    setError("companyName", "Company Name is required.");
    ok = false;
  }
  const url = el.linkedinUrl.value.trim();
  if (url && !/^https?:\/\/(www\.)?linkedin\.com\/.*$/i.test(url)) {
    setError("linkedinUrl", "Please enter a valid LinkedIn URL.");
    ok = false;
  }
  return ok;
}

function readState() {
  try {
    const raw = localStorage.getItem(stateKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeState(data) {
  localStorage.setItem(stateKey, JSON.stringify(data));
}
function clearState() {
  localStorage.removeItem(stateKey);
}

function setLoading(active) {
  if (active) {
    el.overlay.classList.remove("hidden");
    el.overlay.setAttribute("aria-busy", "true");
  } else {
    el.overlay.classList.add("hidden");
    el.overlay.setAttribute("aria-busy", "false");
  }
}
function updateStatus(text) {
  el.statusText.textContent = text;
}
function showStatusCard(show) {
  el.statusSection.classList.toggle("hidden", !show);
}
function showResultCard(show) {
  el.resultSection.classList.toggle("hidden", !show);
}
function fillPayloadPreview(payload) {
  el.payloadPreview.textContent = JSON.stringify(payload, null, 2);
}
function copyToClipboard(text) {
  return navigator.clipboard?.writeText(text);
}
function setCountdown(text) {
  el.countdownText.textContent = text || "";
}
function resumeBanner(show) {
  el.resumeBanner.classList.toggle("hidden", !show);
}

// ---------------------------------------------------------------------------
// Mode management helpers
//
// The application supports two modes: 'single' for individual lead processing and
// 'batch' for CSV batch uploads. The UI displays only the relevant section
// based on the current mode. Users can switch modes via the buttons in the
// mode selector. Switching modes while a run is active will prompt for
// confirmation and cancel the active run.

// Determine if a single-run polling loop is currently active. We treat any
// pending timers as an active run.
function hasActiveSingleRun() {
  return !!(pollTimer || initialWaitTimer || countdownInterval);
}

// Determine if a batch run is currently active (running and not canceled).
function hasActiveBatchRun() {
  return !!(batchState && batchState.running && !batchState.canceled);
}

// Cancel any active run gracefully. For single runs, stop timers and reset
// the status UI. For batch runs, invoke the cancelBatch() and resetBatch()
// helpers. Also resets the state so new runs can be initiated.
function cancelActiveRun() {
  // Cancel single run
  if (hasActiveSingleRun()) {
    stopAllTimers();
    setLoading(false);
    // Reset single run UI to idle
    updateStatus("Idle");
    showStatusCard(false);
    showResultCard(false);
    el.requestIdText.textContent = "—";
    el.payloadPreview.textContent = "";
    el.submitBtn.disabled = false;
    setCountdown("");
    // Clear persisted state
    clearState();
  }
  // Cancel batch run
  if (hasActiveBatchRun()) {
    cancelBatch();
    // resetBatch will clear progress, disable buttons, and reset the UI
    resetBatch();
  }
  // Re-enable both mode buttons after cancel
  enableModeButtons();
}

// Re-enable the mode buttons so the user can switch modes or start runs. This
// should be called after a run (single or batch) completes or is canceled.
function enableModeButtons() {
  if (el.modeSingleBtn) {
    el.modeSingleBtn.disabled = false;
    el.modeSingleBtn.setAttribute("aria-disabled", "false");
  }
  if (el.modeBatchBtn) {
    el.modeBatchBtn.disabled = false;
    el.modeBatchBtn.setAttribute("aria-disabled", "false");
  }
}

// Apply a new mode to the UI. This shows or hides the single and batch
// sections, updates the aria-pressed state on the buttons, and persists
// the selection. If switching to batch, the single-run resume banner is
// hidden. When switching to single, the resume banner is shown if there is
// an active unfinished request.
function applyMode(mode) {
  currentMode = mode;
  const isSingle = mode === "single";
  // Toggle sections
  if (el.singleSection) el.singleSection.classList.toggle("hidden", !isSingle);
  if (el.batchSection) el.batchSection.classList.toggle("hidden", isSingle);
  // Update button aria-pressed state
  if (el.modeSingleBtn) {
    el.modeSingleBtn.setAttribute("aria-pressed", isSingle ? "true" : "false");
  }
  if (el.modeBatchBtn) {
    el.modeBatchBtn.setAttribute("aria-pressed", !isSingle ? "true" : "false");
  }
  // Persist in localStorage
  try {
    localStorage.setItem(modeKey, mode);
  } catch {}
  // Update URL hash without adding history entries
  const newHash = `#${mode}`;
  if (window.location.hash !== newHash) {
    try { history.replaceState(null, "", newHash); } catch {}
  }
  // Hide resume banner when switching to batch; show when single and an unfinished state exists
  if (isSingle) {
    const st = readState();
    if (st && st.requestId && !st.done) {
      resumeBanner(true);
    } else {
      resumeBanner(false);
    }
  } else {
    resumeBanner(false);
  }
  // Clear status and result sections when switching to batch to avoid confusion
  if (!isSingle) {
    showStatusCard(false);
    showResultCard(false);
    setCountdown("");
    updateStatus("Idle");
  }
}

// Initialize the mode on page load based on the URL hash or persisted
// localStorage value. Defaults to 'single' if none provided.
function initMode() {
  let mode = null;
  const hash = window.location.hash ? window.location.hash.replace("#", "").toLowerCase() : "";
  if (hash === "single" || hash === "batch") {
    mode = hash;
  } else {
    try {
      const saved = localStorage.getItem(modeKey);
      if (saved === "single" || saved === "batch") {
        mode = saved;
      }
    } catch {}
  }
  if (mode !== "single" && mode !== "batch") mode = "single";
  applyMode(mode);
}

// Handle a user-initiated mode change. If a run is active, prompt for
// confirmation and cancel the run if the user agrees.
function handleModeChange(newMode) {
  if (!newMode || newMode === currentMode) return;
  // If any run is active, confirm cancellation
  if (hasActiveSingleRun() || hasActiveBatchRun()) {
    const confirmSwitch = window.confirm("A run is in progress. Switching modes will cancel it. Continue?");
    if (!confirmSwitch) return;
    cancelActiveRun();
  }
  applyMode(newMode);
}

// ----------------------- Preview Helpers (Postman-style) -----------------------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// very light markdown: **bold**, *italic*, linkify URLs, line breaks
function mdToHtml(s) {
  if (s == null) return "";
  let out = escapeHtml(String(s));
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); // bold
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");             // italic
  out = out.replace(/(https?:\/\/[^\s)]+)(?=\)|\s|$)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'); // linkify
  out = out.replace(/\n/g, "<br>");                            // line breaks
  return out;
}

function renderPreviewTable(obj) {
  const rows = [];
  const keys = Object.keys(obj || {});
  for (const k of keys) {
    const v = obj[k];
    let htmlVal = "";

    if (v == null) {
      htmlVal = '<span class="dim">null</span>';
    } else if (typeof v === "string") {
      htmlVal = mdToHtml(v);
    } else if (typeof v === "number" || typeof v === "boolean") {
      htmlVal = escapeHtml(String(v));
    } else if (Array.isArray(v)) {
      htmlVal = "<ul>" + v.map(it => `<li>${mdToHtml(typeof it === "string" ? it : JSON.stringify(it))}</li>`).join("") + "</ul>";
    } else if (typeof v === "object") {
      htmlVal = `<pre class="code">${escapeHtml(JSON.stringify(v, null, 2))}</pre>`;
    } else {
      htmlVal = escapeHtml(String(v));
    }

    rows.push(`<tr><th>${escapeHtml(k)}</th><td class="val">${htmlVal}</td></tr>`);
  }
  return `<div class="preview"><table>${rows.join("")}</table></div>`;
}

// ---------------------------------------------------------------------------
// Structured CSV Helpers
// These helpers define the desired header order and build structured row arrays
// from the result JSON returned by Workflow 2. Each column corresponds to a
// specific field extracted from the result. Missing values are left blank.
//
// Header names must match the desired CSV columns:
// Name | last_activity | summary_lead | summary_company | lead_linkedin_url |
// lead_public_identifier | lead_full_name | experience_headlines | lead_connections |
// lead_followers | lead_email | lead_mobile | lead_title | company_name |
// company_industry | company_domain | company_linkedin_url | company_founded_year |
// company_size | current_job_duration | top_skills | lead_location | about |
// experience_headlines_detailed | education

const structuredHeaders = [
  "Name",
  "last_activity",
  "summary_lead",
  "summary_company",
  "lead_linkedin_url",
  "lead_public_identifier",
  "lead_full_name",
  "experience_headlines",
  "lead_connections",
  "lead_followers",
  "lead_email",
  "lead_mobile",
  "lead_title",
  "company_name",
  "company_industry",
  "company_domain",
  "company_linkedin_url",
  "company_founded_year",
  "company_size",
  "current_job_duration",
  "top_skills",
  "lead_location",
  "about",
  "experience_headlines_detailed",
  "education",
];

function buildStructuredHeaders() {
  // Return a shallow copy to avoid accidental mutation
  return structuredHeaders.slice();
}

 function buildStructuredRow(name, resultData) {
  /*
    Build a CSV row for a single lead result.

    We support two shapes for `resultData`:
    1. **Flattened object** with fields like `last_activity`, `summary_lead`, etc. directly on the
       top-level. This is what your JSON currently looks like (see the sample provided).
    2. **Nested object** with a `.data` array containing sub-objects at indexes 0–3, as used
       earlier in the project. We keep this fallback to avoid breaking compatibility with
       workflows that return nested data.

    The function prioritizes values from the flattened object. If a flattened key is
    missing or empty, it falls back to the nested location. Numeric values are
    converted to strings, and composite fields like `experience_headlines_detailed` and
    `education` are joined with newlines.
  */

  // Helper to safely get a flattened value by key
  const getFlat = (key) => {
    if (resultData && typeof resultData === "object" && resultData[key] != null) {
      return resultData[key];
    }
    return "";
  };

  // Nested fallback array: some workflows return `data: [d0, d1, d2, d3]`
  const dataArray = Array.isArray(resultData?.data) ? resultData.data : [];
  const d0 = dataArray[0] || {};
  const d1 = dataArray[1] || {};
  const d2 = dataArray[2] || {};
  const d3 = dataArray[3] || {};

  // Compose complex fields first.
  // Experience details: use flattened string if provided; otherwise build from nested structure.
  let expDetails = getFlat("experience_headlines_detailed");
  if (!expDetails) {
    const expList = [
      d1?.experiences?.[0]?.title,
      d1?.experiences?.[0]?.subComponents?.[0]?.title,
      d1?.experiences?.[0]?.subComponents?.[0]?.caption,
      d1?.experiences?.[0]?.subComponents?.[0]?.description,
    ].filter(Boolean);
    expDetails = expList.join("\n");
  }

  // Education details: flattened string first; fallback to nested.
  let education = getFlat("education");
  if (!education) {
    const eduList = [
      d1?.educations?.[0]?.title,
      d1?.educations?.[0]?.subtitle,
    ].filter(Boolean);
    education = eduList.join("\n");
  }

  // Top skills: flattened field first; fallback to nested array or string.
  let topSkills = getFlat("top_skills");
  if (!topSkills) {
    const ts = d1?.topSkillsByEndorsements;
    if (Array.isArray(ts)) {
      topSkills = ts.join(", ");
    } else if (ts != null) {
      topSkills = String(ts);
    } else {
      topSkills = "";
    }
  }

  // Helper to convert numeric or undefined to string.
  const toStringOrBlank = (val) => {
    if (val == null) return "";
    return String(val);
  };

  return [
    name || "",
    // last_activity: flattened or nested d0.lastActivity
    getFlat("last_activity") || d0?.lastActivity || "",
    // summary_lead: flattened or nested d2.text
    getFlat("summary_lead") || d2?.text || "",
    // summary_company: flattened or nested d3.text
    getFlat("summary_company") || d3?.text || "",
    // lead_linkedin_url
    getFlat("lead_linkedin_url") || d1?.linkedinUrl || "",
    // lead_public_identifier
    getFlat("lead_public_identifier") || d1?.publicIdentifier || "",
    // lead_full_name
    getFlat("lead_full_name") || d1?.fullName || "",
    // experience_headlines
    getFlat("experience_headlines") || d1?.headline || "",
    // lead_connections
    toStringOrBlank(getFlat("lead_connections")) || toStringOrBlank(d1?.connections),
    // lead_followers
    toStringOrBlank(getFlat("lead_followers")) || toStringOrBlank(d1?.followers),
    // lead_email
    getFlat("lead_email") || d1?.email || "",
    // lead_mobile
    getFlat("lead_mobile") || d1?.mobileNumber || "",
    // lead_title
    getFlat("lead_title") || d1?.jobTitle || "",
    // company_name
    getFlat("company_name") || d1?.companyName || "",
    // company_industry
    getFlat("company_industry") || d1?.companyIndustry || "",
    // company_domain (website)
    getFlat("company_domain") || d1?.companyWebsite || "",
    // company_linkedin_url
    getFlat("company_linkedin_url") || d1?.companyLinkedin || "",
    // company_founded_year
    toStringOrBlank(getFlat("company_founded_year")) || toStringOrBlank(d1?.companyFoundedIn),
    // company_size
    getFlat("company_size") || d1?.companySize || "",
    // current_job_duration
    getFlat("current_job_duration") || d1?.currentJobDuration || "",
    // top_skills
    topSkills,
    // lead_location
    getFlat("lead_location") || d1?.addressWithoutCountry || "",
    // about
    getFlat("about") || d1?.about || "",
    // experience_headlines_detailed
    expDetails,
    // education
    education,
  ];
 }

function switchTab(which) {
  const isJson = which === "json";
  $$(".tab-btn").forEach((b) => b.classList.remove("active"));
  $$(".tab-panel").forEach((p) => p.classList.remove("active"));
  if (isJson) {
    el.tabJsonBtn.classList.add("active");
    el.resultJson.classList.add("active");
  } else {
    el.tabPreviewBtn.classList.add("active");
    el.resultPreview.classList.add("active");
  }
}

function copyJson() {
  const text = el.resultJson.textContent || "";
  navigator.clipboard?.writeText(text).then(() => {
    el.copyJsonBtn.textContent = "Copied";
    setTimeout(() => (el.copyJsonBtn.textContent = "Copy JSON"), 1200);
  });
}

function copyPreview() {
  const text = el.resultPreview.innerText || "";
  navigator.clipboard?.writeText(text).then(() => {
    el.copyPreviewBtn.textContent = "Copied";
    setTimeout(() => (el.copyPreviewBtn.textContent = "Copy Preview"), 1200);
  });
}

// ----------------------- Notification & Sound -----------------------

function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Simple two-tone chime: A5 then C6 with quick fade
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = "sine";
    o1.frequency.value = 880; // A5
    g1.gain.setValueAtTime(0.0001, now);
    g1.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
    g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    o1.connect(g1).connect(ctx.destination);
    o1.start(now);
    o1.stop(now + 0.27);

    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "sine";
    o2.frequency.value = 1046.5; // C6
    g2.gain.setValueAtTime(0.0001, now + 0.22);
    g2.gain.exponentialRampToValueAtTime(0.14, now + 0.26);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    o2.connect(g2).connect(ctx.destination);
    o2.start(now + 0.22);
    o2.stop(now + 0.52);
  } catch {
    // no-op if blocked
  }
}

async function showResultNotification(st) {
  if (!("Notification" in window)) {
    return; // browser doesn't support
  }

  let perm = Notification.permission; // 'default' | 'granted' | 'denied'
  if (perm === "default") {
    try {
      perm = await Notification.requestPermission();
    } catch {
      // ignore
    }
  }
  if (perm !== "granted") return;

  const title = "Report ready";
  const body = [st?.name, st?.companyName].filter(Boolean).join(" • ") || st?.requestId || "Result available";
  const n = new Notification(title, {
    body,
    tag: st?.requestId || String(Date.now()), // dedupe per request
    renotify: true,
    silent: true, // we play our own chime
  });
  n.onclick = () => {
    try {
      window.focus();
      if (document.visibilityState === "hidden") {
        window.open(window.location.href, "_self");
      }
      n.close();
    } catch {}
  };
}

// ----------------------- Polling & Countdown (Phase 5) -----------------------

let pollTimer = null;
let initialWaitTimer = null;
let countdownInterval = null;

function fmtRemaining(msLeft) {
  if (msLeft < 0) msLeft = 0;
  const s = Math.ceil(msLeft / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function stopAllTimers() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (initialWaitTimer) { clearTimeout(initialWaitTimer); initialWaitTimer = null; }
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
}

function schedulePolling(st) {
  stopAllTimers();

  const cfg = window.CONFIG || {};
  const WAIT = Number(cfg.WAIT_BEFORE_POLL_MS ?? 120000);   // 2 min
  const INTERVAL = Number(cfg.POLL_INTERVAL_MS ?? 30000);   // 30s
  const TIMEOUT = Number(cfg.TIMEOUT_MS ?? 360000);         // 6 min

  const start = st.submittedAt || Date.now();
  const deadline = start + TIMEOUT;

  function startPolling() {
    updateStatus("Polling Workflow for results…");
    doPoll(st); // immediate
    pollTimer = setInterval(() => doPoll(st), INTERVAL);
  }

  const elapsed = Date.now() - start;
  if (elapsed >= WAIT) {
    startPolling();
  } else {
    const waitLeft = WAIT - elapsed;
    updateStatus(`Waiting ${Math.ceil(waitLeft / 1000)}s before first status check…`);
    initialWaitTimer = setTimeout(startPolling, waitLeft);
  }

  // countdown
  countdownInterval = setInterval(() => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      stopAllTimers();
      setCountdown("");
      onTimeout(st);
    } else {
      setCountdown(`Time remaining: ${fmtRemaining(remaining)}`);
    }
  }, 1000);

  st._deadline = deadline;
  writeState({ ...st, phase: 5, deadline });
}

function onTimeout(st) {
  stopAllTimers();
  updateStatus("Timed out at 6 minutes without a result. Try again later.");
  el.checkAgainBtn.classList.remove("hidden");
  setLoading(false);
  writeState({ ...st, done: false, timedOut: true });
  // Re-enable mode buttons since the run ended due to timeout
  enableModeButtons();
}

function doPoll(st) {
  const url = window.CONFIG?.WEBHOOK2_URL?.trim();
  if (!url) {
    updateStatus("Polling not configured. Set WEBHOOK2_URL in config.js.");
    return;
  }

  const headers = { "Content-Type": "application/json" };
  const clientKey = window.CONFIG?.CLIENT_KEY?.trim();
  if (clientKey) headers["X-Client-Key"] = clientKey;

  fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ requestId: st.requestId }),
  })
    .then(async (res) => {
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch {}

      if (res.status === 200) {
        stopAllTimers();
        setCountdown("");
        setLoading(false);
        updateStatus("Result received.");
        showResultCard(true);
        // Fill tabs: JSON + Preview
        el.resultJson.textContent = JSON.stringify(data, null, 2);
        el.resultPreview.innerHTML = renderPreviewTable(data?.data || data);
        switchTab("preview"); // default to preview
        writeState({ ...st, done: true, result: data });

        // NEW: alert user
        playChime();
        showResultNotification(st);
        // Allow switching modes again since the run is complete
        enableModeButtons();

      } else if (res.status === 400 || res.status === 202) {
        updateStatus("Still processing…");
      } else if (res.status === 404) {
        stopAllTimers();
        setCountdown("");
        setLoading(false);
        updateStatus("Request ID not found.");
        el.checkAgainBtn.classList.remove("hidden");
        // Run is finished with error, re-enable mode buttons
        enableModeButtons();
      } else if (res.status >= 500) {
        stopAllTimers();
        setCountdown("");
        setLoading(false);
        updateStatus(`Server error (${res.status}). ${text || ""}`);
        el.checkAgainBtn.classList.remove("hidden");
        // Re-enable mode buttons on server error
        enableModeButtons();
      } else {
        stopAllTimers();
        setCountdown("");
        updateStatus(`Unexpected response (${res.status}). ${text || ""}`);
        // Unexpected response ends run; re-enable mode buttons
        enableModeButtons();
      }
    })
    .catch((err) => {
      updateStatus(`Network error polling Workflow 2: ${err?.message || err}`);
    });
}

// ----------------------- Lifecycle & Events -----------------------

document.addEventListener("DOMContentLoaded", () => {
  // Initialize UI mode based on URL hash or saved value
  initMode();
  // Attach mode selector button handlers
  if (el.modeSingleBtn) {
    el.modeSingleBtn.addEventListener("click", () => handleModeChange("single"));
  }
  if (el.modeBatchBtn) {
    el.modeBatchBtn.addEventListener("click", () => handleModeChange("batch"));
  }

  // Single run form handlers
  el.form.addEventListener("submit", onSubmit);
  el.resetBtn.addEventListener("click", onReset);
  el.copyIdBtn.addEventListener("click", onCopyId);
  el.resumeBtn.addEventListener("click", onResume);
  el.clearBtn.addEventListener("click", onClear);
  el.checkAgainBtn.addEventListener("click", onCheckAgain);

  // Tabs + copy
  if (el.tabJsonBtn && el.tabPreviewBtn) {
    el.tabJsonBtn.addEventListener("click", () => switchTab("json"));
    el.tabPreviewBtn.addEventListener("click", () => switchTab("preview"));
  }
  if (el.copyJsonBtn) el.copyJsonBtn.addEventListener("click", copyJson);
  if (el.copyPreviewBtn) el.copyPreviewBtn.addEventListener("click", copyPreview);
});

function onSubmit(e) {
  e.preventDefault();
  // Guard: only allow submit in single mode
  if (currentMode !== "single") {
    // Inform the user; using alert() ensures immediate visibility
    window.alert("Please switch to Single mode to run a single lead search.");
    return;
  }
  if (!validateForm()) return;

  const requestId = generateRequestId();
  const payload = {
    requestId,
    name: el.name.value.trim(),
    companyName: el.companyName.value.trim(),
    linkedinUrl: el.linkedinUrl.value.trim() || null,
    submittedAt: Date.now(),
  };

  writeState({ ...payload, done: false, phase: 2 });

  showStatusCard(true);
  el.requestIdText.textContent = requestId;
  fillPayloadPreview(payload);
  setLoading(true);
  el.submitBtn.disabled = true;
  updateStatus("Submitting to Workflow 1…");

  const url = window.CONFIG?.WEBHOOK1_URL?.trim();
  if (!url) {
    // Simulate ACK for local/demo use
    setTimeout(() => {
      setLoading(false);
      updateStatus("ACK simulated. Starting polling… (set WEBHOOK1_URL for real calls)");
      schedulePolling(payload);
    }, 700);
    return;
  }

  const headers = { "Content-Type": "application/json" };
  const clientKey = window.CONFIG?.CLIENT_KEY?.trim();
  if (clientKey) headers["X-Client-Key"] = clientKey;

  fetch(url, { method: "POST", headers, body: JSON.stringify(payload) })
    .then(async (res) => {
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch {}

      if (!res.ok) {
        setLoading(false);
        updateStatus(`Workflow 1 failed (${res.status}). ${text || ""}`);
        el.submitBtn.disabled = false;
        return;
      }

      setLoading(false);
      updateStatus("ACK received. Starting polling…");
      // Disable switching to batch mode while single polling is in progress
      if (el.modeBatchBtn) {
        el.modeBatchBtn.disabled = true;
        el.modeBatchBtn.setAttribute("aria-disabled", "true");
      }
      schedulePolling(payload);
    })
    .catch((err) => {
      setLoading(false);
      updateStatus(`Network error: ${err?.message || err}`);
      el.submitBtn.disabled = false;
    });
}

function onReset() {
  el.form.reset();
  clearErrors();
  clearState();
  showStatusCard(false);
  showResultCard(false);
  updateStatus("Idle");
  el.requestIdText.textContent = "—";
  el.payloadPreview.textContent = "";
  el.submitBtn.disabled = false;
  resumeBanner(false);
  setCountdown("");
  stopAllTimers();

  // If a batch was previously run or in progress, reset the batch UI as well.
  if (typeof resetBatch === "function") resetBatch();

  // Re-enable mode buttons after reset
  enableModeButtons();
}

function onCopyId() {
  const id = el.requestIdText.textContent.trim();
  if (!id || id === "—") return;
  copyToClipboard(id).then(() => {
    el.copyIdBtn.textContent = "Copied";
    setTimeout(() => (el.copyIdBtn.textContent = "Copy"), 1200);
  });
}

function onResume() {
  const st = readState();
  if (!st) return;
  resumeBanner(false);
  showStatusCard(true);
  el.requestIdText.textContent = st.requestId;
  fillPayloadPreview(st);
  updateStatus("Resumed previous request.");
  schedulePolling(st);
}

function onClear() {
  clearState();
  resumeBanner(false);
  stopAllTimers();
  setCountdown("");
  // Re-enable mode buttons since no run is active
  enableModeButtons();
}

function onCheckAgain() {
  const st = readState();
  if (!st || !st.requestId) return;
  el.checkAgainBtn.disabled = true;
  updateStatus("Checking once more…");
  doPoll(st);
  setTimeout(() => { el.checkAgainBtn.disabled = false; }, 1500);
}

// ---------------------------------------------------------------------------
// Batch upload helpers and logic
// ---------------------------------------------------------------------------

// Global state for current batch run. Set to null when idle.
let batchState = null;

// Parse a CSV row into an array of values, handling quoted commas and quotes.
function parseCsvRow(row) {
  const out = [];
  let current = "";
  let inside = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      // escaped quote
      if (inside && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inside = !inside;
      }
    } else if (char === ',' && !inside) {
      out.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out;
}

// Convert CSV text into an array of rows (each row is an array of strings)
function parseCsvText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const rows = [];
  for (const line of lines) {
    rows.push(parseCsvRow(line));
  }
  return rows;
}

// Turn result JSON into a simple plain text preview for CSV export.
function createPreviewPlainText(data) {
  const obj = data?.data || data;
  const lines = [];
  for (const [key, val] of Object.entries(obj || {})) {
    let v = "";
    if (val == null) {
      v = "";
    } else if (typeof val === "string") {
      v = val;
    } else if (Array.isArray(val)) {
      v = val.join(", ");
    } else if (typeof val === "object") {
      v = JSON.stringify(val);
    } else {
      v = String(val);
    }
    lines.push(`${key}: ${v}`);
  }
  return lines.join("\n");
}

// Generate a CSV string from an array of row arrays. Values are escaped.
function generateCsvString(rows) {
  return rows
    .map((row) =>
      row
        .map((val) => {
          if (val == null) return "";
          const s = String(val);
          if (/[",\n]/.test(s)) {
            return '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        })
        .join(",")
    )
    .join("\n");
}

// Append a message to the batch progress log and scroll to bottom.
function logProgress(msg) {
  if (!el.batchProgress) return;
  el.batchProgress.textContent += msg + "\n";
  el.batchProgress.scrollTop = el.batchProgress.scrollHeight;
}

// Clear the batch progress log.
function clearProgress() {
  if (el.batchProgress) el.batchProgress.textContent = "";
}

// Perform the workflow for a single lead and return its result.
async function runLead(lead) {
  // Compose payload for Workflow 1
  const requestId = generateRequestId();
  const payload = {
    requestId,
    name: lead.name,
    companyName: lead.company,
    linkedinUrl: lead.linkedinUrl || null,
    submittedAt: Date.now(),
  };
  const cfg = window.CONFIG || {};
  const headers = { "Content-Type": "application/json" };
  if (cfg.CLIENT_KEY) headers["X-Client-Key"] = cfg.CLIENT_KEY;
  try {
    // Send to Workflow 1
    if (cfg.WEBHOOK1_URL) {
      await fetch(cfg.WEBHOOK1_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    }
    // Wait before polling
    const WAIT = Number(cfg.WAIT_BEFORE_POLL_MS ?? 120000);
    const INTERVAL = Number(cfg.POLL_INTERVAL_MS ?? 30000);
    const TIMEOUT = Number(cfg.TIMEOUT_MS ?? 360000);
    await new Promise((resolve) => setTimeout(resolve, WAIT));
    const endAt = Date.now() + TIMEOUT;
    while (Date.now() < endAt) {
      try {
        const res = await fetch(cfg.WEBHOOK2_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({ requestId }),
        });
        const text = await res.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch {}
        if (res.status === 200) {
          return { ok: true, data };
        }
        if (res.status === 404 || res.status >= 500) {
          return { ok: false, error: `${res.status}` };
        }
        // 202/400 → still processing
      } catch (err) {
        return { ok: false, error: err?.message || "network" };
      }
      await new Promise((resolve) => setTimeout(resolve, INTERVAL));
    }
    return { ok: false, error: "timeout" };
  } catch (err) {
    return { ok: false, error: err?.message || "workflow" };
  }
}

// Cancel a running batch gracefully
function cancelBatch() {
  if (batchState && !batchState.canceled) {
    batchState.canceled = true;
    logProgress("Batch canceled.");
    // Immediately hide the Cancel button and show the Reset button so the user
    // can clear the form without waiting for the current lead to finish.
    if (el.batchCancelBtn) el.batchCancelBtn.classList.add("hidden");
    if (el.batchResetBtn) el.batchResetBtn.classList.remove("hidden");

    // Allow switching modes once cancellation is requested
    enableModeButtons();
  }
}

// Reset batch UI and state for a new upload
function resetBatch() {
  // Cancel current batch if active
  if (batchState && !batchState.canceled && batchState.running) {
    cancelBatch();
  }
  batchState = null;
  // Clear file input
  if (el.batchFile) el.batchFile.value = "";
  // Clear progress
  clearProgress();
  // Reset buttons
  if (el.batchDownloadBtn) {
    // Disable the download button and clear any previous href/dataset to avoid stale URLs
    el.batchDownloadBtn.disabled = true;
    el.batchDownloadBtn.removeAttribute("href");
    delete el.batchDownloadBtn.dataset.url;
    delete el.batchDownloadBtn.dataset.filename;
  }
  if (el.batchStartBtn) el.batchStartBtn.disabled = true;
  if (el.batchCancelBtn) el.batchCancelBtn.classList.add("hidden");
  if (el.batchResetBtn) el.batchResetBtn.classList.add("hidden");
  // Show sample and hide cancel & reset
  if (el.batchSampleBtn) el.batchSampleBtn.disabled = false;
  logProgress("Ready for new CSV upload.");

  // Re-enable mode buttons in case a batch was canceled/reset
  enableModeButtons();
}

// Run a batch of leads sequentially
async function runBatch(leads) {
  batchState = { running: true, canceled: false, leads, results: [] };
  const total = leads.length;
  // Show cancel and hide reset
  el.batchCancelBtn.classList.remove("hidden");
  el.batchResetBtn.classList.add("hidden");
  el.batchStartBtn.disabled = true;
  for (let i = 0; i < total; i++) {
    if (batchState.canceled) break;
    const lead = leads[i];
    logProgress(`Processing row ${i + 1}/${total}…`);
    const result = await runLead(lead);
    if (result.ok) {
      logProgress(`Done row ${i + 1} ✓`);
      // Store the result data alongside the preview for structured CSV building
      batchState.results.push({ name: lead.name, preview: createPreviewPlainText(result.data), data: result.data });
    } else {
      logProgress(`Row ${i + 1} → error`);
      batchState.results.push({ name: lead.name, preview: "error", data: null });
    }
  }
  batchState.running = false;
  // Hide cancel and show reset
  el.batchCancelBtn.classList.add("hidden");
  el.batchResetBtn.classList.remove("hidden");
  // Build results CSV with structured columns
  const rows = [];
  // Use the helper to define header row
  rows.push(buildStructuredHeaders());
  for (const r of batchState.results) {
    // Build each structured row using the stored result data (or blanks if none)
    rows.push(buildStructuredRow(r.name, r.data));
  }
  const csv = generateCsvString(rows);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  // Store URL and filename on button dataset instead of assigning href to a <button>
  el.batchDownloadBtn.dataset.url = url;
  el.batchDownloadBtn.dataset.filename = `batch-results-${Date.now()}.csv`;
  el.batchDownloadBtn.disabled = false;
  // Notify user
  playChime();
  showResultNotification({ name: null, companyName: null, requestId: null });
  logProgress("Batch complete.");
  // Re-enable mode buttons since batch has finished
  enableModeButtons();
}

// Download a sample CSV for users
function downloadSampleCsv() {
  const sample = "Name,Company,LinkedInUrl\nJane Doe,Acme Inc,https://www.linkedin.com/in/janedoe\nJohn Smith,Globex,";
  const blob = new Blob([sample], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample.csv";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

// Handle file input change: read CSV and enable start
function onBatchFileChange() {
  const file = el.batchFile?.files?.[0];
  if (!file) {
    el.batchStartBtn.disabled = true;
    return;
  }
  // Read file
  const reader = new FileReader();
  reader.onload = () => {
    try {
      clearProgress();
      const rows = parseCsvText(reader.result);
      if (rows.length < 2) {
        logProgress("CSV must include headers and at least one row.");
        el.batchStartBtn.disabled = true;
        return;
      }
      const header = rows[0].map((h) => h.trim());
      const expected = ["Name", "Company", "LinkedInUrl"];
      const matches = expected.every((col) => header.includes(col));
      if (!matches) {
        logProgress("Error: CSV headers must be Name, Company, LinkedInUrl.");
        el.batchStartBtn.disabled = true;
        return;
      }
      // Build lead objects
      const leads = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const lead = {};
        for (let j = 0; j < header.length; j++) {
          const col = header[j];
          lead[col.toLowerCase()] = row[j] || "";
        }
        // Normalize property names
        leads.push({
          name: lead.name || "",
          company: lead.company || "",
          linkedinUrl: lead.linkedinurl || "",
        });
      }
      // Enforce cap
      const cfg = window.CONFIG || {};
      const max = Number(cfg.BATCH_MAX_LEADS_OVERRIDE || cfg.BATCH_MAX_LEADS || 15);
      if (leads.length > max) {
        logProgress(`Only processing first ${max} rows (found ${leads.length}).`);
        el.batchStartBtn.disabled = false;
        el.batchFile.dataset.leads = JSON.stringify(leads.slice(0, max));
      } else {
        el.batchStartBtn.disabled = false;
        el.batchFile.dataset.leads = JSON.stringify(leads);
      }
    } catch (err) {
      logProgress(`Error reading CSV: ${err?.message || err}`);
      el.batchStartBtn.disabled = true;
    }
  };
  reader.onerror = () => {
    logProgress("Failed to read file.");
    el.batchStartBtn.disabled = true;
  };
  reader.readAsText(file);
}

// Handle batch start
function onBatchStart() {
  // Guard: only allow batch start in batch mode
  if (currentMode !== "batch") {
    logProgress("Please switch to Batch mode to start a batch run.");
    return;
  }
  const leadsJson = el.batchFile.dataset.leads;
  if (!leadsJson) return;
  const leads = JSON.parse(leadsJson);
  clearProgress();
  logProgress(`Starting batch for ${leads.length} leads…`);
  // Start the run asynchronously without blocking UI
  // Disable switching back to single while batch is running
  if (el.modeSingleBtn) {
    el.modeSingleBtn.disabled = true;
    el.modeSingleBtn.setAttribute("aria-disabled", "true");
  }
  runBatch(leads);
}

// Attach batch event listeners on DOM load
document.addEventListener("DOMContentLoaded", () => {
  if (el.batchFile) {
    el.batchFile.addEventListener("change", onBatchFileChange);
  }
  if (el.batchSampleBtn) {
    el.batchSampleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      downloadSampleCsv();
    });
  }
  if (el.batchStartBtn) {
    el.batchStartBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onBatchStart();
    });
  }
  if (el.batchCancelBtn) {
    el.batchCancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      cancelBatch();
    });
  }
  if (el.batchResetBtn) {
    el.batchResetBtn.addEventListener("click", (e) => {
      e.preventDefault();
      resetBatch();
    });
  }

  // When the results CSV is ready, clicking the download button should create a temporary
  // anchor to trigger the browser download since <button> elements do not respect href attributes.
  if (el.batchDownloadBtn) {
    el.batchDownloadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // Do nothing if disabled
      if (el.batchDownloadBtn.disabled) return;
      const url = el.batchDownloadBtn.dataset.url;
      const filename = el.batchDownloadBtn.dataset.filename || "results.csv";
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Optionally release the object URL after download
      // You may choose to revoke the URL after a short delay to allow the download to complete
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch {}
      }, 1000);
    });
  }
});
