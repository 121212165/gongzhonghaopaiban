/**
 * 编辑器核心模块
 * 职责：Markdown 语法插入、undo/redo、快捷键、粘贴处理、统计
 */

// --- 私有状态 ---
let editorElement = null;
let undoStack = [];
let redoStack = [];
const MAX_UNDO = 50;
let onChangeCallback = null;

// --- Markdown 语法定义 ---
export const markdownSyntax = {
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

// --- 初始化 ---
export function initEditor(textarea) {
  editorElement = textarea;
}

// --- 读写 ---
export function getValue() {
  return editorElement ? editorElement.value : '';
}

export function setValue(text) {
  if (editorElement) editorElement.value = text;
}

// --- 变化回调 ---
export function onChange(callback) {
  onChangeCallback = callback;
}

export function notifyChange() {
  if (onChangeCallback) onChangeCallback();
}

// --- Undo/Redo ---
export function pushUndoState() {
  if (!editorElement) return;
  undoStack.push({
    value: editorElement.value,
    selectionStart: editorElement.selectionStart,
    selectionEnd: editorElement.selectionEnd
  });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
}

export function undo() {
  if (undoStack.length === 0 || !editorElement) return false;
  redoStack.push({
    value: editorElement.value,
    selectionStart: editorElement.selectionStart,
    selectionEnd: editorElement.selectionEnd
  });
  const state = undoStack.pop();
  editorElement.value = state.value;
  editorElement.setSelectionRange(state.selectionStart, state.selectionEnd);
  return true;
}

export function redo() {
  if (redoStack.length === 0 || !editorElement) return false;
  undoStack.push({
    value: editorElement.value,
    selectionStart: editorElement.selectionStart,
    selectionEnd: editorElement.selectionEnd
  });
  const state = redoStack.pop();
  editorElement.value = state.value;
  editorElement.setSelectionRange(state.selectionStart, state.selectionEnd);
  return true;
}

export function canUndo() { return undoStack.length > 0; }
export function canRedo() { return redoStack.length > 0; }

// --- 选中文本包装为 Markdown 语法 ---
export function wrapSelection(action) {
  if (!editorElement) return;
  const syntax = markdownSyntax[action];
  if (!syntax) return;

  pushUndoState();
  const start = editorElement.selectionStart;
  const end = editorElement.selectionEnd;
  const selectedText = editorElement.value.substring(start, end);

  if (action === 'link') {
    const url = prompt('请输入链接地址:', 'https://');
    if (url) {
      const newText = `[${selectedText || '链接文字'}](${url})`;
      editorElement.value = editorElement.value.substring(0, start) + newText + editorElement.value.substring(end);
    }
  } else if (action === 'image') {
    // Image handling is done through the paste/file upload flow, not here
    return;
  } else if (action === 'table') {
    const tableText = '\n| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 内容1 | 内容2 | 内容3 |\n| 内容4 | 内容5 | 内容6 |\n';
    editorElement.value = editorElement.value.substring(0, start) + tableText + editorElement.value.substring(end);
  } else {
    const newText = syntax.prefix + selectedText + syntax.suffix;
    editorElement.value = editorElement.value.substring(0, start) + newText + editorElement.value.substring(end);
  }

  notifyChange();
}

// --- 插入图片 ---
export function insertImage(src) {
  if (!editorElement) return;
  pushUndoState();
  const start = editorElement.selectionStart;
  const end = editorElement.selectionEnd;
  const imageMarkdown = `![图片](${src})`;
  editorElement.value = editorElement.value.substring(0, start) + imageMarkdown + editorElement.value.substring(end);
  notifyChange();
}

// --- 键盘快捷键 ---
export function handleKeyDown(e) {
  if (e.ctrlKey || e.metaKey) {
    const actionMap = {
      'b': 'bold', 'i': 'italic', 'u': 'underline', 'k': 'link',
      '1': 'h1', '2': 'h2', '3': 'h3', '4': 'h4'
    };
    const action = actionMap[e.key.toLowerCase()];
    if (action) {
      e.preventDefault();
      wrapSelection(action);
      return true;
    }
    return false;
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    pushUndoState();
    const start = editorElement.selectionStart;
    const end = editorElement.selectionEnd;
    const selectedText = editorElement.value.substring(start, end);

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
      editorElement.value = editorElement.value.substring(0, start) + adjustedLines.join('\n') + editorElement.value.substring(end);
      editorElement.setSelectionRange(Math.max(start - removedFromFirst, 0), Math.max(end + totalLengthChange, start));
    } else {
      const lineCount = selectedText.split('\n').length;
      editorElement.value = editorElement.value.substring(0, start) + selectedText.replace(/^/gm, '  ') + editorElement.value.substring(end);
      editorElement.setSelectionRange(start + 2, end + 2 * lineCount);
    }

    notifyChange();
    return true;
  }

  return false;
}

// --- 粘贴处理 ---
export function handlePaste(e, onImagePasted) {
  const clipboardData = e.clipboardData;
  if (!clipboardData) return false;

  const items = clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault();
      const blob = items[i].getAsFile();
      if (blob && onImagePasted) {
        onImagePasted(blob);
      }
      return true;
    }
  }
  return false;
}

// --- 统计更新（纯函数，返回数据对象）---
export function updateStats() {
  if (!editorElement) return null;
  const markdown = editorElement.value;
  const lines = markdown.split('\n');

  const charCount = markdown.replace(/\s/g, '').length;
  const paragraphCount = lines.filter(line => line.trim().length > 0).length;
  const imageCount = (markdown.match(/!\[.*?\]\(.*?\)/g) || []).length;
  const headingCount = (markdown.match(/^#{1,6}\s+/gm) || []).length;
  const readTime = Math.ceil(charCount / 500);

  return { charCount, paragraphCount, imageCount, headingCount, readTime };
}
