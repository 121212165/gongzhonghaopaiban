import { vi } from 'vitest';

// ============================================================
// Global mocks for jsdom environment
// ============================================================

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

// Clipboard
if (!('clipboard' in navigator)) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(() => Promise.resolve()) },
    writable: true,
    configurable: true
  });
}

// Dialogs
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

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true
});

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
