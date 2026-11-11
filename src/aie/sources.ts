import type { AieApi } from './api.js';
import { packSources, multipartArchive, downloadArchive } from './archives.js';
import { AieError } from './errors.js';
import type { JobContext } from './operations.js';
import { Findings } from './findings.js';
import { Settings } from './settings.js';
import { LIMITS } from './limits.js';
import { record, validateWrite, writable, type Data } from './schema.js';
import type { BaseCreateProjectModel } from '../vendor/aie-v63/src/models/index.js';

export class Sources {
  constructor(private readonly api: AieApi) {}

  async create(
    source: string,
    name: string,
    branchName: string,
    description: string | undefined,
    scanChanges: Data | undefined,
    job: JobContext,
  ) {
    return this.transfer(job, (scoped) =>
      this.createWithinDeadline(source, name, branchName, description, scanChanges, scoped),
    );
  }
  private async createWithinDeadline(
    source: string,
    name: string,
    branchName: string,
    description: string | undefined,
    scanChanges: Data | undefined,
    job: JobContext,
  ) {
    job.stage('packing_sources');
    const archive = await packSources(source, job.signal);
    try {
      job.stage('creating_project');
      const ids = await this.api.json(
        this.api.store.apiStoreProjectArchivePostRaw(
          {},
          multipartArchive(archive, `${name}.zip`, { Name: branchName, Description: description ?? '' }, job.signal),
        ),
      );
      if (!ids.projectId || !ids.branchId)
        throw new AieError('AIE_INVALID_RESPONSE', 'Project creation response omitted project or branch ID.', {
          effects: 'unknown',
        });
      const { projectId, branchId } = ids;
      job.applied('project_created', { project_id: projectId, branch_id: branchId });
      job.stage('completing_configuration');
      const defaults = record(
        await this.api.json(
          this.api.projects.apiProjectsProjectIdDefaultSettingsGetRaw({ projectId }, { signal: job.signal }),
        ),
      );
      // DefaultProjectSettingsModel is the server's initial wizard state. Build
      // only BaseCreateProjectModel fields, never send the whole read DTO back.
      const configuration = {
        id: projectId,
        name,
        projectUrl: defaults.projectUrl ?? '',
        languages: defaults.languages,
        whiteBox: defaults.whiteBoxSettings ?? defaults.whiteBox,
        blackBoxEnabled: defaults.blackBoxEnabled ?? false,
        blackBox: defaults.blackBoxEnabled ? (defaults.blackBoxSettings ?? defaults.blackBox) : undefined,
        priority: defaults.priority,
        preferredAgentsSettings: defaults.preferredAgentsSettings,
        projectTargetBasedType: 'SourceBased',
        automatedAiTriageEnabled: defaults.automatedAiTriageEnabled ?? false,
        automatedAiTriageMinSeverity: defaults.automatedAiTriageMinSeverity,
      };
      const write = writable('BaseCreateProjectModel', JSON.parse(JSON.stringify(configuration)));
      validateWrite('BaseCreateProjectModel', write);
      await this.api.empty(
        this.api.projects.apiProjectsProjectIdCompleteConfigurationPostRaw(
          { projectId, projectType: 'Permanent', baseCreateProjectModel: write as BaseCreateProjectModel },
          { signal: job.signal },
        ),
      );
      job.applied('configuration_completed');
      const project = await this.api.json(
        this.api.projects.apiProjectsProjectIdGetRaw({ projectId }, { signal: job.signal }),
      );
      if (project.projectType !== 'Permanent')
        throw new AieError(
          'AIE_READBACK_MISMATCH',
          'Project creation was accepted but the permanent project type was not confirmed.',
          { effects: 'applied', target: { project_id: projectId, branch_id: branchId } },
        );
      if (scanChanges) {
        job.stage('applying_scan_settings');
        await new Settings(this.api).update(projectId, 'scan', scanChanges);
        job.applied('initial_scan_settings_saved');
      }
      job.stage('verifying_sources');
      await this.ready(projectId, branchId);
      job.applied('sources_ready');
      return {
        project_id: projectId,
        branch_id: branchId,
        sources_ready: true,
        permanent: true,
        effects: 'applied',
        ...this.summary(archive),
      };
    } finally {
      await archive.cleanup();
    }
  }

