import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError } from '../../shared/errors.js';
import { type JsonObject, record } from '../../shared/json.js';
import { LIMITS } from '../../shared/limits.js';
import type { AieApi } from '../api/client.js';
import { ProjectTargetBasedType, ProjectType } from '../api/contracts.js';
import { WriteModelName } from '../api/models.js';
import { validateWrite, writable, writeDto } from '../api/write-schema.js';
import { Findings } from '../projects/findings.js';
import { type JobContext, WorkflowStage } from '../runtime/models.js';
import { SettingsSection } from '../settings/models.js';
import { Settings } from '../settings/project-settings.js';
import { downloadArchive } from './extract.js';
import { multipartArchive } from './multipart.js';
import { packSources } from './pack.js';
import { sourcesReady } from './source-reader.js';

export class Sources {

  public constructor(private readonly api: AieApi) {}

  public async create(
    source: string,
    name: string,
    branchName: string,
    description: string | undefined,
    scanChanges: JsonObject | undefined,
    job: JobContext,
  ) {
    return this.transfer(job, (scoped) =>
      this.createWithinDeadline(source, name, branchName, description, scanChanges, scoped),
    );
  }

  public async upload(projectId: string, branchId: string, source: string, job: JobContext) {
    return this.transfer(job, (scoped) => this.uploadWithinDeadline(projectId, branchId, source, scoped));
  }

  public async createBranch(
    projectId: string,
    branchName: string,
    source: string,
    description: string | undefined,
    job: JobContext,
  ) {
    return this.transfer(job, (scoped) =>
      this.createBranchWithinDeadline(projectId, branchName, source, description, scoped),
    );
  }

  public async download(
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

  private async configureProject(projectId: string, branchId: string, name: string, job: JobContext): Promise<void> {
    job.stage(WorkflowStage.CompletingConfiguration);
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
      projectTargetBasedType: ProjectTargetBasedType.SourceBased,
      automatedAiTriageEnabled: defaults.automatedAiTriageEnabled ?? false,
      automatedAiTriageMinSeverity: defaults.automatedAiTriageMinSeverity,
    };

    const write = writable(WriteModelName.CreateProject, JSON.parse(JSON.stringify(configuration)));
    validateWrite(WriteModelName.CreateProject, write);
    await this.api.empty(
      this.api.projects.apiProjectsProjectIdCompleteConfigurationPostRaw(
        {
          projectId,
          projectType: ProjectType.Permanent,
          baseCreateProjectModel: writeDto(WriteModelName.CreateProject, write),
        },
        { signal: job.signal },
      ),
    );
    job.applied(WorkflowStage.ConfigurationCompleted);
    const project = await this.api.json(
      this.api.projects.apiProjectsProjectIdGetRaw({ projectId }, { signal: job.signal }),
    );

    if (project.projectType !== ProjectType.Permanent) {
      throw new ToolError(
        ErrorCode.ReadbackMismatch,
        'Project creation was accepted but the permanent project type was not confirmed.',
        { effects: Effects.Applied, target: { project_id: projectId, branch_id: branchId } },
      );
    }
  }

  private async createBranchWithinDeadline(
    projectId: string,
    branchName: string,
    source: string,
    description: string | undefined,
    job: JobContext,
  ) {
    job.stage(WorkflowStage.PackingSources);
    const archive = await packSources(source, job.signal);

    try {
      const defaultBefore = await this.defaultBranch(projectId);
      job.stage(WorkflowStage.CreatingBranch);
      const branchId = await this.api.json(
        this.api.projects.apiProjectsProjectIdBranchesPostRaw(
          {
            projectId,
            branchBaseModel: { name: branchName, description },
          },
          { signal: job.signal },
        ),
      );

      if (!branchId) {
        throw new ToolError(ErrorCode.InvalidResponse, 'Branch creation omitted its ID.', { effects: Effects.Unknown });
      }

      job.applied(WorkflowStage.BranchCreated, { project_id: projectId, branch_id: branchId });
      job.stage(WorkflowStage.UploadingSources);
      await this.api.empty(
        this.api.store.apiStoreProjectIdBranchesBranchIdSourcesPostRaw(
          { projectId, branchId, archived: true },
          multipartArchive(archive, 'sources.zip', {}, job.signal),
        ),
      );
      job.applied(WorkflowStage.ArchiveUploaded);
      const readiness = await sourcesReady(this.api, projectId, branchId, archive.included_files);
      job.applied(WorkflowStage.SourcesReady);

      return {
        project_id: projectId,
        branch_id: branchId,
        sources_ready: true,
        effects: Effects.Applied,
        ...(await this.branchSelection(projectId, defaultBefore)),
        ...this.summary(archive),
        source_readiness: readiness.source_readiness,
        source_directory_verified: readiness.source_directory_verified,
      };
    } finally {
      await archive.cleanup();
    }
  }

