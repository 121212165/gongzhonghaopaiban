/**
 * 应用入口模块
 * 职责：初始化所有模块、事件绑定、自动保存、Toast
 */

import { initEditor, getValue, setValue, pushUndoState, undo, redo,
         wrapSelection, insertImage, handleKeyDown, handlePaste,
         updateStats, onChange } from './editor.js';
import { initPreview, renderMarkdown, syncScroll, setPreviewMode } from './preview.js';
import { initTheme, setTheme, resetTheme, getCurrentTheme, updateThemeButtons } from './theme.js';
import { initImageDB, saveImage, readFileAsDataURL, removeImage } from './image.js';
import { saveVersion, getVersions, findVersion, removeVersion } from './version.js';
import { exportMarkdown, exportPdf, exportWechat } from './export.js';
import { simpleHash } from './utils.js';

// ==================== DOM 引用 ====================
const $ = id => document.getElementById(id);
const editor = $('editor');
const preview = $('preview');
const articleTitle = $('articleTitle');
const articleAuthor = $('articleAuthor');
const saveStatus = $('saveStatus');

// ==================== 状态 ====================
let currentHash = '';
let autoSaveTimer = null;
let dbAvailable = true;
let renderTimeout = null;

// ==================== 初始化 ====================
async function init() {
  initEditor(editor);
  initPreview(preview);

  // 恢复主题
  initTheme();

  // 初始化 IndexedDB
  try {
    await initImageDB();
  } catch (error) {
    console.error('IndexedDB init failed:', error);
    dbAvailable = false;
  }

  // 加载已保存内容
  loadContent();

  // 绑定事件
  bindEvents();

  // 注册编辑器变化回调
  onChange(handleEditorChange);

  // 初始渲染
  renderMarkdown(getValue());
  updateStatsDisplay();
}

// ==================== 事件绑定 ====================
function bindEvents() {
  // 工具栏
  const toolbar = document.querySelector('.toolbar');
  if (toolbar) toolbar.addEventListener('click', handleToolbarClick);

  // 主题
  const themeButtons = document.querySelector('.theme-buttons');
  if (themeButtons) themeButtons.addEventListener('click', handleThemeClick);

  // 预览模式
  const previewBtns = document.querySelector('.preview-mode-buttons');
  if (previewBtns) previewBtns.addEventListener('click', handlePreviewModeClick);

  // 版本管理
  const versionBtns = document.querySelector('.version-buttons');
  if (versionBtns) versionBtns.addEventListener('click', handleVersionButtons);

  // 导出
  const exportBtns = document.querySelector('.export-buttons');
  if (exportBtns) exportBtns.addEventListener('click', handleExportButtons);

  // 操作
  const actionBtns = document.querySelector('.action-buttons');
  if (actionBtns) actionBtns.addEventListener('click', handleActionButtons);

  // 编辑器事件
  if (editor) {
    editor.addEventListener('input', handleEditorInput);
    editor.addEventListener('keydown', (e) => handleKeyDown(e));
    editor.addEventListener('paste', handlePasteEvent);
    editor.addEventListener('scroll', () => syncScroll(editor, preview));
  }
  if (preview) {
    preview.addEventListener('scroll', () => syncScroll(preview, editor));
  }

  // 文章信息
  if (articleTitle) articleTitle.addEventListener('input', triggerAutoSave);
  if (articleAuthor) articleAuthor.addEventListener('input', triggerAutoSave);

  // 模态框
  const modalClose = document.querySelector('.modal-close');
  if (modalClose) modalClose.addEventListener('click', () => $('versionModal')?.classList.remove('show'));

  const versionModal = $('versionModal');
  if (versionModal) {
    versionModal.addEventListener('click', (e) => {
      if (e.target.id === 'versionModal') versionModal.classList.remove('show');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $('versionModal')?.classList.remove('show');
  });

  const versionList = $('versionList');
  if (versionList) versionList.addEventListener('click', handleVersionListClick);
}

// ==================== 工具栏 ====================
function handleToolbarClick(e) {
  const btn = e.target.closest('.toolbar-btn');
  if (!btn) return;

  const action = btn.dataset.action;

  if (action === 'undo') {
    if (undo()) {
      renderMarkdown(getValue());
      triggerAutoSave();
    }
  } else if (action === 'redo') {
    if (redo()) {
      renderMarkdown(getValue());
      triggerAutoSave();
    }
  } else if (action === 'image') {
    // 图片上传通过文件对话框
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const base64 = await readFileAsDataURL(file);
        if (dbAvailable) await saveImage(base64);
        insertImage(base64);
        renderMarkdown(getValue());
        triggerAutoSave();
      } catch (error) {
        showToast('图片上传失败: ' + error.message, 'error');
      }
    };
    input.click();
  } else {
    wrapSelection(action);
    renderMarkdown(getValue());
    triggerAutoSave();
  }
}

// ==================== 主题 ====================
function handleThemeClick(e) {
  const btn = e.target.closest('.theme-btn');
  if (!btn) return;

  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  setTheme(btn.dataset.theme);
}

// ==================== 预览模式 ====================
function handlePreviewModeClick(e) {
  const btn = e.target.closest('.preview-mode-btn');
  if (!btn) return;

  document.querySelectorAll('.preview-mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  setPreviewMode(btn.dataset.mode);
}

// ==================== 编辑器输入 ====================
function handleEditorInput() {
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    renderMarkdown(getValue());
    updateStatsDisplay();
  }, 150);
  triggerAutoSave();
}

function handleEditorChange() {
  renderMarkdown(getValue());
  triggerAutoSave();
}

