/**
 * Toast 消息组件
 * 职责：非侵入式通知，替代 alert/confirm
 */

let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 2000;
      display: flex; flex-direction: column; gap: 8px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }
  return container;
}

/**
 * 显示 Toast 消息
 * @param {string} message - 消息内容
 * @param {'success'|'error'|'info'} type - 类型
 * @param {number} duration - 显示时间（毫秒）
 */
export function showToast(message, type = 'success', duration = 3000) {
  const c = ensureContainer();

  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    padding: 12px 24px; border-radius: 8px;
    background: ${type === 'error' ? '#ff3b30' : type === 'info' ? '#007aff' : '#4cd964'};
    color: #fff; font-size: 14px; line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    opacity: 0; transform: translateY(10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    pointer-events: auto;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  `;

  c.appendChild(toast);

  // 触发进入动画
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // 自动移除
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/** 显示错误 Toast */
export function showError(message) {
  showToast(message, 'error', 5000);
}

/** 显示成功 Toast */
export function showSuccess(message) {
  showToast(message, 'success', 3000);
}
