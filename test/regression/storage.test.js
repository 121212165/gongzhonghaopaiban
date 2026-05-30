import { describe, it, expect, beforeEach } from 'vitest';
import { clearStorageStore } from '../helpers/setup.js';
import { saveVersion, getVersions, findVersion, removeVersion } from '../../src/version.js';
import { simpleHash } from '../../src/utils.js';

// ---------------------------------------------------------------------------
// Storage behaviour tests — import src/ modules directly
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearStorageStore();
});

describe('simpleHash', () => {
  it('produces a deterministic hash string', () => {
    const hash1 = simpleHash('Hello');
    const hash2 = simpleHash('Hello');
    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe('string');
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = simpleHash('Hello');
    const hash2 = simpleHash('World');
    expect(hash1).not.toBe(hash2);
  });
});

describe('version management', () => {
  it('saveVersion stores a version snapshot in localStorage', () => {
    saveVersion('Version 1 Title', 'Version 1 content', 'Author');

    const versions = getVersions();
    expect(versions.length).toBe(1);
    expect(versions[0].content).toBe('Version 1 content');
    expect(versions[0].title).toBe('Version 1 Title');
    expect(versions[0].author).toBe('Author');
    expect(versions[0].id).toBeDefined();
    expect(versions[0].timestamp).toBeDefined();
  });

  it('saveVersion prepends new versions (newest first)', () => {
    saveVersion('First', 'content-1', '');
    saveVersion('Second', 'content-2', '');

    const versions = getVersions();
    expect(versions.length).toBe(2);
    expect(versions[0].title).toBe('Second');
    expect(versions[1].title).toBe('First');
  });

  it('saveVersion caps at 10 versions', () => {
    for (let i = 0; i < 12; i++) {
      saveVersion(`V${i}`, `content-${i}`, '');
    }

    const versions = getVersions();
    expect(versions.length).toBe(10);
    expect(versions[0].title).toBe('V11');
  });

  it('removeVersion removes the specified version from the list', () => {
    saveVersion('First', 'content-first', '');
    saveVersion('Second', 'content-second', '');

    const versions = getVersions();
    expect(versions.length).toBe(2);
    const idToDelete = versions[0].id; // 'Second' (newest)

    const remaining = removeVersion(idToDelete);

    expect(remaining.length).toBe(1);
    expect(remaining[0].content).toBe('content-first');

    // Also verify localStorage was updated
    const fromStorage = getVersions();
    expect(fromStorage.length).toBe(1);
    expect(fromStorage[0].content).toBe('content-first');
  });

  it('findVersion returns the version with the given id', () => {
    saveVersion('Target', 'find-me', '');
    const versions = getVersions();
    const id = versions[0].id;

    const found = findVersion(id);
    expect(found).not.toBeNull();
    expect(found.content).toBe('find-me');
  });

  it('findVersion returns null for non-existent id', () => {
    saveVersion('Only', 'one', '');
    const found = findVersion(999999);
    expect(found).toBeNull();
  });

  it('saveVersion uses default title when none is provided', () => {
    saveVersion('', 'content', '');
    const versions = getVersions();
    expect(versions[0].title).toBe('未命名文章');
  });
});
