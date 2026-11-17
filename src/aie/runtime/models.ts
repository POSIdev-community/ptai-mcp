export const JobState = {
  Running: 'running',
  Cancelling: 'cancelling',
  Succeeded: 'succeeded',
  Failed: 'failed',
  Cancelled: 'cancelled',
} as const;
export type JobState = (typeof JobState)[keyof typeof JobState];
export const WorkflowStage = {
  Accepted: 'accepted',
  PackingSources: 'packing_sources',
  CreatingProject: 'creating_project',
  CreatingBranch: 'creating_branch',
  BranchCreated: 'branch_created',
  ProjectCreated: 'project_created',
  CompletingConfiguration: 'completing_configuration',
  ConfigurationCompleted: 'configuration_completed',
  ApplyingScanSettings: 'applying_scan_settings',
  InitialScanSettingsSaved: 'initial_scan_settings_saved',
  VerifyingSources: 'verifying_sources',
  SourcesReady: 'sources_ready',
  UploadingSources: 'uploading_sources',
  ArchiveUploaded: 'archive_uploaded',
  DownloadingSources: 'downloading_sources',
  SourcesPublished: 'sources_published',
  CheckingSources: 'checking_sources',
  QueueingScan: 'queueing_scan',
  ScanQueued: 'scan_queued',
} as const;

export interface JobContext {
  signal: AbortSignal;
  check(): void;
  stage(name: string): void;
  applied(stage: string, ids?: Record<string, unknown>): void;
  remember?(ids: Record<string, unknown>): void;
  cancellationRequested?(): boolean;
}
