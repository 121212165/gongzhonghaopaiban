import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { setupDOM, loadScript } from '../helpers/setup.js';

// ---------------------------------------------------------------------------
// Preview rendering behaviour tests
//
// These verify that renderMarkdown() calls the expected processing pipeline
// and updates the preview DOM element.
// ---------------------------------------------------------------------------

beforeAll(async () => {
  setupDOM();
  await loadScript();
});

beforeEach(() => {
  vi.clearAllMocks();
  document.getElementById('editor').value = '';
  document.getElementById('preview').innerHTML = '';
  if ('currentHash' in globalThis) globalThis.currentHash = '';
});

describe('preview rendering', () => {
  it('updates the preview element HTML when renderMarkdown is called', () => {
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    editor.value = 'Hello, **world**!';

    globalThis.renderMarkdown();

    // Our marked.parse mock returns `<p>${text}</p>`
    // DOMPurify.sanitize mock passes through unchanged
    expect(preview.innerHTML).toBe('<p>Hello, **world**!</p>');
  });

  it('calls marked.parse with the current editor content', () => {
    const editor = document.getElementById('editor');
    editor.value = '# Title\n\nSome paragraph.';

    globalThis.renderMarkdown();

    expect(globalThis.marked.parse).toHaveBeenCalledTimes(1);
    expect(globalThis.marked.parse).toHaveBeenCalledWith('# Title\n\nSome paragraph.');
  });

  it('passes marked output through DOMPurify.sanitize', () => {
    const editor = document.getElementById('editor');
    editor.value = '<script>alert("xss")</script>';

    globalThis.renderMarkdown();

    expect(globalThis.DOMPurify.sanitize).toHaveBeenCalledTimes(1);
    // The argument should be the output of marked.parse
    expect(globalThis.DOMPurify.sanitize).toHaveBeenCalledWith(
      '<p><script>alert("xss")</script></p>'
    );
  });

  it('calls updateStats during rendering', () => {
    const editor = document.getElementById('editor');
    editor.value = '# A\n\nB\n\n![img](url.png)';

    globalThis.renderMarkdown();

    // Stats should be populated
    expect(document.getElementById('charCount').textContent).not.toBe('0');
    expect(document.getElementById('paragraphCount').textContent).not.toBe('0');
  });

  it('produces empty preview when editor is empty', () => {
    const preview = document.getElementById('preview');

    globalThis.renderMarkdown();

    // marked.parse('') returns '<p></p>' from our mock
    expect(preview.innerHTML).toBe('<p></p>');
  });
});
