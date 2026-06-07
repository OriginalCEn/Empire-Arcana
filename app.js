const BOOK_STORAGE_KEY = "empireArcana.reader.bookText";
const BOOKMARK_KEY = "empireArcana.reader.bookmark";
const SETTINGS_KEY = "empireArcana.reader.settings";

const elements = {
  bookTitle: document.querySelector("#bookTitle"),
  chapterKicker: document.querySelector("#chapterKicker"),
  chapterNav: document.querySelector("#chapterNav"),
  chapterSelect: document.querySelector("#chapterSelect"),
  chapterCount: document.querySelector("#chapterCount"),
  chapterTitle: document.querySelector("#chapterTitle"),
  chapterBody: document.querySelector("#chapterBody"),
  progressBar: document.querySelector("#progressBar"),
  statusLine: document.querySelector("#statusLine"),
  prevChapter: document.querySelector("#prevChapter"),
  nextChapter: document.querySelector("#nextChapter"),
  saveBookmark: document.querySelector("#saveBookmark"),
  resumeBookmark: document.querySelector("#resumeBookmark"),
  decreaseFont: document.querySelector("#decreaseFont"),
  increaseFont: document.querySelector("#increaseFont"),
  importBook: document.querySelector("#importBook"),
  bookFile: document.querySelector("#bookFile")
};

const state = {
  title: "Empire Arcana",
  chapters: [],
  currentChapter: 0,
  settings: {
    fontSize: 20
  }
};

function normalizeText(text) {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function parseBook(rawText) {
  const text = normalizeText(rawText);
  const lines = text.split("\n");
  const chapterStarts = [];

  lines.forEach((line, index) => {
    if (/^Chapter\s+\d+\b/i.test(line.trim())) {
      chapterStarts.push(index);
    }
  });

  const firstChapterLine = chapterStarts[0] ?? 1;
  const title = lines
    .slice(0, firstChapterLine)
    .map((line) => line.trim())
    .find(Boolean) || "Empire Arcana";

  const chapters = chapterStarts.map((start, index) => {
    const end = chapterStarts[index + 1] ?? lines.length;
    const heading = lines[start].trim();
    const bodyText = lines
      .slice(start + 1, end)
      .join("\n")
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    return {
      title: heading.replace(/^Chapter\s+(\d+)\s+(.*)$/i, "Chapter $1: $2"),
      paragraphs: bodyText
    };
  });

  return { title, chapters };
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadBookText() {
  const imported = localStorage.getItem(BOOK_STORAGE_KEY);
  if (imported) return imported;

  if (window.EMPIRE_ARCANA_TEXT) {
    return window.EMPIRE_ARCANA_TEXT;
  }

  const response = await fetch("book.txt", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Book text could not be loaded.");
  }
  return response.text();
}

function loadSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (Number.isFinite(settings.fontSize)) {
      state.settings.fontSize = Math.min(24, Math.max(17, settings.fontSize));
    }
  } catch {
    localStorage.removeItem(SETTINGS_KEY);
  }
  applySettings();
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function applySettings() {
  document.documentElement.style.setProperty("--reader-font-size", `${state.settings.fontSize}px`);
}

function setStatus(message) {
  elements.statusLine.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    elements.statusLine.textContent = "";
  }, 2800);
}

function renderNavigation() {
  elements.chapterNav.innerHTML = "";
  elements.chapterSelect.innerHTML = "";

  state.chapters.forEach((chapter, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chapter-link";
    button.textContent = chapter.title;
    button.addEventListener("click", () => showChapter(index));
    elements.chapterNav.appendChild(button);

    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = chapter.title;
    elements.chapterSelect.appendChild(option);
  });
}

function renderChapter() {
  const chapter = state.chapters[state.currentChapter];
  if (!chapter) return;

  elements.bookTitle.textContent = state.title;
  elements.chapterKicker.textContent = `${state.currentChapter + 1} of ${state.chapters.length}`;
  elements.chapterCount.textContent = `Chapter ${state.currentChapter + 1} of ${state.chapters.length}`;
  elements.chapterTitle.textContent = chapter.title;
  elements.chapterSelect.value = String(state.currentChapter);
  elements.chapterBody.innerHTML = chapter.paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");

  document.querySelectorAll(".chapter-link").forEach((button, index) => {
    button.classList.toggle("active", index === state.currentChapter);
  });

  elements.prevChapter.disabled = state.currentChapter === 0;
  elements.nextChapter.disabled = state.currentChapter === state.chapters.length - 1;
  updateProgress();
}

