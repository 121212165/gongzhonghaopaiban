import { marked } from 'marked';
import DOMPurify from 'dompurify';

const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const copyBtn = document.getElementById('copyBtn');
const statsEl = document.getElementById('stats');

let renderTimer = null;

const THEMES = {
  default: { primary: '#007aff', bg: '#f5f5f5', surface: '#fff', text: '#333', text2: '#666', border: '#e0e0e0', heading: '#000', quoteBg: '#f8f9fa', quoteBorder: '#007aff', codeBg: '#f5f5f5', codeColor: '#e83e8c' },
  elegant: { primary: '#8e44ad', bg: '#fafafa', surface: '#fff', text: '#2c3e50', text2: '#7f8c8d', border: '#e0e0e0', heading: '#1a1a1a', quoteBg: '#f0f0f0', quoteBorder: '#8e44ad', codeBg: '#f0f0f0', codeColor: '#e83e8c' },
  modern: { primary: '#00d4ff', bg: '#fff', surface: '#fff', text: '#1a1a1a', text2: '#666', border: '#e0e0e0', heading: '#00d4ff', quoteBg: '#f0f7ff', quoteBorder: '#00d4ff', codeBg: '#f0f7ff', codeColor: '#e83e8c' },
  dark: { primary: '#4a9eff', bg: '#1a1a1a', surface: '#2d2d2d', text: '#e0e0e0', text2: '#a0a0a0', border: '#3d3d3d', heading: '#fff', quoteBg: '#2d2d2d', quoteBorder: '#4a9eff', codeBg: '#2d2d2d', codeColor: '#d4d4d4' },
  minimal: { primary: '#333', bg: '#fff', surface: '#fff', text: '#333', text2: '#666', border: '#ddd', heading: '#000', quoteBg: '#fff', quoteBorder: '#333', codeBg: '#f5f5f5', codeColor: '#e83e8c' }
};

function getTheme() {
  return THEMES[localStorage.getItem('theme') || 'default'] || THEMES.default;
}

function render() {
  const md = editor.value;
  preview.innerHTML = DOMPurify.sanitize(marked.parse(md));
  updateStats(md);
}

function updateStats(md) {
  const chars = md.replace(/\s/g, '').length;
  const paras = md.split('\n').filter(l => l.trim()).length;
  const imgs = (md.match(/!\[.*?\]\(.*?\)/g) || []).length;
  const heads = (md.match(/^#{1,6}\s+/gm) || []).length;
  const mins = Math.max(1, Math.ceil(chars / 500));
  statsEl.textContent = `${chars} 字 · ${paras} 段 · ${imgs} 图 · ${heads} 标题 · ${mins} 分钟阅读`;
}

function addInlineStyles(html) {
  const t = getTheme();
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  if (!root) return html;

  const styles = {
    h1: `font-size:24px;font-weight:bold;color:${t.heading};margin:1em 0 0.5em;`,
    h2: `font-size:20px;font-weight:bold;color:${t.heading};margin:1em 0 0.5em;`,
    h3: `font-size:18px;font-weight:bold;color:${t.heading};margin:1em 0 0.5em;`,
    h4: `font-size:16px;font-weight:bold;color:${t.heading};margin:1em 0 0.5em;`,
    p: `font-size:16px;line-height:1.8;color:${t.text};margin-bottom:1em;`,
    blockquote: `border-left:4px solid ${t.quoteBorder};padding:15px 20px;margin:20px 0;background:${t.quoteBg};color:${t.text2};border-radius:0 8px 8px 0;`,
    ul: 'padding-left:2em;margin-bottom:1em;',
    ol: 'padding-left:2em;margin-bottom:1em;',
    li: `margin-bottom:0.5em;line-height:1.8;color:${t.text};`,
    img: 'max-width:100%;height:auto;display:block;margin:20px auto;border-radius:8px;',
    a: `color:${t.primary};text-decoration:none;`,
    table: 'width:100%;border-collapse:collapse;margin:20px 0;',
    th: `border:1px solid ${t.border};padding:12px;text-align:left;background:${t.bg};font-weight:bold;`,
    td: `border:1px solid ${t.border};padding:12px;text-align:left;`,
    hr: `border:none;border-top:2px solid ${t.border};margin:30px 0;`
  };

  function walk(node) {
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'code' && node.parentElement?.tagName !== 'PRE') {
      node.setAttribute('style', `background:${t.codeBg};color:${t.codeColor};padding:2px 6px;border-radius:4px;font-family:Monaco,Menlo,Consolas,monospace;font-size:0.9em;`);
    } else if (styles[tag]) {
      node.setAttribute('style', styles[tag] + (node.getAttribute('style') || ''));
    }
    [...node.children].forEach(walk);
  }

  [...root.children].forEach(walk);
  return root.innerHTML;
}

function copyToClipboard() {
  const title = '';
  const content = editor.value;
  const html = DOMPurify.sanitize(marked.parse(content));
  const styled = addInlineStyles(html);
  const safe = DOMPurify.sanitize(styled, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','hr','ul','ol','li','blockquote','pre','code','table','thead','tbody','tr','th','td','a','img','em','strong','i','b','u','s','del','span','div','section'],
    ALLOWED_ATTR: ['style','href','target','rel','src','alt','title','width','height']
  });
  const wechatHtml = `<section style="max-width:677px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;"><section style="font-size:16px;line-height:1.8;color:#333;">${safe}</section></section>`;

  navigator.clipboard.writeText(wechatHtml).then(() => {
    showToast('已复制到剪贴板');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = wechatHtml;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('已复制到剪贴板');
  });
}

function showToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 24px;border-radius:8px;background:#4cd964;color:#fff;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.15);opacity:0;transition:opacity 0.3s';
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2000);
}

function applyTheme(theme) {
  document.body.className = theme === 'default' ? '' : `theme-${theme}`;
  localStorage.setItem('theme', theme);
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
}

editor.addEventListener('input', () => {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 150);
  localStorage.setItem('content', editor.value);
});

copyBtn.addEventListener('click', copyToClipboard);

document.querySelector('.theme-bar').addEventListener('click', e => {
  const btn = e.target.closest('.theme-btn');
  if (!btn) return;
  applyTheme(btn.dataset.theme);
});

const saved = localStorage.getItem('content');
if (saved) editor.value = saved;
const savedTheme = localStorage.getItem('theme');
if (savedTheme) applyTheme(savedTheme);
render();
