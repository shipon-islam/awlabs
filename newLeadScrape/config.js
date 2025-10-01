// Edit these values for your environment.
// Serve these files over HTTP (e.g., `python -m http.server 8080`) so the browser can load config.js
// without CORS/file:// issues.

window.CONFIG = {
  // REQUIRED: Your n8n Webhook URL for Workflow 1 (intake/ack)
  // Example: "https://n8n.yourdomain.com/webhook/person-report-intake"
  WEBHOOK1_URL: "https://n8n.aw-dev.site/webhook/lead-scrape-v2",

  // OPTIONAL: Shared secret header your webhook expects (add check in n8n)
  // Leave blank "" if not used.
  CLIENT_KEY: "", // sent as X-Client-Key

  // If your Workflow 1 expects a different JSON shape, you can map it here later.

  // REQUIRED for Phase 4/5: Your n8n Webhook URL for Workflow 2 (status/fetch)
  // Example: "https://n8n.yourdomain.com/webhook/person-report-status"
  WEBHOOK2_URL: "https://n8n.aw-dev.site/webhook/lead-scrape-result",

  // Timing knobs for Phase 5 (ms)
  WAIT_BEFORE_POLL_MS: 120000, // wait 2 minutes before starting to poll
  POLL_INTERVAL_MS: 30000,       // every 30s
  TIMEOUT_MS: 360000            // stop at 6 minutes total
  ,
  // Batch upload limits: process at most this many leads per CSV. You can change
  // BATCH_MAX_LEADS_OVERRIDE to a non-zero number to quietly override the cap.
  BATCH_MAX_LEADS: 15,
  BATCH_MAX_LEADS_OVERRIDE: 0
};
