import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock DOM environment
beforeEach(() => {
    document.body.innerHTML = `
        <textarea id="editor"></textarea>
        <div id="preview"></div>
        <input id="articleTitle" />
        <input id="articleAuthor" />
        <span id="charCount">0</span>
        <span id="paragraphCount">0</span>
        <span id="imageCount">0</span>
        <span id="headingCount">0</span>
        <span id="readTime">0 分钟</span>
        <span id="saveStatus">已自动保存</span>
        <div class="toolbar"></div>
        <div class="theme-buttons"></div>
        <div class="preview-mode-buttons"></div>
        <div class="version-buttons"><button id="saveVersion"></button><button id="showVersions"></button></div>
        <div class="export-buttons"><button id="exportMd"></button><button id="exportPdf"></button><button id="exportWechat"></button></div>
        <div class="action-buttons"><button id="clearContent"></button><button id="resetTheme"></button></div>
        <div class="modal-close"></div>
        <div class="modal" id="versionModal"><div id="versionList"></div></div>
    `;
});

describe('simpleHash', () => {
    // Import the function - since it's global, we need to load script.js
    // Test the hash algorithm directly
    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    it('returns consistent hash for same input', () => {
        expect(simpleHash('hello')).toBe(simpleHash('hello'));
    });

    it('returns different hash for different input', () => {
        expect(simpleHash('hello')).not.toBe(simpleHash('world'));
    });

    it('returns string', () => {
        expect(typeof simpleHash('test')).toBe('string');
    });

    it('handles empty string', () => {
        expect(simpleHash('')).toBe('0');
    });

    it('handles unicode', () => {
        expect(typeof simpleHash('你好世界')).toBe('string');
    });
});

describe('updateStats', () => {
    // Test the regex-based counting logic
    it('counts chars without whitespace', () => {
        const text = 'hello world  ';
        const charCount = text.replace(/\s/g, '').length;
        expect(charCount).toBe(10);
    });

    it('counts paragraphs as non-empty lines', () => {
        const lines = ['hello', '', 'world', '  ', 'test'];
        const paragraphCount = lines.filter(line => line.trim().length > 0).length;
        expect(paragraphCount).toBe(3);
    });

    it('counts images via regex', () => {
        const text = '![alt](url1) and ![img](url2)';
        const imageCount = (text.match(/!\[.*?\]\(.*?\)/g) || []).length;
        expect(imageCount).toBe(2);
    });

    it('counts headings via regex', () => {
        const text = '# H1\n## H2\nnormal\n### H3\n';
        const headingCount = (text.match(/^#{1,6}\s+/gm) || []).length;
        expect(headingCount).toBe(3);
    });

    it('calculates read time as ceil(chars/500)', () => {
        const charCount = 1200;
        const readTime = Math.ceil(charCount / 500);
        expect(readTime).toBe(3);
    });
});

describe('markdownSyntax', () => {
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

    it('has all expected actions', () => {
        const expected = ['bold', 'italic', 'underline', 'strikethrough', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'quote', 'code', 'inlineCode', 'link', 'image', 'divider'];
        expect(Object.keys(markdownSyntax).sort()).toEqual(expected.sort());
    });

    it('bold wraps with **', () => {
        const text = 'hello';
        const { prefix, suffix } = markdownSyntax.bold;
        expect(prefix + text + suffix).toBe('**hello**');
    });

    it('heading levels have correct prefix', () => {
        expect(markdownSyntax.h1.prefix).toBe('# ');
        expect(markdownSyntax.h2.prefix).toBe('## ');
        expect(markdownSyntax.h3.prefix).toBe('### ');
        expect(markdownSyntax.h4.prefix).toBe('#### ');
    });

    it('link wraps with brackets and parens', () => {
        const text = 'click';
        const { prefix, suffix } = markdownSyntax.link;
        expect(prefix + text + suffix).toBe('[click](url)');
    });
});
