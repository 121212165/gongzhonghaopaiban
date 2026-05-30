import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupDOM } from '../helpers/setup.js';

// Mock marked and security modules before importing preview
vi.mock('marked', () => ({
  marked: { parse: vi.fn((text) => `<p>${text}</p>`) }
}));
vi.mock('../../src/config/security.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
  PURIFY_CONFIG_STRICT: { ALLOWED_TAGS: [] }
}));

import { initPreview, renderMarkdown } from '../../src/preview.js';
import { sanitizeHtml } from '../../src/config/security.js';
import { marked } from 'marked';

// ---------------------------------------------------------------------------
// Preview rendering behaviour tests — import src/ modules directly
// ---------------------------------------------------------------------------

let preview;

beforeEach(() => {
  vi.clearAllMocks();
  setupDOM();
  preview = document.getElementById('preview');
  initPreview(preview);
});

describe('preview rendering', () => {
  it('updates the preview element HTML when renderMarkdown is called', () => {
    renderMarkdown('Hello, **world**!');

    expect(preview.innerHTML).toBe('<p>Hello, **world**!</p>');
  });

  it('calls marked.parse with the provided text', () => {
    renderMarkdown('# Title\n\nSome paragraph.');

    expect(marked.parse).toHaveBeenCalledTimes(1);
    expect(marked.parse).toHaveBeenCalledWith('# Title\n\nSome paragraph.');
  });

  it('passes marked output through sanitizeHtml', () => {
    renderMarkdown('<script>alert("xss")</script>');

    expect(sanitizeHtml).toHaveBeenCalledTimes(1);
    expect(sanitizeHtml).toHaveBeenCalledWith(
      '<p><script>alert("xss")</script></p>',
      expect.any(Object)
    );
  });

  it('produces empty paragraph for empty input', () => {
    renderMarkdown('');
    expect(preview.innerHTML).toBe('<p></p>');
  });

  it('returns empty string when no preview element is initialized', () => {
    initPreview(null);
    const result = renderMarkdown('test');
    expect(result).toBe('');
  });
});
