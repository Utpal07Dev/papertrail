/*
 * PaperVault browser application
 * --------------------------------
 * This file uses only standard browser APIs. Every backend call goes through
 * fetch(), and uploads use FormData so the PDF is sent as multipart/form-data.
 */

// When FastAPI serves this folder, API routes are on the same origin. When a
// beginner runs the frontend with VS Code Live Server (usually port 5500), we
// automatically call the separately running FastAPI server on port 8000.
const configuredApiUrl = document
  .querySelector('meta[name="api-base-url"]')
  ?.getAttribute("content")
  ?.trim();
const standaloneLocalPorts = new Set(["3000", "5500", "5501"]);
const selectedApiUrl =
  configuredApiUrl ||
  (standaloneLocalPorts.has(window.location.port)
    ? "http://localhost:8000/api"
    : `${window.location.origin}/api`);
const API_BASE_URL = (
  selectedApiUrl.startsWith("/")
    ? `${window.location.origin}${selectedApiUrl}`
    : selectedApiUrl
).replace(/\/$/, "");
const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");

// Point API documentation to the backend when frontend and API use different origins.
document.querySelector("#api-docs-link").href = `${API_ORIGIN}/docs`;

// Cache DOM elements once instead of repeatedly searching the document.
const uploadForm = document.querySelector("#upload-form");
const uploadButton = document.querySelector("#upload-button");
const fileInput = document.querySelector("#file");
const fileLabel = document.querySelector("#file-label");
const searchForm = document.querySelector("#search-form");
const semesterFilter = document.querySelector("#search-semester");
const branchFilter = document.querySelector("#search-branch");
const courseCodeFilter = document.querySelector("#search-course-code");
const papersList = document.querySelector("#papers-list");
const resultsSummary = document.querySelector("#results-summary");
const paperCount = document.querySelector("#paper-count");
const downloadCount = document.querySelector("#download-count");
const apiStatus = document.querySelector("#api-status");
const toast = document.querySelector("#toast");

// Dark mode elements
const darkModeToggle = document.querySelector("#dark-mode-toggle");
const iconSun = document.querySelector("#icon-sun");
const iconMoon = document.querySelector("#icon-moon");

// PDF Viewer modal elements
const pdfViewerModal = document.querySelector("#pdf-viewer-modal");
const pdfViewerTitle = document.querySelector("#pdf-viewer-title");
const pdfViewerIframe = document.querySelector("#pdf-viewer-iframe");
const pdfViewerClose = document.querySelector("#pdf-viewer-close");

// Course Hub elements
const courseHub = document.querySelector("#course-hub");
const courseHubTitle = document.querySelector("#course-hub-title");
const resourcesList = document.querySelector("#resources-list");
const resourceForm = document.querySelector("#resource-form");
const resourceSubmit = document.querySelector("#resource-submit");
const resourceDescription = document.querySelector("#resource-description");
const resourceUrl = document.querySelector("#resource-url");

// Report modal elements
const reportModal = document.querySelector("#report-modal");
const reportForm = document.querySelector("#report-form");
const reportModalClose = document.querySelector("#report-modal-close");
const reportCancel = document.querySelector("#report-cancel");
const reportSubmit = document.querySelector("#report-submit");
const reportReason = document.querySelector("#report-reason");
const reportModalPaperTitle = document.querySelector("#report-modal-paper-title");

let toastTimer;
let searchTimer;
let currentReportPaperId = null;

// ── Dark Mode Logic ──────────────────────────────────────────────────────────

function applyTheme(isDark) {
  if (isDark) {
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark-bg");
    if (iconSun && iconMoon) {
      iconSun.classList.remove("hidden");
      iconMoon.classList.add("hidden");
    }
  } else {
    document.documentElement.classList.remove("dark");
    document.body.classList.remove("dark-bg");
    if (iconSun && iconMoon) {
      iconSun.classList.add("hidden");
      iconMoon.classList.remove("hidden");
    }
  }
}

