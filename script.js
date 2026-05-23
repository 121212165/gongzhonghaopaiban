const editor = document.getElementById('editor');
const htmlEditor = document.getElementById('htmlEditor');
const preview = document.getElementById('preview');
const articleTitle = document.getElementById('articleTitle');
const articleAuthor = document.getElementById('articleAuthor');

let currentTheme = 'simple';
let currentPreviewMode = 'desktop';
let currentInputMode = 'markdown';
let autoSaveTimer = null;
let currentHash = '';
let db = null;

const DB_NAME = 'WeChatEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeHtml(html) {
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(html, {
            ADD_TAGS: ['style'],
            ADD_ATTR: ['style', 'class', 'id', 'width', 'height', 'align', 'valign', 'bgcolor', 'background', 'border', 'cellpadding', 'cellspacing'],
            FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'select'],
            FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur']
        });
    }
    return html;
}

// ============================================================
// IndexedDB - Image Storage
// ============================================================

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

async function saveImageToDB(base64Data) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const image = {
            data: base64Data,
            timestamp: Date.now()
        };

        const request = store.add(image);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function uploadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const base64 = event.target.result;
                const id = await saveImageToDB(base64);
                resolve({ id, data: base64 });
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

// ============================================================
// Markdown Syntax Definitions
// ============================================================

const markdownSyntax = {
    bold: { prefix: '**', suffix: '**' },
    italic: { prefix: '*', suffix: '*' },
    underline: { prefix: '<u>', suffix: '</u>' },
    strikethrough: { prefix: '~~', suffix: '~~' },
    h1: { prefix: '# ', suffix: '' },
    h2: { prefix: '## ', suffix: '' },
    h3: { prefix: '### ', suffix: '' },
    h4: { prefix: '#### ', suffix: '' },
    ul: { prefix: '- ', suffix: '' },
    ol: { prefix: '1. ', suffix: '' },
    quote: { prefix: '> ', suffix: '' },
    code: { prefix: '```\n', suffix: '\n```' },
    inlineCode: { prefix: '`', suffix: '`' },
    link: { prefix: '[', suffix: '](url)' },
    image: { prefix: '![alt](', suffix: ')' },
    divider: { prefix: '\n---\n', suffix: '' }
};

marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: true,
    mangle: false
});

// ============================================================
// Rendering
// ============================================================

function renderPreview() {
    if (currentInputMode === 'markdown') {
        const markdown = editor.value;
        preview.innerHTML = sanitizeHtml(marked.parse(markdown));
    } else {
        preview.innerHTML = sanitizeHtml(htmlEditor.value);
    }
    updateStats();
}

