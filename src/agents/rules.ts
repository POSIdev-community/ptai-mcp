import fs from 'node:fs/promises';
import path from 'node:path';

export const RULES_START = '<!-- PT AI Security Rules - DO NOT EDIT -->';
export const RULES_END = '<!-- END PT AI Security Rules -->';

const RULES = `${RULES_START}
## PT Application Inspector — Automated Security Scanning

This project is protected by PT Application Inspector. After changes are
applied, an automated security scan may return affected files and findings.

When a finding affects a file you modified:
1. Call the MCP tool \`list_issues\` for the affected file.
2. Fix vulnerabilities you introduced before reporting success.
3. If a finding is a false positive, call \`triage_issue\` with a justification.
4. Do not report success until your modified files are resolved or triaged.
${RULES_END}`;

export async function appendRules(filePath: string): Promise<void> {
  const existing = (await readOptional(filePath)) ?? '';
  if (existing.includes(RULES_START)) return;
  await ensureParent(filePath);
  const separator = existing.trim().length === 0 ? '' : '\n\n';
  await fs.writeFile(filePath, `${existing}${separator}${RULES}\n`, 'utf8');
}

export async function removeRules(filePath: string): Promise<void> {
  const existing = await readOptional(filePath);
  if (existing === null) return;
  const start = existing.indexOf(RULES_START);
  const endMarker = existing.indexOf(RULES_END, start + RULES_START.length);
  if (start < 0 || endMarker < 0) return;

  let from = start;
  let to = endMarker + RULES_END.length;
  while (from > 0 && (existing[from - 1] === '\n' || existing[from - 1] === '\r')) from -= 1;
  while (to < existing.length && (existing[to] === '\n' || existing[to] === '\r')) to += 1;

  const updated = `${existing.slice(0, from)}${existing.slice(to)}`.trimEnd();
  await fs.writeFile(filePath, `${updated}\n`, 'utf8');
}

export async function writeStandaloneRules(filePath: string): Promise<void> {
  let content = RULES;
  if (filePath.toLowerCase().endsWith('.mdc')) {
    content = `---\ndescription: "PT Application Inspector Automated Security Scanning"\nalwaysApply: true\n---\n\n${content}`;
  }
  await ensureParent(filePath);
  const expected = `${content}\n`;
  if ((await readOptional(filePath)) === expected) return;
  await fs.writeFile(filePath, expected, 'utf8');
}

export async function deleteStandaloneRules(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export function getRulesContent(): string {
  return RULES;
}

async function ensureParent(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readOptional(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
