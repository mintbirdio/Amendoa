import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Allow importing the shared scoring core that lives outside scout/ (../src/shared).
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/**/*.test.ts']
    },
    server: {
        fs: { allow: [repoRoot] }
    }
});
