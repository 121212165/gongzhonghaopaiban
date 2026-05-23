const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const articleTitle = document.getElementById('articleTitle');
const articleAuthor = document.getElementById('articleAuthor');

let currentTheme = 'simple';
let currentPreviewMode = 'desktop';
let autoSaveTimer = null;
let currentHash = '';
let db = null;
let dbAvailable = true;

let undoStack = [];
let redoStack = [];
const MAX_UNDO = 50;

function addWechatInlineStyles(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="wx-root">${html}</div>`, 'text/html');
    const root = doc.getElementById('wx-root');
    if (!root) return html;

    function getNodeStyle(tag, node) {
        const styles = {
            h1: 'font-size: 24px; font-weight: bold; color: #1a1a1a; margin: 1em 0 0.5em;',
            h2: 'font-size: 20px; font-weight: bold; color: #1a1a1a; margin: 1em 0 0.5em;',
            h3: 'font-size: 18px; font-weight: bold; color: #1a1a1a; margin: 1em 0 0.5em;',
            h4: 'font-size: 16px; font-weight: bold; color: #1a1a1a; margin: 1em 0 0.5em;',
            h5: 'font-size: 15px; font-weight: bold; color: #1a1a1a; margin: 1em 0 0.5em;',
            h6: 'font-size: 14px; font-weight: bold; color: #1a1a1a; margin: 1em 0 0.5em;',
            p: 'font-size: 16px; line-height: 1.8; color: #333; margin-bottom: 1em;',
            blockquote: 'border-left: 4px solid #007aff; padding: 15px 20px; margin: 20px 0; background: #f8f9fa; color: #666; border-radius: 0 8px 8px 0;',
            ul: 'padding-left: 2em; margin-bottom: 1em;',
            ol: 'padding-left: 2em; margin-bottom: 1em;',
            li: 'margin-bottom: 0.5em; line-height: 1.8;',
            img: 'max-width: 100%; height: auto; display: block; margin: 20px auto; border-radius: 8px;',
            a: 'color: #007aff; text-decoration: none;',
            table: 'width: 100%; border-collapse: collapse; margin: 20px 0;',
            th: 'border: 1px solid #ddd; padding: 12px; text-align: left; background: #f5f5f5; font-weight: bold;',
            td: 'border: 1px solid #ddd; padding: 12px; text-align: left;',
            hr: 'border: none; border-top: 2px solid #e0e0e0; margin: 30px 0;',
        };
        if (tag === 'code' && node.parentElement && node.parentElement.tagName !== 'PRE') {
            return 'background: #f5f5f5; color: #e83e8c; padding: 2px 6px; border-radius: 4px; font-family: Monaco, Menlo, "Ubuntu Mono", Consolas, monospace; font-size: 0.9em;';
        }
        return styles[tag] || '';
    }

    function walk(node) {
        if (node.nodeType !== 1) return;
        const tag = node.tagName.toLowerCase();
        const addedStyle = getNodeStyle(tag, node);
        if (addedStyle) {
            const existing = node.getAttribute('style') || '';
            node.setAttribute('style', addedStyle + existing);
        }
        [...node.children].forEach(walk);
    }

    [...root.children].forEach(walk);
    return root.innerHTML;
}

const DB_NAME = 'WeChatEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

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
    if (!dbAvailable) throw new Error('IndexedDB unavailable');
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

async function getImagesFromDB() {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteImageFromDB(id) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function uploadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const base64 = event.target.result;
                if (!dbAvailable) {
                    resolve({ id: null, data: base64 });
                    return;
                }
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

let syncRaf = null;
function syncScroll(source, target) {
    if (syncRaf) return;
    syncRaf = requestAnimationFrame(() => {
        const percentage = source.scrollTop / (source.scrollHeight - source.clientHeight);
        target.scrollTop = percentage * (target.scrollHeight - target.clientHeight);
        syncRaf = null;
    });
}

function renderMarkdown() {
    const markdown = editor.value;
    const html = DOMPurify.sanitize(marked.parse(markdown));
    preview.innerHTML = html;
    updateStats();
}

function updateStats() {
    const markdown = editor.value;
    const lines = markdown.split('\n');
    
    const charCount = markdown.replace(/\s/g, '').length;
    const paragraphCount = lines.filter(line => line.trim().length > 0).length;
    const imageCount = (markdown.match(/!\[.*?\]\(.*?\)/g) || []).length;
    const headingCount = (markdown.match(/^#{1,6}\s+/gm) || []).length;
    const readTime = Math.ceil(charCount / 500);
    
    document.getElementById('charCount').textContent = charCount;
    document.getElementById('paragraphCount').textContent = paragraphCount;
    document.getElementById('imageCount').textContent = imageCount;
    document.getElementById('headingCount').textContent = headingCount;
    document.getElementById('readTime').textContent = `${readTime} 分钟`;
}

function pushUndoState() {
    undoStack.push({
        value: editor.value,
        selectionStart: editor.selectionStart,
        selectionEnd: editor.selectionEnd
    });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
}

function wrapSelection(action) {
    const syntax = markdownSyntax[action];
    if (!syntax) return;

    pushUndoState();
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
                    const newText = `![${alt || '图片'}](data:image;base64,${result.data.split(',')[1]})`;
                    editor.value = editor.value.substring(0, start) + newText + editor.value.substring(end);
                    renderMarkdown();
                    triggerAutoSave();
                } catch (error) {
                    alert('图片上传失败: ' + error.message);
                }
            }
        };
        input.click();
    } else if (action === 'table') {
        const tableText = `
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 内容1 | 内容2 | 内容3 |
| 内容4 | 内容5 | 内容6 |
`;
        editor.value = editor.value.substring(0, start) + tableText + editor.value.substring(end);
    } else {
        const newText = syntax.prefix + selectedText + syntax.suffix;
        editor.value = editor.value.substring(0, start) + newText + editor.value.substring(end);
    }
    
    renderMarkdown();
    triggerAutoSave();
}

function handleToolbarClick(e) {
    const btn = e.target.closest('.toolbar-btn');
    if (!btn) return;
    
    const action = btn.dataset.action;
    if (action === 'undo') {
        if (undoStack.length === 0) return;
        redoStack.push({
            value: editor.value,
            selectionStart: editor.selectionStart,
            selectionEnd: editor.selectionEnd
        });
        const state = undoStack.pop();
        editor.value = state.value;
        editor.setSelectionRange(state.selectionStart, state.selectionEnd);
        renderMarkdown();
        triggerAutoSave();
        return;
    } else if (action === 'redo') {
        if (redoStack.length === 0) return;
        undoStack.push({
            value: editor.value,
            selectionStart: editor.selectionStart,
            selectionEnd: editor.selectionEnd
        });
        const state = redoStack.pop();
        editor.value = state.value;
        editor.setSelectionRange(state.selectionStart, state.selectionEnd);
        renderMarkdown();
        triggerAutoSave();
        return;
    } else {
        wrapSelection(action);
    }
}

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
        pushUndoState();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);

        if (e.shiftKey) {
            const lines = selectedText.split('\n');
            const firstLineLeading = lines[0].length - lines[0].trimStart().length;
            const removedFromFirst = Math.min(2, firstLineLeading);
            let totalLengthChange = 0;
            const adjustedLines = lines.map(line => {
                const leading = line.length - line.trimStart().length;
                const toRemove = Math.min(2, leading);
                totalLengthChange -= toRemove;
                return line.substring(toRemove);
            });
            editor.value = editor.value.substring(0, start) + adjustedLines.join('\n') + editor.value.substring(end);
            const newStart = Math.max(start - removedFromFirst, 0);
            const newEnd = Math.max(end + totalLengthChange, newStart);
            editor.setSelectionRange(newStart, newEnd);
        } else {
            const lineCount = selectedText.split('\n').length;
            editor.value = editor.value.substring(0, start) + selectedText.replace(/^/gm, '  ') + editor.value.substring(end);
            editor.setSelectionRange(start + 2, end + 2 * lineCount);
        }

        renderMarkdown();
    }
}

function handlePaste(e) {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const items = clipboardData.items;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = items[i].getAsFile();
            const reader = new FileReader();

            reader.onload = async function(event) {
                try {
                    const base64 = event.target.result;
                    if (dbAvailable) {
                        await saveImageToDB(base64);
                    }
                    insertImage(base64);
                } catch (error) {
                    console.error('Failed to save image:', error);
                    insertImage(event.target.result);
                }
            };

            reader.readAsDataURL(blob);
            return;
        }
    }

    // No image found — let native paste handle text
}

function insertImage(src) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const imageMarkdown = `![图片](${src})`;
    
    editor.value = editor.value.substring(0, start) + imageMarkdown + editor.value.substring(end);
    renderMarkdown();
    triggerAutoSave();
}

function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    document.getElementById('saveStatus').textContent = '保存中...';
    
    autoSaveTimer = setTimeout(() => {
        saveContent();
    }, 1000);
}

function saveContent() {
    const content = editor.value;
    const title = articleTitle.value;
    const author = articleAuthor.value;
    
    const hash = simpleHash(content + title + author);
    
    if (hash !== currentHash) {
        try {
            localStorage.setItem('markdownContent', content);
            localStorage.setItem('articleTitle', title);
            localStorage.setItem('articleAuthor', author);
            localStorage.setItem('contentHash', hash);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                alert('存储空间已满，请删除旧版本或减少文章中的图片');
            }
        }

        currentHash = hash;
        document.getElementById('saveStatus').textContent = '已自动保存';
    } else {
        document.getElementById('saveStatus').textContent = '已自动保存';
    }
}

function loadContent() {
    const content = localStorage.getItem('markdownContent');
    const title = localStorage.getItem('articleTitle');
    const author = localStorage.getItem('articleAuthor');
    const theme = localStorage.getItem('theme');
    
    if (content) editor.value = content;
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
    
    currentHash = localStorage.getItem('contentHash') || '';
    renderMarkdown();
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

function saveVersion() {
    const versions = JSON.parse(localStorage.getItem('versions') || '[]');
    const version = {
        id: Date.now(),
        title: articleTitle.value || '未命名文章',
        content: editor.value,
        author: articleAuthor.value,
        timestamp: new Date().toLocaleString('zh-CN')
    };
    
    versions.unshift(version);
    if (versions.length > 10) versions.pop();

    try {
        localStorage.setItem('versions', JSON.stringify(versions));
        alert('版本已保存');
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            alert('存储空间已满，请删除旧版本或减少文章中的图片');
        }
    }
}

function showVersions() {
    const versions = JSON.parse(localStorage.getItem('versions') || '[]');
    const versionList = document.getElementById('versionList');
    
    if (versions.length === 0) {
        versionList.innerHTML = '<p>暂无历史版本</p>';
    } else {
        versionList.innerHTML = versions.map(v => {
            const safeTitle = v.title.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
            return `
            <div class="version-item">
                <div class="version-title">${safeTitle}</div>
                <div class="version-time">${v.timestamp}</div>
                <div class="version-actions">
                    <button class="version-restore" data-id="${v.id}">恢复</button>
                    <button class="version-delete" data-id="${v.id}">删除</button>
                </div>
            </div>
        `;
        }).join('');
    }
    
    document.getElementById('versionModal').classList.add('show');
}

function restoreVersion(id) {
    const versions = JSON.parse(localStorage.getItem('versions') || '[]');
    const version = versions.find(v => v.id === id);
    
    if (version) {
        if (confirm('确定要恢复此版本吗？当前内容将被覆盖。')) {
            editor.value = version.content;
            articleTitle.value = version.title;
            articleAuthor.value = version.author;
            renderMarkdown();
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

function exportMarkdown() {
    const title = articleTitle.value || '未命名文章';
    const content = editor.value;
    
    const markdown = `# ${title}\n\n${articleAuthor.value ? `作者：${articleAuthor.value}\n\n` : ''}${content}`;
    
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
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
    const content = editor.value;
    const html = DOMPurify.sanitize(marked.parse(content));
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('弹窗被浏览器拦截，请允许弹窗后重试');
        return;
    }
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
                h1 {
                    font-size: 2em;
                    border-bottom: 2px solid #e0e0e0;
                    padding-bottom: 0.3em;
                }
                p {
                    margin: 1em 0;
                }
                code {
                    background: #f4f4f4;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-family: 'Courier New', monospace;
                }
                pre {
                    background: #f4f4f4;
                    padding: 16px;
                    border-radius: 8px;
                    overflow-x: auto;
                }
                pre code {
                    background: none;
                    padding: 0;
                }
                blockquote {
                    border-left: 4px solid #007aff;
                    padding-left: 16px;
                    margin: 1em 0;
                    color: #666;
                    background: #f8f9fa;
                    padding: 12px 16px;
                }
                img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                    margin: 20px auto;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 20px 0;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px 12px;
                    text-align: left;
                }
                th {
                    background: #f4f4f4;
                }
                hr {
                    border: none;
                    border-top: 2px solid #e0e0e0;
                    margin: 30px 0;
                }
                a {
                    color: #007aff;
                    text-decoration: none;
                }
                a:hover {
                    text-decoration: underline;
                }
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

