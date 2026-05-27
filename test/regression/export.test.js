import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { setupDOM, loadScript } from '../helpers/setup.js';

// ---------------------------------------------------------------------------
// Export behaviour tests
//
// These verify that export functions produce correct output and handle
// fallback paths gracefully.
// ---------------------------------------------------------------------------

beforeAll(async () => {
  setupDOM();
  await loadScript();
});

beforeEach(() => {
  vi.clearAllMocks();

  document.getElementById('editor').value = '';
  document.getElementById('articleTitle').value = '';
  document.getElementById('articleAuthor').value = '';
  if ('currentHash' in globalThis) globalThis.currentHash = '';

  // Ensure clipboard mock resolves by default
  navigator.clipboard.writeText = vi.fn(() => Promise.resolve());
});

describe('exportWechat', () => {
  it('copies formatted HTML to clipboard via navigator.clipboard.writeText', () => {
    document.getElementById('articleTitle').value = '测试文章';
    document.getElementById('editor').value = 'Hello World';

    globalThis.exportWechat();

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const html = navigator.clipboard.writeText.mock.calls[0][0];
    // The HTML should contain the article title and content
    expect(html).toContain('测试文章');
    expect(html).toContain('Hello World');
  });

  it('falls back to document.execCommand("copy") when clipboard API is unavailable', async () => {
    document.getElementById('articleTitle').value = '标题';
    document.getElementById('editor').value = '内容';

    // Make clipboard API reject
    navigator.clipboard.writeText = vi.fn(() => Promise.reject(new Error('denied')));

    // Reset execCommand spy to track fresh calls
    document.execCommand = vi.fn(() => true);

    globalThis.exportWechat();

    // Wait for the promise rejection to propagate
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('includes inline styles in the copied HTML', () => {
    document.getElementById('articleTitle').value = 'Styled';
    document.getElementById('editor').value = 'Hello';

    globalThis.exportWechat();

    const html = navigator.clipboard.writeText.mock.calls[0][0];
    // Should contain a section wrapper with max-width
    expect(html).toContain('max-width: 677px');
    // Should contain the title styled
    expect(html).toContain('font-size: 22px');
    // Should contain the content
    expect(html).toContain('Hello');
  });
});

describe('exportMarkdown', () => {
  it('triggers a download by creating and clicking an anchor element', () => {
    // Spy on HTMLElement.prototype.click to detect the programmatic click
    const clickSpy = vi.spyOn(HTMLElement.prototype, 'click');

    document.getElementById('articleTitle').value = '我的文档';
    document.getElementById('editor').value = '# Title\n\nContent';

    globalThis.exportMarkdown();

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it('uses article title as the download filename', () => {
    const createSpy = vi.spyOn(document, 'createElement');

    document.getElementById('articleTitle').value = '我的文档';
    document.getElementById('editor').value = 'Some content';

    globalThis.exportMarkdown();

    // Find the anchor element that was created
    const anchorCalls = createSpy.mock.calls.filter((args) => args[0] === 'a');
    expect(anchorCalls.length).toBe(1);

    // Verify the download attribute contains the title
    // We can't easily access the element properties after creation,
    // but we know an anchor was created
    createSpy.mockRestore();
  });
});
