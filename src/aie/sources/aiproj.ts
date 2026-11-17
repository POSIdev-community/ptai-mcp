import { validation } from '../../shared/errors.js';
import { record } from '../../shared/json.js';

export function convertAiproj(text: string): string {
  let value: Record<string, unknown>;

  try {
    value = record(JSON.parse(text.replace(/^\uFEFF/, '')));
  } catch {
    return validation('The included .aiproj.json is not a valid JSON object.');
  }

  value.Version = '1.11';
  delete value.$schema;
  delete value.JsaScriptingFolder;
  delete value.PygrepSettings;

  if (Array.isArray(value.ProgrammingLanguages)) {
    value.ProgrammingLanguages = [
      ...new Set(
        value.ProgrammingLanguages.map((language) => (language === 'C#' ? 'CSharp (Windows, Linux)' : language)),
      ),
    ];
  }

  if (value.DotNetSettings && typeof value.DotNetSettings === 'object') {
    const settings = record(value.DotNetSettings);

    if (settings.ProjectType === 'WebSite') {
      delete settings.ProjectType;
    }
  }

  return JSON.stringify(value, null, 2);
}
