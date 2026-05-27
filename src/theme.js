/**
 * 主题系统模块
 * 职责：主题切换、持久化
 */

const STORAGE_KEY = 'theme';
const DEFAULT_THEME = 'simple';

let currentTheme = DEFAULT_THEME;
let onChangeCallback = null;

/** 可用主题列表 */
export const THEMES = [
  { id: 'simple', name: '简约主题' },
  { id: 'elegant', name: '优雅主题' },
  { id: 'modern', name: '现代主题' },
  { id: 'dark', name: '暗色主题' },
  { id: 'minimal', name: '极简主题' }
];

/** 初始化（从 localStorage 恢复） */
export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && THEMES.some(t => t.id === saved)) {
    currentTheme = saved;
    applyTheme(saved);
  }
  return currentTheme;
}

function applyTheme(themeId) {
  document.body.className = `theme-${themeId}`;
  localStorage.setItem(STORAGE_KEY, themeId);
}

/** 设置主题 */
export function setTheme(themeId) {
  if (!THEMES.some(t => t.id === themeId)) return false;
  currentTheme = themeId;
  applyTheme(themeId);
  if (onChangeCallback) onChangeCallback(themeId);
  return true;
}

/** 重置为默认主题 */
export function resetTheme() {
  return setTheme(DEFAULT_THEME);
}

/** 获取当前主题 */
export function getCurrentTheme() {
  return currentTheme;
}

/** 注册主题变化回调 */
export function onThemeChanged(callback) {
  onChangeCallback = callback;
}

/** 更新按钮 active 状态 */
export function updateThemeButtons(container) {
  if (!container) return;
  container.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === currentTheme);
  });
}
