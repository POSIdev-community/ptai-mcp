import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getBundleDir } from '../../utils/paths.js';
import { Platform } from '../../utils/platform-constants.js';

export function getSessionFile(): string {
  const sharedDirectory = getBundleDir();
  const sharedFile = path.join(sharedDirectory, 'shared_variables');

  if (process.platform !== Platform.MacOS || fs.existsSync(sharedDirectory)) {
    return sharedFile;
  }

  const userDirectory = path.join(os.homedir(), 'Library', 'Application Support', 'Application Inspector MCP');

  return path.join(userDirectory, 'shared_variables');
}