const savedTheme = localStorage.getItem("papervault-theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
applyTheme(savedTheme === "dark" || (!savedTheme && prefersDark));

if (darkModeToggle) {
  darkModeToggle.addEventListener("click", () => {
    const isNowDark = !document.documentElement.classList.contains("dark");
    applyTheme(isNowDark);
    localStorage.setItem("papervault-theme", isNowDark ? "dark" : "light");
  });
}

/** Convert FastAPI error bodies into one friendly message. */
function getErrorMessage(payload, fallback = "Something went wrong. Please try again.") {
  if (!payload) return fallback;
  if (typeof payload.detail === "string") return payload.detail;
  if (Array.isArray(payload.detail)) {
    return payload.detail.map((error) => error.msg).join(" ");
  }
  return fallback;
}

/** Fetch JSON and throw an Error for every non-2xx HTTP response. */
async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    // A proxy or server can occasionally return a non-JSON error page.
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `Request failed (${response.status}).`));
  }
  return payload;
}

/** Display a short success/error notification without blocking the page. */
function showToast(message, type = "success") {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = [
    "pointer-events-none fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-2xl",
    type === "error" ? "bg-red-700" : "bg-ink dark:bg-[#1a2a23] dark:border dark:border-white/10",
  ].join(" ");

  toastTimer = window.setTimeout(() => toast.classList.add("hidden"), 4500);
}

/** Create a DOM element with classes and text (textContent prevents XSS). */
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Make relative /uploads URLs work with both local and remote backends. */
function absoluteFileUrl(fileUrl) {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  return new URL(fileUrl, `${API_ORIGIN}/`).href;
}

// ── PDF Viewer Modal ────────────────────────────────────────────────────────

function openPdfViewer(url, title) {
  if (!pdfViewerModal || !pdfViewerIframe) return;
  pdfViewerTitle.textContent = title || "PDF Document";
  pdfViewerIframe.src = absoluteFileUrl(url);
  pdfViewerModal.classList.remove("hidden");
  pdfViewerModal.classList.add("flex");
}

function closePdfViewer() {
  if (!pdfViewerModal || !pdfViewerIframe) return;
  pdfViewerModal.classList.add("hidden");
  pdfViewerModal.classList.remove("flex");
  pdfViewerIframe.src = "";
}

if (pdfViewerClose) {
  pdfViewerClose.addEventListener("click", closePdfViewer);
}

if (pdfViewerModal) {
  pdfViewerModal.addEventListener("click", (e) => {
    if (e.target === pdfViewerModal) closePdfViewer();
  });
}

// ── Report Modal helpers ────────────────────────────────────────────────────

function openReportModal(paperId, paperTitle) {
  currentReportPaperId = paperId;
  reportModalPaperTitle.textContent = paperTitle;
  reportForm.reset();
  reportReason.value = "";
  reportModal.classList.remove("hidden");
  reportModal.classList.add("flex");
  // Focus the first radio for keyboard users
  const firstRadio = reportForm.querySelector('input[name="report-preset"]');
  if (firstRadio) firstRadio.focus();
}

function closeReportModal() {
  currentReportPaperId = null;
  reportModal.classList.add("hidden");
  reportModal.classList.remove("flex");
}

reportModalClose.addEventListener("click", closeReportModal);
reportCancel.addEventListener("click", closeReportModal);

// Close on backdrop click
reportModal.addEventListener("click", (e) => {
  if (e.target === reportModal) closeReportModal();
});

// Close modal on Escape key (both report and PDF viewer)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (reportModal && !reportModal.classList.contains("hidden")) {
      closeReportModal();
    }
    if (pdfViewerModal && !pdfViewerModal.classList.contains("hidden")) {
      closePdfViewer();
    }
  }
});

