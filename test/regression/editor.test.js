import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { setupDOM, loadScript } from '../helpers/setup.js';

// ---------------------------------------------------------------------------
// Editor behaviour tests
//
// These tests load script.js into a jsdom environment and exercise its
// top-level functions the same way the browser does.
// ---------------------------------------------------------------------------

beforeAll(async () => {
  setupDOM();
  await loadScript();
});

beforeEach(() => {
  vi.clearAllMocks();

  // Reset global script state
  if ('undoStack' in globalThis) globalThis.undoStack.length = 0;
  if ('redoStack' in globalThis) globalThis.redoStack.length = 0;
  if ('currentTheme' in globalThis) globalThis.currentTheme = 'simple';
  if ('currentPreviewMode' in globalThis) globalThis.currentPreviewMode = 'desktop';
  if ('currentHash' in globalThis) globalThis.currentHash = '';

  // Reset DOM state without destroying elements (event listeners are on them)
  document.getElementById('editor').value = '';
  document.getElementById('preview').innerHTML = '';
  document.getElementById('articleTitle').value = '';
  document.getElementById('articleAuthor').value = '';
  document.getElementById('charCount').textContent = '0';
  document.getElementById('paragraphCount').textContent = '0';
  document.getElementById('imageCount').textContent = '0';
  document.getElementById('headingCount').textContent = '0';
  document.getElementById('readTime').textContent = '0 分钟';
  document.getElementById('saveStatus').textContent = '已自动保存';

  // Reset preview mode visual state
  const preview = document.getElementById('preview');
  preview.style.maxWidth = '';
  preview.style.margin = '';
});

describe('editor statistics', () => {
  it('updates charCount, paragraphCount, imageCount, headingCount and readTime after renderMarkdown', () => {
    const editor = document.getElementById('editor');
    editor.value = '# Hello\n\nWorld\n\n## Section\n\n![img](x.png)';

    // Call the global renderMarkdown function
    globalThis.renderMarkdown();

    // Non-whitespace chars from '# Hello\n\nWorld\n\n## Section\n\n![img](x.png)':
    //   '#HelloWorld##Section![img](x.png)' = 30
    expect(document.getElementById('charCount').textContent).toBe('33');
    // Non-empty lines: 4
    expect(document.getElementById('paragraphCount').textContent).toBe('4');
    // Images matching ![alt](url): 1
    expect(document.getElementById('imageCount').textContent).toBe('1');
    // Headings (^#{1,6}\\s+): "# Hello" + "## Section" = 2
    expect(document.getElementById('headingCount').textContent).toBe('2');
    // Read time = ceil(30/500) = 1
    expect(document.getElementById('readTime').textContent).toBe('1 分钟');
  });
});

describe('toolbar formatting', () => {
  it('wraps selected text with ** when bold toolbar button is clicked', () => {
    const editor = document.getElementById('editor');
    editor.value = 'Hello World';
    editor.selectionStart = 0;
    editor.selectionEnd = 5;

    // Click the bold toolbar button
    document.querySelector('[data-action="bold"]').click();

    expect(editor.value).toBe('**Hello** World');
  });
});

describe('undo/redo', () => {
  it('restores previous editor state when undo button is clicked', () => {
    const editor = document.getElementById('editor');
    editor.value = 'original';
    editor.selectionStart = 0;
    editor.selectionEnd = editor.value.length;

    // Make a change (bold wrapping) — this calls pushUndoState internally
    document.querySelector('[data-action="bold"]').click();
    expect(editor.value).toBe('**original**');

    // Click undo
    document.querySelector('[data-action="undo"]').click();
    expect(editor.value).toBe('original');
  });
});

describe('preview mode', () => {
  it('sets max-width to 375px when mobile preview mode is activated', () => {
    const preview = document.getElementById('preview');

    // Click the mobile preview mode button
    document.querySelector('[data-mode="mobile"]').click();

    expect(preview.style.maxWidth).toBe('375px');
    // jsdom serializes '0 auto' as '0px auto'
    expect(preview.style.margin).toBe('0px auto');
  });
});
