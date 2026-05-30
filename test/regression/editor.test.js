import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupDOM } from '../helpers/setup.js';

// Mock modules that preview.js depends on
vi.mock('marked', () => ({
  marked: { parse: vi.fn((text) => `<p>${text}</p>`) }
}));
vi.mock('../../src/config/security.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
  PURIFY_CONFIG_STRICT: { ALLOWED_TAGS: [] }
}));

import { initEditor, getValue, setValue, wrapSelection,
         pushUndoState, undo, redo, updateStats } from '../../src/editor.js';
import { initPreview, setPreviewMode } from '../../src/preview.js';

// ---------------------------------------------------------------------------
// Editor behaviour tests — import src/ modules directly
// ---------------------------------------------------------------------------

let editor, preview;

beforeEach(() => {
  setupDOM();
  editor = document.getElementById('editor');
  preview = document.getElementById('preview');
  initEditor(editor);
  initPreview(preview);
});

describe('editor statistics', () => {
  it('computes charCount, paragraphCount, imageCount, headingCount and readTime', () => {
    editor.value = '# Hello\n\nWorld\n\n## Section\n\n![img](x.png)';

    const stats = updateStats();
    expect(stats.charCount).toBe(33);
    expect(stats.paragraphCount).toBe(4);
    expect(stats.imageCount).toBe(1);
    expect(stats.headingCount).toBe(2);
    expect(stats.readTime).toBe(1);
  });
});

describe('toolbar formatting', () => {
  it('wraps selected text with ** for bold', () => {
    editor.value = 'Hello World';
    editor.selectionStart = 0;
    editor.selectionEnd = 5;

    wrapSelection('bold');

    expect(editor.value).toBe('**Hello** World');
  });

  it('wraps selected text with * for italic', () => {
    editor.value = 'Hello World';
    editor.selectionStart = 0;
    editor.selectionEnd = 5;

    wrapSelection('italic');

    expect(editor.value).toBe('*Hello* World');
  });

  it('wraps selected text with ~~ for strikethrough', () => {
    editor.value = 'Hello World';
    editor.selectionStart = 0;
    editor.selectionEnd = 5;

    wrapSelection('strikethrough');

    expect(editor.value).toBe('~~Hello~~ World');
  });
});

describe('undo/redo', () => {
  it('restores previous editor state on undo', () => {
    editor.value = 'original';
    editor.selectionStart = 0;
    editor.selectionEnd = editor.value.length;

    wrapSelection('bold');
    expect(editor.value).toBe('**original**');

    undo();
    expect(editor.value).toBe('original');
  });

  it('re-applies undone state on redo', () => {
    editor.value = 'original';
    editor.selectionStart = 0;
    editor.selectionEnd = editor.value.length;

    wrapSelection('bold');
    expect(editor.value).toBe('**original**');

    undo();
    expect(editor.value).toBe('original');

    redo();
    expect(editor.value).toBe('**original**');
  });
});

describe('preview mode', () => {
  it('sets max-width to 375px when mobile preview mode is activated', () => {
    setPreviewMode('mobile');

    expect(preview.style.maxWidth).toBe('375px');
    expect(preview.style.margin).toBe('0px auto');
  });

  it('resets max-width when desktop mode is activated', () => {
    setPreviewMode('mobile');
    setPreviewMode('desktop');

    expect(preview.style.maxWidth).toBe('100%');
    expect(preview.style.margin).toBe('0px');
  });
});
