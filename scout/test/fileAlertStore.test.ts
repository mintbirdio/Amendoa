import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileAlertStore } from '../src/store/FileAlertStore';

let dir: string;
let path: string;

beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'scout-'));
    path = join(dir, 'nested', 'alerted.json');
});

afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

describe('FileAlertStore', () => {
    it('loads empty when the file is absent', async () => {
        const store = await FileAlertStore.load(path);
        expect(store.size()).toBe(0);
    });

    it('persists and reloads alerted ids (creating dirs)', async () => {
        const store = await FileAlertStore.load(path);
        store.add('a', 1000);
        store.add('b', 2000);
        await store.flush();

        const reloaded = await FileAlertStore.load(path);
        expect(reloaded.has('a')).toBe(true);
        expect(reloaded.has('b')).toBe(true);
        expect(reloaded.size()).toBe(2);
    });

    it('writes the documented JSON shape', async () => {
        const store = await FileAlertStore.load(path);
        store.add('x', 42);
        await store.flush();
        const parsed = JSON.parse(await readFile(path, 'utf8'));
        expect(parsed).toEqual({ alertedIds: { x: 42 } });
    });

    it('prune drops old entries and persists on flush', async () => {
        const store = await FileAlertStore.load(path);
        store.add('old', 1000);
        store.add('new', 9_000_000_000_000);
        expect(store.prune(5000)).toBe(1);
        await store.flush();
        const reloaded = await FileAlertStore.load(path);
        expect(reloaded.has('old')).toBe(false);
        expect(reloaded.has('new')).toBe(true);
    });
});
