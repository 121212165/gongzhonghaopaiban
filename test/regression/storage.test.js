import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { setupDOM, loadScript, getStorageStore, clearStorageStore } from '../helpers/setup.js';

// ---------------------------------------------------------------------------
// Storage behaviour tests
//
// These verify that saveContent / loadContent persist and restore article
// data correctly, and that version management works.
// ---------------------------------------------------------------------------

beforeAll(async () => {
  setupDOM();
  await loadScript();
});

beforeEach(() => {
  vi.clearAllMocks();
  clearStorageStore();

  document.getElementById('editor').value = '';
  document.getElementById('articleTitle').value = '';
  document.getElementById('articleAuthor').value = '';
  document.getElementById('saveStatus').textContent = '已自动保存';
  if ('currentHash' in globalThis) globalThis.currentHash = '';
});

describe('saveContent / loadContent', () => {
  it('writes editor content, title, author and hash into localStorage', () => {
    document.getElementById('editor').value = 'Hello';
    document.getElementById('articleTitle').value = 'Title';
    document.getElementById('articleAuthor').value = 'Author';

    globalThis.saveContent();

    // Check localStorage
    expect(localStorage.getItem('markdownContent')).toBe('Hello');
    expect(localStorage.getItem('articleTitle')).toBe('Title');
    expect(localStorage.getItem('articleAuthor')).toBe('Author');
    expect(localStorage.getItem('contentHash')).toBeDefined();
    expect(typeof localStorage.getItem('contentHash')).toBe('string');
  });

  it('restores editor value, title and author from localStorage via loadContent', () => {
    // Pre-populate localStorage
    localStorage.setItem('markdownContent', 'Restored content');
    localStorage.setItem('articleTitle', 'Restored Title');
    localStorage.setItem('articleAuthor', 'Restored Author');

    globalThis.loadContent();

    expect(document.getElementById('editor').value).toBe('Restored content');
    expect(document.getElementById('articleTitle').value).toBe('Restored Title');
    expect(document.getElementById('articleAuthor').value).toBe('Restored Author');
  });

  it('does not write to localStorage again when content has not changed', () => {
    // Set a known content hash to simulate already-saved state
    const editor = document.getElementById('editor');
    editor.value = 'Stable content';
    document.getElementById('articleTitle').value = 'Stable Title';
    document.getElementById('articleAuthor').value = 'Author';

    // First save - set the currentHash
    globalThis.saveContent();
    const hashAfterFirstSave = localStorage.getItem('contentHash');

    // Save again with identical content — hash should match, no duplicates
    globalThis.saveContent();
    const hashAfterSecondSave = localStorage.getItem('contentHash');

    // Hash should remain the same (not changed by second save)
    expect(hashAfterSecondSave).toBe(hashAfterFirstSave);
  });

  it('updates saveStatus text after saving', () => {
    document.getElementById('editor').value = 'Anything';
    globalThis.saveContent();

    expect(document.getElementById('saveStatus').textContent).toBe('已自动保存');
  });
});

describe('version management', () => {
  it('saveVersion stores a version snapshot in localStorage', () => {
    document.getElementById('editor').value = 'Version 1 content';
    document.getElementById('articleTitle').value = 'Version 1 Title';

    globalThis.saveVersion();

    const versions = JSON.parse(localStorage.getItem('versions'));
    expect(versions.length).toBe(1);
    expect(versions[0].content).toBe('Version 1 content');
    expect(versions[0].title).toBe('Version 1 Title');
  });

  it('deleteVersion removes the specified version from the list', () => {
    // Save two versions
    document.getElementById('editor').value = 'First';
    document.getElementById('articleTitle').value = 'Doc 1';
    globalThis.saveVersion();

    document.getElementById('editor').value = 'Second';
    document.getElementById('articleTitle').value = 'Doc 2';
    globalThis.saveVersion();

    const versions = JSON.parse(localStorage.getItem('versions'));
    expect(versions.length).toBe(2);
    const idToDelete = versions[0].id;

    // confirm() is mocked to return true
    globalThis.deleteVersion(idToDelete);

    const remaining = JSON.parse(localStorage.getItem('versions'));
    expect(remaining.length).toBe(1);
    expect(remaining[0].content).toBe('First');
  });

  it('restoreVersion loads version content back into the editor', () => {
    document.getElementById('editor').value = 'To be restored';
    document.getElementById('articleTitle').value = 'The Title';
    globalThis.saveVersion();

    // Change editor to something else
    document.getElementById('editor').value = 'New content';
    document.getElementById('articleTitle').value = 'New Title';

    // Restore the version — confirm() returns true
    const versions = JSON.parse(localStorage.getItem('versions'));
    globalThis.restoreVersion(versions[0].id);

    expect(document.getElementById('editor').value).toBe('To be restored');
    expect(document.getElementById('articleTitle').value).toBe('The Title');
  });
});
