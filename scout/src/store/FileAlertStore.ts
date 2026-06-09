/**
 * FileAlertStore — persists the alerted-tweet set to a JSON file so dedup
 * survives between scheduled runs (e.g. committed/cached by the GitHub Action).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { InMemoryAlertStore } from './AlertStore';

export class FileAlertStore extends InMemoryAlertStore {
    private constructor(private readonly path: string, initial: Record<string, number>) {
        super(initial);
    }

    /** Load the store from disk (empty if the file doesn't exist yet). */
    static async load(path: string): Promise<FileAlertStore> {
        let initial: Record<string, number> = {};
        try {
            const raw = await readFile(path, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.alertedIds && typeof parsed.alertedIds === 'object') {
                initial = parsed.alertedIds as Record<string, number>;
            }
        } catch (err) {
            const code = (err as NodeJS.ErrnoException)?.code;
            if (code !== 'ENOENT') throw err; // missing file is fine; anything else is real
        }
        return new FileAlertStore(path, initial);
    }

    override async flush(): Promise<void> {
        await mkdir(dirname(this.path), { recursive: true });
        const body = JSON.stringify({ alertedIds: this.toJSON() }, null, 2);
        await writeFile(this.path, body, 'utf8');
    }
}
