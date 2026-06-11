import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Allow importing the shared scoring core that lives outside scout/ (../src/shared).
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
    // Scout has no CSS. Without this, Vitest walks up the tree, finds the
    // extension's root postcss.config.js (which requires tailwindcss, not a
    // scout/ dep), and dies before any test runs. An empty plugin list pins
    // PostCSS off and keeps the suite hermetic.
    css: { postcss: { plugins: [] } },
    test: {
        environment: 'node',
        include: ['test/**/*.test.ts']
    },
    server: {
        fs: { allow: [repoRoot] }
    }
});
