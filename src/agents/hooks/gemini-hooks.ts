import fs from 'node:fs/promises';
import path from 'node:path';
import { LocalToolName } from '../../local/tool-names.js';
import { GeminiConfigPath } from '../constants.js';
import { appendRules, deleteStandaloneRules, removeRules } from '../rules.js';
import { ensureParent, readOptional } from './config-file.js';

export async function hasGeminiRules(): Promise<boolean> {
  return (
    (
      await readOptional(
        path.join(
          process.env.USERPROFILE || process.env.HOME || '',
          GeminiConfigPath.Directory,
          GeminiConfigPath.Guide,
        ),
      )
    )?.includes('PT AI Security Rules') === true
  );
}

export async function configureAntigravityHooks(): Promise<boolean> {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  await appendRules(path.join(home, GeminiConfigPath.Directory, GeminiConfigPath.Guide));
  const workflow = path.join(home, GeminiConfigPath.Directory, 'config', 'global_workflows', 'pt_ai_security_scan.md');
  const content = `---\nname: PT AI Security Scan\ndescription: Run PT Application Inspector after significant code changes\n---\n\nAfter completing security-relevant changes, call the MCP tool \`${LocalToolName.TriggerScan}\` with mode \`incremental\`, review affected files, and fix or triage findings before reporting success.\n`;
  await ensureParent(workflow);

  if ((await readOptional(workflow)) !== content) {
    await fs.writeFile(workflow, content, 'utf8');
  }

  return true;
}

export async function configureGeminiCliHooks(): Promise<boolean> {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  await appendRules(path.join(home, GeminiConfigPath.Directory, GeminiConfigPath.Guide));

  return true;
}

export async function removeAntigravityHooks(): Promise<boolean> {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  await removeRules(path.join(home, GeminiConfigPath.Directory, GeminiConfigPath.Guide));
  await deleteStandaloneRules(
    path.join(home, GeminiConfigPath.Directory, 'config', 'global_workflows', 'pt_ai_security_scan.md'),
  );

  return true;
}

export async function removeGeminiCliHooks(): Promise<boolean> {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  await removeRules(path.join(home, GeminiConfigPath.Directory, GeminiConfigPath.Guide));

  return true;
}
