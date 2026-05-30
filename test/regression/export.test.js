import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupDOM } from '../helpers/setup.js';

// Mock marked and security modules before importing export
vi.mock('marked', () => ({
  marked: { parse: vi.fn((text) => `<p>${text}</p>`) }
}));
vi.mock('../../src/config/security.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
  PURIFY_CONFIG_STRICT: { ALLOWED_TAGS: [] },
  PURIFY_CONFIG_LOOSE: { ALLOWED_TAGS: [], ALLOWED_ATTR: ['style'] }
}));

import { exportMarkdown, exportWechat } from '../../src/export.js';

// ---------------------------------------------------------------------------
// Export behaviour tests — import src/ modules directly
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setupDOM();
  navigator.clipboard.writeText = vi.fn(() => Promise.resolve());
});

describe('exportWechat', () => {
  it('copies formatted HTML to clipboard via navigator.clipboard.writeText', () => {
    exportWechat('测试文章', 'Hello World', '');

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const html = navigator.clipboard.writeText.mock.calls[0][0];
    expect(html).toContain('测试文章');
    expect(html).toContain('Hello World');
  });

  it('falls back to document.execCommand("copy") when clipboard API is unavailable', async () => {
    navigator.clipboard.writeText = vi.fn(() => Promise.reject(new Error('denied')));
    document.execCommand = vi.fn(() => true);

    exportWechat('标题', '内容', '');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('includes section wrapper with max-width in the copied HTML', () => {
    exportWechat('Styled', 'Hello', '');

    const html = navigator.clipboard.writeText.mock.calls[0][0];
    expect(html).toContain('max-width:677px');
    expect(html).toContain('Hello');
  });

  it('escapes HTML in title and author', () => {
    exportWechat('<script>xss</script>', 'content', '<b>attacker</b>');

    const html = navigator.clipboard.writeText.mock.calls[0][0];
    expect(html).not.toContain('<script>xss</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('exportMarkdown', () => {
  it('triggers a download by creating and clicking an anchor element', () => {
    const clickSpy = vi.spyOn(HTMLElement.prototype, 'click');

    exportMarkdown('我的文档', '# Title\n\nContent', '');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it('includes title and content in the downloaded markdown', () => {
    const createSpy = vi.spyOn(document, 'createElement');

    exportMarkdown('我的文档', 'Some content', '作者');

    const anchorCalls = createSpy.mock.calls.filter((args) => args[0] === 'a');
    expect(anchorCalls.length).toBe(1);
    createSpy.mockRestore();
  });
});
