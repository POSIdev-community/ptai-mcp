import { IssueType } from '../../vendor/aie-v63/src/models/index.js';
import type { AieApi } from '../api/client.js';
import type { VulnerabilityModel } from '../api/contracts.js';
import { cascadeMatch } from './text-matcher.js';

const maxDescriptionKeys = 64;
const concurrency = 4;

export async function searchIssues(api: AieApi, projectId: string, issues: VulnerabilityModel[], query?: string) {
  if (!query?.trim()) {
    return { issues, search: { requested: false } };
  }

  const representatives = new Map<string, VulnerabilityModel>();

  for (const issue of issues) {
    if (!componentTitle(issue)) {
      representatives.set(descriptionKey(issue), issue);
    }
  }

  const selected = [...representatives.entries()].slice(0, maxDescriptionKeys);
  const loaded = await loadTitles(api, projectId, selected);
  const unavailable = representatives.size - selected.length + loaded.unavailable;
  const matched = cascadeMatch(
    issues,
    (issue) =>
      [issue.type ?? '', componentTitle(issue), ...(loaded.titles.get(descriptionKey(issue)) ?? [])].filter(Boolean),
    query,
  );

  return {
    issues: matched,
    search: {
      requested: true,
      query,
      description_lookups_complete: unavailable === 0,
      titles_completeness: 'AIE may omit resource identities; complete title coverage is not guaranteed',
      unavailable_description_keys: unavailable,
      matching: 'exact_then_contains_then_all_tokens',
      ...(unavailable
        ? { note: 'Some display titles are unavailable; raw types and component names were searched.' }
        : {}),
    },
  };
}

async function loadTitles(api: AieApi, projectId: string, selected: Array<[string, VulnerabilityModel]>) {
  const titles = new Map<string, string[]>();
  let unavailable = 0;

  for (let offset = 0; offset < selected.length; offset += concurrency) {
    await Promise.all(
      selected.slice(offset, offset + concurrency).map(async ([key, issue]) => {
        try {
          const resources = await api.json(
            api.projects.apiProjectsProjectIdIssuesIssueIdResourcesGetRaw({
              projectId,
              issueId: issue.id!,
              localeId: 'en-US',
            }),
          );

          const values = resources.map((resource) => resource.title).filter((title) => !!title?.trim());
          titles.set(key, values);

          if (!values.length) {
            unavailable++;
          }
        } catch {
          unavailable++;
        }
      }),
    );
  }

  return { titles, unavailable };
}

function descriptionKey(issue: VulnerabilityModel): string {
  return JSON.stringify([
    issue.issueType,
    issue.type,
    issue.issueType === IssueType.Fingerprint ? issue.id : undefined,
  ]);
}

function componentTitle(issue: VulnerabilityModel): string {
  const component = issue.vulnerableScaComponent ?? issue.vulnerableComponent;

  return component?.component ? [component.component, component.version].filter(Boolean).join(' ') : '';
}
