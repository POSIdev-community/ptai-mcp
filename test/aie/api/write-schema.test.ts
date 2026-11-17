import { describe, expect, it } from 'vitest';
import { preserveReadExtras, validateWrite, writable } from '../../../src/aie/api/write-schema.js';
import { type JsonObject, merge } from '../../../src/shared/json.js';

function prepareWrite(name: string, original: JsonObject, patch: JsonObject): JsonObject {
  const validated = merge(writable(name, original), patch) as JsonObject;
  validateWrite(name, validated);
  return preserveReadExtras(name, original, validated, patch);
}

describe('preserving read extras in validated writes', () => {
  it('restores nested fields through schema references but excludes read-only root fields', () => {
    const original = {
      id: 'server-only',
      sourceType: 'Local',
      whiteBoxSettings: { patternMatchingEnabled: true, futureSettings: { enabled: true } },
    };
    const snapshot = structuredClone(original);
    const updated = prepareWrite('ProjectSettingsUpdateModel', original, {
      whiteBoxSettings: { patternMatchingEnabled: false },
    });
    expect(updated).toEqual({
      whiteBoxSettings: { patternMatchingEnabled: false, futureSettings: { enabled: true } },
    });
    const settings = updated.whiteBoxSettings as JsonObject;
    expect(settings.futureSettings).not.toBe(original.whiteBoxSettings.futureSettings);
    expect(original).toEqual(snapshot);
  });

  it('preserves extras at multiple referenced object levels while replacing nullable leaves', () => {
    const original = {
      site: 'https://fixture.invalid',
      authentication: {
        type: 'Http',
        serverExtension: true,
        http: { userName: 'before', password: 'synthetic', futureSettings: { enabled: true } },
      },
    };
    expect(prepareWrite('BlackBoxSettingsModel', original, { site: null })).toEqual({
      ...original,
      site: null,
    });
  });

  it('clones an untouched array with unknown fields in its elements', () => {
    const original = {
      additionalHttpHeaders: [{ key: 'X-Fixture', value: 'before', futureSettings: { enabled: true } }],
    };
    const updated = prepareWrite('BlackBoxSettingsModel', original, { sslCheck: true });
    expect(updated).toEqual({ ...original, sslCheck: true });
    expect(updated.additionalHttpHeaders).not.toBe(original.additionalHttpHeaders);
    const headers = updated.additionalHttpHeaders as JsonObject[];
    expect(headers[0].futureSettings).not.toBe(original.additionalHttpHeaders[0].futureSettings);
  });

  it.each([{ replacement: [] }, { replacement: [{ key: 'X-Replacement', value: 'after' }] }])(
    'replaces an explicitly patched array: %j',
    ({ replacement }) => {
      const original = {
        additionalHttpHeaders: [{ key: 'X-Fixture', value: 'before', serverExtension: true }],
      };
      expect(prepareWrite('BlackBoxSettingsModel', original, { additionalHttpHeaders: replacement })).toEqual({
        additionalHttpHeaders: replacement,
      });
      expect(original.additionalHttpHeaders[0].serverExtension).toBe(true);
    },
  );

  it('replaces a nullable array with null', () => {
    expect(
      prepareWrite(
        'BlackBoxSettingsModel',
        { additionalHttpHeaders: [{ key: 'X-Fixture' }] },
        {
          additionalHttpHeaders: null,
        },
      ),
    ).toEqual({ additionalHttpHeaders: null });
  });

  it('does not let a caller introduce unknown nested fields', () => {
    expect(() =>
      prepareWrite('ProjectSettingsUpdateModel', {}, { whiteBoxSettings: { serverExtension: true } }),
    ).toThrow(expect.objectContaining({ code: 'AIE_VALIDATION_ERROR' }));
  });

  it('does not restore unsafe object keys from an untrusted read DTO', () => {
    const original = JSON.parse(
      '{"whiteBoxSettings":{"__proto__":{"polluted":true},"constructor":{},"prototype":{},"safeExtra":true}}',
    ) as JsonObject;
    const patch = { whiteBoxSettings: { patternMatchingEnabled: false } };
    validateWrite('ProjectSettingsUpdateModel', patch);
    const restored = preserveReadExtras('ProjectSettingsUpdateModel', original, patch, patch);
    expect(restored).toEqual({ whiteBoxSettings: { patternMatchingEnabled: false, safeExtra: true } });
    expect(Object.hasOwn(restored.whiteBoxSettings as JsonObject, '__proto__')).toBe(false);
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  });
});
