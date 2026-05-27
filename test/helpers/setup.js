import { vi, beforeEach } from 'vitest';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// Global mocks — plain objects/functions (not vi.fn where possible)
// to survive vi.clearAllMocks() in test files.
// ============================================================

// Marked
global.marked = {
  parse: vi.fn((text) => `<p>${text}</p>`),
  setOptions: vi.fn()
};

// DOMPurify
global.DOMPurify = {
  sanitize: vi.fn((html) => html)
};

// URL
if (typeof global.URL.createObjectURL !== 'function') {
  global.URL.createObjectURL = vi.fn(() => 'blob:mocked');
}
if (typeof global.URL.revokeObjectURL !== 'function') {
  global.URL.revokeObjectURL = vi.fn();
}

// window.open for exportPdf
global.open = vi.fn(() => ({
  document: { write: vi.fn(), close: vi.fn() },
  print: vi.fn()
}));

// IndexedDB — plain function so clearAllMocks doesn't break it
global.indexedDB = {
  open: () => {
    const request = {
      onerror: null,
      onsuccess: null,
      onupgradeneeded: null,
      result: null,
      error: new Error('IndexedDB not available in test'),
      readyState: 'done'
    };
    setTimeout(() => {
      if (typeof request.onerror === 'function') {
        request.onerror({ target: request });
      }
    }, 0);
    return request;
  }
};

// Clipboard
if (!('clipboard' in navigator)) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(() => Promise.resolve()) },
    writable: true,
    configurable: true
  });
}

// Dialogs — plain functions, not vi.fn, so clearAllMocks doesn't break them
global.confirm = () => true;
global.alert = () => {};
global.prompt = () => '';
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = () => {};
document.execCommand = () => true;

// ============================================================
// localStorage mock
// ============================================================
const storageStore = {};

function mockGetItem(key) { return key in storageStore ? storageStore[key] : null; }
function mockSetItem(key, value) { storageStore[key] = String(value); }
function mockRemoveItem(key) { delete storageStore[key]; }
function mockClear() { Object.keys(storageStore).forEach(k => delete storageStore[k]); }

const mockLocalStorage = {
  getItem: mockGetItem,
  setItem: mockSetItem,
  removeItem: mockRemoveItem,
  clear: mockClear,
  key: () => null,
  get length() { return Object.keys(storageStore).length; }
};

// Replace both window and globalThis localStorage
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true
});

// In jsdom, window !== globalThis, so also set on window
try { Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true
}); } catch (_) {}

export function getStorageStore() {
  return storageStore;
}

export function clearStorageStore() {
  Object.keys(storageStore).forEach(k => delete storageStore[k]);
}

// ============================================================
// DOM setup
// ============================================================
export function setupDOM() {
  document.body.innerHTML = `
    <textarea id="editor"></textarea>
    <div id="preview"></div>
    <input id="articleTitle" />
    <input id="articleAuthor" />
    <span id="charCount">0</span>
    <span id="paragraphCount">0</span>
    <span id="imageCount">0</span>
    <span id="headingCount">0</span>
    <span id="readTime">0 分钟</span>
    <span id="saveStatus">已自动保存</span>
    <div class="toolbar">
      <button type="button" class="toolbar-btn" data-action="bold"><strong>B</strong></button>
      <button type="button" class="toolbar-btn" data-action="italic"><em>I</em></button>
      <button type="button" class="toolbar-btn" data-action="strikethrough"><s>S</s></button>
      <button type="button" class="toolbar-btn" data-action="undo">Undo</button>
      <button type="button" class="toolbar-btn" data-action="redo">Redo</button>
    </div>
    <div class="theme-buttons">
      <button type="button" class="theme-btn active" data-theme="simple">简约</button>
      <button type="button" class="theme-btn" data-theme="dark">暗色</button>
    </div>
    <div class="preview-mode-buttons">
      <button class="preview-mode-btn active" data-mode="desktop">桌面端</button>
      <button class="preview-mode-btn" data-mode="mobile">手机端</button>
    </div>
    <div class="version-buttons">
      <button id="saveVersion">保存版本</button>
      <button id="showVersions">查看历史</button>
    </div>
    <div class="export-buttons">
      <button id="exportMd">导出 MD</button>
      <button id="exportPdf">导出 PDF</button>
      <button id="exportWechat">复制公众号</button>
    </div>
    <div class="action-buttons">
      <button id="clearContent">清空</button>
      <button id="resetTheme">重置主题</button>
    </div>
    <div class="modal" id="versionModal">
      <div id="versionList"></div>
    </div>
    <div class="modal-close"></div>
  `;
}

// ============================================================
// Load old script.js for regression tests
// ============================================================
const scriptPath = resolve(__dirname, '../../script.js');
let _scriptContent = null;

export async function loadScript() {
  if (!_scriptContent) {
    _scriptContent = fs.readFileSync(scriptPath, 'utf-8');
  }
  const code = _scriptContent.replace(/\b(const|let)\s+/g, 'var ');
  (0, eval)(code);
  // Wait for async initDB() error path to complete
  await new Promise((resolve) => setTimeout(resolve, 30));
}