/** Build one safe paper card using DOM methods rather than innerHTML. */
function createPaperCard(paper, index) {
  const article = element(
    "article",
    "paper-card group rounded-2xl border border-ink/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-forest/25 hover:shadow-card sm:p-6 dark:border-white/10 dark:bg-[#1a2a23] dark:hover:border-mint/30"
  );
  article.style.animationDelay = `${Math.min(index * 45, 300)}ms`;

  const layout = element("div", "flex items-start gap-4");
  const icon = element(
    "div",
    "grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mint text-forest dark:bg-mint/20 dark:text-mint"
  );
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "PDF";
  icon.classList.add("text-[10px]", "font-extrabold", "tracking-wider");

  const content = element("div", "min-w-0 flex-1");
  const topRow = element("div", "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between");
  const headingGroup = element("div", "min-w-0");
  const badges = element("div", "mb-2 flex flex-wrap items-center gap-2");
  badges.append(
    element("span", "rounded-md bg-forest px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white dark:bg-forest/80", paper.course_code),
    element("span", "rounded-md bg-paper px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink/50 dark:bg-white/10 dark:text-white/60", paper.exam_type)
  );

  const title = element(
    "h3",
    "truncate font-display text-lg font-extrabold tracking-tight text-ink dark:text-white",
    paper.title
  );
  title.title = paper.title;
  headingGroup.append(badges, title);

  // View PDF Button
  const viewButton = element(
    "button",
    "view-button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-ink/15 bg-paper/80 px-3 py-2.5 text-xs font-extrabold text-ink transition hover:border-forest hover:bg-forest hover:text-white disabled:cursor-wait disabled:opacity-60 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:border-mint dark:hover:bg-mint dark:hover:text-ink"
  );
  viewButton.type = "button";
  viewButton.dataset.viewUrl = paper.file_url;
  viewButton.dataset.viewTitle = paper.title;
  viewButton.setAttribute("aria-label", `View ${paper.title}`);
  viewButton.innerHTML = `<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg> View`;

  // Download PDF Button
  const downloadButton = element(
    "button",
    "download-button inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-forest/20 bg-mint/60 px-4 py-2.5 text-xs font-extrabold text-forest transition hover:border-forest hover:bg-forest hover:text-white disabled:cursor-wait disabled:opacity-60 dark:border-mint/30 dark:bg-mint/15 dark:text-mint dark:hover:bg-mint dark:hover:text-ink",
    "Download PDF"
  );
  downloadButton.type = "button";
  downloadButton.dataset.downloadId = String(paper.id);
  downloadButton.setAttribute("aria-label", `Download ${paper.title}`);

  // Report button
  const reportButton = element(
    "button",
    "report-button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-extrabold text-amber-700 transition hover:border-red-400 hover:bg-red-500 hover:text-white disabled:cursor-wait disabled:opacity-60 dark:border-amber-400/20 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-red-600 dark:hover:text-white"
  );
  reportButton.type = "button";
  reportButton.dataset.reportId = String(paper.id);
  reportButton.dataset.reportTitle = paper.title;
  reportButton.setAttribute("aria-label", `Report ${paper.title}`);
  reportButton.innerHTML = `<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Report`;

  // Show report count badge if there are reports
  if (paper.report_count > 0) {
    const reportBadge = element(
      "span",
      "ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-200 px-1.5 text-[10px] font-extrabold text-amber-800 dark:bg-amber-400/30 dark:text-amber-300",
      String(paper.report_count)
    );
    reportButton.append(reportBadge);
  }

  const actions = element("div", "flex shrink-0 flex-wrap items-center gap-2");
  actions.append(viewButton, downloadButton, reportButton);
  topRow.append(headingGroup, actions);

  const details = element("div", "mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink/5 pt-4 text-xs font-medium text-ink/45 dark:border-white/5 dark:text-white/40");
  details.append(
    element("span", "", `Semester ${paper.semester}`),
    element("span", "", paper.branch),
    element("span", "", `${paper.download_count.toLocaleString()} download${paper.download_count === 1 ? "" : "s"}`)
  );

  content.append(topRow, details);
  layout.append(icon, content);
  article.append(layout);
  return article;
}

// ── Course Hub helpers ────────────────────────────────────────────────────────────

/** Build a single safe resource card using DOM methods (no innerHTML). */
function createResourceCard(resource) {
  const card = element(
    "div",
    "paper-card rounded-2xl border border-ink/10 bg-paper/70 p-4 flex items-start gap-4 dark:border-white/10 dark:bg-white/5"
  );

  // Icon
  const iconWrap = element(
    "div",
    "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint text-forest dark:bg-mint/20 dark:text-mint"
  );
  iconWrap.setAttribute("aria-hidden", "true");
  iconWrap.innerHTML = resource.url
    ? `<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`
    : `<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke="currentColor" stroke-width="1.8"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.8"/></svg>`;

  // Body
  const body = element("div", "min-w-0 flex-1");
  const desc = element(
    "p",
    "text-sm font-semibold text-ink leading-snug dark:text-white/90",
    resource.description
  );
  body.append(desc);

  if (resource.url) {
    const link = document.createElement("a");
    link.href = resource.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className =
      "mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-forest/10 px-2.5 py-1 text-xs font-bold text-forest transition hover:bg-forest hover:text-white dark:bg-mint/10 dark:text-mint dark:hover:bg-mint dark:hover:text-ink";
    link.textContent = "Open link →";
    body.append(link);
  }

  // Timestamp
  const ts = element(
    "p",
    "mt-2 text-[11px] text-ink/35 dark:text-white/35",
    new Date(resource.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })
  );
  body.append(ts);

  card.append(iconWrap, body);
  return card;
}