  async upload(projectId: string, branchId: string, source: string, job: JobContext) {
    return this.transfer(job, (scoped) => this.uploadWithinDeadline(projectId, branchId, source, scoped));
  }
  private async uploadWithinDeadline(projectId: string, branchId: string, source: string, job: JobContext) {
    await new Findings(this.api).branch(projectId, branchId);
    const before = await this.api.json(this.api.branches.apiBranchesBranchIdGetRaw({ branchId }));
    job.stage('packing_sources');
    const archive = await packSources(source, job.signal);
    try {
      job.stage('uploading_sources');
      await this.api.empty(
        this.api.store.apiStoreProjectIdBranchesBranchIdSourcesPostRaw(
          { projectId, branchId, archived: true },
          multipartArchive(archive, 'sources.zip', {}, job.signal),
        ),
      );
      job.applied('archive_uploaded', { project_id: projectId, branch_id: branchId });
      job.stage('verifying_sources');
      const after = await this.ready(projectId, branchId);
      if (before.sourcesChangingDate === after.sourcesChangingDate)
        throw new AieError(
          'AIE_SOURCE_READINESS_UNKNOWN',
          'Upload was accepted, but the branch source revision did not confirm readiness.',
          { effects: 'applied', target: { project_id: projectId, branch_id: branchId } },
        );
      job.applied('sources_ready');
      return {
        project_id: projectId,
        branch_id: branchId,
        sources_ready: true,
        sources_changing_date: after.sourcesChangingDate,
        effects: 'applied',
        ...this.summary(archive),
      };
    } finally {
      await archive.cleanup();
    }
  }

  async download(
    projectId: string,
    branchId: string,
    destination: string,
    scanId: string | undefined,
    job: JobContext,
  ) {
    return this.transfer(job, (scoped) =>
      this.downloadWithinDeadline(projectId, branchId, destination, scanId, scoped),
    );
  }
  private async downloadWithinDeadline(
    projectId: string,
    branchId: string,
    destination: string,
    scanId: string | undefined,
    job: JobContext,
  ) {
    await new Findings(this.api).branch(projectId, branchId);
    if (scanId) await new Findings(this.api).scan(projectId, scanId, branchId);
    job.stage('downloading_sources');
    job.check();
    const response = await this.api.response(
      this.api.store.apiStoreProjectIdBranchesBranchIdSourcesGetRaw({ projectId, branchId }, { signal: job.signal }),
    );
    const saved = await downloadArchive(response, destination, job.signal);
    job.applied('sources_published', { project_id: projectId, branch_id: branchId });
    return { project_id: projectId, branch_id: branchId, scan_id: scanId, ...saved, effects: 'applied' };
  }

  private async transfer<T>(job: JobContext, run: (scoped: JobContext) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new DOMException('Archive workflow timed out.', 'TimeoutError')),
      LIMITS.transferMs,
    );
    timeout.unref();
    const abort = () => controller.abort(job.signal.reason);
    job.signal.addEventListener('abort', abort, { once: true });
    if (job.signal.aborted) abort();
    const scoped = {
      ...job,
      signal: controller.signal,
      check: () => {
        job.check();
        controller.signal.throwIfAborted();
      },
    };
    try {
      return await run(scoped);
    } finally {
      clearTimeout(timeout);
      job.signal.removeEventListener('abort', abort);
    }
  }

  private async ready(projectId: string, branchId: string) {
    await new Findings(this.api).branch(projectId, branchId);
    const branch = await this.api.json(this.api.branches.apiBranchesBranchIdGetRaw({ branchId }));
    if (!branch.sourcesChangingDate || !(Date.parse(branch.sourcesChangingDate) > 0))
      throw new AieError(
        'AIE_SOURCE_READINESS_UNKNOWN',
        'The source archive request completed but branch readiness could not be confirmed.',
        { effects: 'applied', target: { project_id: projectId, branch_id: branchId } },
      );
    return branch;
  }
  private summary(archive: Awaited<ReturnType<typeof packSources>>) {
    return {
      ignore_files: archive.ignore_files,
      excluded_entries: archive.ignored_files,
      excluded_entries_note: 'An excluded directory counts as one pruned entry; its contents are not traversed.',
      skipped_symlinks: archive.skipped_symlinks,
      included_files: archive.included_files,
      archive_bytes: archive.size,
      aiproj_converted: archive.aiproj_converted,
      source_readiness: 'archive_endpoint_and_branch_readback',
    };
  }
}
