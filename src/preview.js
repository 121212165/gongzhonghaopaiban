/**
 * 预览渲染模块
 * 职责：Markdown → HTML 渲染、滚动同步、预览模式管理
 */

let previewElement = null;
let syncRaf = null;
let currentMode = 'desktop';

/** 初始化预览 */
export function initPreview(previewEl) {
  previewElement = previewEl;
}

/** 渲染 Markdown 为 HTML（使用全局 marked 和 DOMPurify） */
export function renderMarkdown(text) {
  if (!previewElement) return '';
  const html = DOMPurify.sanitize(marked.parse(text));
  previewElement.innerHTML = html;
  return html;
}

/** 同步滚动 */
export function syncScroll(source, target) {
  if (syncRaf || !source || !target) return;
  syncRaf = requestAnimationFrame(() => {
    const sourceScrollable = source.scrollHeight - source.clientHeight;
    const targetScrollable = target.scrollHeight - target.clientHeight;
    if (sourceScrollable > 0) {
      const percentage = source.scrollTop / sourceScrollable;
      target.scrollTop = percentage * targetScrollable;
    }
    syncRaf = null;
  });
}

/** 设置预览模式（desktop/mobile） */
export function setPreviewMode(mode) {
  currentMode = mode;
  if (!previewElement) return;
  if (mode === 'mobile') {
    previewElement.style.maxWidth = '375px';
    previewElement.style.margin = '0 auto';
  } else {
    previewElement.style.maxWidth = '100%';
    previewElement.style.margin = '0';
  }
}

/** 获取当前预览模式 */
export function getPreviewMode() {
  return currentMode;
}
