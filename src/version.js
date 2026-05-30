/**
 * 版本管理模块
 * 职责：保存/恢复/删除历史版本
 */

const STORAGE_KEY = 'versions';
const MAX_VERSIONS = 10;
let idCounter = 0;

/** 保存版本 */
export function saveVersion(title, content, author) {
  const versions = getVersions();
  const version = {
    id: Date.now() * 1000 + (idCounter++ % 1000),
    title: title || '未命名文章',
    content: content || '',
    author: author || '',
    timestamp: new Date().toLocaleString('zh-CN')
  };

  versions.unshift(version);
  if (versions.length > MAX_VERSIONS) versions.pop();

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      throw new Error('存储空间已满，请删除旧版本或减少文章中的图片');
    }
    throw e;
  }
}

/** 获取所有版本 */
export function getVersions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/** 查找版本 */
export function findVersion(id) {
  return getVersions().find(v => v.id === id) || null;
}

/** 删除版本 */
export function removeVersion(id) {
  let versions = getVersions();
  versions = versions.filter(v => v.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
  return versions;
}