// ==================== 粘贴 ====================
function handlePasteEvent(e) {
  handlePaste(e, async (blob) => {
    try {
      const base64 = await readFileAsDataURL(blob);
      if (dbAvailable) await saveImage(base64);
      insertImage(base64);
    } catch (error) {
      console.error('Failed to save image:', error);
    }
  });
}

// ==================== 自动保存 ====================
function triggerAutoSave() {
  clearTimeout(autoSaveTimer);
  if (saveStatus) saveStatus.textContent = '保存中...';
  autoSaveTimer = setTimeout(saveContent, 1000);
}

function saveContent() {
  const content = getValue();
  const title = articleTitle ? articleTitle.value : '';
  const author = articleAuthor ? articleAuthor.value : '';
  const hash = simpleHash(content + title + author);

  if (hash !== currentHash) {
    try {
      localStorage.setItem('markdownContent', content);
      localStorage.setItem('articleTitle', title);
      localStorage.setItem('articleAuthor', author);
      localStorage.setItem('contentHash', hash);
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        showToast('存储空间已满，请删除旧版本或减少文章中的图片', 'error');
      }
    }
    currentHash = hash;
  }
  if (saveStatus) saveStatus.textContent = '已自动保存';
}

function loadContent() {
  const content = localStorage.getItem('markdownContent');
  const title = localStorage.getItem('articleTitle');
  const author = localStorage.getItem('articleAuthor');
  const savedTheme = localStorage.getItem('theme');

  if (content) setValue(content);
  if (title && articleTitle) articleTitle.value = title;
  if (author && articleAuthor) articleAuthor.value = author;
  if (savedTheme) {
    setTheme(savedTheme);
    updateThemeButtons(document.querySelector('.theme-buttons'));
  }

  currentHash = localStorage.getItem('contentHash') || '';
}

// ==================== 统计 ====================
function updateStatsDisplay() {
  const stats = updateStats();
  if (!stats) return;
  setText('charCount', stats.charCount);
  setText('paragraphCount', stats.paragraphCount);
  setText('imageCount', stats.imageCount);
  setText('headingCount', stats.headingCount);
  if ($('readTime')) $('readTime').textContent = `${stats.readTime} 分钟`;
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = String(value);
}

// ==================== 版本管理 ====================
function handleVersionButtons(e) {
  if (e.target.id === 'saveVersion') {
    try {
      saveVersion(articleTitle?.value, getValue(), articleAuthor?.value);
      showToast('版本已保存');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
  if (e.target.id === 'showVersions') openVersionModal();
}

function openVersionModal() {
  const versions = getVersions();
  const list = $('versionList');
  if (!list) return;

  if (versions.length === 0) {
    list.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">暂无历史版本</p>';
  } else {
    list.innerHTML = versions.map(v => {
      const safeTitle = String(v.title || '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
      return `<div class="version-item">
        <div class="version-title">${safeTitle}</div>
        <div class="version-time">${v.timestamp || ''}</div>
        <div class="version-actions">
          <button class="version-restore" data-id="${v.id}">恢复</button>
          <button class="version-delete" data-id="${v.id}">删除</button>
        </div>
      </div>`;
    }).join('');
  }
  const modal = $('versionModal');
  if (modal) modal.classList.add('show');
}

function handleVersionListClick(e) {
  const btn = e.target;
  if (!btn.dataset || !btn.dataset.id) return;
  const id = parseInt(btn.dataset.id);

  if (btn.classList.contains('version-restore')) {
    const version = findVersion(id);
    if (version && confirm('确定要恢复此版本吗？当前内容将被覆盖。')) {
      setValue(version.content || '');
      if (articleTitle) articleTitle.value = version.title || '';
      if (articleAuthor) articleAuthor.value = version.author || '';
      renderMarkdown(getValue());
      updateStatsDisplay();
      triggerAutoSave();
      $('versionModal')?.classList.remove('show');
    }
  }

  if (btn.classList.contains('version-delete')) {
    if (confirm('确定要删除此版本吗？')) {
      removeVersion(id);
      openVersionModal();
    }
  }
}

// ==================== 导出 ====================
function handleExportButtons(e) {
  const id = e.target.id;
  const title = articleTitle?.value || '未命名文章';
  const content = getValue();
  const author = articleAuthor?.value || '';

  if (id === 'exportMd') {
    exportMarkdown(title, content, author);
  } else if (id === 'exportPdf') {
    try {
      exportPdf(title, content, author);
    } catch (err) {
      showToast(err.message, 'error');
    }
  } else if (id === 'exportWechat') {
    exportWechat(title, content, author);
    showToast('已复制到剪贴板，可直接粘贴到公众号编辑器中');
  }
}

// ==================== 操作 ====================
function handleActionButtons(e) {
  if (e.target.id === 'clearContent') {
    if (confirm('确定要清空所有内容吗？此操作不可撤销。')) {
      setValue('');
      if (articleTitle) articleTitle.value = '';
      if (articleAuthor) articleAuthor.value = '';
      renderMarkdown(getValue());
      updateStatsDisplay();
      triggerAutoSave();
    }
  }
  if (e.target.id === 'resetTheme') {
    resetTheme();
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    const defaultBtn = document.querySelector('.theme-btn[data-theme="simple"]');
    if (defaultBtn) defaultBtn.classList.add('active');
    showToast('已重置为简约主题');
  }
}

// ==================== Toast 消息 ====================
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 2000;
    padding: 12px 24px; border-radius: 8px;
    background: ${type === 'error' ? '#ff3b30' : '#4cd964'};
    color: #fff; font-size: 14px; line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    opacity: 0; transform: translateY(10px);
    transition: opacity 0.3s, transform 0.3s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  `;
  document.body.appendChild(toast);

  // 触发动画
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==================== 启动 ====================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
