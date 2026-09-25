#!/usr/bin/env node

// Forward execution to the compiled CLI bundle.
import { runCli } from '../dist/cli.js';

await runCli();
