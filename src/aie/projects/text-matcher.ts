/** Same cascade as BE4P McpInfrastructure.TextMatcher: select the first nonempty level. */
export function cascadeMatch<T>(items: T[], fields: (item: T) => string[], query: string): T[] {
  const text = query.trim().toLowerCase();

  if (!text) {
    return items;
  }

  const candidates = items.map((item) => ({ item, fields: fields(item).map((field) => field.toLowerCase()) }));
  const exact = candidates.filter((candidate) => candidate.fields.includes(text));

  if (exact.length) {
    return exact.map((candidate) => candidate.item);
  }

  const contains = candidates.filter((candidate) => candidate.fields.some((field) => field.includes(text)));

  if (contains.length) {
    return contains.map((candidate) => candidate.item);
  }

  const tokens = text.split(/ +/).filter(Boolean);

  return candidates.filter((candidate) => matchesTokens(candidate.fields, tokens)).map((candidate) => candidate.item);
}

function matchesTokens(fields: string[], tokens: string[]): boolean {
  return fields.some((field) => tokens.every((token) => field.includes(token)));
}
