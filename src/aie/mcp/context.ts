import type { JsonObject } from '../../shared/json.js';
import { type ConnectedSession } from '../auth/models.js';
import type { PmCatalog } from '../pm/catalog.js';
import type { Findings } from '../projects/findings.js';
import { type JobContext } from '../runtime/models.js';
import { type Operations } from '../runtime/operations.js';
import type { Pages } from '../runtime/pagination.js';
import type { Scans } from '../scans/scan-service.js';
import type { ScanStatus } from '../scans/scan-status.js';
import type { Settings } from '../settings/project-settings.js';
import type { Sources } from '../sources/source-service.js';
import type { ConnectedToolName, PageArguments } from './tool-contract.js';

export interface ToolContext {
  session: ConnectedSession;
  operations: Operations;
  pages: Pages;
  findings: Findings;
  settings: Settings;
  pm: PmCatalog;
  scans: Scans;
  sources: Sources;
  list(
    name: ConnectedToolName,
    query: JsonObject,
    page: PageArguments,
    load: () => Promise<unknown[]>,
  ): ReturnType<Pages['list']>;
  startOperation(
    name: ConnectedToolName,
    run: (job: JobContext) => Promise<JsonObject>,
  ): ReturnType<Operations['start']>;
  observeScan(status: ScanStatus): void;
}