function updateStats() {
    const source = currentInputMode === 'markdown' ? editor.value : htmlEditor.value;
    const text = source.replace(/<[^>]+>/g, '');
    const charCount = text.replace(/\s/g, '').length;
    const paragraphCount = currentInputMode === 'markdown'
        ? source.split('\n').filter(line => line.trim().length > 0).length
        : (source.match(/<\/?(p|div|h[1-6]|li|blockquote|tr)[^>]*>/gi) || []).length;
    const imageCount = currentInputMode === 'markdown'
        ? (source.match(/!\[.*?\]\(.*?\)/g) || []).length
        : (source.match(/<img\s/gi) || []).length;
    const headingCount = currentInputMode === 'markdown'
        ? (source.match(/^#{1,6}\s+/gm) || []).length
        : (source.match(/<h[1-6][^>]*>/gi) || []).length;
    const readTime = Math.ceil(charCount / 500);

    document.getElementById('charCount').textContent = charCount;
    document.getElementById('paragraphCount').textContent = paragraphCount;
    document.getElementById('imageCount').textContent = imageCount;
    document.getElementById('headingCount').textContent = headingCount;
    document.getElementById('readTime').textContent = `${readTime} 分钟`;
}

// ============================================================
// Input Mode Switching
// ============================================================

function switchInputMode(mode) {
    currentInputMode = mode;

    document.querySelectorAll('.input-mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.input-mode-btn[data-mode="${mode}"]`).classList.add('active');

    const mdWrapper = document.getElementById('markdownEditorWrapper');
    const htmlWrapper = document.getElementById('htmlEditorWrapper');
    const mdToolbar = document.getElementById('markdownToolbar');

    if (mode === 'markdown') {
        mdWrapper.classList.remove('hidden');
        htmlWrapper.classList.add('hidden');
        mdToolbar.style.display = 'flex';
        renderPreview();
    } else {
        mdWrapper.classList.add('hidden');
        htmlWrapper.classList.remove('hidden');
        mdToolbar.style.display = 'none';
        renderPreview();
    }

    localStorage.setItem('inputMode', mode);
}

// ============================================================
// Scroll Sync
// ============================================================

let isScrolling = false;
let scrollTimeout = null;

function syncScroll(source, target) {
    if (isScrolling) return;
    const maxScroll = source.scrollHeight - source.clientHeight;
    if (maxScroll <= 0) return;

    isScrolling = true;

    const percentage = source.scrollTop / maxScroll;
    target.scrollTop = percentage * (target.scrollHeight - target.clientHeight);

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        isScrolling = false;
    }, 50);
}

// ============================================================
// Markdown Toolbar Actions
// ============================================================

function wrapSelection(action) {
    const syntax = markdownSyntax[action];
    if (!syntax) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);

    if (action === 'link') {
        const url = prompt('请输入链接地址:', 'https://');
        if (url) {
            const newText = `[${selectedText || '链接文字'}](${url})`;
            editor.value = editor.value.substring(0, start) + newText + editor.value.substring(end);
        }
    } else if (action === 'image') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const result = await uploadImage(file);
                    const alt = prompt('请输入图片描述:', '图片');
                    const newText = `![${alt || '图片'}](${result.data})`;
                    editor.value = editor.value.substring(0, start) + newText + editor.value.substring(end);
                    renderPreview();
                    triggerAutoSave();
                } catch (error) {
                    showToast('图片上传失败: ' + error.message, 'error');
                }
            }
        };
        input.click();
    } else if (action === 'table') {
        const tableText = `\n| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 内容1 | 内容2 | 内容3 |\n| 内容4 | 内容5 | 内容6 |\n`;
        editor.value = editor.value.substring(0, start) + tableText + editor.value.substring(end);
    } else {
        const newText = syntax.prefix + selectedText + syntax.suffix;
        editor.value = editor.value.substring(0, start) + newText + editor.value.substring(end);
    }

    renderPreview();
    triggerAutoSave();
}

function handleToolbarClick(e) {
    const btn = e.target.closest('.toolbar-btn');
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === 'undo') {
        editor.focus();
        document.execCommand('undo');
    } else if (action === 'redo') {
        editor.focus();
        document.execCommand('redo');
    } else {
        wrapSelection(action);
    }
}

// ============================================================
// Theme & Preview Mode
// ============================================================

function handleThemeClick(e) {
    const btn = e.target.closest('.theme-btn');
    if (!btn) return;

    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentTheme = btn.dataset.theme;
    document.body.className = `theme-${currentTheme}`;

    localStorage.setItem('theme', currentTheme);
}

function handlePreviewModeClick(e) {
    const btn = e.target.closest('.preview-mode-btn');
    if (!btn) return;

    document.querySelectorAll('.preview-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentPreviewMode = btn.dataset.mode;

    if (currentPreviewMode === 'mobile') {
        preview.style.maxWidth = '375px';
        preview.style.margin = '0 auto';
    } else {
        preview.style.maxWidth = '100%';
        preview.style.margin = '0';
    }
}

// ============================================================
// Keyboard Shortcuts
// ============================================================

function handleKeyDown(e) {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
            case 'b':
                e.preventDefault();
                wrapSelection('bold');
                break;
            case 'i':
                e.preventDefault();
                wrapSelection('italic');
                break;
            case 'u':
                e.preventDefault();
                wrapSelection('underline');
                break;
            case 'k':
                e.preventDefault();
                wrapSelection('link');
                break;
            case '1':
                e.preventDefault();
                wrapSelection('h1');
                break;
            case '2':
                e.preventDefault();
                wrapSelection('h2');
                break;
            case '3':
                e.preventDefault();
                wrapSelection('h3');
                break;
            case '4':
                e.preventDefault();
                wrapSelection('h4');
                break;
        }
    }

    if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);

        if (e.shiftKey) {
            editor.value = editor.value.substring(0, start) + selectedText.replace(/^(\s*)/gm, (match, spaces) => spaces.slice(0, -2)) + editor.value.substring(end);
        } else {
            editor.value = editor.value.substring(0, start) + selectedText.replace(/^/gm, '  ') + editor.value.substring(end);
        }

        renderPreview();
    }
}