/** Fetch and render all resources for a given course_code. */
async function loadResources(courseCode) {
  resourcesList.replaceChildren();
  const spinner = element("p", "text-sm text-ink/40 italic dark:text-white/30", "Loading resources…");
  resourcesList.append(spinner);

  try {
    const resources = await requestJson(
      `${API_BASE_URL}/courses/${encodeURIComponent(courseCode.toUpperCase())}/resources`
    );

    resourcesList.replaceChildren();
    if (resources.length === 0) {
      resourcesList.append(
        element("p", "text-sm text-ink/40 italic dark:text-white/30", "No resources yet. Be the first to add one!")
      );
      return;
    }
    const frag = document.createDocumentFragment();
    resources.forEach((r) => frag.append(createResourceCard(r)));
    resourcesList.append(frag);
  } catch {
    resourcesList.replaceChildren(
      element("p", "text-sm text-red-600 dark:text-red-400", "Could not load resources.")
    );
  }
}

/** Render search results plus the summary statistics in the hero. */
function renderPapers(papers) {
  papersList.replaceChildren();
  papersList.setAttribute("aria-busy", "false");

  paperCount.textContent = papers.length.toLocaleString();
  const visibleDownloads = papers.reduce((sum, paper) => sum + paper.download_count, 0);
  downloadCount.textContent = visibleDownloads.toLocaleString();
  resultsSummary.textContent = `${papers.length} paper${papers.length === 1 ? "" : "s"} found`;

  if (papers.length === 0) {
    const empty = element("div", "rounded-3xl border border-dashed border-ink/15 bg-white/60 px-6 py-16 text-center dark:border-white/10 dark:bg-[#1a2a23]/60");
    empty.append(
      element("p", "font-display text-xl font-extrabold text-ink dark:text-white", "No papers found"),
      element("p", "mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/45 dark:text-white/40", "Try fewer filters, search part of a course code, or upload the first matching paper.")
    );
    papersList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  papers.forEach((paper, index) => fragment.append(createPaperCard(paper, index)));
  papersList.append(fragment);
}

/** Read filters, produce a query string, and refresh the results list. */
async function loadPapers() {
  papersList.setAttribute("aria-busy", "true");
  resultsSummary.textContent = "Searching…";

  const params = new URLSearchParams();
  if (semesterFilter.value) params.set("semester", semesterFilter.value);
  if (branchFilter.value) params.set("branch", branchFilter.value);
  if (courseCodeFilter.value.trim()) params.set("course_code", courseCodeFilter.value.trim());

  try {
    const papers = await requestJson(`${API_BASE_URL}/papers?${params.toString()}`);
    renderPapers(papers);
    setApiStatus(true);
  } catch (error) {
    setApiStatus(false);
    papersList.setAttribute("aria-busy", "false");
    papersList.replaceChildren();
    const errorPanel = element("div", "rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400", error.message);
    papersList.append(errorPanel);
    resultsSummary.textContent = "Could not load papers";
    paperCount.textContent = "—";
    downloadCount.textContent = "—";
  }
}

function setApiStatus(isOnline) {
  apiStatus.replaceChildren();
  const dot = element("span", `h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-red-500"}`);
  apiStatus.append(dot, document.createTextNode(isOnline ? "API online" : "API offline"));
}

// FormData automatically includes every named input, including the binary PDF.
// Do not manually set Content-Type: the browser adds the required boundary.
uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const selectedFile = fileInput.files[0];
  if (!selectedFile) {
    showToast("Please choose a PDF file.", "error");
    return;
  }
  if (selectedFile.size > 15 * 1024 * 1024) {
    showToast("The PDF must be 15 MB or smaller.", "error");
    return;
  }

  uploadButton.disabled = true;
  const originalText = uploadButton.querySelector("span").textContent;
  uploadButton.querySelector("span").textContent = "Uploading…";

  try {
    const createdPaper = await requestJson(`${API_BASE_URL}/papers`, {
      method: "POST",
      body: new FormData(uploadForm),
    });
    showToast(`"${createdPaper.title}" was added successfully.`);
    uploadForm.reset();
    fileLabel.textContent = "Choose a PDF file";
    await loadPapers();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    uploadButton.disabled = false;
    uploadButton.querySelector("span").textContent = originalText;
  }
});

