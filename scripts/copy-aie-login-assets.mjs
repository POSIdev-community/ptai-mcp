import { copyFileSync } from 'node:fs';

// Keep the local login pages self-contained when the CLI runs from an npm archive.
copyFileSync('src/aie/ai_casgate_logo.svg', 'dist/ai_casgate_logo.svg');
copyFileSync('src/aie/Inter-Regular.woff2', 'dist/Inter-Regular.woff2');
copyFileSync('src/aie/TT-Positive-Regular.woff2', 'dist/TT-Positive-Regular.woff2');