// ============================================================
// Paste Handling
// ============================================================

function handlePaste(e) {
    e.preventDefault();

    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let hasImage = false;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            hasImage = true;
            const blob = items[i].getAsFile();
            const reader = new FileReader();

            reader.onload = async function(event) {
                try {
                    const base64 = event.target.result;
                    await saveImageToDB(base64);
                    insertImage(base64);
                } catch (error) {
                    console.error('Failed to save image:', error);
                    insertImage(event.target.result);
                }
            };

            reader.readAsDataURL(blob);
            break;
        }
    }

    if (!hasImage) {
        const text = (e.clipboardData || e.originalEvent.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text);
    }
}

function insertImage(src) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const imageMarkdown = `![图片](${src})`;

    editor.value = editor.value.substring(0, start) + imageMarkdown + editor.value.substring(end);
    renderPreview();
    triggerAutoSave();
}

// ============================================================
// Auto-Save
// ============================================================

function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    document.getElementById('saveStatus').textContent = '保存中...';

    autoSaveTimer = setTimeout(() => {
        saveContent();
    }, 1000);
}

function saveContent() {
    const content = currentInputMode === 'markdown' ? editor.value : htmlEditor.value;
    const title = articleTitle.value;
    const author = articleAuthor.value;

    const hash = simpleHash(content + title + author + currentInputMode);

    if (hash !== currentHash) {
        localStorage.setItem('markdownContent', editor.value);
        localStorage.setItem('htmlContent', htmlEditor.value);
        localStorage.setItem('articleTitle', title);
        localStorage.setItem('articleAuthor', author);
        localStorage.setItem('contentHash', hash);

        currentHash = hash;
        document.getElementById('saveStatus').textContent = '已自动保存';
    } else {
        document.getElementById('saveStatus').textContent = '已自动保存';
    }
}

function loadContent() {
    const mdContent = localStorage.getItem('markdownContent');
    const htmlContent = localStorage.getItem('htmlContent');
    const title = localStorage.getItem('articleTitle');
    const author = localStorage.getItem('articleAuthor');
    const theme = localStorage.getItem('theme');
    const inputMode = localStorage.getItem('inputMode');

    if (mdContent) editor.value = mdContent;
    if (htmlContent) htmlEditor.value = htmlContent;
    if (title) articleTitle.value = title;
    if (author) articleAuthor.value = author;
    if (theme) {
        currentTheme = theme;
        document.body.className = `theme-${currentTheme}`;
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === theme) {
                btn.classList.add('active');
            }
        });
    }
    if (inputMode) {
        switchInputMode(inputMode);
    }

    currentHash = localStorage.getItem('contentHash') || '';
    renderPreview();
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

// ============================================================
// Version Management
// ============================================================

function saveVersion() {
    const versions = JSON.parse(localStorage.getItem('versions') || '[]');
    const version = {
        id: Date.now(),
        title: articleTitle.value || '未命名文章',
        content: currentInputMode === 'markdown' ? editor.value : htmlEditor.value,
        mode: currentInputMode,
        author: articleAuthor.value,
        timestamp: new Date().toLocaleString('zh-CN')
    };

    versions.unshift(version);
    if (versions.length > 10) versions.pop();

    localStorage.setItem('versions', JSON.stringify(versions));
    showToast('版本已保存');
}