function exportWechat() {
    const title = articleTitle.value || '未命名文章';
    const content = editor.value;
    const html = addWechatInlineStyles(DOMPurify.sanitize(marked.parse(content)));

    const wechatHtml = `
        <section style="max-width: 677px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;">
            <h1 style="font-size: 22px; font-weight: bold; color: #1a1a1a; margin-bottom: 20px; text-align: left;">${escapeHtml(title)}</h1>
            ${articleAuthor.value ? `<p style="color: #888; font-size: 14px; margin-bottom: 30px;">作者：${escapeHtml(articleAuthor.value)}</p>` : ''}
            <section style="font-size: 16px; line-height: 1.8; color: #333;">
                ${html}
            </section>
        </section>
    `;
    
    navigator.clipboard.writeText(wechatHtml).then(() => {
        alert('已复制到剪贴板，可以直接粘贴到公众号编辑器中');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = wechatHtml;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('已复制到剪贴板，可以直接粘贴到公众号编辑器中');
    });
}

function clearContent() {
    if (confirm('确定要清空所有内容吗？此操作不可撤销。')) {
        editor.value = '';
        articleTitle.value = '';
        articleAuthor.value = '';
        renderMarkdown();
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
document.querySelector('.modal-close').addEventListener('click', () => {
    document.getElementById('versionModal').classList.remove('show');
});
document.getElementById('versionModal').addEventListener('click', (e) => {
    if (e.target.id === 'versionModal') {
        document.getElementById('versionModal').classList.remove('show');
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
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

let renderTimeout;
editor.addEventListener('input', () => {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(renderMarkdown, 150);
    triggerAutoSave();
});
editor.addEventListener('keydown', handleKeyDown);
editor.addEventListener('paste', handlePaste);
editor.addEventListener('scroll', () => syncScroll(editor, preview));
preview.addEventListener('scroll', () => syncScroll(preview, editor));
articleTitle.addEventListener('input', triggerAutoSave);
articleAuthor.addEventListener('input', triggerAutoSave);

initDB().then(() => {
    loadContent();
}).catch(error => {
    console.error('Failed to initialize database:', error);
    dbAvailable = false;
    loadContent();
});