// Show the selected filename immediately so users know their click worked.
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  fileLabel.textContent = file ? file.name : "Choose a PDF file";
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadPapers();
});
semesterFilter.addEventListener("change", loadPapers);
branchFilter.addEventListener("change", loadPapers);
courseCodeFilter.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    loadPapers();

    // Show / hide the Course Hub depending on whether a code is typed.
    const code = courseCodeFilter.value.trim();
    if (code) {
      courseHubTitle.textContent = code.toUpperCase();
      courseHub.classList.remove("hidden");
      loadResources(code);
    } else {
      courseHub.classList.add("hidden");
    }
  }, 350);
});

// View PDF button listener
papersList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view-url]");
  if (!button) return;

  openPdfViewer(button.dataset.viewUrl, button.dataset.viewTitle || "PDF Document");
});

// Event delegation handles every current and future download button with one
// listener. Tracking completes before the real file URL is opened.
papersList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-download-id]");
  if (!button) return;

  button.disabled = true;
  const previousLabel = button.textContent;
  button.textContent = "Preparing…";

  try {
    const result = await requestJson(
      `${API_BASE_URL}/papers/${button.dataset.downloadId}/download`
    );
    const link = document.createElement("a");
    link.href = absoluteFileUrl(result.file_url);
    link.target = "_blank";
    link.rel = "noopener";
    link.download = "";
    document.body.append(link);
    link.click();
    link.remove();
    await loadPapers();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = previousLabel;
  }
});

// Report button — opens modal to collect the reason.
papersList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-report-id]");
  if (!button) return;

  openReportModal(button.dataset.reportId, button.dataset.reportTitle || "this paper");
});

// Report form submission
reportForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentReportPaperId) return;

  // Determine the reason: use a selected preset, or fall back to the textarea
  const selectedPreset = reportForm.querySelector('input[name="report-preset"]:checked');
  let reason = "";
  if (selectedPreset && selectedPreset.value) {
    // Preset selected — optionally append extra detail from textarea
    reason = selectedPreset.value;
    const extra = reportReason.value.trim();
    if (extra) reason += ` — ${extra}`;
  } else {
    // "Other" or nothing selected — use the textarea content
    reason = reportReason.value.trim();
  }

  if (!reason) {
    showToast("Please select a reason or type one in the text box.", "error");
    return;
  }

  reportSubmit.disabled = true;
  reportSubmit.textContent = "Submitting…";

  try {
    const response = await fetch(`${API_BASE_URL}/papers/${currentReportPaperId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    const payload = await response.json().catch(() => null);

    if (response.status === 200 && payload?.detail) {
      // Paper was auto-deleted because threshold was reached
      showToast(payload.detail);
      closeReportModal();
      await loadPapers();
      return;
    }

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `Report failed (${response.status}).`));
    }

    showToast("Report submitted. Thank you for helping keep the archive clean.");
    closeReportModal();
    await loadPapers();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    reportSubmit.disabled = false;
    reportSubmit.innerHTML = `<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Submit Report`;
  }
});

// Initial page load: the result request also acts as a useful API health check.
loadPapers();

// ── Resource form submission ───────────────────────────────────────────────────────────
resourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const courseCode = courseCodeFilter.value.trim();
  if (!courseCode) {
    showToast("Search for a course code first.", "error");
    return;
  }

  const body = {
    description: resourceDescription.value.trim(),
    url: resourceUrl.value.trim() || null,
  };

  resourceSubmit.disabled = true;
  resourceSubmit.textContent = "Saving…";

  try {
    await requestJson(
      `${API_BASE_URL}/courses/${encodeURIComponent(courseCode.toUpperCase())}/resources`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    showToast("Resource added successfully!");
    resourceForm.reset();
    // Close the <details> accordion after submission
    resourceForm.closest("details").removeAttribute("open");
    await loadResources(courseCode);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    resourceSubmit.disabled = false;
    resourceSubmit.innerHTML = `<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Add Resource`;
  }
});