function showVersions() {
    const versions = JSON.parse(localStorage.getItem('versions') || '[]');
    const versionList = document.getElementById('versionList');

    if (versions.length === 0) {
        versionList.innerHTML = '<p>暂无历史版本</p>';
    } else {
        versionList.innerHTML = versions.map(v => `
            <div class="version-item">
                <div class="version-title">${escapeHtml(v.title)}</div>
                <div class="version-time">${escapeHtml(v.timestamp)} · ${v.mode === 'html' ? 'HTML' : 'Markdown'}</div>
                <div class="version-actions">
                    <button class="version-restore" data-id="${v.id}">恢复</button>
                    <button class="version-delete" data-id="${v.id}">删除</button>
                </div>
            </div>
        `).join('');
    }

    document.getElementById('versionModal').classList.add('show');
}

function restoreVersion(id) {
    const versions = JSON.parse(localStorage.getItem('versions') || '[]');
    const version = versions.find(v => v.id === id);

    if (version) {
        if (confirm('确定要恢复此版本吗？当前内容将被覆盖。')) {
            const mode = version.mode || 'markdown';
            switchInputMode(mode);
            if (mode === 'markdown') {
                editor.value = version.content;
            } else {
                htmlEditor.value = version.content;
            }
            articleTitle.value = version.title;
            articleAuthor.value = version.author;
            renderPreview();
            triggerAutoSave();
            document.getElementById('versionModal').classList.remove('show');
        }
    }
}

function deleteVersion(id) {
    if (confirm('确定要删除此版本吗？')) {
        let versions = JSON.parse(localStorage.getItem('versions') || '[]');
        versions = versions.filter(v => v.id !== id);
        localStorage.setItem('versions', JSON.stringify(versions));
        showVersions();
    }
}

// ============================================================
// InlineStyleEngine - WeChat Compatible HTML
// ============================================================

