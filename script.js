const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const articleTitle = document.getElementById('articleTitle');
const articleAuthor = document.getElementById('articleAuthor');

let currentTheme = 'simple';
let currentPreviewMode = 'desktop';
let autoSaveTimer = null;
let currentHash = '';
let db = null;

const DB_NAME = 'WeChatEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';

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

let isScrolling = false;
let scrollTimeout = null;

function syncScroll(source, target) {
    if (isScrolling) return;
    
    isScrolling = true;
    
    const sourceScrollPercentage = source.scrollTop / (source.scrollHeight - source.clientHeight);
    target.scrollTop = sourceScrollPercentage * (target.scrollHeight - target.clientHeight);
    
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        isScrolling = false;
    }, 50);
}

function renderMarkdown() {
    const markdown = editor.value;
    const html = marked.parse(markdown);
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
        document.execCommand('undo');
    } else if (action === 'redo') {
        document.execCommand('redo');
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
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        
        if (e.shiftKey) {
            editor.value = editor.value.substring(0, start) + selectedText.replace(/^(\s*)/gm, (match, spaces) => spaces.slice(0, -2)) + editor.value.substring(end);
        } else {
            editor.value = editor.value.substring(0, start) + selectedText.replace(/^/gm, '  ') + editor.value.substring(end);
        }
        
        renderMarkdown();
    }
}

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
        localStorage.setItem('markdownContent', content);
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
    
    localStorage.setItem('versions', JSON.stringify(versions));
    alert('版本已保存');
}

function showVersions() {
    const versions = JSON.parse(localStorage.getItem('versions') || '[]');
    const versionList = document.getElementById('versionList');
    
    if (versions.length === 0) {
        versionList.innerHTML = '<p>暂无历史版本</p>';
    } else {
        versionList.innerHTML = versions.map(v => `
            <div class="version-item">
                <div class="version-title">${v.title}</div>
                <div class="version-time">${v.timestamp}</div>
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
    const content = editor.value;
    const html = marked.parse(content);
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
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
            <h1>${title}</h1>
            ${articleAuthor.value ? `<p style="color: #666; margin-bottom: 30px;">作者：${articleAuthor.value}</p>` : ''}
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
    const html = marked.parse(content);
    
    const wechatHtml = `
        <section style="max-width: 677px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;">
            <h1 style="font-size: 22px; font-weight: bold; color: #1a1a1a; margin-bottom: 20px; text-align: left;">${title}</h1>
            ${articleAuthor.value ? `<p style="color: #888; font-size: 14px; margin-bottom: 30px;">作者：${articleAuthor.value}</p>` : ''}
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
document.getElementById('versionList').addEventListener('click', (e) => {
    if (e.target.classList.contains('version-restore')) {
        restoreVersion(parseInt(e.target.dataset.id));
    }
    if (e.target.classList.contains('version-delete')) {
        deleteVersion(parseInt(e.target.dataset.id));
    }
});

editor.addEventListener('input', () => {
    renderMarkdown();
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
    loadContent();
});
