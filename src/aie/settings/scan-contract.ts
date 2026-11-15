import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError, validation } from '../../shared/errors.js';
import { type JsonObject, record } from '../../shared/json.js';
import { checkReadback } from '../api/write-schema.js';

// Only expose optional settings present in the server response.
const rootExtensions = ['raceConditionSettings', 'asintSettings'];
const whiteBoxExtensions = ['searchForRaceConditionsEnabled', 'asintEnabled'];

export function availableScanSchema(schema: JsonObject, current: JsonObject): JsonObject {
  const definitions = record(schema.$defs);
  restrictProperties(record(definitions.ProjectSettingsUpdateModel), current, rootExtensions);
  restrictProperties(
    record(definitions.WhiteBoxSettingsModel),
    objectValue(current.whiteBoxSettings),
    whiteBoxExtensions,
  );

  return schema;
}

export function assertScanChangesAvailable(current: JsonObject, changes: JsonObject, schema: JsonObject): void {
  const properties = record(record(record(schema.$defs).ProjectSettingsUpdateModel).properties);

  if (
    Object.keys(current).some(
      (name) => !(name in properties) && !['sourceType', 'langPercentDistribution'].includes(name),
    )
  ) {
    throw new ToolError(ErrorCode.SchemaMissing, 'Unknown project settings sections prevent a complete safe write.', {
      effects: Effects.NotApplied,
      next_action: 'Compare this server settings contract with the bundled schemas before changing the project.',
    });
  }

  assertPresent(current, changes, rootExtensions);
  assertPresent(objectValue(current.whiteBoxSettings), objectValue(changes.whiteBoxSettings), whiteBoxExtensions);
}

export function verifyScanReadback(saved: unknown, changes: JsonObject): void {
  // AIE persists language flags, then enumerates them in its own order.
  // Only this set is normalized; ordering of every other array remains significant.
  checkReadback(normalizeLanguages(saved), normalizeLanguages(changes));
}

function normalizeLanguages(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const settings = value as JsonObject;

  if (!Array.isArray(settings.languages) || !settings.languages.every((language) => typeof language === 'string')) {
    return value;
  }

  return { ...settings, languages: [...new Set(settings.languages)].sort() };
}

function restrictProperties(schema: JsonObject, current: JsonObject, extensions: string[]): void {
  const properties = record(schema.properties);

  for (const name of extensions) {
    if (!Object.hasOwn(current, name)) {
      delete properties[name];
    }
  }
}

function assertPresent(current: JsonObject, changes: JsonObject, extensions: string[]): void {
  for (const name of extensions) {
    if (Object.hasOwn(changes, name) && !Object.hasOwn(current, name)) {
      validation(`This AIE settings response does not expose ${name}; its write support is unconfirmed.`);
    }
  }
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}