const InlineStyleEngine = {
    getThemeStyles() {
        const cs = getComputedStyle(document.documentElement);
        return {
            primaryColor: cs.getPropertyValue('--primary-color').trim() || '#007aff',
            textColor: cs.getPropertyValue('--wechat-text-color').trim() || cs.getPropertyValue('--text-color').trim() || '#333',
            headingColor: cs.getPropertyValue('--wechat-heading-color').trim() || cs.getPropertyValue('--heading-color').trim() || '#1a1a1a',
            quoteBg: cs.getPropertyValue('--quote-bg').trim() || '#f8f9fa',
            quoteBorder: cs.getPropertyValue('--quote-border').trim() || '#007aff',
            quoteColor: cs.getPropertyValue('--quote-color').trim() || '#666',
            codeBg: cs.getPropertyValue('--code-bg').trim() || '#f5f5f5',
            codeColor: cs.getPropertyValue('--code-color').trim() || '#e83e8c',
            codeBlockBg: cs.getPropertyValue('--code-block-bg').trim() || '#282c34',
            codeBlockColor: cs.getPropertyValue('--code-block-color').trim() || '#abb2bf',
            linkColor: cs.getPropertyValue('--link-color').trim() || '#007aff',
            tableBorder: cs.getPropertyValue('--table-border').trim() || '#ddd',
            tableHeaderBg: cs.getPropertyValue('--table-header-bg').trim() || '#f5f5f5',
            dividerColor: cs.getPropertyValue('--divider-color').trim() || '#e0e0e0',
            textSecondary: cs.getPropertyValue('--text-secondary').trim() || '#666',
        };
    },

    buildWechatHTML(rawHtml) {
        const theme = this.getThemeStyles();

        // Parse HTML into a DOM tree
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');
        const body = doc.body;

        // Walk all elements and apply inline styles
        this.inlineStyles(body, theme);

        // Build the final self-contained HTML
        const title = articleTitle.value || '';
        const author = articleAuthor.value || '';

        let result = '';

        if (title) {
            result += `<h1 style="font-size: 22px; font-weight: bold; color: ${theme.headingColor}; margin: 0 0 16px 0; padding: 0; line-height: 1.4; text-align: left;">${this.escapeHtml(title)}</h1>`;
        }

        if (author) {
            result += `<p style="color: ${theme.textSecondary}; font-size: 14px; margin: 0 0 24px 0; padding: 0;">作者：${this.escapeHtml(author)}</p>`;
        }

        result += body.innerHTML;

        return result;
    },

    inlineStyles(element, theme) {
        const children = Array.from(element.children);

        for (const child of children) {
            const tag = child.tagName.toLowerCase();

            switch (tag) {
                case 'h1':
                    child.setAttribute('style', `font-size: 22px; font-weight: bold; color: ${theme.headingColor}; margin: 1.2em 0 0.6em 0; padding: 0; line-height: 1.4;`);
                    break;
                case 'h2':
                    child.setAttribute('style', `font-size: 20px; font-weight: bold; color: ${theme.headingColor}; margin: 1em 0 0.5em 0; padding: 0; line-height: 1.4;`);
                    break;
                case 'h3':
                    child.setAttribute('style', `font-size: 18px; font-weight: bold; color: ${theme.headingColor}; margin: 1em 0 0.5em 0; padding: 0; line-height: 1.4;`);
                    break;
                case 'h4':
                    child.setAttribute('style', `font-size: 16px; font-weight: bold; color: ${theme.headingColor}; margin: 0.8em 0 0.4em 0; padding: 0; line-height: 1.4;`);
                    break;
                case 'p':
                    child.setAttribute('style', `font-size: 16px; color: ${theme.textColor}; margin: 0 0 16px 0; padding: 0; line-height: 1.75; letter-spacing: 0.5px;`);
                    break;
                case 'strong':
                case 'b':
                    child.setAttribute('style', `font-weight: bold; color: ${theme.headingColor};`);
                    break;
                case 'em':
                case 'i':
                    child.setAttribute('style', `font-style: italic;`);
                    break;
                case 'u':
                    child.setAttribute('style', `text-decoration: underline;`);
                    break;
                case 's':
                case 'del':
                case 'strike':
                    child.setAttribute('style', `text-decoration: line-through; color: ${theme.textSecondary};`);
                    break;
                case 'a':
                    child.setAttribute('style', `color: ${theme.linkColor}; text-decoration: none; border-bottom: 1px solid ${theme.linkColor};`);
                    break;
                case 'blockquote':
                    child.setAttribute('style', `border-left: 4px solid ${theme.quoteBorder}; background: ${theme.quoteBg}; color: ${theme.quoteColor}; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; font-size: 15px; line-height: 1.6;`);
                    break;
                case 'ul':
                    child.setAttribute('style', `margin: 0 0 16px 0; padding-left: 2em; color: ${theme.textColor};`);
                    break;
                case 'ol':
                    child.setAttribute('style', `margin: 0 0 16px 0; padding-left: 2em; color: ${theme.textColor};`);
                    break;
                case 'li':
                    child.setAttribute('style', `margin-bottom: 8px; font-size: 16px; line-height: 1.75; color: ${theme.textColor};`);
                    break;
                case 'pre':
                    child.setAttribute('style', `background: ${theme.codeBlockBg}; color: ${theme.codeBlockColor}; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 16px 0; font-family: 'Menlo', 'Consolas', monospace; font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-all;`);
                    break;
                case 'code':
                    if (child.parentElement && child.parentElement.tagName.toLowerCase() === 'pre') {
                        child.setAttribute('style', `background: transparent; color: inherit; padding: 0; font-family: inherit; font-size: inherit;`);
                    } else {
                        child.setAttribute('style', `background: ${theme.codeBg}; color: ${theme.codeColor}; padding: 2px 6px; border-radius: 4px; font-family: 'Menlo', 'Consolas', monospace; font-size: 14px;`);
                    }
                    break;
                case 'img':
                    child.setAttribute('style', `max-width: 100%; height: auto; display: block; margin: 16px auto; border-radius: 4px;`);
                    break;
                case 'hr':
                    child.setAttribute('style', `border: none; border-top: 1px solid ${theme.dividerColor}; margin: 24px 0;`);
                    break;
                case 'table':
                    child.setAttribute('style', `width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 15px;`);
                    break;
                case 'thead':
                case 'tbody':
                    // no style needed
                    break;
                case 'tr':
                    child.setAttribute('style', `border-bottom: 1px solid ${theme.tableBorder};`);
                    break;
                case 'th':
                    child.setAttribute('style', `background: ${theme.tableHeaderBg}; font-weight: bold; padding: 10px 12px; border: 1px solid ${theme.tableBorder}; text-align: left; color: ${theme.headingColor};`);
                    break;
                case 'td':
                    child.setAttribute('style', `padding: 10px 12px; border: 1px solid ${theme.tableBorder}; color: ${theme.textColor};`);
                    break;
                case 'span':
                    // Preserve existing inline styles on spans
                    break;
                case 'div':
                case 'section':
                    child.setAttribute('style', `margin: 0; padding: 0;`);
                    break;
                default:
                    break;
            }

            // Recursively process children
            if (child.children && child.children.length > 0) {
                this.inlineStyles(child, theme);
            }
        }
    },

    escapeHtml
};

