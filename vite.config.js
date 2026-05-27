import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
    plugins: [viteSingleFile()],
    build: {
        rollupOptions: {
            input: 'index.html'
        },
        outDir: 'dist'
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./test/helpers/setup.js']
    }
});