function showChapter(index, scrollTop = true) {
  state.currentChapter = Math.min(Math.max(index, 0), state.chapters.length - 1);
  renderChapter();
  if (scrollTop) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function getScrollRatio() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  return Math.min(1, Math.max(0, window.scrollY / scrollable));
}

function updateProgress() {
  const chapterPart = state.chapters.length <= 1
    ? 0
    : state.currentChapter / state.chapters.length;
  const scrollPart = getScrollRatio() / Math.max(state.chapters.length, 1);
  const progress = Math.min(1, chapterPart + scrollPart);
  elements.progressBar.style.width = `${Math.round(progress * 1000) / 10}%`;
}

function saveBookmark() {
  const bookmark = {
    chapterIndex: state.currentChapter,
    scrollRatio: getScrollRatio(),
    chapterTitle: state.chapters[state.currentChapter]?.title || "",
    savedAt: new Date().toISOString()
  };
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmark));
  setStatus("Bookmark saved");
}

function getBookmark() {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARK_KEY) || "null");
  } catch {
    localStorage.removeItem(BOOKMARK_KEY);
    return null;
  }
}

function resumeBookmark() {
  const bookmark = getBookmark();
  if (!bookmark || !Number.isFinite(bookmark.chapterIndex)) {
    setStatus("No bookmark saved");
    return;
  }

  showChapter(bookmark.chapterIndex, false);
  requestAnimationFrame(() => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({
      top: Math.max(0, scrollable * (bookmark.scrollRatio || 0)),
      behavior: "smooth"
    });
    setStatus("Bookmark opened");
  });
}

function updateBookmarkButton() {
  const bookmark = getBookmark();
  elements.resumeBookmark.disabled = !bookmark;
}

function changeFontSize(delta) {
  state.settings.fontSize = Math.min(24, Math.max(17, state.settings.fontSize + delta));
  applySettings();
  saveSettings();
  updateProgress();
}

async function importBook(file) {
  if (!file) return;
  const text = await file.text();
  localStorage.setItem(BOOK_STORAGE_KEY, text);
  const parsed = parseBook(text);
  state.title = parsed.title;
  state.chapters = parsed.chapters;
  state.currentChapter = 0;
  renderNavigation();
  renderChapter();
  window.scrollTo({ top: 0 });
  setStatus("Book imported");
}

function bindEvents() {
  elements.prevChapter.addEventListener("click", () => showChapter(state.currentChapter - 1));
  elements.nextChapter.addEventListener("click", () => showChapter(state.currentChapter + 1));
  elements.chapterSelect.addEventListener("change", (event) => showChapter(Number(event.target.value)));
  elements.saveBookmark.addEventListener("click", () => {
    saveBookmark();
    updateBookmarkButton();
  });
  elements.resumeBookmark.addEventListener("click", resumeBookmark);
  elements.decreaseFont.addEventListener("click", () => changeFontSize(-1));
  elements.increaseFont.addEventListener("click", () => changeFontSize(1));
  elements.importBook.addEventListener("click", () => elements.bookFile.click());
  elements.bookFile.addEventListener("change", (event) => importBook(event.target.files[0]));

  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") showChapter(state.currentChapter - 1);
    if (event.key === "ArrowRight") showChapter(state.currentChapter + 1);
  });
}

async function init() {
  loadSettings();
  bindEvents();

  try {
    const text = await loadBookText();
    const parsed = parseBook(text);
    state.title = parsed.title;
    state.chapters = parsed.chapters;
    if (!state.chapters.length) {
      throw new Error("No chapters found.");
    }
    renderNavigation();
    renderChapter();
    updateBookmarkButton();
  } catch (error) {
    elements.chapterTitle.textContent = "Unable to load the book";
    elements.chapterBody.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

init();