// ============================================================
// Export Functions
// ============================================================

function exportMarkdown() {
    const title = articleTitle.value || '未命名文章';
    const content = editor.value;

    const markdown = `# ${title}\n\n${articleAuthor.value ? `作者：${articleAuthor.value}\n\n` : ''}${content}`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportPdf() {
    const title = articleTitle.value || '未命名文章';
    const content = currentInputMode === 'markdown' ? editor.value : htmlEditor.value;
    const html = currentInputMode === 'markdown' ? marked.parse(content) : content;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <title>${escapeHtml(title)}</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 40px 20px;
                    line-height: 1.8;
                    color: #333;
                }
                h1, h2, h3, h4, h5, h6 {
                    margin-top: 1.5em;
                    margin-bottom: 0.5em;
                    color: #1a1a1a;
                }
                h1 { font-size: 2em; border-bottom: 2px solid #e0e0e0; padding-bottom: 0.3em; }
                p { margin: 1em 0; }
                code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
                pre { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
                pre code { background: none; padding: 0; }
                blockquote { border-left: 4px solid #007aff; padding: 12px 16px; margin: 1em 0; color: #666; background: #f8f9fa; }
                img { max-width: 100%; height: auto; display: block; margin: 20px auto; }
                table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
                th { background: #f4f4f4; }
                hr { border: none; border-top: 2px solid #e0e0e0; margin: 30px 0; }
                a { color: #007aff; text-decoration: none; }
            </style>
        </head>
        <body>
            <h1>${escapeHtml(title)}</h1>
            ${articleAuthor.value ? `<p style="color: #666; margin-bottom: 30px;">作者：${escapeHtml(articleAuthor.value)}</p>` : ''}
            ${html}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

/**
 * Copy WeChat-compatible HTML to clipboard.
 *
 * Uses Clipboard API write() to place both text/html and text/plain
 * on the clipboard. WeChat's editor reads text/html and preserves
 * inline styles, so the formatting is preserved when pasting.
 */
async function exportWechat() {
    // Get the rendered HTML from preview
    const previewHtml = preview.innerHTML;

    if (!previewHtml.trim()) {
        showToast('请先输入内容', 'error');
        return;
    }

    // Build WeChat-compatible HTML with all styles inlined
    const wechatHtml = InlineStyleEngine.buildWechatHTML(previewHtml);

    // Wrap in a section with max-width for WeChat reading experience
    const wrappedHtml = `<section style="max-width: 578px; margin: 0 auto; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;">${wechatHtml}</section>`;

    try {
        // Use Clipboard API to write HTML + plain text
        const htmlBlob = new Blob([wrappedHtml], { type: 'text/html' });
        const textBlob = new Blob([preview.textContent], { type: 'text/plain' });

        await navigator.clipboard.write([
            new ClipboardItem({
                'text/html': htmlBlob,
                'text/plain': textBlob
            })
        ]);

        showToast('已复制公众号格式，直接粘贴到公众号编辑器即可', 'success');
    } catch (err) {
        // Fallback: use a hidden contenteditable div to copy rich text
        try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = wrappedHtml;
            tempDiv.style.position = 'fixed';
            tempDiv.style.left = '0';
            tempDiv.style.top = '0';
            tempDiv.style.width = '0';
            tempDiv.style.height = '0';
            tempDiv.style.overflow = 'hidden';
            tempDiv.style.opacity = '0';
            tempDiv.style.pointerEvents = 'none';
            tempDiv.contentEditable = 'true';
            document.body.appendChild(tempDiv);

            const range = document.createRange();
            range.selectNodeContents(tempDiv);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            document.execCommand('copy');
            selection.removeAllRanges();
            document.body.removeChild(tempDiv);

            showToast('已复制公众号格式（兼容模式），直接粘贴到公众号编辑器即可', 'success');
        } catch (fallbackErr) {
            showToast('复制失败，请手动选择预览内容复制', 'error');
        }
    }
}

// ============================================================
// Toast Notification
// ============================================================

function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast' + (type ? ` ${type}` : '');

    // Force reflow for re-triggering animation
    void toast.offsetWidth;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============================================================
// Content Management
// ============================================================

function clearContent() {
    if (confirm('确定要清空所有内容吗？此操作不可撤销。')) {
        editor.value = '';
        htmlEditor.value = '';
        articleTitle.value = '';
        articleAuthor.value = '';
        renderPreview();
        triggerAutoSave();
    }
}

function resetTheme() {
    currentTheme = 'simple';
    document.body.className = 'theme-simple';
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === 'simple') {
            btn.classList.add('active');
        }
    });
    localStorage.setItem('theme', 'simple');
}

// ============================================================
// Event Listeners
// ============================================================

// Input mode toggle
document.querySelector('.input-mode-buttons').addEventListener('click', (e) => {
    const btn = e.target.closest('.input-mode-btn');
    if (!btn) return;
    switchInputMode(btn.dataset.mode);
});

// Markdown toolbar
document.querySelector('.toolbar').addEventListener('click', handleToolbarClick);
document.querySelector('.theme-buttons').addEventListener('click', handleThemeClick);
document.querySelector('.preview-mode-buttons').addEventListener('click', handlePreviewModeClick);

document.querySelector('.version-buttons').addEventListener('click', (e) => {
    if (e.target.id === 'saveVersion') saveVersion();
    if (e.target.id === 'showVersions') showVersions();
});
document.querySelector('.export-buttons').addEventListener('click', (e) => {
    if (e.target.id === 'exportMd') exportMarkdown();
    if (e.target.id === 'exportPdf') exportPdf();
    if (e.target.id === 'exportWechat') exportWechat();
});
document.querySelector('.action-buttons').addEventListener('click', (e) => {
    if (e.target.id === 'clearContent') clearContent();
    if (e.target.id === 'resetTheme') resetTheme();
});

// Modal
document.querySelector('.modal-close').addEventListener('click', () => {
    document.getElementById('versionModal').classList.remove('show');
});
document.getElementById('versionModal').addEventListener('click', (e) => {
    if (e.target.id === 'versionModal') {
        document.getElementById('versionModal').classList.remove('show');
    }
});
document.getElementById('versionList').addEventListener('click', (e) => {
    if (e.target.classList.contains('version-restore')) {
        restoreVersion(parseInt(e.target.dataset.id));
    }
    if (e.target.classList.contains('version-delete')) {
        deleteVersion(parseInt(e.target.dataset.id));
    }
});

// Editor events
editor.addEventListener('input', () => {
    renderPreview();
    triggerAutoSave();
});
editor.addEventListener('keydown', handleKeyDown);
editor.addEventListener('paste', handlePaste);

// HTML editor events - live rendering
htmlEditor.addEventListener('input', () => {
    renderPreview();
    triggerAutoSave();
});
// Allow native paste in HTML editor (don't intercept like Markdown editor)
htmlEditor.addEventListener('paste', () => {
    setTimeout(() => {
        renderPreview();
        triggerAutoSave();
    }, 10);
});

// Scroll sync
editor.addEventListener('scroll', () => syncScroll(editor, preview));
htmlEditor.addEventListener('scroll', () => syncScroll(htmlEditor, preview));
preview.addEventListener('scroll', () => {
    const activeEditor = currentInputMode === 'markdown' ? editor : htmlEditor;
    syncScroll(preview, activeEditor);
});

// Auto-save triggers
articleTitle.addEventListener('input', triggerAutoSave);
articleAuthor.addEventListener('input', triggerAutoSave);

// ============================================================
// Initialization
// ============================================================

initDB().then(() => {
    loadContent();
}).catch(error => {
    console.error('Failed to initialize database:', error);
    loadContent();
});