  private async createWithinDeadline(
    source: string,
    name: string,
    branchName: string,
    description: string | undefined,
    scanChanges: JsonObject | undefined,
    job: JobContext,
  ) {
    job.stage(WorkflowStage.PackingSources);
    const archive = await packSources(source, job.signal);

    try {
      job.stage(WorkflowStage.CreatingProject);
      const ids = await this.api.json(
        this.api.store.apiStoreProjectArchivePostRaw(
          {},
          multipartArchive(archive, `${name}.zip`, { Name: branchName, Description: description ?? '' }, job.signal),
        ),
      );

      if (!ids?.projectId || !ids.branchId) {
        throw new ToolError(ErrorCode.InvalidResponse, 'Project creation response omitted project or branch ID.', {
          effects: Effects.Unknown,
        });
      }

      const { projectId, branchId } = ids;
      job.applied(WorkflowStage.ProjectCreated, { project_id: projectId, branch_id: branchId });
      await this.configureProject(projectId, branchId, name, job);

      if (scanChanges) {
        job.stage(WorkflowStage.ApplyingScanSettings);
        await new Settings(this.api).update(projectId, SettingsSection.Scan, scanChanges);
        job.applied(WorkflowStage.InitialScanSettingsSaved);
      }

      job.stage(WorkflowStage.VerifyingSources);
      const readiness = await sourcesReady(this.api, projectId, branchId, archive.included_files);
      job.applied(WorkflowStage.SourcesReady);

      return {
        project_id: projectId,
        branch_id: branchId,
        sources_ready: true,
        permanent: true,
        effects: Effects.Applied,
        ...this.summary(archive),
        source_readiness: readiness.source_readiness,
        source_directory_verified: readiness.source_directory_verified,
      };
    } finally {
      await archive.cleanup();
    }
  }

  private async uploadWithinDeadline(projectId: string, branchId: string, source: string, job: JobContext) {
    await new Findings(this.api).branch(projectId, branchId);
    const before = await this.api.json(this.api.branches.apiBranchesBranchIdGetRaw({ branchId }));
    job.stage(WorkflowStage.PackingSources);
    const archive = await packSources(source, job.signal);

    try {
      job.stage(WorkflowStage.UploadingSources);
      await this.api.empty(
        this.api.store.apiStoreProjectIdBranchesBranchIdSourcesPostRaw(
          { projectId, branchId, archived: true },
          multipartArchive(archive, 'sources.zip', {}, job.signal),
        ),
      );
      job.applied(WorkflowStage.ArchiveUploaded, { project_id: projectId, branch_id: branchId });
      job.stage(WorkflowStage.VerifyingSources);
      const after = await sourcesReady(this.api, projectId, branchId, archive.included_files);

      if (before.sourcesChangingDate === after.sourcesChangingDate) {
        throw new ToolError(
          ErrorCode.SourceReadinessUnknown,
          'Upload was accepted, but the branch source revision did not confirm readiness.',
          { effects: Effects.Applied, target: { project_id: projectId, branch_id: branchId } },
        );
      }

      job.applied(WorkflowStage.SourcesReady);

      return {
        project_id: projectId,
        branch_id: branchId,
        sources_ready: true,
        sources_changing_date: after.sourcesChangingDate,
        effects: Effects.Applied,
        ...this.summary(archive),
        source_readiness: after.source_readiness,
        source_directory_verified: after.source_directory_verified,
      };
    } finally {
      await archive.cleanup();
    }
  }

  private async downloadWithinDeadline(
    projectId: string,
    branchId: string,
    destination: string,
    scanId: string | undefined,
    job: JobContext,
  ) {
    await new Findings(this.api).branch(projectId, branchId);

    if (scanId) {
      await new Findings(this.api).scan(projectId, scanId, branchId);
    }

    job.stage(WorkflowStage.DownloadingSources);
    job.check();
    const response = await this.api.response(
      this.api.store.apiStoreProjectIdBranchesBranchIdSourcesGetRaw({ projectId, branchId }, { signal: job.signal }),
    );

    const saved = await downloadArchive(response, destination, job.signal);
    job.applied(WorkflowStage.SourcesPublished, { project_id: projectId, branch_id: branchId });

    return { project_id: projectId, branch_id: branchId, scan_id: scanId, ...saved, effects: Effects.Applied };
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

    if (job.signal.aborted) {
      abort();
    }

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

  private async defaultBranch(projectId: string): Promise<string | null> {
    try {
      return await this.api.json(this.api.projects.apiProjectsProjectIdBranchesWorkingGetRaw({ projectId }));
    } catch {
      return null;
    }
  }

  private async branchSelection(projectId: string, before: string | null) {
    const after = await this.defaultBranch(projectId);

    return {
      working_branch_selection_changed: false,
      default_branch_before: before,
      default_branch_after: after,
      default_branch_changed: before && after ? before !== after : null,
      default_branch_note:
        'AIE derives the Plugin default from scan/creation dates; creating or scanning a branch may recompute it without changing user selection.',
    };
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
    };
  }
}
