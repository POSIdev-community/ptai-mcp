import { cpSync, mkdirSync } from 'node:fs';

// Keep runtime templates and login pages available in the installed npm archive.
mkdirSync('dist/assets', { recursive: true });
cpSync('assets/aie-login', 'dist/assets/aie-login', { recursive: true });
cpSync('assets/agents', 'dist/assets/agents', { recursive: true });
