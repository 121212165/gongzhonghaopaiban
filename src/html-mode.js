/**
 * HTML 编辑模式模块
 * 职责：Markdown/HTML 模式切换、HTML 源码编辑与渲染
 *
 * Issue #1: 用户可在 Markdown 和 HTML 视图间切换
 * HTML 模式 = 查看/编辑渲染后的 HTML 源码
 * 切换回 Markdown 时保留原内容，不破坏数据
 */

let currentMode = 'markdown'; // 'markdown' | 'html'
let editorElement = null;
let previewElement = null;
let modeChangeCallback = null;
let markdownContent = ''; // 切换前保存 Markdown 内容

/**
 * 初始化 HTML 编辑模式模块
 * - 绑定 mode-tabs 点击事件
 * - 设置 HTML 模式下的输入处理（预览实时更新）
 */
export function initHtmlMode(editorEl, previewEl) {
  editorElement = editorEl;
  previewElement = previewEl;

  // 在 HTML 模式下，用户编辑 HTML 源码时直接更新预览区
  // 使用 setTimeout(200) 确保在 app.js 的 debounced renderMarkdown(150ms) 之后执行
  if (editorElement) {
    editorElement.addEventListener('input', () => {
      if (currentMode === 'html' && previewElement) {
        setTimeout(() => {
          previewElement.innerHTML = editorElement.value;
        }, 200);
      }
    });
  }

  // 自动绑定编辑模式标签页
  const modeTabs = document.querySelector('.mode-tabs');
  if (modeTabs) {
    modeTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-editor-mode]');
      if (!tab) return;

      const targetMode = tab.dataset.editorMode;
      if (targetMode === currentMode) return;

      // 切换 active 状态
      modeTabs.querySelectorAll('[data-editor-mode]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // 执行模式切换
      if (targetMode === 'html') {
        // 切换到 HTML：保存 Markdown 原文，将预览区 HTML 填入编辑器
        markdownContent = editorElement.value;
        if (previewElement) {
          editorElement.value = previewElement.innerHTML;
        }
      } else {
        // 切换到 Markdown：恢复原文
        if (markdownContent) {
          editorElement.value = markdownContent;
        }
        markdownContent = '';
        // 触发重新渲染
        editorElement.dispatchEvent(new Event('input', { bubbles: true }));
      }

      currentMode = targetMode;
      if (modeChangeCallback) modeChangeCallback(currentMode);
    });
  }
}

/** 设置编辑模式 */
export function setMode(mode) {
  if (mode === currentMode || !editorElement) return;

  if (mode === 'html') {
    markdownContent = editorElement.value;
    if (previewElement) {
      editorElement.value = previewElement.innerHTML;
    }
  } else {
    if (markdownContent) {
      editorElement.value = markdownContent;
    }
    markdownContent = '';
  }

  currentMode = mode;
  if (modeChangeCallback) modeChangeCallback(mode);
}

/** 获取当前模式 */
export function getMode() {
  return currentMode;
}

/** 是否 HTML 模式 */
export function isHtmlMode() {
  return currentMode === 'html';
}

/** 注册模式变化回调 */
export function onModeChanged(callback) {
  modeChangeCallback = callback;
}
