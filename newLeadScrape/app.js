// Person Report UI — Full app.js (Phases 1–5 + Postman-style viewer + notification + sound)

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const stateKey = "rk-person-report-state-v1";

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

      } else if (res.status === 400 || res.status === 202) {
        updateStatus("Still processing…");
      } else if (res.status === 404) {
        stopAllTimers();
        setCountdown("");
        setLoading(false);
        updateStatus("Request ID not found.");
        el.checkAgainBtn.classList.remove("hidden");
      } else if (res.status >= 500) {
        stopAllTimers();
        setCountdown("");
        setLoading(false);
        updateStatus(`Server error (${res.status}). ${text || ""}`);
        el.checkAgainBtn.classList.remove("hidden");
      } else {
        stopAllTimers();
        setCountdown("");
        updateStatus(`Unexpected response (${res.status}). ${text || ""}`);
      }
    })
    .catch((err) => {
      updateStatus(`Network error polling Workflow 2: ${err?.message || err}`);
    });
}

// ----------------------- Lifecycle & Events -----------------------

document.addEventListener("DOMContentLoaded", () => {
  const st = readState();
  if (st && st.requestId && !st.done) {
    resumeBanner(true);
  }

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
}

function onCheckAgain() {
  const st = readState();
  if (!st || !st.requestId) return;
  el.checkAgainBtn.disabled = true;
  updateStatus("Checking once more…");
  doPoll(st);
  setTimeout(() => { el.checkAgainBtn.disabled = false; }, 1500);
}
