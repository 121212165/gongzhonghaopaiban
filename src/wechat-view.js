/**
 * 公众号视图预览模块
 * 职责：提供编辑器视图/公众号视图/手机视图三种预览模式
 */

export const VIEW_MODES = {
  EDITOR: 'editor',
  WECHAT: 'wechat',
  MOBILE: 'mobile'
};

let currentViewMode = VIEW_MODES.EDITOR;
let previewElement = null;

/**
 * 初始化公众号视图模块
 * - 自动绑定 .view-mode-buttons 点击事件
 */
export function initWechatView(previewEl) {
  previewElement = previewEl;

  // 自动绑定视图切换按钮
  const container = document.querySelector('.view-mode-buttons');
  if (container) {
    bindViewModeButtons(container);
  }
}

/** 设置视图模式 */
export function setViewMode(mode) {
  currentViewMode = mode;
  applyViewMode();
  return mode;
}

/** 获取当前视图 */
export function getViewMode() {
  return currentViewMode;
}

/** 应用视图样式 */
function applyViewMode() {
  if (!previewElement) return;

  // 移除所有视图相关类
  previewElement.classList.remove('view-editor', 'view-wechat', 'view-mobile');

  switch (currentViewMode) {
    case VIEW_MODES.EDITOR:
      previewElement.style.maxWidth = '';
      previewElement.style.margin = '';
      previewElement.style.background = '';
      previewElement.style.boxShadow = '';
      previewElement.classList.add('view-editor');
      break;

    case VIEW_MODES.WECHAT:
      previewElement.style.maxWidth = '677px';
      previewElement.style.margin = '20px auto';
      previewElement.style.background = '#fff';
      previewElement.style.boxShadow = '0 2px 20px rgba(0,0,0,0.08)';
      previewElement.classList.add('view-wechat');
      break;

    case VIEW_MODES.MOBILE:
      previewElement.style.maxWidth = '375px';
      previewElement.style.margin = '20px auto';
      previewElement.style.background = '#fff';
      previewElement.style.boxShadow = '0 0 0 2px #333, 0 4px 30px rgba(0,0,0,0.15)';
      previewElement.classList.add('view-mobile');
      break;
  }
}

/** 注册视图切换的 UI 事件 */
export function bindViewModeButtons(container) {
  if (!container) return;
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;

    container.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    setViewMode(btn.dataset.view);
  });
}
