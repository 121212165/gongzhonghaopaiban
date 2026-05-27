/**
 * 工具函数模块
 */

/** HTML 转义 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** 简单哈希（用于内容比对） */
export function simpleHash(str) {
  if (typeof str !== 'string') str = String(str);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}
