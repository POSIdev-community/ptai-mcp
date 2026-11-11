/* tslint:disable */
/* eslint-disable */
/**
 *
 * @export
 * @interface AccessTokenCreateModel
 */
export interface AccessTokenCreateModel {
    /**
     *
     * @type {string}
     * @memberof AccessTokenCreateModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof AccessTokenCreateModel
     */
    expiresDateTime?: string | null;
    /**
     *
     * @type {Array<AccessTokenScopeType>}
     * @memberof AccessTokenCreateModel
     */
    scopes?: Array<AccessTokenScopeType> | null;
}
/**
 *
 * @export
 * @interface AccessTokenCreatedModel
 */
export interface AccessTokenCreatedModel {
    /**
     *
     * @type {string}
     * @memberof AccessTokenCreatedModel
     */
    token?: string | null;
}
/**
 *
 * @export
 * @interface AccessTokenModel
 */
export interface AccessTokenModel {
    /**
     *
     * @type {string}
     * @memberof AccessTokenModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof AccessTokenModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof AccessTokenModel
     */
    expiresDateTime?: string | null;
    /**
     *
     * @type {string}
     * @memberof AccessTokenModel
     */
    createdDateTime?: string;
    /**
     *
     * @type {Array<AccessTokenScopeType>}
     * @memberof AccessTokenModel
     */
    scopes?: Array<AccessTokenScopeType> | null;
    /**
     *
     * @type {UserModel}
     * @memberof AccessTokenModel
     */
    creator?: UserModel;
}

/**
 *
 * @export
 */
export const AccessTokenScopeType = {
    None: 'None',
    ScanAgent: 'ScanAgent',
    LightClientAndPlugins: 'LightClientAndPlugins'
} as const;
export type AccessTokenScopeType = typeof AccessTokenScopeType[keyof typeof AccessTokenScopeType];

/**
 *
 * @export
 * @interface AccessTokenValidationModel
 */
export interface AccessTokenValidationModel {
    /**
     *
     * @type {string}
     * @memberof AccessTokenValidationModel
     */
    value?: string | null;
}
/**
 *
 * @export
 * @interface ActiveScanModel
 */
export interface ActiveScanModel {
    /**
     *
     * @type {string}
     * @memberof ActiveScanModel
     */
    scanResultId?: string;
    /**
     *
     * @type {ScanProgressModel}
     * @memberof ActiveScanModel
     */
    progress?: ScanProgressModel;
    /**
     *
     * @type {ProjectModel}
     * @memberof ActiveScanModel
     */
    project?: ProjectModel;
    /**
     *
     * @type {BranchLightModel}
     * @memberof ActiveScanModel
     */
    branch?: BranchLightModel;
}
/**
 *
 * @export
 * @interface Agent
 */
export interface Agent {
    /**
     *
     * @type {string}
     * @memberof Agent
     */
    id: string;
    /**
     *
     * @type {string}
     * @memberof Agent
     */
    name: string;
    /**
     *
     * @type {string}
     * @memberof Agent
     */
    version: string;
    /**
     *
     * @type {AgentOperatingSystem}
     * @memberof Agent
     */
    operatingSystem: AgentOperatingSystem;
    /**
     *
     * @type {string}
     * @memberof Agent
     */
    lastActiveDateTime: string;
    /**
     *
     * @type {AgentStatus}
     * @memberof Agent
     */
    status: AgentStatus;
    /**
     *
     * @type {boolean}
     * @memberof Agent
     */
    disabled: boolean;
    /**
     *
     * @type {boolean}
     * @memberof Agent
     */
    stuck: boolean;
    /**
     *
     * @type {string}
     * @memberof Agent
     */
    scanResultId?: string | null;
}
/**
 *
 * @export
 * @interface AgentEnvironmentModel
 */
export interface AgentEnvironmentModel {
    /**
     *
     * @type {ComponentVersionModel}
     * @memberof AgentEnvironmentModel
     */
    agentVersion?: ComponentVersionModel;
    /**
     *
     * @type {Array<ComponentVersionModel>}
     * @memberof AgentEnvironmentModel
     */
    componentVersions?: Array<ComponentVersionModel> | null;
    /**
     *
     * @type {boolean}
     * @memberof AgentEnvironmentModel
     */
    fullRescanOnNewFilesAdded?: boolean;
}

/**
 *
 * @export
 */
export const AgentOperatingSystem = {
    Linux: 'Linux',
    Windows: 'Windows'
} as const;
export type AgentOperatingSystem = typeof AgentOperatingSystem[keyof typeof AgentOperatingSystem];


/**
 *
 * @export
 */
export const AgentStatus = {
    Registering: 'Registering',
    Pending: 'Pending',
    Scanning: 'Scanning'
} as const;
export type AgentStatus = typeof AgentStatus[keyof typeof AgentStatus];

/**
 *
 * @export
 * @interface AgentWithScan
 */
export interface AgentWithScan {
    /**
     *
     * @type {Agent}
     * @memberof AgentWithScan
     */
    agent: Agent;
    /**
     *
     * @type {ScanInfo}
     * @memberof AgentWithScan
     */
    scan?: ScanInfo | null;
}
/**
 *
 * @export
 * @interface AgentsMetricsStatus
 */
export interface AgentsMetricsStatus {
    /**
     *
     * @type {AgentsMetricsStatusAgents}
     * @memberof AgentsMetricsStatus
     */
    agents: AgentsMetricsStatusAgents;
}
/**
 *
 * @export
 * @interface AgentsMetricsStatusAgents
 */
export interface AgentsMetricsStatusAgents {
    /**
     *
     * @type {number}
     * @memberof AgentsMetricsStatusAgents
     */
    total: number;
    /**
     *
     * @type {number}
     * @memberof AgentsMetricsStatusAgents
     */
    enabled: number;
    /**
     *
     * @type {number}
     * @memberof AgentsMetricsStatusAgents
     */
    disabled: number;
    /**
     *
     * @type {number}
     * @memberof AgentsMetricsStatusAgents
     */
    scanning: number;
    /**
     *
     * @type {number}
     * @memberof AgentsMetricsStatusAgents
     */
    pending: number;
    /**
     *
     * @type {number}
     * @memberof AgentsMetricsStatusAgents
     */
    stuck: number;
    /**
     *
     * @type {Array<Agent>}
     * @memberof AgentsMetricsStatusAgents
     */
    details: Array<Agent>;
}
/**
 *
 * @export
 * @interface AiTriageIntegrationStatus
 */
export interface AiTriageIntegrationStatus {
    /**
     *
     * @type {boolean}
     * @memberof AiTriageIntegrationStatus
     */
    isEnabled: boolean;
    /**
     * Base URL of the AI Triage HTTP API for this installation (same value as backend AiTriage:BaseUrl). Returned on GET for UI display only; clients must not send this field on POST (ignored if present).

     * @type {string}
     * @memberof AiTriageIntegrationStatus
     */
    readonly publicBaseUrl?: string | null;
    /**
     * Whether manual AI triage is licensed (`license_features.parameters.ai_assistant` from FLUS license token). Returned on GET and POST; clients must not send this field on POST (ignored if present).

     * @type {boolean}
     * @memberof AiTriageIntegrationStatus
     */
    readonly aiAssistant?: boolean;
    /**
     * Whether automated AI triage is licensed (`license_features.parameters.ai_assistant_auto` from FLUS license token). Returned on GET and POST; clients must not send this field on POST (ignored if present).

     * @type {boolean}
     * @memberof AiTriageIntegrationStatus
     */
    readonly aiAssistantAuto?: boolean;
    /**
     * Whether the AI triage agreement is accepted according to persisted installation settings (DB). On GET/POST response this is the stored value. On POST request use `UpdateAiTriageIntegrationStatusRequest.agreementAccepted` — the client must send it explicitly.

     * @type {boolean}
     * @memberof AiTriageIntegrationStatus
     */
    agreementAccepted: boolean;
}

/**
 * AI triage lifecycle status for an issue
 * @export
 */
export const AiTriageStatus = {
    NotSet: 'NotSet',
    NotStarted: 'NotStarted',
    InProgress: 'InProgress',
    Finished: 'Finished',
    FinishedWithError: 'FinishedWithError'
} as const;
export type AiTriageStatus = typeof AiTriageStatus[keyof typeof AiTriageStatus];


/**
 *
 * @export
 */
export const AiTriageVerdict = {
    NotSet: 'NotSet',
    TruePositive: 'TruePositive',
    FalsePositive: 'FalsePositive',
    OutOfScope: 'OutOfScope'
} as const;
export type AiTriageVerdict = typeof AiTriageVerdict[keyof typeof AiTriageVerdict];

/**
 *
 * @export
 * @interface AnalysisRulesSettingsModel
 */
export interface AnalysisRulesSettingsModel {
    /**
     *
     * @type {boolean}
     * @memberof AnalysisRulesSettingsModel
     */
    applyAllPmRules: boolean;
    /**
     *
     * @type {Array<string>}
     * @memberof AnalysisRulesSettingsModel
     */
    pmGroupIds: Array<string>;
}
/**
 *
 * @export
 * @interface AnalysisRulesUpdateSettingsModel
 */
export interface AnalysisRulesUpdateSettingsModel {
    /**
     *
     * @type {boolean}
     * @memberof AnalysisRulesUpdateSettingsModel
     */
    applyAllPmRules: boolean;
    /**
     *
     * @type {Array<string>}
     * @memberof AnalysisRulesUpdateSettingsModel
     */
    pmGroupIds: Array<string>;
}
/**
 *
 * @export
 * @interface ApiErrorModel
 */
export interface ApiErrorModel {
    /**
     *
     * @type {ApiErrorType}
     * @memberof ApiErrorModel
     */
    errorCode?: ApiErrorType;
    /**
     *
     * @type {{ [key: string]: string; }}
     * @memberof ApiErrorModel
     */
    details?: { [key: string]: string; } | null;
}

/**
 *
 * @export
 */
export const ApiErrorType = {
    None: 'None',
    UserIdIsEmpty: 'USER_ID_IS_EMPTY',
    AccessTokenIsIncorrect: 'ACCESS_TOKEN_IS_INCORRECT',
    AccessTokenIdIsIncorrect: 'ACCESS_TOKEN_ID_IS_INCORRECT',
    AccessTokenWithSameNameAlreadyExists: 'ACCESS_TOKEN_WITH_SAME_NAME_ALREADY_EXISTS',
    UserNotFound: 'USER_NOT_FOUND',
    InitiatorNotFound: 'INITIATOR_NOT_FOUND',
    CannotAssignProjectRoleWithAllProjects: 'CANNOT_ASSIGN_PROJECT_ROLE_WITH_ALL_PROJECTS',
    UserIdIsIncorrect: 'USER_ID_IS_INCORRECT',
    UserUpsertFailed: 'USER_UPSERT_FAILED',
    RoleNotFound: 'ROLE_NOT_FOUND',
    RoleIsReadonly: 'ROLE_IS_READONLY',
    RoleAlreadyExists: 'ROLE_ALREADY_EXISTS',
    RoleUpsertFailed: 'ROLE_UPSERT_FAILED',
    RoleUpdateFailed: 'ROLE_UPDATE_FAILED',
    RoleDeleteFailed: 'ROLE_DELETE_FAILED',
    DomainUpsertFailed: 'DOMAIN_UPSERT_FAILED',
    DomainDeleteFailed: 'DOMAIN_DELETE_FAILED',
    MemberNotFound: 'MEMBER_NOT_FOUND',
    ExtAuthProvidersGetError: 'EXT_AUTH_PROVIDERS_GET_ERROR',
    ExtAuthProvidersAtLeastOneExistsLimitError: 'EXT_AUTH_PROVIDERS_AT_LEAST_ONE_EXISTS_LIMIT_ERROR',
    ExtAuthProviderNotFound: 'EXT_AUTH_PROVIDER_NOT_FOUND',
    ExtAuthProviderGetError: 'EXT_AUTH_PROVIDER_GET_ERROR',
    ExtAuthProviderUpdateError: 'EXT_AUTH_PROVIDER_UPDATE_ERROR',
    ExtAuthProviderDeleteError: 'EXT_AUTH_PROVIDER_DELETE_ERROR',
    ExtAuthProviderIsIncorrect: 'EXT_AUTH_PROVIDER_IS_INCORRECT',
    ExtAuthProviderSchemeIsIncorrect: 'EXT_AUTH_PROVIDER_SCHEME_IS_INCORRECT',
    ExtAuthProviderWithSameNameAlreadyExists: 'EXT_AUTH_PROVIDER_WITH_SAME_NAME_ALREADY_EXISTS',
    ExtAuthSettingsTestConnectionFailed: 'EXT_AUTH_SETTINGS_TEST_CONNECTION_FAILED',
    ExtAuthProviderLdapWithSameSettingsAlreadyExists: 'EXT_AUTH_PROVIDER_LDAP_WITH_SAME_SETTINGS_ALREADY_EXISTS',
    ExtAuthProviderForbidden: 'EXT_AUTH_PROVIDER_FORBIDDEN',
    ExtAuthSigninError: 'EXT_AUTH_SIGNIN_ERROR',
    ExtAuthSigninCallbackError: 'EXT_AUTH_SIGNIN_CALLBACK_ERROR',
    ExtAuthSigninProviderIsEmptyOrDisabled: 'EXT_AUTH_SIGNIN_PROVIDER_IS_EMPTY_OR_DISABLED',
    ExtAuthSigninScopeTypeIsIncorrect: 'EXT_AUTH_SIGNIN_SCOPE_TYPE_IS_INCORRECT',
    ExtAuthSigninProviderIsNotAuthenticated: 'EXT_AUTH_SIGNIN_PROVIDER_IS_NOT_AUTHENTICATED',
    ExtAuthSigninInvalidCredentials: 'EXT_AUTH_SIGNIN_INVALID_CREDENTIALS',
    ExtAuthSigninSchemeIsIncorrect: 'EXT_AUTH_SIGNIN_SCHEME_IS_INCORRECT',
    ExtAuthSigninOpenidInvalidConfiguration: 'EXT_AUTH_SIGNIN_OPENID_INVALID_CONFIGURATION',
    ExtAuthSigninSaml2ResponseStatusError: 'EXT_AUTH_SIGNIN_SAML2_RESPONSE_STATUS_ERROR',
    ExtAuthSigninSaml2InvalidSignature: 'EXT_AUTH_SIGNIN_SAML2_INVALID_SIGNATURE',
    ExtAuthSignOutOpenidError: 'EXT_AUTH_SIGN_OUT_OPENID_ERROR',
    ExtAuthSignOutSaml2Error: 'EXT_AUTH_SIGN_OUT_SAML2_ERROR',
    ExtAuthSessionGetError: 'EXT_AUTH_SESSION_GET_ERROR',
    ExtAuthUsersEmpty: 'EXT_AUTH_USERS_EMPTY',
    ExtAuthLdapSyncFailed: 'EXT_AUTH_LDAP_SYNC_FAILED',
    ExtLdapSyncAlreadyStarted: 'EXT_LDAP_SYNC_ALREADY_STARTED',
    UpdatePackageVersionIsAlreadyUploaded: 'UPDATE_PACKAGE_VERSION_IS_ALREADY_UPLOADED',
    UpdatePackageUploadedIsAlreadyStarted: 'UPDATE_PACKAGE_UPLOADED_IS_ALREADY_STARTED',
    UpdatePackageUnknownProduct: 'UPDATE_PACKAGE_UNKNOWN_PRODUCT',
    UpdatePackageVersionIsNotUploaded: 'UPDATE_PACKAGE_VERSION_IS_NOT_UPLOADED',
    UpdateServerProcessRunTimeout: 'UPDATE_SERVER_PROCESS_RUN_TIMEOUT',
    UpdateServerParametersInvalid: 'UPDATE_SERVER_PARAMETERS_INVALID',
    UpdateServerInstallerExitWithError: 'UPDATE_SERVER_INSTALLER_EXIT_WITH_ERROR',
    UpdateServerPackageIsIncorrect: 'UPDATE_SERVER_PACKAGE_IS_INCORRECT',
    UpdateServerNotEnoughSpace: 'UPDATE_SERVER_NOT_ENOUGH_SPACE',
    VersionMismatch: 'VERSION_MISMATCH',
    CertificateFileIsEmpty: 'CERTIFICATE_FILE_IS_EMPTY',
    CertificateIsAlreadyInstalled: 'CERTIFICATE_IS_ALREADY_INSTALLED',
    CertificateIsNotValid: 'CERTIFICATE_IS_NOT_VALID',
    UriIsNotValid: 'URI_IS_NOT_VALID',
    PortIsNotSpecified: 'PORT_IS_NOT_SPECIFIED',
    IncorrectDateValue: 'INCORRECT_DATE_VALUE',
    LogsNotFound: 'LOGS_NOT_FOUND',
    ExtLogSystemForbidden: 'EXT_LOG_SYSTEM_FORBIDDEN',
    ProjectWithSameNameAlreadyExists: 'PROJECT_WITH_SAME_NAME_ALREADY_EXISTS',
    UnexpectedScanStage: 'UNEXPECTED_SCAN_STAGE',
    ProjectNotFound: 'PROJECT_NOT_FOUND',
    UploadNotFound: 'UPLOAD_NOT_FOUND',
    ScanresultNotFound: 'SCANRESULT_NOT_FOUND',
    InvalidJsonFields: 'INVALID_JSON_FIELDS',
    InvalidBlackboxSettings: 'INVALID_BLACKBOX_SETTINGS',
    InvalidLocaleId: 'INVALID_LOCALE_ID',
    IncorrectSastRules: 'INCORRECT_SAST_RULES',
    IncorrectPmRule: 'INCORRECT_PM_RULE',
    UnexpectedLanguage: 'UNEXPECTED_LANGUAGE',
    MailProfileNotFound: 'MAIL_PROFILE_NOT_FOUND',
    UpdaterNotSet: 'UPDATER_NOT_SET',
    IssueNotFound: 'ISSUE_NOT_FOUND',
    ScansettingsNotFound: 'SCANSETTINGS_NOT_FOUND',
    InvalidQueryParameter: 'INVALID_QUERY_PARAMETER',
    InvalidPmRule: 'INVALID_PM_RULE',
    PmRuleNotFound: 'PM_RULE_NOT_FOUND',
    PmRuleVulnTypeNotFound: 'PM_RULE_VULN_TYPE_NOT_FOUND',
    PmRuleVulnTypeIsUsed: 'PM_RULE_VULN_TYPE_IS_USED',
    SystemPmRuleVulnTypeCannotBeDeleted: 'SYSTEM_PM_RULE_VULN_TYPE_CANNOT_BE_DELETED',
    PmRuleExportNotFound: 'PM_RULE_EXPORT_NOT_FOUND',
    PmRuleExportEmptyList: 'PM_RULE_EXPORT_EMPTY_LIST',
    PmRuleImportInvalidFormat: 'PM_RULE_IMPORT_INVALID_FORMAT',
    PmRuleImportNoFilesSent: 'PM_RULE_IMPORT_NO_FILES_SENT',
    PmRuleImportInvalidImportSettings: 'PM_RULE_IMPORT_INVALID_IMPORT_SETTINGS',
    EntityNotFound: 'ENTITY_NOT_FOUND',
    RowNotFound: 'ROW_NOT_FOUND',
    InvalidProjectType: 'INVALID_PROJECT_TYPE',
    WrongProjectId: 'WRONG_PROJECT_ID',
    ScanTypeIsNotFull: 'SCAN_TYPE_IS_NOT_FULL',
    CouldNotActualizeExistingProjectSettings: 'COULD_NOT_ACTUALIZE_EXISTING_PROJECT_SETTINGS',
    InvalidSourceType: 'INVALID_SOURCE_TYPE',
    SourceTypeCanNotBeChanged: 'SOURCE_TYPE_CAN_NOT_BE_CHANGED',
    SourcesSettingsNotFound: 'SOURCES_SETTINGS_NOT_FOUND',
    ProjectHasNoBranches: 'PROJECT_HAS_NO_BRANCHES',
    BranchNotFound: 'BRANCH_NOT_FOUND',
    EmptyBranchSettings: 'EMPTY_BRANCH_SETTINGS',
    EmptyBranchName: 'EMPTY_BRANCH_NAME',
    BranchWithSameNameAlreadyExists: 'BRANCH_WITH_SAME_NAME_ALREADY_EXISTS',
    OnlyBranchWithLocalSourceTypeCanBeUpdated: 'ONLY_BRANCH_WITH_LOCAL_SOURCE_TYPE_CAN_BE_UPDATED',
    LastBranchCanNotBeDeleted: 'LAST_BRANCH_CAN_NOT_BE_DELETED',
    MainBranchCanNotBeDeleted: 'MAIN_BRANCH_CAN_NOT_BE_DELETED',
    PmGroupNotFound: 'PM_GROUP_NOT_FOUND',
    IncorrectPmGroup: 'INCORRECT_PM_GROUP',
    ProjectQueueSettingsAlreadyExists: 'PROJECT_QUEUE_SETTINGS_ALREADY_EXISTS',
    InvalidPriorityType: 'INVALID_PRIORITY_TYPE',
    MissingPreferredAgents: 'MISSING_PREFERRED_AGENTS',
    ScanResultScanTypeTransitionIsNotAllowed: 'SCAN_RESULT_SCAN_TYPE_TRANSITION_IS_NOT_ALLOWED',
    ScanResultIsNotIncremental: 'SCAN_RESULT_IS_NOT_INCREMENTAL',
    MissingAipoj: 'MISSING_AIPOJ',
    EmptyAipoj: 'EMPTY_AIPOJ',
    IssueTrackerConnectionNotFound: 'ISSUE_TRACKER_CONNECTION_NOT_FOUND',
    IssueTrackerConnectionForbidden: 'ISSUE_TRACKER_CONNECTION_FORBIDDEN',
    IssueTrackerConnectionSettingsNotSet: 'ISSUE_TRACKER_CONNECTION_SETTINGS_NOT_SET',
    IssueTrackerConnectionFailed: 'ISSUE_TRACKER_CONNECTION_FAILED',
    IssueTrackerSettingsIdNotSet: 'ISSUE_TRACKER_SETTINGS_ID_NOT_SET',
    IssueTrackerCredentialsNotSet: 'ISSUE_TRACKER_CREDENTIALS_NOT_SET',
    IssueTrackerHostIsIncorrect: 'ISSUE_TRACKER_HOST_IS_INCORRECT',
    IssueTrackerOauthDataNotSet: 'ISSUE_TRACKER_OAUTH_DATA_NOT_SET',
    IssueTrackerTrackerNotFound: 'ISSUE_TRACKER_TRACKER_NOT_FOUND',
    IssueTrackerTrackerNotFoundWithOauth: 'ISSUE_TRACKER_TRACKER_NOT_FOUND_WITH_OAUTH',
    IssueTrackerInvalidTicketLink: 'ISSUE_TRACKER_INVALID_TICKET_LINK',
    IssueTrackerUnsupportedFieldsCofiguration: 'ISSUE_TRACKER_UNSUPPORTED_FIELDS_COFIGURATION',
    IssueTrackerTicketCreationFailed: 'ISSUE_TRACKER_TICKET_CREATION_FAILED',
    IssueTrackerPrioritiesGettingFailed: 'ISSUE_TRACKER_PRIORITIES_GETTING_FAILED',
    IssueTrackerUsersGettingFailed: 'ISSUE_TRACKER_USERS_GETTING_FAILED',
    IssueTrackerStatusesGettingFailed: 'ISSUE_TRACKER_STATUSES_GETTING_FAILED',
    IssueTrackerFieldsGettingFailed: 'ISSUE_TRACKER_FIELDS_GETTING_FAILED',
    IssueTrackerOptionsGettingFailed: 'ISSUE_TRACKER_OPTIONS_GETTING_FAILED',
    IssueTrackerExistingTicketsGettingFailed: 'ISSUE_TRACKER_EXISTING_TICKETS_GETTING_FAILED',
    IssueTrackerComponentsGettingFailed: 'ISSUE_TRACKER_COMPONENTS_GETTING_FAILED',
    IssueTrackerCaptchaChallenge: 'ISSUE_TRACKER_CAPTCHA_CHALLENGE',
    IssueTrackerAuthenticationDeniedDetailed: 'ISSUE_TRACKER_AUTHENTICATION_DENIED_DETAILED',
    IssueTrackerAuthenticationDenied: 'ISSUE_TRACKER_AUTHENTICATION_DENIED',
    IssueTrackerAuthenticationFailed: 'ISSUE_TRACKER_AUTHENTICATION_FAILED',
    IssueTrackerOauthSettingsInvalid: 'ISSUE_TRACKER_OAUTH_SETTINGS_INVALID',
    IssueTrackerOauthAuthenticationGettingAccessTokenFailed: 'ISSUE_TRACKER_OAUTH_AUTHENTICATION_GETTING_ACCESS_TOKEN_FAILED',
    IssueTrackerOauthAuthenticationInvalidAccessTokenReturned: 'ISSUE_TRACKER_OAUTH_AUTHENTICATION_INVALID_ACCESS_TOKEN_RETURNED',
    IssueTrackerOauthAuthenticationGettingRequestTokenFailed: 'ISSUE_TRACKER_OAUTH_AUTHENTICATION_GETTING_REQUEST_TOKEN_FAILED',
    IssueTrackerOauthAuthenticationInvalidRequestTokenReturned: 'ISSUE_TRACKER_OAUTH_AUTHENTICATION_INVALID_REQUEST_TOKEN_RETURNED',
    FsSourceIsBusy: 'FS_SOURCE_IS_BUSY',
    DirectoryNotFound: 'DIRECTORY_NOT_FOUND',
    InvalidArchiveData: 'INVALID_ARCHIVE_DATA',
    IssueAttachTicketLinkFailed: 'ISSUE_ATTACH_TICKET_LINK_FAILED',
    CommentPolicyFailedCommentIsEmpty: 'COMMENT_POLICY_FAILED_COMMENT_IS_EMPTY',
    ProjectsCountLimitedByLicense: 'PROJECTS_COUNT_LIMITED_BY_LICENSE',
    LicenseFileIsInvalid: 'LICENSE_FILE_IS_INVALID',
    LicenseExpired: 'LICENSE_EXPIRED',
    ActiveLicenseNotFound: 'ACTIVE_LICENSE_NOT_FOUND',
    LicenseFingerprintError: 'LICENSE_FINGERPRINT_ERROR',
    LicenseWithoutFingerprint: 'LICENSE_WITHOUT_FINGERPRINT',
    LanguageNotAllowedByLicence: 'LANGUAGE_NOT_ALLOWED_BY_LICENCE',
    LicensedAgentsLimitExceed: 'LICENSED_AGENTS_LIMIT_EXCEED',
    CouldNotStoreLicense: 'COULD_NOT_STORE_LICENSE',
    LicenseServiceNotAvailable: 'LICENSE_SERVICE_NOT_AVAILABLE',
    LicenseUnlicensedUsage: 'LICENSE_UNLICENSED_USAGE',
    LicenseVariantNotSupported: 'LICENSE_VARIANT_NOT_SUPPORTED',
    NonVcsProject: 'NON_VCS_PROJECT',
    UnknownSourceVersionControlSystem: 'UNKNOWN_SOURCE_VERSION_CONTROL_SYSTEM',
    SourceVersionControlSystemError: 'SOURCE_VERSION_CONTROL_SYSTEM_ERROR',
    InvalidVersionControlSystemSettings: 'INVALID_VERSION_CONTROL_SYSTEM_SETTINGS',
    InvalidVersionControlSystemSettingsUri: 'INVALID_VERSION_CONTROL_SYSTEM_SETTINGS_URI',
    OperationNotExists: 'OPERATION_NOT_EXISTS',
    ScanAgentNotFound: 'SCAN_AGENT_NOT_FOUND',
    ScanAlreadyScheduled: 'SCAN_ALREADY_SCHEDULED',
    IncorrectAgentStatus: 'INCORRECT_AGENT_STATUS',
    ScanAgentWasSuspended: 'SCAN_AGENT_WAS_SUSPENDED',
    ScanAgentIsScanning: 'SCAN_AGENT_IS_SCANNING',
    ScanAgentStuck: 'SCAN_AGENT_STUCK',
    ScanAgentNotDisabled: 'SCAN_AGENT_NOT_DISABLED',
    ScanAgentRegistering: 'SCAN_AGENT_REGISTERING',
    ScanAgentNotPending: 'SCAN_AGENT_NOT_PENDING',
    ScanNotFound: 'SCAN_NOT_FOUND',
    ActiveScanAgentsNotFound: 'ACTIVE_SCAN_AGENTS_NOT_FOUND',
    NoActiveScanAgentThatSupportsLanguage: 'NO_ACTIVE_SCAN_AGENT_THAT_SUPPORTS_LANGUAGE',
    PreferredAgentsNotFound: 'PREFERRED_AGENTS_NOT_FOUND',
    EmptyScanResult: 'EMPTY_SCAN_RESULT',
    ScanAgentIsActive: 'SCAN_AGENT_IS_ACTIVE',
    SchedulingIsLocked: 'SCHEDULING_IS_LOCKED',
    ScanAgentNumberExceed: 'SCAN_AGENT_NUMBER_EXCEED',
    NoScanModules: 'NO_SCAN_MODULES',
    OnlyBlackboxIsNotAllowed: 'ONLY_BLACKBOX_IS_NOT_ALLOWED',
    ScanIsProcessing: 'SCAN_IS_PROCESSING',
    ScanNotProcessingByAnyAgent: 'SCAN_NOT_PROCESSING_BY_ANY_AGENT',
    ScanAlreadyEnqueued: 'SCAN_ALREADY_ENQUEUED',
    QueueItemNotFound: 'QUEUE_ITEM_NOT_FOUND',
    QueueItemAlreadyAssignedToAgent: 'QUEUE_ITEM_ALREADY_ASSIGNED_TO_AGENT',
    ServerCertificateNotFound: 'SERVER_CERTIFICATE_NOT_FOUND',
    FilesystemErrorAccessDenied: 'FILESYSTEM_ERROR_ACCESS_DENIED',
    InvalidLimitSize: 'INVALID_LIMIT_SIZE',
    InvalidContentType: 'INVALID_CONTENT_TYPE',
    VaultCredentialsNotFound: 'VAULT_CREDENTIALS_NOT_FOUND',
    ReportTemplateNotFound: 'REPORT_TEMPLATE_NOT_FOUND',
    ReportGenerateFailed: 'REPORT_GENERATE_FAILED',
    ReportTemplateInvalid: 'REPORT_TEMPLATE_INVALID',
    ReportIncorrectParameters: 'REPORT_INCORRECT_PARAMETERS',
    ReportTemplateWithSameNameAlreadyExists: 'REPORT_TEMPLATE_WITH_SAME_NAME_ALREADY_EXISTS',
    ReportTemplateFileNameIncorrectMacros: 'REPORT_TEMPLATE_FILE_NAME_INCORRECT_MACROS',
    ReportTemplateInvalidFileName: 'REPORT_TEMPLATE_INVALID_FILE_NAME',
    InvalidVersionControlSystemConnectionSettings: 'INVALID_VERSION_CONTROL_SYSTEM_CONNECTION_SETTINGS',
    CouldNotStoreProject: 'COULD_NOT_STORE_PROJECT',
    CouldNotStoreScanSettings: 'COULD_NOT_STORE_SCAN_SETTINGS',
    FilesForDownloadNotFound: 'FILES_FOR_DOWNLOAD_NOT_FOUND',
    ProjectsFilesNotFound: 'PROJECTS_FILES_NOT_FOUND',
    InvalidUploadPath: 'INVALID_UPLOAD_PATH',
    InvalidPathParameter: 'INVALID_PATH_PARAMETER',
    TooManyFiles: 'TOO_MANY_FILES',
    CheckoutFailed: 'CHECKOUT_FAILED',
    EmptyCheckoutSettings: 'EMPTY_CHECKOUT_SETTINGS',
    CouldNotChangeVcsConnectionSettings: 'COULD_NOT_CHANGE_VCS_CONNECTION_SETTINGS',
    CouldNotChangeVcsTargetEnv: 'COULD_NOT_CHANGE_VCS_TARGET_ENV',
    OperationNotApplicableToVirtualBranch: 'OPERATION_NOT_APPLICABLE_TO_VIRTUAL_BRANCH',
    OperationNotApplicableToProjectsOfThisType: 'OPERATION_NOT_APPLICABLE_TO_PROJECTS_OF_THIS_TYPE',
    InvalidProjectTargetBasedType: 'INVALID_PROJECT_TARGET_BASED_TYPE',
    ProjectTargetBasedTypeNotSupported: 'PROJECT_TARGET_BASED_TYPE_NOT_SUPPORTED',
    IncompatibleVersion: 'INCOMPATIBLE_VERSION',
    CannotMergeScanHistory: 'CANNOT_MERGE_SCAN_HISTORY',
    ConflictingEntities: 'CONFLICTING_ENTITIES',
    ProxyHostConnectionForbidden: 'PROXY_HOST_CONNECTION_FORBIDDEN',
    ProxyHostConnectionInvalid: 'PROXY_HOST_CONNECTION_INVALID',
    SmtpHostConnectionForbidden: 'SMTP_HOST_CONNECTION_FORBIDDEN',
    InvalidModulesForSecretDetection: 'INVALID_MODULES_FOR_SECRET_DETECTION',
    InvalidLanguageForMaliciousCode: 'INVALID_LANGUAGE_FOR_MALICIOUS_CODE',
    InvalidSemgrepRule: 'INVALID_SEMGREP_RULE',
    YamlTooLarge: 'YAML_TOO_LARGE',
    ModuleNotAllowedByLicence: 'MODULE_NOT_ALLOWED_BY_LICENCE',
    PackageTypeNotFound: 'PACKAGE_TYPE_NOT_FOUND',
    PackageStatusNotFound: 'PACKAGE_STATUS_NOT_FOUND',
    PackageVersionIsOutdated: 'PACKAGE_VERSION_IS_OUTDATED',
    UploadAlreadyInProgress: 'UPLOAD_ALREADY_IN_PROGRESS',
    PackageNotFound: 'PACKAGE_NOT_FOUND',
    PackageIsIncorrect: 'PACKAGE_IS_INCORRECT',
    PackageVersionAlreadyExists: 'PACKAGE_VERSION_ALREADY_EXISTS',
    AiTriageIntegrationDisabled: 'AI_TRIAGE_INTEGRATION_DISABLED',
    AiTriageIntegrationUnavailable: 'AI_TRIAGE_INTEGRATION_UNAVAILABLE',
    AiTriageAgreementNotAccepted: 'AI_TRIAGE_AGREEMENT_NOT_ACCEPTED',
    AiTriageAutoNotLicensed: 'AI_TRIAGE_AUTO_NOT_LICENSED',
    AiTriageUnsupportedIssueType: 'AI_TRIAGE_UNSUPPORTED_ISSUE_TYPE',
    CannotAssignRoleWithBroaderPermissions: 'CANNOT_ASSIGN_ROLE_WITH_BROADER_PERMISSIONS',
    SecurityPolicyIsAlreadyConfirmed: 'SECURITY_POLICY_IS_ALREADY_CONFIRMED',
    InvalidCandidate: 'INVALID_CANDIDATE',
    InvalidVulnerabilityType: 'INVALID_VULNERABILITY_TYPE',
    CommitFailed: 'COMMIT_FAILED',
    ScanAgentDidNotSetStatus: 'SCAN_AGENT_DID_NOT_SET_STATUS'
} as const;
export type ApiErrorType = typeof ApiErrorType[keyof typeof ApiErrorType];

/**
 * @type ApiTrackerConnectionsConnectionIdTicketsPost200Response
 *
 * @export
 */
export type ApiTrackerConnectionsConnectionIdTicketsPost200Response = { type: 'jira' } & JiraTicketLinkModel;

/**
 *
 * @export
 */
export const AuthProviderScheme = {
    OpenIdConnect: 'OpenIdConnect',
    Saml2: 'Saml2',
    Ldap: 'Ldap'
} as const;
export type AuthProviderScheme = typeof AuthProviderScheme[keyof typeof AuthProviderScheme];

/**
 *
 * @export
 * @interface AuthProviderSettingsBaseModel
 */
export interface AuthProviderSettingsBaseModel {
    /**
     *
     * @type {LdapSettingsModel}
     * @memberof AuthProviderSettingsBaseModel
     */
    ldap?: LdapSettingsModel;
    /**
     *
     * @type {OpenIdSettingsModel}
     * @memberof AuthProviderSettingsBaseModel
     */
    openId?: OpenIdSettingsModel;
    /**
     *
     * @type {Saml2SettingsModel}
     * @memberof AuthProviderSettingsBaseModel
     */
    saml2?: Saml2SettingsModel;
    /**
     *
     * @type {Array<UserMappingModel>}
     * @memberof AuthProviderSettingsBaseModel
     */
    userMappings?: Array<UserMappingModel> | null;
    /**
     *
     * @type {Array<RoleMappingModel>}
     * @memberof AuthProviderSettingsBaseModel
     */
    roleMappings?: Array<RoleMappingModel> | null;
    /**
     *
     * @type {string}
     * @memberof AuthProviderSettingsBaseModel
     */
    name?: string | null;
    /**
     *
     * @type {AuthProviderScheme}
     * @memberof AuthProviderSettingsBaseModel
     */
    scheme?: AuthProviderScheme;
}
/**
 *
 * @export
 * @interface AuthProviderSettingsModel
 */
export interface AuthProviderSettingsModel {
    /**
     *
     * @type {string}
     * @memberof AuthProviderSettingsModel
     */
    id?: string | null;
    /**
     *
     * @type {LdapSettingsModel}
     * @memberof AuthProviderSettingsModel
     */
    ldap?: LdapSettingsModel;
    /**
     *
     * @type {OpenIdSettingsModel}
     * @memberof AuthProviderSettingsModel
     */
    openId?: OpenIdSettingsModel;
    /**
     *
     * @type {Saml2SettingsModel}
     * @memberof AuthProviderSettingsModel
     */
    saml2?: Saml2SettingsModel;
    /**
     *
     * @type {Array<UserMappingModel>}
     * @memberof AuthProviderSettingsModel
     */
    userMappings?: Array<UserMappingModel> | null;
    /**
     *
     * @type {Array<RoleMappingModel>}
     * @memberof AuthProviderSettingsModel
     */
    roleMappings?: Array<RoleMappingModel> | null;
    /**
     *
     * @type {string}
     * @memberof AuthProviderSettingsModel
     */
    name?: string | null;
    /**
     *
     * @type {AuthProviderScheme}
     * @memberof AuthProviderSettingsModel
     */
    scheme?: AuthProviderScheme;
}
/**
 *
 * @export
 * @interface AuthResultModel
 */
export interface AuthResultModel {
    /**
     *
     * @type {string}
     * @memberof AuthResultModel
     */
    accessToken?: string | null;
    /**
     *
     * @type {string}
     * @memberof AuthResultModel
     */
    refreshToken?: string | null;
    /**
     *
     * @type {string}
     * @memberof AuthResultModel
     */
    expiredAt?: string;
}

/**
 *
 * @export
 */
export const AuthScope = {
    None: 'None',
    Internal: 'Internal',
    Web: 'Web',
    WebRefresh: 'WebRefresh',
    WebLongRefresh: 'WebLongRefresh',
    AccessToken: 'AccessToken',
    AccessTokenRefresh: 'AccessTokenRefresh',
    Plugin: 'Plugin',
    PluginRefresh: 'PluginRefresh'
} as const;
export type AuthScope = typeof AuthScope[keyof typeof AuthScope];


/**
 *
 * @export
 */
export const AuthType = {
    Form: 'Form',
    Http: 'Http',
    None: 'None',
    RawCookie: 'RawCookie'
} as const;
export type AuthType = typeof AuthType[keyof typeof AuthType];

/**
 *
 * @export
 * @interface BaseCreateProjectModel
 */
export interface BaseCreateProjectModel {
    /**
     *
     * @type {boolean}
     * @memberof BaseCreateProjectModel
     */
    automatedAiTriageEnabled?: boolean;
    /**
     *
     * @type {IssueLevel}
     * @memberof BaseCreateProjectModel
     */
    automatedAiTriageMinSeverity?: IssueLevel;
    /**
     *
     * @type {string}
     * @memberof BaseCreateProjectModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof BaseCreateProjectModel
     */
    name?: string | null;
    /**
     *
     * @type {Array<LegacyProgrammingLanguageGroup>}
     * @memberof BaseCreateProjectModel
     */
    languages?: Array<LegacyProgrammingLanguageGroup> | null;
    /**
     *
     * @type {string}
     * @memberof BaseCreateProjectModel
     */
    projectUrl?: string | null;
    /**
     *
     * @type {WhiteBoxSettingsModel}
     * @memberof BaseCreateProjectModel
     */
    whiteBox?: WhiteBoxSettingsModel;
    /**
     *
     * @type {boolean}
     * @memberof BaseCreateProjectModel
     */
    blackBoxEnabled?: boolean;
    /**
     *
     * @type {BlackBoxSettingsBaseModel}
     * @memberof BaseCreateProjectModel
     */
    blackBox?: BlackBoxSettingsBaseModel;
    /**
     *
     * @type {Priority}
     * @memberof BaseCreateProjectModel
     */
    priority?: Priority;
    /**
     *
     * @type {PreferredAgentsSettings}
     * @memberof BaseCreateProjectModel
     */
    preferredAgentsSettings?: PreferredAgentsSettings;
    /**
     *
     * @type {ProjectTargetBasedType}
     * @memberof BaseCreateProjectModel
     */
    projectTargetBasedType?: ProjectTargetBasedType;
}
/**
 *
 * @export
 * @interface BaseCveFeedSettings
 */
export interface BaseCveFeedSettings {
    /**
     *
     * @type {string}
     * @memberof BaseCveFeedSettings
     */
    modifiedUrl?: string | null;
    /**
     *
     * @type {string}
     * @memberof BaseCveFeedSettings
     */
    baseUrl?: string | null;
    /**
     *
     * @type {string}
     * @memberof BaseCveFeedSettings
     */
    retireJsUrl?: string | null;
    /**
     *
     * @type {string}
     * @memberof BaseCveFeedSettings
     */
    cisaKnownExploitedUrl?: string | null;
}
/**
 *
 * @export
 * @interface BaseTicketLinkModel
 */
export interface BaseTicketLinkModel {
    /**
     *
     * @type {TrackerType}
     * @memberof BaseTicketLinkModel
     */
    trackerType?: TrackerType;
    /**
     *
     * @type {string}
     * @memberof BaseTicketLinkModel
     */
    readonly connectionId?: string;
    /**
     *
     * @type {string}
     * @memberof BaseTicketLinkModel
     */
    ticketId?: string | null;
}
/**
 *
 * @export
 * @interface BasicCredentialsModel
 */
export interface BasicCredentialsModel {
    /**
     *
     * @type {string}
     * @memberof BasicCredentialsModel
     */
    userName?: string | null;
    /**
     *
     * @type {string}
     * @memberof BasicCredentialsModel
     */
    password?: string | null;
}
/**
 *
 * @export
 * @interface BlackBoxAddressModel
 */
export interface BlackBoxAddressModel {
    /**
     *
     * @type {BlackBoxFormat}
     * @memberof BlackBoxAddressModel
     */
    format?: BlackBoxFormat;
    /**
     *
     * @type {string}
     * @memberof BlackBoxAddressModel
     */
    address?: string | null;
}
/**
 *
 * @export
 * @interface BlackBoxAuthenticationFullModel
 */
export interface BlackBoxAuthenticationFullModel {
    /**
     *
     * @type {AuthType}
     * @memberof BlackBoxAuthenticationFullModel
     */
    type?: AuthType;
    /**
     *
     * @type {BlackBoxFormAuthenticationModel}
     * @memberof BlackBoxAuthenticationFullModel
     */
    form?: BlackBoxFormAuthenticationModel;
    /**
     *
     * @type {BlackBoxHttpAuthenticationModel}
     * @memberof BlackBoxAuthenticationFullModel
     */
    http?: BlackBoxHttpAuthenticationModel;
    /**
     *
     * @type {BlackBoxRawCookieAuthenticationModel}
     * @memberof BlackBoxAuthenticationFullModel
     */
    cookie?: BlackBoxRawCookieAuthenticationModel;
}
/**
 *
 * @export
 * @interface BlackBoxCredentialsModel
 */
export interface BlackBoxCredentialsModel {
    /**
     *
     * @type {CredentialsType}
     * @memberof BlackBoxCredentialsModel
     */
    type?: CredentialsType;
    /**
     *
     * @type {string}
     * @memberof BlackBoxCredentialsModel
     */
    credentials?: string | null;
}
/**
 *
 * @export
 * @interface BlackBoxFormAuthenticationModel
 */
export interface BlackBoxFormAuthenticationModel {
    /**
     *
     * @type {BlackBoxFormDetection}
     * @memberof BlackBoxFormAuthenticationModel
     */
    formDetection?: BlackBoxFormDetection;
    /**
     *
     * @type {string}
     * @memberof BlackBoxFormAuthenticationModel
     */
    loginKey?: string | null;
    /**
     *
     * @type {string}
     * @memberof BlackBoxFormAuthenticationModel
     */
    passwordKey?: string | null;
    /**
     *
     * @type {string}
     * @memberof BlackBoxFormAuthenticationModel
     */
    login?: string | null;
    /**
     *
     * @type {string}
     * @memberof BlackBoxFormAuthenticationModel
     */
    password?: string | null;
    /**
     *
     * @type {string}
     * @memberof BlackBoxFormAuthenticationModel
     */
    formAddress?: string | null;
    /**
     *
     * @type {string}
     * @memberof BlackBoxFormAuthenticationModel
     */
    formXPath?: string | null;
    /**
     *
     * @type {string}
     * @memberof BlackBoxFormAuthenticationModel
     */
    validationTemplate?: string | null;
}

/**
 *
 * @export
 */
export const BlackBoxFormDetection = {
    Auto: 'Auto',
    Manual: 'Manual'
} as const;
export type BlackBoxFormDetection = typeof BlackBoxFormDetection[keyof typeof BlackBoxFormDetection];


/**
 *
 * @export
 */
export const BlackBoxFormat = {
    Wildcard: 'Wildcard',
    ExactMatch: 'ExactMatch',
    RegExp: 'RegExp'
} as const;
export type BlackBoxFormat = typeof BlackBoxFormat[keyof typeof BlackBoxFormat];

/**
 *
 * @export
 * @interface BlackBoxHttpAuthenticationModel
 */
export interface BlackBoxHttpAuthenticationModel {
    /**
     *
     * @type {string}
     * @memberof BlackBoxHttpAuthenticationModel
     */
    login?: string | null;
    /**
     *
     * @type {string}
     * @memberof BlackBoxHttpAuthenticationModel
     */
    password?: string | null;
    /**
     *
     * @type {string}
     * @memberof BlackBoxHttpAuthenticationModel
     */
    validationAddress?: string | null;
}
/**
 *
 * @export
 * @interface BlackBoxProxySettingsModel
 */
export interface BlackBoxProxySettingsModel {
    /**
     *
     * @type {boolean}
     * @memberof BlackBoxProxySettingsModel
     */
    isActive?: boolean;
    /**
     *
     * @type {ProxyType}
     * @memberof BlackBoxProxySettingsModel
     */
    type?: ProxyType;
    /**
     *
     * @type {string}
     * @memberof BlackBoxProxySettingsModel
     */
    host?: string | null;
    /**
     *
     * @type {number}
     * @memberof BlackBoxProxySettingsModel
     */
    port?: number;
    /**
     *
     * @type {string}
     * @memberof BlackBoxProxySettingsModel
     */
    login?: string | null;
    /**
     *
     * @type {string}
     * @memberof BlackBoxProxySettingsModel
     */
    password?: string | null;
}
/**
 *
 * @export
 * @interface BlackBoxRawCookieAuthenticationModel
 */
export interface BlackBoxRawCookieAuthenticationModel {
    /**
     *
     * @type {string}
     * @memberof BlackBoxRawCookieAuthenticationModel
     */
    validationAddress?: string | null;
    /**
     *
     * @type {string}
     * @memberof BlackBoxRawCookieAuthenticationModel
     */
    validationTemplate?: string | null;
    /**
     *
     * @type {string}
     * @memberof BlackBoxRawCookieAuthenticationModel
     */
    cookie?: string | null;
}

/**
 *
 * @export
 */
export const BlackBoxScanLevel = {
    None: 'None',
    Fast: 'Fast',
    Normal: 'Normal',
    Full: 'Full'
} as const;
export type BlackBoxScanLevel = typeof BlackBoxScanLevel[keyof typeof BlackBoxScanLevel];

/**
 *
 * @export
 * @interface BlackBoxSettingsBaseModel
 */
export interface BlackBoxSettingsBaseModel {
    /**
     *
     * @type {string}
     * @memberof BlackBoxSettingsBaseModel
     */
    site?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof BlackBoxSettingsBaseModel
     */
    sslCheck?: boolean;
    /**
     *
     * @type {BlackBoxScanLevel}
     * @memberof BlackBoxSettingsBaseModel
     */
    level?: BlackBoxScanLevel;
    /**
     *
     * @type {ScanScope}
     * @memberof BlackBoxSettingsBaseModel
     */
    scanScope?: ScanScope;
    /**
     *
     * @type {Array<BlackBoxAddressModel>}
     * @memberof BlackBoxSettingsBaseModel
     */
    blackListedAddresses?: Array<BlackBoxAddressModel> | null;
    /**
     *
     * @type {Array<BlackBoxAddressModel>}
     * @memberof BlackBoxSettingsBaseModel
     */
    whiteListedAddresses?: Array<BlackBoxAddressModel> | null;
    /**
     *
     * @type {Array<HttpHeaderModel>}
     * @memberof BlackBoxSettingsBaseModel
     */
    additionalHttpHeaders?: Array<HttpHeaderModel> | null;
    /**
     *
     * @type {BlackBoxAuthenticationFullModel}
     * @memberof BlackBoxSettingsBaseModel
     */
    authentication?: BlackBoxAuthenticationFullModel;
    /**
     *
     * @type {BlackBoxProxySettingsModel}
     * @memberof BlackBoxSettingsBaseModel
     */
    proxySettings?: BlackBoxProxySettingsModel;
    /**
     *
     * @type {boolean}
     * @memberof BlackBoxSettingsBaseModel
     */
    runAutocheckAfterScan?: boolean;
}
/**
 *
 * @export
 * @interface BlackBoxSettingsModel
 */
export interface BlackBoxSettingsModel {
    /**
     *
     * @type {boolean}
     * @memberof BlackBoxSettingsModel
     */
    isActive?: boolean;
    /**
     *
     * @type {string}
     * @memberof BlackBoxSettingsModel
     */
    site?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof BlackBoxSettingsModel
     */
    sslCheck?: boolean;
    /**
     *
     * @type {BlackBoxScanLevel}
     * @memberof BlackBoxSettingsModel
     */
    level?: BlackBoxScanLevel;
    /**
     *
     * @type {ScanScope}
     * @memberof BlackBoxSettingsModel
     */
    scanScope?: ScanScope;
    /**
     *
     * @type {Array<BlackBoxAddressModel>}
     * @memberof BlackBoxSettingsModel
     */
    blackListedAddresses?: Array<BlackBoxAddressModel> | null;
    /**
     *
     * @type {Array<BlackBoxAddressModel>}
     * @memberof BlackBoxSettingsModel
     */
    whiteListedAddresses?: Array<BlackBoxAddressModel> | null;
    /**
     *
     * @type {Array<HttpHeaderModel>}
     * @memberof BlackBoxSettingsModel
     */
    additionalHttpHeaders?: Array<HttpHeaderModel> | null;
    /**
     *
     * @type {BlackBoxAuthenticationFullModel}
     * @memberof BlackBoxSettingsModel
     */
    authentication?: BlackBoxAuthenticationFullModel;
    /**
     *
     * @type {BlackBoxProxySettingsModel}
     * @memberof BlackBoxSettingsModel
     */
    proxySettings?: BlackBoxProxySettingsModel;
    /**
     *
     * @type {boolean}
     * @memberof BlackBoxSettingsModel
     */
    runAutocheckAfterScan?: boolean;
}
/**
 *
 * @export
 * @interface BlackboxVulnerabilityModel
 */
export interface BlackboxVulnerabilityModel {
    /**
     *
     * @type {string}
     * @memberof BlackboxVulnerabilityModel
     */
    title?: string | null;
    /**
     *
     * @type {string}
     * @memberof BlackboxVulnerabilityModel
     */
    scannedUrl?: string | null;
    /**
     *
     * @type {{ [key: string]: string; }}
     * @memberof BlackboxVulnerabilityModel
     */
    items?: { [key: string]: string; } | null;
    /**
     *
     * @type {IssueExploitDataModel}
     * @memberof BlackboxVulnerabilityModel
     */
    request?: IssueExploitDataModel;
    /**
     *
     * @type {IssueExploitDataModel}
     * @memberof BlackboxVulnerabilityModel
     */
    response?: IssueExploitDataModel;
}
/**
 *
 * @export
 * @interface BranchBaseModel
 */
export interface BranchBaseModel {
    /**
     *
     * @type {string}
     * @memberof BranchBaseModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof BranchBaseModel
     */
    description?: string | null;
}
/**
 *
 * @export
 * @interface BranchLightModel
 */
export interface BranchLightModel {
    /**
     *
     * @type {string}
     * @memberof BranchLightModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof BranchLightModel
     */
    name?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof BranchLightModel
     */
    isVirtual?: boolean;
}
/**
 *
 * @export
 * @interface BranchModel
 */
export interface BranchModel {
    /**
     *
     * @type {string}
     * @memberof BranchModel
     */
    id?: string;
    /**
     *
     * @type {boolean}
     * @memberof BranchModel
     */
    isVirtual?: boolean;
    /**
     *
     * @type {string}
     * @memberof BranchModel
     */
    sourcesChangingDate?: string;
    /**
     *
     * @type {UpdaterInfoModel}
     * @memberof BranchModel
     */
    sourcesUpdater?: UpdaterInfoModel;
    /**
     *
     * @type {boolean}
     * @memberof BranchModel
     */
    isWorking?: boolean;
    /**
     *
     * @type {string}
     * @memberof BranchModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof BranchModel
     */
    description?: string | null;
}
/**
 *
 * @export
 * @interface BranchWithScanInfoModel
 */
export interface BranchWithScanInfoModel {
    /**
     *
     * @type {string}
     * @memberof BranchWithScanInfoModel
     */
    id?: string;
    /**
     *
     * @type {boolean}
     * @memberof BranchWithScanInfoModel
     */
    isVirtual?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof BranchWithScanInfoModel
     */
    isWorking?: boolean;
    /**
     *
     * @type {ScanStatisticLightModel}
     * @memberof BranchWithScanInfoModel
     */
    lastScan?: ScanStatisticLightModel;
    /**
     *
     * @type {string}
     * @memberof BranchWithScanInfoModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof BranchWithScanInfoModel
     */
    description?: string | null;
}
/**
 *
 * @export
 * @interface BriefProjectInfo
 */
export interface BriefProjectInfo {
    /**
     *
     * @type {string}
     * @memberof BriefProjectInfo
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof BriefProjectInfo
     */
    projectName?: string | null;
}
/**
 *
 * @export
 * @interface CVSSItem
 */
export interface CVSSItem {
    /**
     *
     * @type {string}
     * @memberof CVSSItem
     */
    version: string;
    /**
     *
     * @type {number}
     * @memberof CVSSItem
     */
    score: number;
    /**
     *
     * @type {string}
     * @memberof CVSSItem
     */
    vector: string;
    /**
     *
     * @type {IssueLevel}
     * @memberof CVSSItem
     */
    severity: IssueLevel;
}
/**
 *
 * @export
 * @interface CertModel
 */
export interface CertModel {
    /**
     *
     * @type {string}
     * @memberof CertModel
     */
    name?: string | null;
}
/**
 *
 * @export
 * @interface CertificateInfoModel
 */
export interface CertificateInfoModel {
    /**
     *
     * @type {string}
     * @memberof CertificateInfoModel
     */
    thumbprint?: string | null;
    /**
     *
     * @type {string}
     * @memberof CertificateInfoModel
     */
    friendlyName?: string | null;
    /**
     *
     * @type {string}
     * @memberof CertificateInfoModel
     */
    subjectName?: string | null;
    /**
     *
     * @type {string}
     * @memberof CertificateInfoModel
     */
    dateStart?: string;
    /**
     *
     * @type {string}
     * @memberof CertificateInfoModel
     */
    dateEnd?: string;
    /**
     *
     * @type {number}
     * @memberof CertificateInfoModel
     */
    daysBeforeExpiry?: number | null;
    /**
     *
     * @type {string}
     * @memberof CertificateInfoModel
     */
    issuer?: string | null;
}
/**
 *
 * @export
 * @interface ChangeHistoryDetailModel
 */
export interface ChangeHistoryDetailModel {
    /**
     *
     * @type {string}
     * @memberof ChangeHistoryDetailModel
     */
    oldValue?: string | null;
    /**
     *
     * @type {string}
     * @memberof ChangeHistoryDetailModel
     */
    newValue?: string | null;
}
/**
 *
 * @export
 * @interface ChangeHistoryRowModel
 */
export interface ChangeHistoryRowModel {
    /**
     *
     * @type {number}
     * @memberof ChangeHistoryRowModel
     */
    id?: number;
    /**
     *
     * @type {InitiatorModel}
     * @memberof ChangeHistoryRowModel
     */
    initiator?: InitiatorModel;
    /**
     *
     * @type {string}
     * @memberof ChangeHistoryRowModel
     */
    branchId?: string;
    /**
     *
     * @type {ChangeObjectType}
     * @memberof ChangeHistoryRowModel
     */
    changeObjectType?: ChangeObjectType;
    /**
     *
     * @type {string}
     * @memberof ChangeHistoryRowModel
     */
    changedDateTime?: string;
    /**
     *
     * @type {string}
     * @memberof ChangeHistoryRowModel
     */
    relatedEntityId?: string | null;
    /**
     *
     * @type {string}
     * @memberof ChangeHistoryRowModel
     */
    comment?: string | null;
    /**
     *
     * @type {{ [key: string]: ChangeHistoryDetailModel; }}
     * @memberof ChangeHistoryRowModel
     */
    details?: { [key: string]: ChangeHistoryDetailModel; } | null;
    /**
     *
     * @type {SyncInfoModel}
     * @memberof ChangeHistoryRowModel
     */
    syncInfo?: SyncInfoModel;
    /**
     *
     * @type {ImportMetadataModel}
     * @memberof ChangeHistoryRowModel
     */
    importMetadata?: ImportMetadataModel;
}
/**
 *
 * @export
 * @interface ChangeIssueApprovalStateModel
 */
export interface ChangeIssueApprovalStateModel {
    /**
     *
     * @type {IssueApprovalState}
     * @memberof ChangeIssueApprovalStateModel
     */
    state?: IssueApprovalState;
    /**
     *
     * @type {string}
     * @memberof ChangeIssueApprovalStateModel
     */
    comment?: string | null;
}
/**
 *
 * @export
 * @interface ChangeIssueCommentModel
 */
export interface ChangeIssueCommentModel {
    /**
     *
     * @type {string}
     * @memberof ChangeIssueCommentModel
     */
    comment?: string | null;
}
/**
 *
 * @export
 * @interface ChangeIssueIsFavoriteModel
 */
export interface ChangeIssueIsFavoriteModel {
    /**
     *
     * @type {boolean}
     * @memberof ChangeIssueIsFavoriteModel
     */
    isFavorite?: boolean;
    /**
     *
     * @type {string}
     * @memberof ChangeIssueIsFavoriteModel
     */
    comment?: string | null;
}
/**
 *
 * @export
 * @interface ChangeIssuesApprovalStateByHashIdModel
 */
export interface ChangeIssuesApprovalStateByHashIdModel {
    /**
     *
     * @type {{ [key: string]: IssueApprovalState; }}
     * @memberof ChangeIssuesApprovalStateByHashIdModel
     */
    issuesStates?: { [key: string]: IssueApprovalState; } | null;
    /**
     *
     * @type {string}
     * @memberof ChangeIssuesApprovalStateByHashIdModel
     */
    comment?: string | null;
    /**
     *
     * @type {string}
     * @memberof ChangeIssuesApprovalStateByHashIdModel
     */
    scanResultId?: string;
}
/**
 *
 * @export
 * @interface ChangeIssuesApprovalStateModel
 */
export interface ChangeIssuesApprovalStateModel {
    /**
     *
     * @type {IssueApprovalState}
     * @memberof ChangeIssuesApprovalStateModel
     */
    state?: IssueApprovalState;
    /**
     *
     * @type {Array<string>}
     * @memberof ChangeIssuesApprovalStateModel
     */
    issueIds?: Array<string> | null;
    /**
     *
     * @type {string}
     * @memberof ChangeIssuesApprovalStateModel
     */
    comment?: string | null;
}
/**
 *
 * @export
 * @interface ChangeIssuesFavoriteModel
 */
export interface ChangeIssuesFavoriteModel {
    /**
     *
     * @type {Array<string>}
     * @memberof ChangeIssuesFavoriteModel
     */
    issues?: Array<string> | null;
    /**
     *
     * @type {boolean}
     * @memberof ChangeIssuesFavoriteModel
     */
    isFavorite?: boolean;
}

/**
 *
 * @export
 */
export const ChangeObjectType = {
    None: 'None',
    IssueApprovalState: 'IssueApprovalState',
    Comment: 'Comment',
    Ticket: 'Ticket',
    Exploit: 'Exploit',
    Favorite: 'Favorite',
    ScanQueueItem: 'ScanQueueItem'
} as const;
export type ChangeObjectType = typeof ChangeObjectType[keyof typeof ChangeObjectType];

/**
 *
 * @export
 * @interface CheckPermissionRequestModel
 */
export interface CheckPermissionRequestModel {
    /**
     *
     * @type {boolean}
     * @memberof CheckPermissionRequestModel
     */
    allowExpiredAccessToken?: boolean;
    /**
     *
     * @type {Array<PermissionType>}
     * @memberof CheckPermissionRequestModel
     */
    permissions?: Array<PermissionType> | null;
    /**
     *
     * @type {string}
     * @memberof CheckPermissionRequestModel
     */
    projectId?: string | null;
    /**
     *
     * @type {PermissionCheckStrategy}
     * @memberof CheckPermissionRequestModel
     */
    permissionCheckStrategy?: PermissionCheckStrategy;
}
/**
 *
 * @export
 * @interface CodeChunkInputModel
 */
export interface CodeChunkInputModel {
    /**
     *
     * @type {string}
     * @memberof CodeChunkInputModel
     */
    file?: string | null;
    /**
     *
     * @type {string}
     * @memberof CodeChunkInputModel
     */
    value?: string | null;
    /**
     *
     * @type {number}
     * @memberof CodeChunkInputModel
     */
    beginLine?: number;
    /**
     *
     * @type {number}
     * @memberof CodeChunkInputModel
     */
    endLine?: number;
    /**
     *
     * @type {number}
     * @memberof CodeChunkInputModel
     */
    beginColumn?: number;
    /**
     *
     * @type {number}
     * @memberof CodeChunkInputModel
     */
    endColumn?: number;
}
/**
 *
 * @export
 * @interface CodeChunkModel
 */
export interface CodeChunkModel {
    /**
     *
     * @type {string}
     * @memberof CodeChunkModel
     */
    file?: string | null;
    /**
     *
     * @type {string}
     * @memberof CodeChunkModel
     */
    value?: string | null;
    /**
     *
     * @type {number}
     * @memberof CodeChunkModel
     */
    beginLine?: number;
    /**
     *
     * @type {number}
     * @memberof CodeChunkModel
     */
    endLine?: number;
    /**
     *
     * @type {number}
     * @memberof CodeChunkModel
     */
    beginColumn?: number;
    /**
     *
     * @type {number}
     * @memberof CodeChunkModel
     */
    endColumn?: number;
}
/**
 *
 * @export
 * @interface ComponentVersionModel
 */
export interface ComponentVersionModel {
    /**
     *
     * @type {string}
     * @memberof ComponentVersionModel
     */
    type?: string | null;
    /**
     *
     * @type {string}
     * @memberof ComponentVersionModel
     */
    version?: string | null;
}
/**
 *
 * @export
 * @interface ConnectionModel
 */
export interface ConnectionModel {
    /**
     *
     * @type {string}
     * @memberof ConnectionModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof ConnectionModel
     */
    host?: string | null;
    /**
     *
     * @type {TrackerType}
     * @memberof ConnectionModel
     */
    trackerType?: TrackerType;
}
/**
 *
 * @export
 * @interface ConnectionSettingsModel
 */
export interface ConnectionSettingsModel {
    /**
     *
     * @type {string}
     * @memberof ConnectionSettingsModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof ConnectionSettingsModel
     */
    host?: string | null;
    /**
     *
     * @type {TrackerType}
     * @memberof ConnectionSettingsModel
     */
    trackerType?: TrackerType;
    /**
     *
     * @type {CredentialsModel}
     * @memberof ConnectionSettingsModel
     */
    credentials?: CredentialsModel;
}
/**
 *
 * @export
 * @interface CreateProjectModel
 */
export interface CreateProjectModel {
    /**
     *
     * @type {ProjectSettingsUpdateModel}
     * @memberof CreateProjectModel
     */
    settings?: ProjectSettingsUpdateModel;
    /**
     *
     * @type {boolean}
     * @memberof CreateProjectModel
     */
    isTemp?: boolean;
    /**
     *
     * @type {PreferredAgentsSettings}
     * @memberof CreateProjectModel
     */
    preferredAgentsSettings?: PreferredAgentsSettings;
    /**
     *
     * @type {ProjectTargetBasedType}
     * @memberof CreateProjectModel
     */
    projectTargetBasedType?: ProjectTargetBasedType;
}
/**
 *
 * @export
 * @interface CreateQueueItem
 */
export interface CreateQueueItem {
    /**
     *
     * @type {string}
     * @memberof CreateQueueItem
     */
    branchId: string;
    /**
     *
     * @type {Scope}
     * @memberof CreateQueueItem
     */
    scope: Scope;
    /**
     *
     * @type {string}
     * @memberof CreateQueueItem
     */
    scanLabel?: string | null;
}
/**
 *
 * @export
 * @interface CredentialsModel
 */
export interface CredentialsModel {
    /**
     *
     * @type {IssueTrackerAuthType}
     * @memberof CredentialsModel
     */
    authType?: IssueTrackerAuthType;
    /**
     *
     * @type {BasicCredentialsModel}
     * @memberof CredentialsModel
     */
    basic?: BasicCredentialsModel;
    /**
     *
     * @type {OAuthCredentialsModel}
     * @memberof CredentialsModel
     */
    oAuth?: OAuthCredentialsModel;
}

/**
 *
 * @export
 */
export const CredentialsType = {
    None: 'None',
    Basic: 'Basic',
    Token: 'Token',
    Ssh: 'Ssh',
    Certificate: 'Certificate',
    Cookie: 'Cookie',
    OAuth1A: 'OAuth1A',
    SshPrivateKey: 'SshPrivateKey'
} as const;
export type CredentialsType = typeof CredentialsType[keyof typeof CredentialsType];

/**
 *
 * @export
 * @interface CvssModel
 */
export interface CvssModel {
    /**
     *
     * @type {string}
     * @memberof CvssModel
     */
    baseVector?: string | null;
    /**
     *
     * @type {string}
     * @memberof CvssModel
     */
    baseScore?: string | null;
    /**
     *
     * @type {string}
     * @memberof CvssModel
     */
    version?: string | null;
    /**
     *
     * @type {IssueLevel}
     * @memberof CvssModel
     */
    severity?: IssueLevel;
}

/**
 *
 * @export
 */
export const DataFormat = {
    Regex: 'Regex',
    Dsl: 'Dsl',
    Semgrep: 'Semgrep'
} as const;
export type DataFormat = typeof DataFormat[keyof typeof DataFormat];

/**
 *
 * @export
 * @interface DefaultProjectSettingsModel
 */
export interface DefaultProjectSettingsModel {
    /**
     *
     * @type {boolean}
     * @memberof DefaultProjectSettingsModel
     */
    automatedAiTriageEnabled?: boolean;
    /**
     *
     * @type {IssueLevel}
     * @memberof DefaultProjectSettingsModel
     */
    automatedAiTriageMinSeverity?: IssueLevel;
    /**
     *
     * @type {DefaultProjectSettingsModelLangPercentDistribution}
     * @memberof DefaultProjectSettingsModel
     */
    langPercentDistribution?: DefaultProjectSettingsModelLangPercentDistribution | null;
    /**
     *
     * @type {DotNetSettingsModel}
     * @memberof DefaultProjectSettingsModel
     */
    dotNetSettings?: DotNetSettingsModel;
    /**
     *
     * @type {JavaScriptSettingsModel}
     * @memberof DefaultProjectSettingsModel
     */
    javaScriptSettings?: JavaScriptSettingsModel;
    /**
     *
     * @type {JavaSettingsModel}
     * @memberof DefaultProjectSettingsModel
     */
    javaSettings?: JavaSettingsModel;
    /**
     *
     * @type {PhpSettingsModel}
     * @memberof DefaultProjectSettingsModel
     */
    phpSettings?: PhpSettingsModel;
    /**
     *
     * @type {PmTaintBaseSettingsModel}
     * @memberof DefaultProjectSettingsModel
     */
    pmTaintSettings?: PmTaintBaseSettingsModel;
    /**
     *
     * @type {PythonSettingsModel}
     * @memberof DefaultProjectSettingsModel
     */
    pythonSettings?: PythonSettingsModel;
    /**
     *
     * @type {RubySettingsModel}
     * @memberof DefaultProjectSettingsModel
     */
    rubySettings?: RubySettingsModel;
    /**
     *
     * @type {GoSettingsModel}
     * @memberof DefaultProjectSettingsModel
     */
    goSettings?: GoSettingsModel;
    /**
     *
     * @type {ScaSettingsModel}
     * @memberof DefaultProjectSettingsModel
     */
    scaSettings?: ScaSettingsModel;
    /**
     *
     * @type {Priority}
     * @memberof DefaultProjectSettingsModel
     */
    priority?: Priority;
    /**
     *
     * @type {string}
     * @memberof DefaultProjectSettingsModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof DefaultProjectSettingsModel
     */
    name?: string | null;
    /**
     *
     * @type {Array<LegacyProgrammingLanguageGroup>}
     * @memberof DefaultProjectSettingsModel
     */
    languages?: Array<LegacyProgrammingLanguageGroup> | null;
    /**
     *
     * @type {string}
     * @memberof DefaultProjectSettingsModel
     */
    projectUrl?: string | null;
    /**
     *
     * @type {WhiteBoxSettingsModel}
     * @memberof DefaultProjectSettingsModel
     */
    whiteBox?: WhiteBoxSettingsModel;
    /**
     *
     * @type {boolean}
     * @memberof DefaultProjectSettingsModel
     */
    blackBoxEnabled?: boolean;
    /**
     *
     * @type {BlackBoxSettingsBaseModel}
     * @memberof DefaultProjectSettingsModel
     */
    blackBox?: BlackBoxSettingsBaseModel;
    /**
     *
     * @type {PreferredAgentsSettings}
     * @memberof DefaultProjectSettingsModel
     */
    preferredAgentsSettings?: PreferredAgentsSettings;
    /**
     *
     * @type {ProjectTargetBasedType}
     * @memberof DefaultProjectSettingsModel
     */
    projectTargetBasedType?: ProjectTargetBasedType;
}
/**
 *
 * @export
 * @interface DefaultProjectSettingsModelLangPercentDistribution
 */
export interface DefaultProjectSettingsModelLangPercentDistribution {
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    None?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    Java?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    CSharpWinOnly?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    Php?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    JavaScript?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    Python?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    ObjectiveC?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    Swift?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    CAndCPlusPlus?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    Go?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    Kotlin?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    Sql?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    Ruby?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    Dart?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    CSharp?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    Solidity?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    Scala?: number;
    /**
     *
     * @type {number}
     * @memberof DefaultProjectSettingsModelLangPercentDistribution
     */
    OneC?: number;
}
/**
 *
 * @export
 * @interface DeleteQueueItems
 */
export interface DeleteQueueItems {
    /**
     *
     * @type {Array<string>}
     * @memberof DeleteQueueItems
     */
    items: Array<string>;
}
/**
 *
 * @export
 * @interface DirectoryContent
 */
export interface DirectoryContent {
    /**
     *
     * @type {string}
     * @memberof DirectoryContent
     */
    name?: string | null;
    /**
     *
     * @type {Array<DirectoryContent>}
     * @memberof DirectoryContent
     */
    _directories?: Array<DirectoryContent>;
    /**
     *
     * @type {Array<string>}
     * @memberof DirectoryContent
     */
    _files?: Array<string>;
    /**
     *
     * @type {boolean}
     * @memberof DirectoryContent
     */
    _hasContent?: boolean;
}

/**
 *
 * @export
 */
export const DotNetProjectType = {
    None: 'None',
    Solution: 'Solution'
} as const;
export type DotNetProjectType = typeof DotNetProjectType[keyof typeof DotNetProjectType];

/**
 *
 * @export
 * @interface DotNetSettingsModel
 */
export interface DotNetSettingsModel {
    /**
     *
     * @type {DotNetProjectType}
     * @memberof DotNetSettingsModel
     */
    projectType?: DotNetProjectType;
    /**
     *
     * @type {string}
     * @memberof DotNetSettingsModel
     */
    solutionFile?: string | null;
    /**
     *
     * @type {string}
     * @memberof DotNetSettingsModel
     */
    launchParameters?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof DotNetSettingsModel
     */
    useAvailablePublicAndProtectedMethods?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof DotNetSettingsModel
     */
    downloadDependencies?: boolean;
    /**
     *
     * @type {string}
     * @memberof DotNetSettingsModel
     */
    dslRulesRelativePath?: string | null;
}

/**
 *
 * @export
 */
export const ElasticSearchLogFormat = {
    Plain: 'Plain',
    Json: 'Json'
} as const;
export type ElasticSearchLogFormat = typeof ElasticSearchLogFormat[keyof typeof ElasticSearchLogFormat];

/**
 *
 * @export
 * @interface ElasticSearchTargetModel
 */
export interface ElasticSearchTargetModel {
    /**
     *
     * @type {string}
     * @memberof ElasticSearchTargetModel
     */
    host?: string | null;
    /**
     *
     * @type {number}
     * @memberof ElasticSearchTargetModel
     */
    port?: number;
    /**
     *
     * @type {boolean}
     * @memberof ElasticSearchTargetModel
     */
    isEnabled?: boolean;
    /**
     *
     * @type {ElasticSearchLogFormat}
     * @memberof ElasticSearchTargetModel
     */
    logFormat?: ElasticSearchLogFormat;
    /**
     *
     * @type {LogLevel}
     * @memberof ElasticSearchTargetModel
     */
    logLevel?: LogLevel;
}
/**
 *
 * @export
 * @interface EnterpriseLicenseModel
 */
export interface EnterpriseLicenseModel {
    /**
     *
     * @type {Array<LicensedModuleModel>}
     * @memberof EnterpriseLicenseModel
     */
    licensedModules?: Array<LicensedModuleModel> | null;
    /**
     *
     * @type {number}
     * @memberof EnterpriseLicenseModel
     */
    licenseNumber?: number;
    /**
     *
     * @type {string}
     * @memberof EnterpriseLicenseModel
     */
    client?: string | null;
    /**
     *
     * @type {string}
     * @memberof EnterpriseLicenseModel
     */
    currentDate?: string;
    /**
     *
     * @type {string}
     * @memberof EnterpriseLicenseModel
     */
    endDate?: string;
    /**
     *
     * @type {number}
     * @memberof EnterpriseLicenseModel
     */
    limitProjects?: number;
    /**
     *
     * @type {number}
     * @memberof EnterpriseLicenseModel
     */
    maxAgents?: number;
    /**
     *
     * @type {Array<ProgrammingLanguageGroup>}
     * @memberof EnterpriseLicenseModel
     */
    languages?: Array<ProgrammingLanguageGroup> | null;
    /**
     *
     * @type {boolean}
     * @memberof EnterpriseLicenseModel
     */
    isValid?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof EnterpriseLicenseModel
     */
    perpetual?: boolean;
}

/**
 *
 * @export
 */
export const ErrorLevel = {
    Error: 'Error',
    Warn: 'Warn',
    Info: 'Info',
    Debug: 'Debug',
    Trace: 'Trace'
} as const;
export type ErrorLevel = typeof ErrorLevel[keyof typeof ErrorLevel];

/**
 *
 * @export
 * @interface ExploitDataInputModel
 */
export interface ExploitDataInputModel {
    /**
     *
     * @type {string}
     * @memberof ExploitDataInputModel
     */
    requestType?: string | null;
    /**
     *
     * @type {string}
     * @memberof ExploitDataInputModel
     */
    text?: string | null;
    /**
     *
     * @type {string}
     * @memberof ExploitDataInputModel
     */
    url?: string | null;
    /**
     *
     * @type {Array<ExploitParameterDataInputModel>}
     * @memberof ExploitDataInputModel
     */
    parameters?: Array<ExploitParameterDataInputModel> | null;
    /**
     *
     * @type {string}
     * @memberof ExploitDataInputModel
     */
    urlTemplate?: string | null;
}
/**
 *
 * @export
 * @interface ExploitParameterData
 */
export interface ExploitParameterData {
    /**
     *
     * @type {string}
     * @memberof ExploitParameterData
     */
    name?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof ExploitParameterData
     */
    vulnerable?: boolean;
    /**
     *
     * @type {string}
     * @memberof ExploitParameterData
     */
    value?: string | null;
    /**
     *
     * @type {string}
     * @memberof ExploitParameterData
     */
    source?: string | null;
    /**
     *
     * @type {string}
     * @memberof ExploitParameterData
     */
    Pattern?: string | null;
    /**
     *
     * @type {Array<string>}
     * @memberof ExploitParameterData
     */
    Functions?: Array<string> | null;
    /**
     *
     * @type {string}
     * @memberof ExploitParameterData
     */
    Projection?: string | null;
}
/**
 *
 * @export
 * @interface ExploitParameterDataInputModel
 */
export interface ExploitParameterDataInputModel {
    /**
     *
     * @type {string}
     * @memberof ExploitParameterDataInputModel
     */
    name?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof ExploitParameterDataInputModel
     */
    vulnerable?: boolean;
    /**
     *
     * @type {string}
     * @memberof ExploitParameterDataInputModel
     */
    value?: string | null;
    /**
     *
     * @type {string}
     * @memberof ExploitParameterDataInputModel
     */
    source?: string | null;
    /**
     *
     * @type {string}
     * @memberof ExploitParameterDataInputModel
     */
    pattern?: string | null;
    /**
     *
     * @type {Array<string>}
     * @memberof ExploitParameterDataInputModel
     */
    functions?: Array<string> | null;
    /**
     *
     * @type {string}
     * @memberof ExploitParameterDataInputModel
     */
    projection?: string | null;
}
/**
 *
 * @export
 * @interface ExtendedCreateProjectModel
 */
export interface ExtendedCreateProjectModel {
    /**
     *
     * @type {ExtendedProjectSettingsModel}
     * @memberof ExtendedCreateProjectModel
     */
    settings?: ExtendedProjectSettingsModel;
    /**
     *
     * @type {boolean}
     * @memberof ExtendedCreateProjectModel
     */
    isTemp?: boolean;
    /**
     *
     * @type {PreferredAgentsSettings}
     * @memberof ExtendedCreateProjectModel
     */
    preferredAgentsSettings?: PreferredAgentsSettings;
    /**
     *
     * @type {ProjectTargetBasedType}
     * @memberof ExtendedCreateProjectModel
     */
    projectTargetBasedType?: ProjectTargetBasedType;
}
/**
 *
 * @export
 * @interface ExtendedIssueTrackerIntegrationSettingsModel
 */
export interface ExtendedIssueTrackerIntegrationSettingsModel {
    /**
     *
     * @type {boolean}
     * @memberof ExtendedIssueTrackerIntegrationSettingsModel
     */
    isActive?: boolean;
    /**
     *
     * @type {string}
     * @memberof ExtendedIssueTrackerIntegrationSettingsModel
     */
    id?: string | null;
    /**
     *
     * @type {ConnectionModel}
     * @memberof ExtendedIssueTrackerIntegrationSettingsModel
     */
    connection?: ConnectionModel;
    /**
     *
     * @type {ProjectInfoModel}
     * @memberof ExtendedIssueTrackerIntegrationSettingsModel
     */
    project?: ProjectInfoModel;
    /**
     *
     * @type {TicketTypeModel}
     * @memberof ExtendedIssueTrackerIntegrationSettingsModel
     */
    ticketType?: TicketTypeModel;
    /**
     *
     * @type {string}
     * @memberof ExtendedIssueTrackerIntegrationSettingsModel
     */
    summary?: string | null;
    /**
     *
     * @type {string}
     * @memberof ExtendedIssueTrackerIntegrationSettingsModel
     */
    description?: string | null;
    /**
     *
     * @type {Array<string>}
     * @memberof ExtendedIssueTrackerIntegrationSettingsModel
     */
    labels?: Array<string> | null;
    /**
     *
     * @type {UserTrackerModel}
     * @memberof ExtendedIssueTrackerIntegrationSettingsModel
     */
    assignee?: UserTrackerModel;
    /**
     *
     * @type {UserTrackerModel}
     * @memberof ExtendedIssueTrackerIntegrationSettingsModel
     */
    reporter?: UserTrackerModel;
}
/**
 *
 * @export
 * @interface ExtendedProjectSettingsModel
 */
export interface ExtendedProjectSettingsModel {
    /**
     *
     * @type {boolean}
     * @memberof ExtendedProjectSettingsModel
     */
    automatedAiTriageEnabled?: boolean;
    /**
     *
     * @type {IssueLevel}
     * @memberof ExtendedProjectSettingsModel
     */
    automatedAiTriageMinSeverity?: IssueLevel;
    /**
     *
     * @type {BlackBoxSettingsModel}
     * @memberof ExtendedProjectSettingsModel
     */
    blackBoxSettings?: BlackBoxSettingsModel;
    /**
     *
     * @type {string}
     * @memberof ExtendedProjectSettingsModel
     */
    projectName?: string | null;
    /**
     *
     * @type {Array<LegacyProgrammingLanguageGroup>}
     * @memberof ExtendedProjectSettingsModel
     */
    languages?: Array<LegacyProgrammingLanguageGroup> | null;
    /**
     *
     * @type {WhiteBoxSettingsModel}
     * @memberof ExtendedProjectSettingsModel
     */
    whiteBoxSettings?: WhiteBoxSettingsModel;
    /**
     *
     * @type {DotNetSettingsModel}
     * @memberof ExtendedProjectSettingsModel
     */
    dotNetSettings?: DotNetSettingsModel;
    /**
     *
     * @type {GoSettingsModel}
     * @memberof ExtendedProjectSettingsModel
     */
    goSettings?: GoSettingsModel;
    /**
     *
     * @type {JavaScriptSettingsModel}
     * @memberof ExtendedProjectSettingsModel
     */
    javaScriptSettings?: JavaScriptSettingsModel;
    /**
     *
     * @type {JavaSettingsModel}
     * @memberof ExtendedProjectSettingsModel
     */
    javaSettings?: JavaSettingsModel;
    /**
     *
     * @type {PhpSettingsModel}
     * @memberof ExtendedProjectSettingsModel
     */
    phpSettings?: PhpSettingsModel;
    /**
     *
     * @type {PmTaintBaseSettingsModel}
     * @memberof ExtendedProjectSettingsModel
     */
    pmTaintSettings?: PmTaintBaseSettingsModel;
    /**
     *
     * @type {PythonSettingsModel}
     * @memberof ExtendedProjectSettingsModel
     */
    pythonSettings?: PythonSettingsModel;
    /**
     *
     * @type {RubySettingsModel}
     * @memberof ExtendedProjectSettingsModel
     */
    rubySettings?: RubySettingsModel;
    /**
     *
     * @type {ScaSettingsModel}
     * @memberof ExtendedProjectSettingsModel
     */
    scaSettings?: ScaSettingsModel;
    /**
     *
     * @type {MailingProjectSettingsModel}
     * @memberof ExtendedProjectSettingsModel
     */
    reportAfterScan?: MailingProjectSettingsModel;
    /**
     *
     * @type {boolean}
     * @memberof ExtendedProjectSettingsModel
     */
    skipGitIgnoreFiles?: boolean;
    /**
     *
     * @type {VcsConnectionSettingsModel}
     * @memberof ExtendedProjectSettingsModel
     */
    vcsConnectionSettings?: VcsConnectionSettingsModel;
    /**
     *
     * @type {Priority}
     * @memberof ExtendedProjectSettingsModel
     */
    priority?: Priority;
}
/**
 *
 * @export
 * @interface ExtendedScanStatisticModel
 */
export interface ExtendedScanStatisticModel {
    /**
     *
     * @type {string}
     * @memberof ExtendedScanStatisticModel
     */
    id?: string | null;
    /**
     *
     * @type {string}
     * @memberof ExtendedScanStatisticModel
     */
    date?: string | null;
    /**
     *
     * @type {ScanProgressModel}
     * @memberof ExtendedScanStatisticModel
     */
    progress?: ScanProgressModel;
    /**
     *
     * @type {ThreatLevel}
     * @memberof ExtendedScanStatisticModel
     */
    threatLevel?: ThreatLevel;
    /**
     *
     * @type {boolean}
     * @memberof ExtendedScanStatisticModel
     */
    hasErrors?: boolean;
    /**
     *
     * @type {string}
     * @memberof ExtendedScanStatisticModel
     */
    queueDate?: string | null;
    /**
     *
     * @type {InitiatorInfoModel}
     * @memberof ExtendedScanStatisticModel
     */
    initiator?: InitiatorInfoModel;
    /**
     *
     * @type {number}
     * @memberof ExtendedScanStatisticModel
     */
    high?: number;
    /**
     *
     * @type {number}
     * @memberof ExtendedScanStatisticModel
     */
    medium?: number;
    /**
     *
     * @type {number}
     * @memberof ExtendedScanStatisticModel
     */
    low?: number;
    /**
     *
     * @type {number}
     * @memberof ExtendedScanStatisticModel
     */
    potential?: number;
    /**
     *
     * @type {number}
     * @memberof ExtendedScanStatisticModel
     */
    total?: number;
    /**
     *
     * @type {number}
     * @memberof ExtendedScanStatisticModel
     */
    filesTotal?: number;
    /**
     *
     * @type {number}
     * @memberof ExtendedScanStatisticModel
     */
    filesScanned?: number;
    /**
     *
     * @type {number}
     * @memberof ExtendedScanStatisticModel
     */
    urlsScanned?: number;
    /**
     *
     * @type {number}
     * @memberof ExtendedScanStatisticModel
     */
    urlsTotal?: number;
    /**
     *
     * @type {string}
     * @memberof ExtendedScanStatisticModel
     */
    scanDuration?: string;
    /**
     *
     * @type {PolicyState}
     * @memberof ExtendedScanStatisticModel
     */
    policyState?: PolicyState;
    /**
     *
     * @type {SecurityPolicyStatus}
     * @memberof ExtendedScanStatisticModel
     */
    securityPolicyStatus?: SecurityPolicyStatus;
}
/**
 *
 * @export
 * @interface ExternalLoggingSettingsModel
 */
export interface ExternalLoggingSettingsModel {
    /**
     *
     * @type {SyslogTargetModel}
     * @memberof ExternalLoggingSettingsModel
     */
    syslog?: SyslogTargetModel;
    /**
     *
     * @type {ElasticSearchTargetModel}
     * @memberof ExternalLoggingSettingsModel
     */
    elasticSearch?: ElasticSearchTargetModel;
}
/**
 *
 * @export
 * @interface FeaturesModel
 */
export interface FeaturesModel {
    /**
     * Indicates if Kubernetes feature is enabled
     * @type {boolean}
     * @memberof FeaturesModel
     */
    kubernetes: boolean;
}
/**
 *
 * @export
 * @interface FieldInfoModel
 */
export interface FieldInfoModel {
    /**
     *
     * @type {string}
     * @memberof FieldInfoModel
     */
    id?: string | null;
    /**
     *
     * @type {object}
     * @memberof FieldInfoModel
     */
    name?: object;
    /**
     *
     * @type {string}
     * @memberof FieldInfoModel
     */
    friendlyName?: string | null;
    /**
     *
     * @type {Array<string>}
     * @memberof FieldInfoModel
     */
    value?: Array<string> | null;
    /**
     *
     * @type {FieldType}
     * @memberof FieldInfoModel
     */
    type?: FieldType;
    /**
     *
     * @type {boolean}
     * @memberof FieldInfoModel
     */
    isArray?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof FieldInfoModel
     */
    isRequired?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof FieldInfoModel
     */
    isCustom?: boolean;
}

/**
 *
 * @export
 */
export const FieldType = {
    Unknown: 'Unknown',
    Date: 'Date',
    DateTime: 'DateTime',
    Number: 'Number',
    Text: 'Text',
    TextArea: 'TextArea',
    Url: 'Url',
    CheckBox: 'CheckBox',
    ListBox: 'ListBox',
    RadioButtons: 'RadioButtons',
    ComboBox: 'ComboBox',
    ComboBoxGroup: 'ComboBoxGroup',
    Attachment: 'Attachment',
    Tags: 'Tags',
    User: 'User',
    Project: 'Project',
    TicketType: 'TicketType',
    Priority: 'Priority',
    Version: 'Version'
} as const;
export type FieldType = typeof FieldType[keyof typeof FieldType];

/**
 *
 * @export
 * @interface FileFolderExclusionsModel
 */
export interface FileFolderExclusionsModel {
    /**
     *
     * @type {string}
     * @memberof FileFolderExclusionsModel
     */
    exclusions?: string | null;
}

/**
 *
 * @export
 */
export const FullScanReason = {
    None: 'None',
    UserRequirement: 'UserRequirement',
    NoPreviousScan: 'NoPreviousScan',
    LegacyPreviousScan: 'LegacyPreviousScan',
    PreviousScanIsNotInDoneStatus: 'PreviousScanIsNotInDoneStatus',
    PreviousScanWithoutStaticAnalyzers: 'PreviousScanWithoutStaticAnalyzers',
    ScanEnvironmentIsNotTheSame: 'ScanEnvironmentIsNotTheSame',
    PreviousScanWithCriticalErrors: 'PreviousScanWithCriticalErrors',
    PreviousScanWithIncrementBlockingErrors: 'PreviousScanWithIncrementBlockingErrors',
    IncompatibleScanSettings: 'IncompatibleScanSettings',
    HasNewFiles: 'HasNewFiles',
    IgnoredFilesListHasChanged: 'IgnoredFilesListHasChanged',
    SyncedFromPlugins: 'SyncedFromPlugins'
} as const;
export type FullScanReason = typeof FullScanReason[keyof typeof FullScanReason];

/**
 *
 * @export
 * @interface GlobalScanSettingsModel
 */
export interface GlobalScanSettingsModel {
    /**
     *
     * @type {boolean}
     * @memberof GlobalScanSettingsModel
     */
    ignoreLineNumbersOnDiff?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof GlobalScanSettingsModel
     */
    ignoreAdditionalConditionOnDiff?: boolean;
}
/**
 *
 * @export
 * @interface GoSettingsModel
 */
export interface GoSettingsModel {
    /**
     *
     * @type {string}
     * @memberof GoSettingsModel
     */
    launchParameters?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof GoSettingsModel
     */
    useAvailablePublicAndProtectedMethods?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof GoSettingsModel
     */
    downloadDependencies?: boolean;
    /**
     *
     * @type {string}
     * @memberof GoSettingsModel
     */
    dependenciesPath?: string | null;
    /**
     *
     * @type {string}
     * @memberof GoSettingsModel
     */
    dslRulesRelativePath?: string | null;
}
/**
 *
 * @export
 * @interface HealthCheckServiceResult
 */
export interface HealthCheckServiceResult {
    /**
     *
     * @type {string}
     * @memberof HealthCheckServiceResult
     */
    service?: string | null;
    /**
     *
     * @type {HealthStatus}
     * @memberof HealthCheckServiceResult
     */
    status?: HealthStatus;
    /**
     *
     * @type {number}
     * @memberof HealthCheckServiceResult
     */
    responseTime?: number;
}
/**
 *
 * @export
 * @interface HealthCheckSummaryResult
 */
export interface HealthCheckSummaryResult {
    /**
     *
     * @type {number}
     * @memberof HealthCheckSummaryResult
     */
    totalResponseTime?: number;
    /**
     *
     * @type {Array<HealthCheckServiceResult>}
     * @memberof HealthCheckSummaryResult
     */
    services?: Array<HealthCheckServiceResult> | null;
}

/**
 *
 * @export
 */
export const HealthStatus = {
    Unhealthy: 'Unhealthy',
    Degraded: 'Degraded',
    Healthy: 'Healthy'
} as const;
export type HealthStatus = typeof HealthStatus[keyof typeof HealthStatus];

/**
 *
 * @export
 * @interface HttpHeaderModel
 */
export interface HttpHeaderModel {
    /**
     *
     * @type {string}
     * @memberof HttpHeaderModel
     */
    key?: string | null;
    /**
     *
     * @type {string}
     * @memberof HttpHeaderModel
     */
    value?: string | null;
}
/**
 *
 * @export
 * @interface ImportMetadataModel
 */
export interface ImportMetadataModel {
    /**
     *
     * @type {string}
     * @memberof ImportMetadataModel
     */
    importedAt: string;
    /**
     *
     * @type {string}
     * @memberof ImportMetadataModel
     */
    importedFrom: string | null;
}
/**
 *
 * @export
 * @interface ImportResultModel
 */
export interface ImportResultModel {
    /**
     *
     * @type {string}
     * @memberof ImportResultModel
     */
    exportDate: string;
    /**
     *
     * @type {string}
     * @memberof ImportResultModel
     */
    importDate: string;
    /**
     *
     * @type {string}
     * @memberof ImportResultModel
     */
    sourceServerName: string | null;
    /**
     *
     * @type {string}
     * @memberof ImportResultModel
     */
    projectId: string;
    /**
     *
     * @type {string}
     * @memberof ImportResultModel
     */
    branchId: string;
    /**
     *
     * @type {number}
     * @memberof ImportResultModel
     */
    issuesTotal: number;
    /**
     *
     * @type {number}
     * @memberof ImportResultModel
     */
    issuesUploaded: number;
    /**
     *
     * @type {Array<string>}
     * @memberof ImportResultModel
     */
    errors: Array<string> | null;
}
/**
 *
 * @export
 * @interface Initiator
 */
export interface Initiator {
    /**
     *
     * @type {InitiatorType}
     * @memberof Initiator
     */
    type: InitiatorType;
    /**
     *
     * @type {string}
     * @memberof Initiator
     */
    id: string;
    /**
     *
     * @type {string}
     * @memberof Initiator
     */
    name: string;
    /**
     *
     * @type {string}
     * @memberof Initiator
     */
    email: string;
    /**
     *
     * @type {string}
     * @memberof Initiator
     */
    login: string;
    /**
     *
     * @type {string}
     * @memberof Initiator
     */
    relatedEntityId: string;
}
/**
 *
 * @export
 * @interface InitiatorInfoModel
 */
export interface InitiatorInfoModel {
    /**
     *
     * @type {string}
     * @memberof InitiatorInfoModel
     */
    id?: string | null;
    /**
     *
     * @type {InitiatorType}
     * @memberof InitiatorInfoModel
     */
    type?: InitiatorType;
    /**
     *
     * @type {string}
     * @memberof InitiatorInfoModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof InitiatorInfoModel
     */
    email?: string | null;
}
/**
 *
 * @export
 * @interface InitiatorModel
 */
export interface InitiatorModel {
    /**
     *
     * @type {InitiatorType}
     * @memberof InitiatorModel
     */
    type?: InitiatorType;
    /**
     *
     * @type {string}
     * @memberof InitiatorModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof InitiatorModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof InitiatorModel
     */
    email?: string | null;
    /**
     *
     * @type {string}
     * @memberof InitiatorModel
     */
    login?: string | null;
    /**
     *
     * @type {string}
     * @memberof InitiatorModel
     */
    relatedEntityId?: string;
}

/**
 *
 * @export
 */
export const InitiatorType = {
    User: 'User',
    AccessToken: 'AccessToken',
    System: 'System'
} as const;
export type InitiatorType = typeof InitiatorType[keyof typeof InitiatorType];

/**
 *
 * @export
 * @interface InjectionPointInputModel
 */
export interface InjectionPointInputModel {
    /**
     *
     * @type {string}
     * @memberof InjectionPointInputModel
     */
    channel?: string | null;
    /**
     *
     * @type {string}
     * @memberof InjectionPointInputModel
     */
    param?: string | null;
    /**
     *
     * @type {string}
     * @memberof InjectionPointInputModel
     */
    key?: string | null;
    /**
     *
     * @type {string}
     * @memberof InjectionPointInputModel
     */
    header?: string | null;
    /**
     *
     * @type {string}
     * @memberof InjectionPointInputModel
     */
    cookie?: string | null;
    /**
     *
     * @type {string}
     * @memberof InjectionPointInputModel
     */
    dirindex?: string | null;
}
/**
 *
 * @export
 * @interface InvalidateIssuesByPathsModel
 */
export interface InvalidateIssuesByPathsModel {
    /**
     *
     * @type {IssueType}
     * @memberof InvalidateIssuesByPathsModel
     */
    issueType?: IssueType;
    /**
     *
     * @type {Array<string>}
     * @memberof InvalidateIssuesByPathsModel
     */
    paths?: Array<string> | null;
}

/**
 *
 * @export
 */
export const IssueApprovalState = {
    None: 'None',
    Approval: 'Approval',
    Discard: 'Discard',
    NotExist: 'NotExist',
    AutoApproval: 'AutoApproval'
} as const;
export type IssueApprovalState = typeof IssueApprovalState[keyof typeof IssueApprovalState];

/**
 *
 * @export
 * @interface IssueBaseMetadata
 */
export interface IssueBaseMetadata {
    /**
     *
     * @type {string}
     * @memberof IssueBaseMetadata
     */
    readonly key?: string | null;
    /**
     *
     * @type {IssueType}
     * @memberof IssueBaseMetadata
     */
    issueType?: IssueType;
    /**
     *
     * @type {IssueLevel}
     * @memberof IssueBaseMetadata
     */
    level?: IssueLevel;
}
/**
 *
 * @export
 * @interface IssueBlackBoxInputModel
 */
export interface IssueBlackBoxInputModel {
    /**
     *
     * @type {string}
     * @memberof IssueBlackBoxInputModel
     */
    title?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueBlackBoxInputModel
     */
    scannedUrl?: string | null;
    /**
     *
     * @type {RequestDataInputModel}
     * @memberof IssueBlackBoxInputModel
     */
    request?: RequestDataInputModel;
    /**
     *
     * @type {string}
     * @memberof IssueBlackBoxInputModel
     */
    responseRaw?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueBlackBoxInputModel
     */
    vector?: string | null;
    /**
     *
     * @type {number}
     * @memberof IssueBlackBoxInputModel
     */
    responseTime?: number;
    /**
     *
     * @type {InjectionPointInputModel}
     * @memberof IssueBlackBoxInputModel
     */
    injectionPoint?: InjectionPointInputModel;
    /**
     *
     * @type {{ [key: string]: string; }}
     * @memberof IssueBlackBoxInputModel
     */
    extra?: { [key: string]: string; } | null;
}
/**
 *
 * @export
 * @interface IssueComponentMetadataModel
 */
export interface IssueComponentMetadataModel {
    /**
     *
     * @type {string}
     * @memberof IssueComponentMetadataModel
     */
    componentName?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueComponentMetadataModel
     */
    cveId?: string | null;
    /**
     *
     * @type {CvssModel}
     * @memberof IssueComponentMetadataModel
     */
    cvss2?: CvssModel;
    /**
     *
     * @type {CvssModel}
     * @memberof IssueComponentMetadataModel
     */
    cvss3?: CvssModel;
}
/**
 *
 * @export
 * @interface IssueConfigurationInputModel
 */
export interface IssueConfigurationInputModel {
    /**
     *
     * @type {string}
     * @memberof IssueConfigurationInputModel
     */
    _function?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueConfigurationInputModel
     */
    existingValue?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueConfigurationInputModel
     */
    recommendedValue?: string | null;
}
/**
 *
 * @export
 * @interface IssueDescriptionBase
 */
export interface IssueDescriptionBase {
    /**
     *
     * @type {string}
     * @memberof IssueDescriptionBase
     */
    readonly key?: string | null;
    /**
     *
     * @type {IssueType}
     * @memberof IssueDescriptionBase
     */
    issueType?: IssueType;
}
/**
 *
 * @export
 * @interface IssueDescriptionModel
 */
export interface IssueDescriptionModel {
    /**
     *
     * @type {string}
     * @memberof IssueDescriptionModel
     */
    identity?: string | null;
    /**
     *
     * @type {IssueType}
     * @memberof IssueDescriptionModel
     */
    issueType?: IssueType;
    /**
     *
     * @type {string}
     * @memberof IssueDescriptionModel
     */
    header?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueDescriptionModel
     */
    descriptionText?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueDescriptionModel
     */
    descriptionHtml?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueDescriptionModel
     */
    descriptionMarkdown?: string | null;
}
/**
 *
 * @export
 * @interface IssueExploitDataModel
 */
export interface IssueExploitDataModel {
    /**
     *
     * @type {string}
     * @memberof IssueExploitDataModel
     */
    type?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueExploitDataModel
     */
    text?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueExploitDataModel
     */
    url?: string | null;
    /**
     *
     * @type {Array<ExploitParameterData>}
     * @memberof IssueExploitDataModel
     */
    parameters?: Array<ExploitParameterData> | null;
}
/**
 *
 * @export
 * @interface IssueFingerprintInputModel
 */
export interface IssueFingerprintInputModel {
    /**
     *
     * @type {string}
     * @memberof IssueFingerprintInputModel
     */
    componentName?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueFingerprintInputModel
     */
    componentVersion?: string | null;
    /**
     *
     * @type {Array<string>}
     * @memberof IssueFingerprintInputModel
     */
    fingerprintIds?: Array<string> | null;
}
/**
 *
 * @export
 * @interface IssueFingerprintScaInputModel
 */
export interface IssueFingerprintScaInputModel {
    /**
     *
     * @type {string}
     * @memberof IssueFingerprintScaInputModel
     */
    componentName?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueFingerprintScaInputModel
     */
    componentVersion?: string | null;
    /**
     *
     * @type {Array<PtOsvInputModel>}
     * @memberof IssueFingerprintScaInputModel
     */
    ptOsvs?: Array<PtOsvInputModel> | null;
    /**
     *
     * @type {Array<string>}
     * @memberof IssueFingerprintScaInputModel
     */
    licenses?: Array<string> | null;
}
/**
 *
 * @export
 * @interface IssueHeader
 */
export interface IssueHeader {
    /**
     *
     * @type {string}
     * @memberof IssueHeader
     */
    identity: string;
    /**
     *
     * @type {string}
     * @memberof IssueHeader
     */
    title: string;
}
/**
 *
 * @export
 * @interface IssueIdsModel
 */
export interface IssueIdsModel {
    /**
     *
     * @type {Array<string>}
     * @memberof IssueIdsModel
     */
    issueIds?: Array<string> | null;
}
/**
 *
 * @export
 * @interface IssueInputModel
 */
export interface IssueInputModel {
    /**
     *
     * @type {IssueType}
     * @memberof IssueInputModel
     */
    issueType?: IssueType;
    /**
     *
     * @type {ScanMode}
     * @memberof IssueInputModel
     */
    scanMode?: ScanMode;
    /**
     *
     * @type {ScanModuleType}
     * @memberof IssueInputModel
     */
    scanModuleType?: ScanModuleType;
    /**
     *
     * @type {CodeChunkInputModel}
     * @memberof IssueInputModel
     */
    vulnerableExpression?: CodeChunkInputModel;
    /**
     *
     * @type {string}
     * @memberof IssueInputModel
     */
    descriptionId?: string | null;
    /**
     *
     * @type {ProgrammingLanguage}
     * @memberof IssueInputModel
     */
    language?: ProgrammingLanguage;
    /**
     *
     * @type {boolean}
     * @memberof IssueInputModel
     */
    isSuspected?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof IssueInputModel
     */
    isSuppressed?: boolean;
    /**
     *
     * @type {IssueConfigurationInputModel}
     * @memberof IssueInputModel
     */
    issueConfiguration?: IssueConfigurationInputModel;
    /**
     *
     * @type {IssueFingerprintInputModel}
     * @memberof IssueInputModel
     */
    issueFingerprint?: IssueFingerprintInputModel;
    /**
     *
     * @type {IssueFingerprintScaInputModel}
     * @memberof IssueInputModel
     */
    issueFingerprintSca?: IssueFingerprintScaInputModel;
    /**
     *
     * @type {IssueScaInputModel}
     * @memberof IssueInputModel
     */
    issueSca?: IssueScaInputModel;
    /**
     *
     * @type {IssueBlackBoxInputModel}
     * @memberof IssueInputModel
     */
    blackBox?: IssueBlackBoxInputModel;
    /**
     *
     * @type {IssueVulnerableCodeInputModel}
     * @memberof IssueInputModel
     */
    vulnerability?: IssueVulnerableCodeInputModel;
    /**
     *
     * @type {object}
     * @memberof IssueInputModel
     */
    secret?: object;
    /**
     *
     * @type {IssueMaliciousCodeInputModel}
     * @memberof IssueInputModel
     */
    maliciousCode?: IssueMaliciousCodeInputModel;
    /**
     *
     * @type {IssueLevel}
     * @memberof IssueInputModel
     */
    issueLevel?: IssueLevel;
}

/**
 *
 * @export
 */
export const IssueLevel = {
    None: 'None',
    Potential: 'Potential',
    Low: 'Low',
    Medium: 'Medium',
    High: 'High'
} as const;
export type IssueLevel = typeof IssueLevel[keyof typeof IssueLevel];

/**
 *
 * @export
 * @interface IssueMaliciousCodeInputModel
 */
export interface IssueMaliciousCodeInputModel {
    /**
     *
     * @type {string}
     * @memberof IssueMaliciousCodeInputModel
     */
    sourceFile?: string | null;
    /**
     *
     * @type {Array<MaliciousCallModel>}
     * @memberof IssueMaliciousCodeInputModel
     */
    maliciousCalls?: Array<MaliciousCallModel> | null;
}
/**
 *
 * @export
 * @interface IssueMetadataModel
 */
export interface IssueMetadataModel {
    /**
     *
     * @type {string}
     * @memberof IssueMetadataModel
     */
    identity?: string | null;
    /**
     *
     * @type {IssueType}
     * @memberof IssueMetadataModel
     */
    issueType?: IssueType;
    /**
     *
     * @type {IssueLevel}
     * @memberof IssueMetadataModel
     */
    level?: IssueLevel;
    /**
     *
     * @type {string}
     * @memberof IssueMetadataModel
     */
    cweId?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueMetadataModel
     */
    owaspId?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueMetadataModel
     */
    pciId?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueMetadataModel
     */
    nist?: string | null;
    /**
     *
     * @type {IssueComponentMetadataModel}
     * @memberof IssueMetadataModel
     */
    component?: IssueComponentMetadataModel;
}
/**
 *
 * @export
 * @interface IssueResource
 */
export interface IssueResource {
    /**
     *
     * @type {string}
     * @memberof IssueResource
     */
    identity: string;
    /**
     *
     * @type {string}
     * @memberof IssueResource
     */
    level: IssueResourceLevelEnum;
    /**
     *
     * @type {string}
     * @memberof IssueResource
     */
    sourceType: IssueResourceSourceTypeEnum;
    /**
     *
     * @type {string}
     * @memberof IssueResource
     */
    title: string;
    /**
     *
     * @type {string}
     * @memberof IssueResource
     */
    descriptionMarkdown?: string | null;
    /**
     *
     * @type {IssueResourceMetadata}
     * @memberof IssueResource
     */
    metadata?: IssueResourceMetadata;
}


/**
 * @export
 */
export const IssueResourceLevelEnum = {
    None: 'None',
    Potential: 'Potential',
    Low: 'Low',
    Medium: 'Medium',
    High: 'High'
} as const;
export type IssueResourceLevelEnum = typeof IssueResourceLevelEnum[keyof typeof IssueResourceLevelEnum];

/**
 * @export
 */
export const IssueResourceSourceTypeEnum = {
    Sast: 'SAST',
    Bb: 'BB',
    Sca: 'SCA',
    Dc: 'DC'
} as const;
export type IssueResourceSourceTypeEnum = typeof IssueResourceSourceTypeEnum[keyof typeof IssueResourceSourceTypeEnum];

/**
 *
 * @export
 * @interface IssueResourceComponent
 */
export interface IssueResourceComponent {
    /**
     *
     * @type {string}
     * @memberof IssueResourceComponent
     */
    componentName?: string | null;
    /**
     *
     * @type {Array<IssueResourceCvssScore>}
     * @memberof IssueResourceComponent
     */
    cvssScores?: Array<IssueResourceCvssScore> | null;
    /**
     *
     * @type {Array<string>}
     * @memberof IssueResourceComponent
     */
    aliases?: Array<string> | null;
    /**
     *
     * @type {Array<string>}
     * @memberof IssueResourceComponent
     */
    exploitConditions?: Array<string> | null;
    /**
     *
     * @type {string}
     * @memberof IssueResourceComponent
     */
    workaround?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueResourceComponent
     */
    vulnerabilityType?: string | null;
}
/**
 *
 * @export
 * @interface IssueResourceCvssScore
 */
export interface IssueResourceCvssScore {
    /**
     *
     * @type {string}
     * @memberof IssueResourceCvssScore
     */
    version?: string;
    /**
     *
     * @type {number}
     * @memberof IssueResourceCvssScore
     */
    score?: number;
    /**
     *
     * @type {string}
     * @memberof IssueResourceCvssScore
     */
    vector?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueResourceCvssScore
     */
    severity?: IssueResourceCvssScoreSeverityEnum;
}


/**
 * @export
 */
export const IssueResourceCvssScoreSeverityEnum = {
    None: 'None',
    Potential: 'Potential',
    Low: 'Low',
    Medium: 'Medium',
    High: 'High'
} as const;
export type IssueResourceCvssScoreSeverityEnum = typeof IssueResourceCvssScoreSeverityEnum[keyof typeof IssueResourceCvssScoreSeverityEnum];

/**
 *
 * @export
 * @interface IssueResourceMetadata
 */
export interface IssueResourceMetadata {
    /**
     *
     * @type {Array<number>}
     * @memberof IssueResourceMetadata
     */
    cwe?: Array<number> | null;
    /**
     *
     * @type {Array<string>}
     * @memberof IssueResourceMetadata
     */
    owasp?: Array<string> | null;
    /**
     *
     * @type {Array<string>}
     * @memberof IssueResourceMetadata
     */
    nist?: Array<string> | null;
    /**
     *
     * @type {Array<string>}
     * @memberof IssueResourceMetadata
     */
    pci?: Array<string> | null;
    /**
     *
     * @type {IssueResourceComponent}
     * @memberof IssueResourceMetadata
     */
    component?: IssueResourceComponent;
}
/**
 *
 * @export
 * @interface IssueResourceMetadataComponent
 */
export interface IssueResourceMetadataComponent {
    /**
     *
     * @type {string}
     * @memberof IssueResourceMetadataComponent
     */
    componentName: string;
    /**
     *
     * @type {Array<CVSSItem>}
     * @memberof IssueResourceMetadataComponent
     */
    cvssScores: Array<CVSSItem>;
    /**
     *
     * @type {Array<string>}
     * @memberof IssueResourceMetadataComponent
     */
    aliases: Array<string>;
    /**
     *
     * @type {Array<string>}
     * @memberof IssueResourceMetadataComponent
     */
    exploitConditions: Array<string>;
    /**
     *
     * @type {string}
     * @memberof IssueResourceMetadataComponent
     */
    workaround: string;
    /**
     *
     * @type {string}
     * @memberof IssueResourceMetadataComponent
     */
    vulnerabilityType: string;
}
/**
 *
 * @export
 * @interface IssueResourcesModel
 */
export interface IssueResourcesModel {
    /**
     *
     * @type {{ [key: string]: IssueDescriptionModel; }}
     * @memberof IssueResourcesModel
     */
    descriptions?: { [key: string]: IssueDescriptionModel; } | null;
    /**
     *
     * @type {{ [key: string]: IssueMetadataModel; }}
     * @memberof IssueResourcesModel
     */
    metadatas?: { [key: string]: IssueMetadataModel; } | null;
}
/**
 *
 * @export
 * @interface IssueScaInputModel
 */
export interface IssueScaInputModel {
    /**
     *
     * @type {string}
     * @memberof IssueScaInputModel
     */
    componentName?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueScaInputModel
     */
    componentVersion?: string | null;
    /**
     *
     * @type {CodeChunkInputModel}
     * @memberof IssueScaInputModel
     */
    entrypoint?: CodeChunkInputModel;
    /**
     *
     * @type {Array<CodeChunkInputModel>}
     * @memberof IssueScaInputModel
     */
    stackTrace?: Array<CodeChunkInputModel> | null;
    /**
     *
     * @type {Array<PtOsvInputModel>}
     * @memberof IssueScaInputModel
     */
    ptOsvs?: Array<PtOsvInputModel> | null;
    /**
     *
     * @type {Array<string>}
     * @memberof IssueScaInputModel
     */
    licenses?: Array<string> | null;
}
/**
 *
 * @export
 * @interface IssueStatisticModel
 */
export interface IssueStatisticModel {
    /**
     *
     * @type {string}
     * @memberof IssueStatisticModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof IssueStatisticModel
     */
    scanResultId?: string;
    /**
     *
     * @type {IssueType}
     * @memberof IssueStatisticModel
     */
    _class?: IssueType;
    /**
     *
     * @type {string}
     * @memberof IssueStatisticModel
     */
    type?: string | null;
    /**
     *
     * @type {IssueLevel}
     * @memberof IssueStatisticModel
     */
    level?: IssueLevel;
    /**
     *
     * @type {IssueApprovalState}
     * @memberof IssueStatisticModel
     */
    state?: IssueApprovalState;
    /**
     *
     * @type {boolean}
     * @memberof IssueStatisticModel
     */
    isSuppressed?: boolean;
    /**
     *
     * @type {number}
     * @memberof IssueStatisticModel
     */
    count?: number;
}

/**
 *
 * @export
 */
export const IssueTrackerAuthType = {
    Unknown: 'Unknown',
    Basic: 'Basic',
    OAuth1A: 'OAuth1A'
} as const;
export type IssueTrackerAuthType = typeof IssueTrackerAuthType[keyof typeof IssueTrackerAuthType];

/**
 *
 * @export
 * @interface IssueTrackerIntegrationSettingsModel
 */
export interface IssueTrackerIntegrationSettingsModel {
    /**
     *
     * @type {boolean}
     * @memberof IssueTrackerIntegrationSettingsModel
     */
    isActive?: boolean;
    /**
     *
     * @type {string}
     * @memberof IssueTrackerIntegrationSettingsModel
     */
    id?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueTrackerIntegrationSettingsModel
     */
    connectionId?: string;
    /**
     *
     * @type {string}
     * @memberof IssueTrackerIntegrationSettingsModel
     */
    projectName?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueTrackerIntegrationSettingsModel
     */
    ticketTypeId?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueTrackerIntegrationSettingsModel
     */
    summary?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueTrackerIntegrationSettingsModel
     */
    description?: string | null;
    /**
     *
     * @type {Array<string>}
     * @memberof IssueTrackerIntegrationSettingsModel
     */
    labels?: Array<string> | null;
    /**
     *
     * @type {string}
     * @memberof IssueTrackerIntegrationSettingsModel
     */
    assigneeName?: string | null;
    /**
     *
     * @type {string}
     * @memberof IssueTrackerIntegrationSettingsModel
     */
    reporterName?: string | null;
}

/**
 *
 * @export
 */
export const IssueType = {
    Unknown: 'Unknown',
    Vulnerability: 'Vulnerability',
    Weakness: 'Weakness',
    Configuration: 'Configuration',
    Fingerprint: 'Fingerprint',
    BlackBox: 'BlackBox',
    Pygrep: 'Pygrep',
    Sca: 'Sca',
    FingerprintSca: 'FingerprintSca',
    Secret: 'Secret',
    MaliciousCode: 'MaliciousCode'
} as const;
export type IssueType = typeof IssueType[keyof typeof IssueType];

/**
 *
 * @export
 * @interface IssueVulnerableCodeInputModel
 */
export interface IssueVulnerableCodeInputModel {
    /**
     *
     * @type {CodeChunkInputModel}
     * @memberof IssueVulnerableCodeInputModel
     */
    entrypoint?: CodeChunkInputModel;
    /**
     *
     * @type {Array<CodeChunkInputModel>}
     * @memberof IssueVulnerableCodeInputModel
     */
    datatrace?: Array<CodeChunkInputModel> | null;
    /**
     *
     * @type {Array<CodeChunkInputModel>}
     * @memberof IssueVulnerableCodeInputModel
     */
    taintDataEntries?: Array<CodeChunkInputModel> | null;
    /**
     *
     * @type {ExploitDataInputModel}
     * @memberof IssueVulnerableCodeInputModel
     */
    autoCheckExploit?: ExploitDataInputModel;
    /**
     *
     * @type {string}
     * @memberof IssueVulnerableCodeInputModel
     */
    condition?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof IssueVulnerableCodeInputModel
     */
    isSecondOrder?: boolean;
}
/**
 *
 * @export
 * @interface JavaScriptSettingsModel
 */
export interface JavaScriptSettingsModel {
    /**
     *
     * @type {string}
     * @memberof JavaScriptSettingsModel
     */
    launchParameters?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof JavaScriptSettingsModel
     */
    useAvailablePublicAndProtectedMethods?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof JavaScriptSettingsModel
     */
    downloadDependencies?: boolean;
    /**
     *
     * @type {string}
     * @memberof JavaScriptSettingsModel
     */
    dependenciesPath?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof JavaScriptSettingsModel
     */
    useTaintAnalysis?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof JavaScriptSettingsModel
     */
    useJsaAnalysis?: boolean;
    /**
     *
     * @type {string}
     * @memberof JavaScriptSettingsModel
     */
    dslRulesRelativePath?: string | null;
}
/**
 *
 * @export
 * @interface JavaSettingsModel
 */
export interface JavaSettingsModel {
    /**
     *
     * @type {string}
     * @memberof JavaSettingsModel
     */
    parameters?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof JavaSettingsModel
     */
    unpackUserPackages?: boolean;
    /**
     *
     * @type {string}
     * @memberof JavaSettingsModel
     */
    userPackagePrefixes?: string | null;
    /**
     *
     * @type {JavaVersions}
     * @memberof JavaSettingsModel
     */
    version?: JavaVersions;
    /**
     *
     * @type {string}
     * @memberof JavaSettingsModel
     */
    launchParameters?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof JavaSettingsModel
     */
    useAvailablePublicAndProtectedMethods?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof JavaSettingsModel
     */
    downloadDependencies?: boolean;
    /**
     *
     * @type {string}
     * @memberof JavaSettingsModel
     */
    dependenciesPath?: string | null;
    /**
     *
     * @type {string}
     * @memberof JavaSettingsModel
     */
    dslRulesRelativePath?: string | null;
}

/**
 *
 * @export
 */
export const JavaVersions = {
    _8: 'v1_8',
    _11: 'v1_11',
    _17: 'v1_17',
    _21: 'v1_21',
    _25: 'v1_25'
} as const;
export type JavaVersions = typeof JavaVersions[keyof typeof JavaVersions];

/**
 *
 * @export
 * @interface JiraTicketLinkModel
 */
export interface JiraTicketLinkModel {
    /**
     *
     * @type {string}
     * @memberof JiraTicketLinkModel
     */
    projectId?: string | null;
    /**
     *
     * @type {TrackerType}
     * @memberof JiraTicketLinkModel
     */
    trackerType?: TrackerType;
    /**
     *
     * @type {string}
     * @memberof JiraTicketLinkModel
     */
    readonly connectionId?: string;
    /**
     *
     * @type {string}
     * @memberof JiraTicketLinkModel
     */
    ticketId?: string | null;
}
/**
 *
 * @export
 * @interface LdapSettingsModel
 */
export interface LdapSettingsModel {
    /**
     *
     * @type {string}
     * @memberof LdapSettingsModel
     */
    host?: string | null;
    /**
     *
     * @type {number}
     * @memberof LdapSettingsModel
     */
    port?: number;
    /**
     *
     * @type {number}
     * @memberof LdapSettingsModel
     */
    sslPort?: number;
    /**
     *
     * @type {boolean}
     * @memberof LdapSettingsModel
     */
    useSsl?: boolean;
    /**
     *
     * @type {CertModel}
     * @memberof LdapSettingsModel
     */
    caCertificate?: CertModel;
    /**
     *
     * @type {boolean}
     * @memberof LdapSettingsModel
     */
    useCryptographicAuthentication?: boolean;
    /**
     *
     * @type {CertModel}
     * @memberof LdapSettingsModel
     */
    authCertificate?: CertModel;
    /**
     *
     * @type {CertModel}
     * @memberof LdapSettingsModel
     */
    privateKey?: CertModel;
    /**
     *
     * @type {string}
     * @memberof LdapSettingsModel
     */
    baseDn?: string | null;
    /**
     *
     * @type {string}
     * @memberof LdapSettingsModel
     */
    rootUserDn?: string | null;
    /**
     *
     * @type {string}
     * @memberof LdapSettingsModel
     */
    rootUserPassword?: string | null;
    /**
     *
     * @type {string}
     * @memberof LdapSettingsModel
     */
    searchFilter?: string | null;
    /**
     *
     * @type {string}
     * @memberof LdapSettingsModel
     */
    syncUsersInterval?: string;
    /**
     *
     * @type {boolean}
     * @memberof LdapSettingsModel
     */
    isAutoSyncUsersEnabled?: boolean;
}

/**
 *
 * @export
 */
export const LdapSyncStatus = {
    Inactive: 'Inactive',
    Running: 'Running'
} as const;
export type LdapSyncStatus = typeof LdapSyncStatus[keyof typeof LdapSyncStatus];


/**
 *
 * @export
 */
export const LegacyProgrammingLanguageGroup = {
    None: 'None',
    Java: 'Java',
    CSharpWinOnly: 'CSharpWinOnly',
    Php: 'Php',
    JavaScript: 'JavaScript',
    Python: 'Python',
    ObjectiveC: 'ObjectiveC',
    Swift: 'Swift',
    CAndCPlusPlus: 'CAndCPlusPlus',
    Go: 'Go',
    Kotlin: 'Kotlin',
    Sql: 'Sql',
    Ruby: 'Ruby',
    Dart: 'Dart',
    CSharp: 'CSharp',
    Solidity: 'Solidity',
    Scala: 'Scala',
    OneC: 'OneC'
} as const;
export type LegacyProgrammingLanguageGroup = typeof LegacyProgrammingLanguageGroup[keyof typeof LegacyProgrammingLanguageGroup];


/**
 *
 * @export
 */
export const LicensedModuleId = {
    Sca: 'Sca',
    MaliciousCode: 'MaliciousCode',
    StandProjects: 'StandProjects'
} as const;
export type LicensedModuleId = typeof LicensedModuleId[keyof typeof LicensedModuleId];

/**
 *
 * @export
 * @interface LicensedModuleModel
 */
export interface LicensedModuleModel {
    /**
     *
     * @type {LicensedModuleId}
     * @memberof LicensedModuleModel
     */
    id?: LicensedModuleId;
    /**
     *
     * @type {boolean}
     * @memberof LicensedModuleModel
     */
    enabled?: boolean;
    /**
     *
     * @type {Array<ScanModuleType>}
     * @memberof LicensedModuleModel
     */
    scanModuleTypes?: Array<ScanModuleType> | null;
}
/**
 *
 * @export
 * @interface LightMailProfileModel
 */
export interface LightMailProfileModel {
    /**
     *
     * @type {string}
     * @memberof LightMailProfileModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof LightMailProfileModel
     */
    profileName?: string | null;
    /**
     *
     * @type {string}
     * @memberof LightMailProfileModel
     */
    smtpServerAddress?: string | null;
}

/**
 *
 * @export
 */
export const LocalSourceType = {
    None: 'None',
    File: 'File',
    Folder: 'Folder'
} as const;
export type LocalSourceType = typeof LocalSourceType[keyof typeof LocalSourceType];


/**
 *
 * @export
 */
export const LogLevel = {
    Undefined: 'Undefined',
    Trace: 'Trace',
    Debug: 'Debug',
    Info: 'Info',
    Warn: 'Warn',
    Error: 'Error',
    Fatal: 'Fatal'
} as const;
export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

/**
 *
 * @export
 * @interface LogLevelModel
 */
export interface LogLevelModel {
    /**
     *
     * @type {LogLevel}
     * @memberof LogLevelModel
     */
    logLevel?: LogLevel;
}
/**
 *
 * @export
 * @interface LogSettingsModel
 */
export interface LogSettingsModel {
    /**
     *
     * @type {LogLevel}
     * @memberof LogSettingsModel
     */
    fileLoggingLevel?: LogLevel;
    /**
     *
     * @type {ExternalLoggingSettingsModel}
     * @memberof LogSettingsModel
     */
    externalLoggingSettings?: ExternalLoggingSettingsModel;
}
/**
 *
 * @export
 * @interface MailAuthentication
 */
export interface MailAuthentication {
    /**
     *
     * @type {boolean}
     * @memberof MailAuthentication
     */
    isAuthRequired?: boolean;
    /**
     *
     * @type {string}
     * @memberof MailAuthentication
     */
    username?: string | null;
    /**
     *
     * @type {string}
     * @memberof MailAuthentication
     */
    password?: string | null;
}
/**
 *
 * @export
 * @interface MailAuthenticationPatchModel
 */
export interface MailAuthenticationPatchModel {
    /**
     *
     * @type {boolean}
     * @memberof MailAuthenticationPatchModel
     */
    isAuthRequired?: boolean | null;
    /**
     *
     * @type {string}
     * @memberof MailAuthenticationPatchModel
     */
    username?: string | null;
    /**
     *
     * @type {string}
     * @memberof MailAuthenticationPatchModel
     */
    password?: string | null;
}
/**
 *
 * @export
 * @interface MailProfileModel
 */
export interface MailProfileModel {
    /**
     *
     * @type {MailAuthentication}
     * @memberof MailProfileModel
     */
    authentication?: MailAuthentication;
    /**
     *
     * @type {string}
     * @memberof MailProfileModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof MailProfileModel
     */
    credentialsId?: string | null;
    /**
     *
     * @type {string}
     * @memberof MailProfileModel
     */
    profileName?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof MailProfileModel
     */
    compressReport?: boolean;
    /**
     *
     * @type {string}
     * @memberof MailProfileModel
     */
    subject?: string | null;
    /**
     *
     * @type {string}
     * @memberof MailProfileModel
     */
    smtpServerAddress?: string | null;
    /**
     *
     * @type {number}
     * @memberof MailProfileModel
     */
    port?: number;
    /**
     *
     * @type {string}
     * @memberof MailProfileModel
     */
    senderEmail?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof MailProfileModel
     */
    enableSsl?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof MailProfileModel
     */
    considerCertificateErrors?: boolean;
}
/**
 *
 * @export
 * @interface MailProfilePatchModel
 */
export interface MailProfilePatchModel {
    /**
     *
     * @type {MailAuthenticationPatchModel}
     * @memberof MailProfilePatchModel
     */
    authentication?: MailAuthenticationPatchModel;
    /**
     *
     * @type {string}
     * @memberof MailProfilePatchModel
     */
    profileName?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof MailProfilePatchModel
     */
    compressReport?: boolean | null;
    /**
     *
     * @type {string}
     * @memberof MailProfilePatchModel
     */
    subject?: string | null;
    /**
     *
     * @type {string}
     * @memberof MailProfilePatchModel
     */
    smtpServerAddress?: string | null;
    /**
     *
     * @type {number}
     * @memberof MailProfilePatchModel
     */
    port?: number | null;
    /**
     *
     * @type {string}
     * @memberof MailProfilePatchModel
     */
    senderEmail?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof MailProfilePatchModel
     */
    enableSsl?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof MailProfilePatchModel
     */
    considerCertificateErrors?: boolean | null;
}
/**
 *
 * @export
 * @interface MailingProjectSettingsModel
 */
export interface MailingProjectSettingsModel {
    /**
     *
     * @type {boolean}
     * @memberof MailingProjectSettingsModel
     */
    enabled?: boolean;
    /**
     *
     * @type {string}
     * @memberof MailingProjectSettingsModel
     */
    mailProfileId?: string | null;
    /**
     *
     * @type {Array<string>}
     * @memberof MailingProjectSettingsModel
     */
    emailRecipients?: Array<string> | null;
}
/**
 *
 * @export
 * @interface MaliciousCallModel
 */
export interface MaliciousCallModel {
    /**
     *
     * @type {string}
     * @memberof MaliciousCallModel
     */
    sourceFile?: string | null;
    /**
     *
     * @type {number}
     * @memberof MaliciousCallModel
     */
    lineNumber?: number;
    /**
     *
     * @type {string}
     * @memberof MaliciousCallModel
     */
    lineValue?: string | null;
    /**
     *
     * @type {string}
     * @memberof MaliciousCallModel
     */
    maliciousGroup?: string | null;
}
/**
 *
 * @export
 * @interface MaliciousCodeModel
 */
export interface MaliciousCodeModel {
    /**
     *
     * @type {string}
     * @memberof MaliciousCodeModel
     */
    fileName?: string | null;
    /**
     *
     * @type {Array<MaliciousCallModel>}
     * @memberof MaliciousCodeModel
     */
    maliciousCalls?: Array<MaliciousCallModel> | null;
}
/**
 *
 * @export
 * @interface MemberModel
 */
export interface MemberModel {
    /**
     *
     * @type {string}
     * @memberof MemberModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof MemberModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof MemberModel
     */
    email?: string | null;
    /**
     *
     * @type {string}
     * @memberof MemberModel
     */
    login?: string | null;
    /**
     *
     * @type {string}
     * @memberof MemberModel
     */
    authentication?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof MemberModel
     */
    isActive?: boolean;
    /**
     *
     * @type {Array<MemberRoleModel>}
     * @memberof MemberModel
     */
    roles?: Array<MemberRoleModel> | null;
}
/**
 *
 * @export
 * @interface MemberRoleModel
 */
export interface MemberRoleModel {
    /**
     *
     * @type {string}
     * @memberof MemberRoleModel
     */
    name?: string | null;
    /**
     *
     * @type {Array<RoleProjectModel>}
     * @memberof MemberRoleModel
     */
    projects?: Array<RoleProjectModel> | null;
    /**
     *
     * @type {boolean}
     * @memberof MemberRoleModel
     */
    autoSet?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof MemberRoleModel
     */
    allProjects?: boolean;
}
/**
 *
 * @export
 * @interface MetaVarModel
 */
export interface MetaVarModel {
    /**
     *
     * @type {string}
     * @memberof MetaVarModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof MetaVarModel
     */
    value?: string | null;
    /**
     *
     * @type {number}
     * @memberof MetaVarModel
     */
    beginLine?: number;
    /**
     *
     * @type {number}
     * @memberof MetaVarModel
     */
    endLine?: number;
    /**
     *
     * @type {number}
     * @memberof MetaVarModel
     */
    beginColumn?: number;
    /**
     *
     * @type {number}
     * @memberof MetaVarModel
     */
    endColumn?: number;
}
/**
 *
 * @export
 * @interface MoveQueueItems
 */
export interface MoveQueueItems {
    /**
     *
     * @type {Array<string>}
     * @memberof MoveQueueItems
     */
    items: Array<string>;
    /**
     *
     * @type {number}
     * @memberof MoveQueueItems
     */
    place: number;
}
/**
 *
 * @export
 * @interface Node
 */
export interface Node {
    /**
     *
     * @type {NodeType}
     * @memberof Node
     */
    type?: NodeType;
    /**
     *
     * @type {string}
     * @memberof Node
     */
    relativePath?: string | null;
    /**
     *
     * @type {number}
     * @memberof Node
     */
    lastModifiedDate?: number;
    /**
     *
     * @type {number}
     * @memberof Node
     */
    size?: number;
    /**
     *
     * @type {string}
     * @memberof Node
     */
    hash?: string | null;
    /**
     *
     * @type {Array<string>}
     * @memberof Node
     */
    relatedFiles?: Array<string> | null;
    /**
     *
     * @type {{ [key: string]: NodeState; }}
     * @memberof Node
     */
    stateByCores?: { [key: string]: NodeState; } | null;
}

/**
 *
 * @export
 */
export const NodeState = {
    Unknown: 'Unknown',
    Scanned: 'Scanned',
    ExcludeByIgnoreList: 'ExcludeByIgnoreList',
    SkippedByIncrement: 'SkippedByIncrement',
    SkippedByCore: 'SkippedByCore'
} as const;
export type NodeState = typeof NodeState[keyof typeof NodeState];


/**
 *
 * @export
 */
export const NodeType = {
    Unknown: 'Unknown',
    File: 'File',
    Folder: 'Folder',
    FileWithEntry: 'FileWithEntry',
    VirtualFolder: 'VirtualFolder',
    FileWithDecompiledData: 'FileWithDecompiledData',
    DecompiledData: 'DecompiledData',
    FileWithDownloadedDependency: 'FileWithDownloadedDependency'
} as const;
export type NodeType = typeof NodeType[keyof typeof NodeType];

/**
 *
 * @export
 * @interface OAuthCredentialsModel
 */
export interface OAuthCredentialsModel {
    /**
     *
     * @type {Oauth1DataModel}
     * @memberof OAuthCredentialsModel
     */
    authData?: Oauth1DataModel;
    /**
     *
     * @type {string}
     * @memberof OAuthCredentialsModel
     */
    token?: string | null;
    /**
     *
     * @type {string}
     * @memberof OAuthCredentialsModel
     */
    tokenSecret?: string | null;
}
/**
 *
 * @export
 * @interface Oauth1AccessTokenModel
 */
export interface Oauth1AccessTokenModel {
    /**
     *
     * @type {string}
     * @memberof Oauth1AccessTokenModel
     */
    token?: string | null;
    /**
     *
     * @type {string}
     * @memberof Oauth1AccessTokenModel
     */
    secret?: string | null;
}
/**
 *
 * @export
 * @interface Oauth1DataModel
 */
export interface Oauth1DataModel {
    /**
     *
     * @type {string}
     * @memberof Oauth1DataModel
     */
    privateKey?: string | null;
    /**
     *
     * @type {string}
     * @memberof Oauth1DataModel
     */
    publicKey?: string | null;
    /**
     *
     * @type {string}
     * @memberof Oauth1DataModel
     */
    consumerKey?: string | null;
}
/**
 *
 * @export
 * @interface Oauth1RequestTokenModel
 */
export interface Oauth1RequestTokenModel {
    /**
     *
     * @type {string}
     * @memberof Oauth1RequestTokenModel
     */
    token?: string | null;
    /**
     *
     * @type {string}
     * @memberof Oauth1RequestTokenModel
     */
    grantUrl?: string | null;
}

/**
 *
 * @export
 */
export const OpenIdResponseMode = {
    Query: 'Query',
    FormPost: 'FormPost',
    Fragment: 'Fragment'
} as const;
export type OpenIdResponseMode = typeof OpenIdResponseMode[keyof typeof OpenIdResponseMode];


/**
 *
 * @export
 */
export const OpenIdResponseType = {
    Code: 'Code',
    CodeIdToken: 'CodeIdToken',
    CodeIdTokenToken: 'CodeIdTokenToken',
    CodeToken: 'CodeToken',
    IdToken: 'IdToken',
    IdTokenToken: 'IdTokenToken',
    None: 'None',
    Token: 'Token'
} as const;
export type OpenIdResponseType = typeof OpenIdResponseType[keyof typeof OpenIdResponseType];

/**
 *
 * @export
 * @interface OpenIdSettingsModel
 */
export interface OpenIdSettingsModel {
    /**
     *
     * @type {string}
     * @memberof OpenIdSettingsModel
     */
    authority?: string | null;
    /**
     *
     * @type {string}
     * @memberof OpenIdSettingsModel
     */
    clientId?: string | null;
    /**
     *
     * @type {string}
     * @memberof OpenIdSettingsModel
     */
    clientSecret?: string | null;
    /**
     *
     * @type {CertModel}
     * @memberof OpenIdSettingsModel
     */
    caCertificate?: CertModel;
    /**
     *
     * @type {OpenIdResponseMode}
     * @memberof OpenIdSettingsModel
     */
    responseMode?: OpenIdResponseMode;
    /**
     *
     * @type {OpenIdResponseType}
     * @memberof OpenIdSettingsModel
     */
    responseType?: OpenIdResponseType;
}
/**
 *
 * @export
 * @interface OptionValueModel
 */
export interface OptionValueModel {
    /**
     *
     * @type {string}
     * @memberof OptionValueModel
     */
    id?: string | null;
    /**
     *
     * @type {string}
     * @memberof OptionValueModel
     */
    name?: string | null;
}
/**
 *
 * @export
 * @interface PMGroupModel
 */
export interface PMGroupModel {
    /**
     *
     * @type {string}
     * @memberof PMGroupModel
     */
    id: string;
    /**
     *
     * @type {string}
     * @memberof PMGroupModel
     */
    name: string;
    /**
     *
     * @type {string}
     * @memberof PMGroupModel
     */
    modifiedDate: string;
    /**
     *
     * @type {UserModel}
     * @memberof PMGroupModel
     */
    modifiedBy: UserModel;
    /**
     *
     * @type {number}
     * @memberof PMGroupModel
     */
    rulesCount: number;
}
/**
 *
 * @export
 * @interface PMGroupUpsertModel
 */
export interface PMGroupUpsertModel {
    /**
     *
     * @type {string}
     * @memberof PMGroupUpsertModel
     */
    name: string;
    /**
     *
     * @type {Array<string>}
     * @memberof PMGroupUpsertModel
     */
    rules: Array<string>;
}
/**
 *
 * @export
 * @interface Package
 */
export interface Package {
    /**
     *
     * @type {number}
     * @memberof Package
     */
    id: number;
    /**
     *
     * @type {PackageStatus}
     * @memberof Package
     */
    status: PackageStatus;
    /**
     *
     * @type {PackageType}
     * @memberof Package
     */
    packageType: PackageType;
    /**
     *
     * @type {string}
     * @memberof Package
     */
    version: string;
    /**
     *
     * @type {string}
     * @memberof Package
     */
    fileName: string;
    /**
     *
     * @type {number}
     * @memberof Package
     */
    fileSize: number;
    /**
     *
     * @type {string}
     * @memberof Package
     */
    fileHash: string;
    /**
     *
     * @type {PackageTrigger}
     * @memberof Package
     */
    triggeredBy: PackageTrigger;
    /**
     *
     * @type {string}
     * @memberof Package
     */
    uploadedAt: string;
    /**
     *
     * @type {PackageUser}
     * @memberof Package
     */
    uploadedBy?: PackageUser | null;
    /**
     *
     * @type {string}
     * @memberof Package
     */
    lastModifiedAt: string;
    /**
     *
     * @type {PackageUser}
     * @memberof Package
     */
    lastModifiedBy?: PackageUser | null;
}

/**
 *
 * @export
 */
export const PackageStatus = {
    Active: 'active',
    Current: 'current',
    Archived: 'archived',
    RolledBack: 'rolled_back'
} as const;
export type PackageStatus = typeof PackageStatus[keyof typeof PackageStatus];


/**
 *
 * @export
 */
export const PackageTrigger = {
    Manual: 'manual',
    Scheduled: 'scheduled'
} as const;
export type PackageTrigger = typeof PackageTrigger[keyof typeof PackageTrigger];


/**
 *
 * @export
 */
export const PackageType = {
    ScaFeeds: 'sca_feeds'
} as const;
export type PackageType = typeof PackageType[keyof typeof PackageType];

/**
 *
 * @export
 * @interface PackageUser
 */
export interface PackageUser {
    /**
     *
     * @type {string}
     * @memberof PackageUser
     */
    id: string;
    /**
     *
     * @type {string}
     * @memberof PackageUser
     */
    userName: string;
    /**
     *
     * @type {string}
     * @memberof PackageUser
     */
    email: string;
    /**
     *
     * @type {string}
     * @memberof PackageUser
     */
    tokenName: string;
}

/**
 *
 * @export
 */
export const PermissionCheckStrategy = {
    Any: 'Any',
    All: 'All'
} as const;
export type PermissionCheckStrategy = typeof PermissionCheckStrategy[keyof typeof PermissionCheckStrategy];


/**
 *
 * @export
 */
export const PermissionType = {
    None: 'None',
    CreateProject: 'CreateProject',
    ManageIssueTrackerIntegration: 'ManageIssueTrackerIntegration',
    ReadIssueTrackerIntegration: 'ReadIssueTrackerIntegration',
    ManageLicense: 'ManageLicense',
    ReadLicense: 'ReadLicense',
    ManageScanQueue: 'ManageScanQueue',
    ReadScanQueue: 'ReadScanQueue',
    ManageScanAgents: 'ManageScanAgents',
    ReadScanAgents: 'ReadScanAgents',
    ManageCustomRules: 'ManageCustomRules',
    ReadCustomRules: 'ReadCustomRules',
    ManageAccessTokens: 'ManageAccessTokens',
    ReadAccessTokens: 'ReadAccessTokens',
    ReadSslCert: 'ReadSSLCert',
    LoadLogs: 'LoadLogs',
    ReadLogSettings: 'ReadLogSettings',
    ManageLogSettings: 'ManageLogSettings',
    ManageSystemProxySettings: 'ManageSystemProxySettings',
    ReadSystemProxySettings: 'ReadSystemProxySettings',
    ManageMailProfileSettings: 'ManageMailProfileSettings',
    ReadMailProfileSettings: 'ReadMailProfileSettings',
    ManageReportSettings: 'ManageReportSettings',
    ReadReportSettings: 'ReadReportSettings',
    ManageSsoSettings: 'ManageSSOSettings',
    ReadSsoSettings: 'ReadSSOSettings',
    ManageUsers: 'ManageUsers',
    ReadUsers: 'ReadUsers',
    ManageRoles: 'ManageRoles',
    ReadRoles: 'ReadRoles',
    CreateDisposableProject: 'CreateDisposableProject',
    ViewProject: 'ViewProject',
    ChangeVulnStatus: 'ChangeVulnStatus',
    DeleteScanResult: 'DeleteScanResult',
    UpdateProject: 'UpdateProject',
    ManageScan: 'ManageScan',
    DeleteProject: 'DeleteProject',
    ManageProjectMembership: 'ManageProjectMembership',
    DeleteIssueTrackerTicket: 'DeleteIssueTrackerTicket',
    CreateIssueTrackerTicket: 'CreateIssueTrackerTicket',
    ChangeVulnStatusWithoutComment: 'ChangeVulnStatusWithoutComment',
    ManageBranches: 'ManageBranches',
    WorkWithScanScheduler: 'WorkWithScanScheduler',
    SetAutoApprove: 'SetAutoApprove',
    ManageAiTriageIntegration: 'ManageAiTriageIntegration',
    AcceptSecurityPolicyRisks: 'AcceptSecurityPolicyRisks',
    ManagePackages: 'ManagePackages'
} as const;
export type PermissionType = typeof PermissionType[keyof typeof PermissionType];

/**
 *
 * @export
 * @interface PhpSettingsModel
 */
export interface PhpSettingsModel {
    /**
     *
     * @type {string}
     * @memberof PhpSettingsModel
     */
    launchParameters?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof PhpSettingsModel
     */
    useAvailablePublicAndProtectedMethods?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof PhpSettingsModel
     */
    downloadDependencies?: boolean;
    /**
     *
     * @type {string}
     * @memberof PhpSettingsModel
     */
    dependenciesPath?: string | null;
    /**
     *
     * @type {string}
     * @memberof PhpSettingsModel
     */
    dslRulesRelativePath?: string | null;
}
/**
 *
 * @export
 * @interface PmRuleCreateUpdateModel
 */
export interface PmRuleCreateUpdateModel {
    /**
     *
     * @type {string}
     * @memberof PmRuleCreateUpdateModel
     */
    vulnerabilityTypeId?: string | null;
    /**
     *
     * @type {Array<string>}
     * @memberof PmRuleCreateUpdateModel
     */
    pmGroupIds?: Array<string> | null;
    /**
     *
     * @type {string}
     * @memberof PmRuleCreateUpdateModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof PmRuleCreateUpdateModel
     */
    description?: string | null;
    /**
     *
     * @type {Array<PmTaintProgrammingLanguages>}
     * @memberof PmRuleCreateUpdateModel
     */
    programmingLanguages?: Array<PmTaintProgrammingLanguages> | null;
    /**
     *
     * @type {DataFormat}
     * @memberof PmRuleCreateUpdateModel
     */
    dataFormat?: DataFormat;
    /**
     *
     * @type {string}
     * @memberof PmRuleCreateUpdateModel
     */
    filenameWildcard?: string | null;
    /**
     *
     * @type {string}
     * @memberof PmRuleCreateUpdateModel
     */
    value?: string | null;
    /**
     *
     * @type {IssueLevel}
     * @memberof PmRuleCreateUpdateModel
     */
    level?: IssueLevel;
    /**
     *
     * @type {string}
     * @memberof PmRuleCreateUpdateModel
     */
    contactInfo?: string | null;
}
/**
 *
 * @export
 * @interface PmRuleModel
 */
export interface PmRuleModel {
    /**
     *
     * @type {string}
     * @memberof PmRuleModel
     */
    id?: string | null;
    /**
     *
     * @type {number}
     * @memberof PmRuleModel
     */
    version?: number;
    /**
     *
     * @type {string}
     * @memberof PmRuleModel
     */
    modifiedDate?: string;
    /**
     *
     * @type {UserModel}
     * @memberof PmRuleModel
     */
    modifiedBy?: UserModel;
    /**
     *
     * @type {PmRuleVulnTypeModel}
     * @memberof PmRuleModel
     */
    vulnerabilityType?: PmRuleVulnTypeModel;
    /**
     *
     * @type {string}
     * @memberof PmRuleModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof PmRuleModel
     */
    description?: string | null;
    /**
     *
     * @type {Array<PmTaintProgrammingLanguages>}
     * @memberof PmRuleModel
     */
    programmingLanguages?: Array<PmTaintProgrammingLanguages> | null;
    /**
     *
     * @type {DataFormat}
     * @memberof PmRuleModel
     */
    dataFormat?: DataFormat;
    /**
     *
     * @type {string}
     * @memberof PmRuleModel
     */
    filenameWildcard?: string | null;
    /**
     *
     * @type {string}
     * @memberof PmRuleModel
     */
    value?: string | null;
    /**
     *
     * @type {IssueLevel}
     * @memberof PmRuleModel
     */
    level?: IssueLevel;
    /**
     *
     * @type {string}
     * @memberof PmRuleModel
     */
    contactInfo?: string | null;
}

/**
 *
 * @export
 */
export const PmRuleVulnCreationType = {
    User: 'User',
    System: 'System'
} as const;
export type PmRuleVulnCreationType = typeof PmRuleVulnCreationType[keyof typeof PmRuleVulnCreationType];

/**
 *
 * @export
 * @interface PmRuleVulnType
 */
export interface PmRuleVulnType {
    /**
     *
     * @type {string}
     * @memberof PmRuleVulnType
     */
    id: string;
    /**
     *
     * @type {string}
     * @memberof PmRuleVulnType
     */
    name: string;
    /**
     *
     * @type {string}
     * @memberof PmRuleVulnType
     */
    description?: string | null;
    /**
     *
     * @type {PmRuleVulnCreationType}
     * @memberof PmRuleVulnType
     */
    creationType: PmRuleVulnCreationType;
}
/**
 *
 * @export
 * @interface PmRuleVulnTypeCreatingModel
 */
export interface PmRuleVulnTypeCreatingModel {
    /**
     *
     * @type {string}
     * @memberof PmRuleVulnTypeCreatingModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof PmRuleVulnTypeCreatingModel
     */
    description?: string | null;
}
/**
 *
 * @export
 * @interface PmRuleVulnTypeModel
 */
export interface PmRuleVulnTypeModel {
    /**
     *
     * @type {string}
     * @memberof PmRuleVulnTypeModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof PmRuleVulnTypeModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof PmRuleVulnTypeModel
     */
    description?: string | null;
    /**
     *
     * @type {PmRuleVulnCreationType}
     * @memberof PmRuleVulnTypeModel
     */
    creationType?: PmRuleVulnCreationType;
}
/**
 *
 * @export
 * @interface PmRuleWithGroupsModel
 */
export interface PmRuleWithGroupsModel {
    /**
     *
     * @type {Array<string>}
     * @memberof PmRuleWithGroupsModel
     */
    pmGroupIds?: Array<string> | null;
    /**
     *
     * @type {string}
     * @memberof PmRuleWithGroupsModel
     */
    id?: string | null;
    /**
     *
     * @type {number}
     * @memberof PmRuleWithGroupsModel
     */
    version?: number;
    /**
     *
     * @type {string}
     * @memberof PmRuleWithGroupsModel
     */
    modifiedDate?: string;
    /**
     *
     * @type {UserModel}
     * @memberof PmRuleWithGroupsModel
     */
    modifiedBy?: UserModel;
    /**
     *
     * @type {PmRuleVulnTypeModel}
     * @memberof PmRuleWithGroupsModel
     */
    vulnerabilityType?: PmRuleVulnTypeModel;
    /**
     *
     * @type {string}
     * @memberof PmRuleWithGroupsModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof PmRuleWithGroupsModel
     */
    description?: string | null;
    /**
     *
     * @type {Array<PmTaintProgrammingLanguages>}
     * @memberof PmRuleWithGroupsModel
     */
    programmingLanguages?: Array<PmTaintProgrammingLanguages> | null;
    /**
     *
     * @type {DataFormat}
     * @memberof PmRuleWithGroupsModel
     */
    dataFormat?: DataFormat;
    /**
     *
     * @type {string}
     * @memberof PmRuleWithGroupsModel
     */
    filenameWildcard?: string | null;
    /**
     *
     * @type {string}
     * @memberof PmRuleWithGroupsModel
     */
    value?: string | null;
    /**
     *
     * @type {IssueLevel}
     * @memberof PmRuleWithGroupsModel
     */
    level?: IssueLevel;
    /**
     *
     * @type {string}
     * @memberof PmRuleWithGroupsModel
     */
    contactInfo?: string | null;
}
/**
 *
 * @export
 * @interface PmRulesHashModel
 */
export interface PmRulesHashModel {
    /**
     *
     * @type {string}
     * @memberof PmRulesHashModel
     */
    pmRulesHash?: string | null;
}
/**
 *
 * @export
 * @interface PmTaintBaseSettingsModel
 */
export interface PmTaintBaseSettingsModel {
    /**
     *
     * @type {string}
     * @memberof PmTaintBaseSettingsModel
     */
    launchParameters?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof PmTaintBaseSettingsModel
     */
    useAvailablePublicAndProtectedMethods?: boolean;
}

/**
 *
 * @export
 */
export const PmTaintProgrammingLanguages = {
    None: 'None',
    Php: 'Php',
    Java: 'Java',
    Html: 'Html',
    JavaScript: 'JavaScript',
    PlSql: 'PlSql',
    TSql: 'TSql',
    Aspx: 'Aspx',
    C: 'C',
    CPlusPlus: 'CPlusPlus',
    ObjectiveC: 'ObjectiveC',
    Swift: 'Swift',
    MySql: 'MySql',
    Python: 'Python',
    CSharp: 'CSharp',
    Go: 'Go',
    Kotlin: 'Kotlin',
    TypeScript: 'TypeScript',
    Ruby: 'Ruby',
    Solidity: 'Solidity',
    Scala: 'Scala',
    OneC: 'OneC',
    Dart: 'Dart'
} as const;
export type PmTaintProgrammingLanguages = typeof PmTaintProgrammingLanguages[keyof typeof PmTaintProgrammingLanguages];

/**
 *
 * @export
 * @interface PmTaintSettingsModel
 */
export interface PmTaintSettingsModel {
    /**
     *
     * @type {boolean}
     * @memberof PmTaintSettingsModel
     */
    applyAllPmRules?: boolean;
    /**
     *
     * @type {Array<string>}
     * @memberof PmTaintSettingsModel
     */
    pmGroups?: Array<string> | null;
    /**
     *
     * @type {string}
     * @memberof PmTaintSettingsModel
     */
    launchParameters?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof PmTaintSettingsModel
     */
    useAvailablePublicAndProtectedMethods?: boolean;
}

/**
 *
 * @export
 */
export const PolicyState = {
    None: 'None',
    Rejected: 'Rejected',
    Confirmed: 'Confirmed'
} as const;
export type PolicyState = typeof PolicyState[keyof typeof PolicyState];

/**
 *
 * @export
 * @interface PreferredAgentsSettings
 */
export interface PreferredAgentsSettings {
    /**
     *
     * @type {Array<string>}
     * @memberof PreferredAgentsSettings
     */
    preferredAgents: Array<string> | null;
    /**
     *
     * @type {boolean}
     * @memberof PreferredAgentsSettings
     */
    preferredAgentsOnly: boolean;
}
/**
 *
 * @export
 * @interface PreferredAgentsSettingsModel
 */
export interface PreferredAgentsSettingsModel {
    /**
     *
     * @type {Array<string>}
     * @memberof PreferredAgentsSettingsModel
     */
    preferredAgents?: Array<string> | null;
    /**
     *
     * @type {boolean}
     * @memberof PreferredAgentsSettingsModel
     */
    preferredAgentsOnly?: boolean;
}

/**
 *
 * @export
 */
export const Priority = {
    None: 'None',
    Low: 'Low',
    Medium: 'Medium',
    High: 'High',
    Critical: 'Critical'
} as const;
export type Priority = typeof Priority[keyof typeof Priority];

/**
 *
 * @export
 * @interface PriorityTypeModel
 */
export interface PriorityTypeModel {
    /**
     *
     * @type {string}
     * @memberof PriorityTypeModel
     */
    id?: string | null;
    /**
     *
     * @type {string}
     * @memberof PriorityTypeModel
     */
    name?: string | null;
}

/**
 *
 * @export
 */
export const ProgrammingLanguage = {
    DotNet: 'DotNet',
    Php: 'Php',
    Java: 'Java',
    Html: 'Html',
    JavaScript: 'JavaScript',
    All: 'All',
    SandBox: 'SandBox',
    Binary: 'Binary',
    PlSql: 'PlSql',
    TSql: 'TSql',
    Aspx: 'Aspx',
    C: 'C',
    CPlusPlus: 'CPlusPlus',
    ObjectiveC: 'ObjectiveC',
    Swift: 'Swift',
    MySql: 'MySql',
    Python: 'Python',
    CSharpWinOnly: 'CSharpWinOnly',
    Go: 'Go',
    Kotlin: 'Kotlin',
    TypeScript: 'TypeScript',
    Ruby: 'Ruby',
    CSharpCrossPlatform: 'CSharpCrossPlatform',
    Solidity: 'Solidity',
    Scala: 'Scala',
    OneC: 'OneC',
    Dart: 'Dart',
    None: 'None'
} as const;
export type ProgrammingLanguage = typeof ProgrammingLanguage[keyof typeof ProgrammingLanguage];


/**
 *
 * @export
 */
export const ProgrammingLanguageGroup = {
    None: 'None',
    Java: 'Java',
    CSharp: 'CSharp',
    Php: 'Php',
    JavaScript: 'JavaScript',
    Python: 'Python',
    ObjectiveC: 'ObjectiveC',
    Swift: 'Swift',
    CAndCPlusPlus: 'CAndCPlusPlus',
    Go: 'Go',
    Kotlin: 'Kotlin',
    Sql: 'Sql',
    Ruby: 'Ruby',
    Solidity: 'Solidity',
    Scala: 'Scala',
    OneC: 'OneC',
    Dart: 'Dart'
} as const;
export type ProgrammingLanguageGroup = typeof ProgrammingLanguageGroup[keyof typeof ProgrammingLanguageGroup];


/**
 *
 * @export
 */
export const ProgrammingLanguages = {
    None: 'None',
    DotNet: 'DotNet',
    Php: 'Php',
    Java: 'Java',
    Html: 'Html',
    JavaScript: 'JavaScript',
    SandBox: 'SandBox',
    Binary: 'Binary',
    PlSql: 'PlSql',
    TSql: 'TSql',
    Aspx: 'Aspx',
    C: 'C',
    CPlusPlus: 'CPlusPlus',
    ObjectiveC: 'ObjectiveC',
    Swift: 'Swift',
    MySql: 'MySql',
    Python: 'Python',
    CSharpWinOnly: 'CSharpWinOnly',
    Go: 'Go',
    Kotlin: 'Kotlin',
    TypeScript: 'TypeScript',
    Ruby: 'Ruby',
    CSharpCrossPlatform: 'CSharpCrossPlatform',
    Solidity: 'Solidity',
    Scala: 'Scala',
    OneC: 'OneC',
    Dart: 'Dart'
} as const;
export type ProgrammingLanguages = typeof ProgrammingLanguages[keyof typeof ProgrammingLanguages];

/**
 *
 * @export
 * @interface ProjectInfoModel
 */
export interface ProjectInfoModel {
    /**
     *
     * @type {string}
     * @memberof ProjectInfoModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof ProjectInfoModel
     */
    displayName?: string | null;
}
/**
 *
 * @export
 * @interface ProjectMemberModel
 */
export interface ProjectMemberModel {
    /**
     *
     * @type {string}
     * @memberof ProjectMemberModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof ProjectMemberModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof ProjectMemberModel
     */
    email?: string | null;
    /**
     *
     * @type {string}
     * @memberof ProjectMemberModel
     */
    authentication?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof ProjectMemberModel
     */
    isActive?: boolean;
    /**
     *
     * @type {Array<ProjectMemberRoleModel>}
     * @memberof ProjectMemberModel
     */
    roles?: Array<ProjectMemberRoleModel> | null;
}
/**
 *
 * @export
 * @interface ProjectMemberRoleModel
 */
export interface ProjectMemberRoleModel {
    /**
     *
     * @type {string}
     * @memberof ProjectMemberRoleModel
     */
    name?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof ProjectMemberRoleModel
     */
    autoSet?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof ProjectMemberRoleModel
     */
    allProjects?: boolean;
}
/**
 *
 * @export
 * @interface ProjectModel
 */
export interface ProjectModel {
    /**
     *
     * @type {string}
     * @memberof ProjectModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof ProjectModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof ProjectModel
     */
    settingsId?: string;
    /**
     *
     * @type {string}
     * @memberof ProjectModel
     */
    creationDate?: string;
    /**
     *
     * @type {ProjectType}
     * @memberof ProjectModel
     */
    projectType?: ProjectType;
    /**
     *
     * @type {string}
     * @memberof ProjectModel
     */
    projectSettingsId?: string;
    /**
     *
     * @type {ProjectTargetBasedType}
     * @memberof ProjectModel
     */
    projectTargetBasedType?: ProjectTargetBasedType;
    /**
     *
     * @type {string}
     * @memberof ProjectModel
     */
    virtualBranchId?: string | null;
}
/**
 *
 * @export
 * @interface ProjectPermissionsModel
 */
export interface ProjectPermissionsModel {
    /**
     *
     * @type {string}
     * @memberof ProjectPermissionsModel
     */
    projectId?: string;
    /**
     *
     * @type {Array<PermissionType>}
     * @memberof ProjectPermissionsModel
     */
    permissions?: Array<PermissionType> | null;
}
/**
 *
 * @export
 * @interface ProjectSettingsModel
 */
export interface ProjectSettingsModel {
    /**
     *
     * @type {boolean}
     * @memberof ProjectSettingsModel
     */
    automatedAiTriageEnabled?: boolean;
    /**
     *
     * @type {IssueLevel}
     * @memberof ProjectSettingsModel
     */
    automatedAiTriageMinSeverity?: IssueLevel;
    /**
     *
     * @type {SourceType}
     * @memberof ProjectSettingsModel
     */
    sourceType?: SourceType;
    /**
     *
     * @type {DefaultProjectSettingsModelLangPercentDistribution}
     * @memberof ProjectSettingsModel
     */
    langPercentDistribution?: DefaultProjectSettingsModelLangPercentDistribution | null;
    /**
     *
     * @type {string}
     * @memberof ProjectSettingsModel
     */
    projectName?: string | null;
    /**
     *
     * @type {Array<LegacyProgrammingLanguageGroup>}
     * @memberof ProjectSettingsModel
     */
    languages?: Array<LegacyProgrammingLanguageGroup> | null;
    /**
     *
     * @type {WhiteBoxSettingsModel}
     * @memberof ProjectSettingsModel
     */
    whiteBoxSettings?: WhiteBoxSettingsModel;
    /**
     *
     * @type {DotNetSettingsModel}
     * @memberof ProjectSettingsModel
     */
    dotNetSettings?: DotNetSettingsModel;
    /**
     *
     * @type {GoSettingsModel}
     * @memberof ProjectSettingsModel
     */
    goSettings?: GoSettingsModel;
    /**
     *
     * @type {JavaScriptSettingsModel}
     * @memberof ProjectSettingsModel
     */
    javaScriptSettings?: JavaScriptSettingsModel;
    /**
     *
     * @type {JavaSettingsModel}
     * @memberof ProjectSettingsModel
     */
    javaSettings?: JavaSettingsModel;
    /**
     *
     * @type {PhpSettingsModel}
     * @memberof ProjectSettingsModel
     */
    phpSettings?: PhpSettingsModel;
    /**
     *
     * @type {PmTaintBaseSettingsModel}
     * @memberof ProjectSettingsModel
     */
    pmTaintSettings?: PmTaintBaseSettingsModel;
    /**
     *
     * @type {PythonSettingsModel}
     * @memberof ProjectSettingsModel
     */
    pythonSettings?: PythonSettingsModel;
    /**
     *
     * @type {RubySettingsModel}
     * @memberof ProjectSettingsModel
     */
    rubySettings?: RubySettingsModel;
    /**
     *
     * @type {ScaSettingsModel}
     * @memberof ProjectSettingsModel
     */
    scaSettings?: ScaSettingsModel;
    /**
     *
     * @type {MailingProjectSettingsModel}
     * @memberof ProjectSettingsModel
     */
    reportAfterScan?: MailingProjectSettingsModel;
    /**
     *
     * @type {boolean}
     * @memberof ProjectSettingsModel
     */
    skipGitIgnoreFiles?: boolean;
    /**
     *
     * @type {VcsConnectionSettingsModel}
     * @memberof ProjectSettingsModel
     */
    vcsConnectionSettings?: VcsConnectionSettingsModel;
    /**
     *
     * @type {Priority}
     * @memberof ProjectSettingsModel
     */
    priority?: Priority;
}
/**
 *
 * @export
 * @interface ProjectSettingsUpdateModel
 */
export interface ProjectSettingsUpdateModel {
    /**
     *
     * @type {boolean}
     * @memberof ProjectSettingsUpdateModel
     */
    automatedAiTriageEnabled?: boolean;
    /**
     *
     * @type {IssueLevel}
     * @memberof ProjectSettingsUpdateModel
     */
    automatedAiTriageMinSeverity?: IssueLevel;
    /**
     *
     * @type {string}
     * @memberof ProjectSettingsUpdateModel
     */
    projectName?: string | null;
    /**
     *
     * @type {Array<LegacyProgrammingLanguageGroup>}
     * @memberof ProjectSettingsUpdateModel
     */
    languages?: Array<LegacyProgrammingLanguageGroup> | null;
    /**
     *
     * @type {WhiteBoxSettingsModel}
     * @memberof ProjectSettingsUpdateModel
     */
    whiteBoxSettings?: WhiteBoxSettingsModel;
    /**
     *
     * @type {DotNetSettingsModel}
     * @memberof ProjectSettingsUpdateModel
     */
    dotNetSettings?: DotNetSettingsModel;
    /**
     *
     * @type {GoSettingsModel}
     * @memberof ProjectSettingsUpdateModel
     */
    goSettings?: GoSettingsModel;
    /**
     *
     * @type {JavaScriptSettingsModel}
     * @memberof ProjectSettingsUpdateModel
     */
    javaScriptSettings?: JavaScriptSettingsModel;
    /**
     *
     * @type {JavaSettingsModel}
     * @memberof ProjectSettingsUpdateModel
     */
    javaSettings?: JavaSettingsModel;
    /**
     *
     * @type {PhpSettingsModel}
     * @memberof ProjectSettingsUpdateModel
     */
    phpSettings?: PhpSettingsModel;
    /**
     *
     * @type {PmTaintBaseSettingsModel}
     * @memberof ProjectSettingsUpdateModel
     */
    pmTaintSettings?: PmTaintBaseSettingsModel;
    /**
     *
     * @type {PythonSettingsModel}
     * @memberof ProjectSettingsUpdateModel
     */
    pythonSettings?: PythonSettingsModel;
    /**
     *
     * @type {RubySettingsModel}
     * @memberof ProjectSettingsUpdateModel
     */
    rubySettings?: RubySettingsModel;
    /**
     *
     * @type {ScaSettingsModel}
     * @memberof ProjectSettingsUpdateModel
     */
    scaSettings?: ScaSettingsModel;
    /**
     *
     * @type {MailingProjectSettingsModel}
     * @memberof ProjectSettingsUpdateModel
     */
    reportAfterScan?: MailingProjectSettingsModel;
    /**
     *
     * @type {boolean}
     * @memberof ProjectSettingsUpdateModel
     */
    skipGitIgnoreFiles?: boolean;
    /**
     *
     * @type {VcsConnectionSettingsModel}
     * @memberof ProjectSettingsUpdateModel
     */
    vcsConnectionSettings?: VcsConnectionSettingsModel;
    /**
     *
     * @type {Priority}
     * @memberof ProjectSettingsUpdateModel
     */
    priority?: Priority;
}

/**
 *
 * @export
 */
export const ProjectSortColumnId = {
    Unknown: 'Unknown',
    Name: 'Name',
    Branch: 'Branch',
    LastScanDate: 'LastScanDate',
    LastScanPolicyState: 'LastScanPolicyState',
    LastScanLevel: 'LastScanLevel',
    LastScanTotal: 'LastScanTotal',
    LastScanFilesOrUrlsScanned: 'LastScanFilesOrUrlsScanned',
    Pinned: 'Pinned',
    ProjectTargetBasedType: 'ProjectTargetBasedType'
} as const;
export type ProjectSortColumnId = typeof ProjectSortColumnId[keyof typeof ProjectSortColumnId];

/**
 *
 * @export
 * @interface ProjectSortModel
 */
export interface ProjectSortModel {
    /**
     *
     * @type {SortType}
     * @memberof ProjectSortModel
     */
    sortType?: SortType;
    /**
     *
     * @type {ProjectSortColumnId}
     * @memberof ProjectSortModel
     */
    projectSortColumnId?: ProjectSortColumnId;
}
/**
 *
 * @export
 * @interface ProjectSortingOptionsModel
 */
export interface ProjectSortingOptionsModel {
    /**
     *
     * @type {string}
     * @memberof ProjectSortingOptionsModel
     */
    projectName?: string | null;
    /**
     *
     * @type {ProgrammingLanguages}
     * @memberof ProjectSortingOptionsModel
     */
    languages?: ProgrammingLanguages;
}
/**
 *
 * @export
 * @interface ProjectStatsModel
 */
export interface ProjectStatsModel {
    /**
     *
     * @type {number}
     * @memberof ProjectStatsModel
     */
    neverScanned?: number;
    /**
     *
     * @type {number}
     * @memberof ProjectStatsModel
     */
    scanningOrEnqueued?: number;
    /**
     *
     * @type {number}
     * @memberof ProjectStatsModel
     */
    successful?: number;
    /**
     *
     * @type {number}
     * @memberof ProjectStatsModel
     */
    failed?: number;
    /**
     *
     * @type {number}
     * @memberof ProjectStatsModel
     */
    policyFailed?: number;
}

/**
 *
 * @export
 */
export const ProjectTargetBasedType = {
    SourceBased: 'SourceBased',
    StandBased: 'StandBased',
    SbomBased: 'SbomBased'
} as const;
export type ProjectTargetBasedType = typeof ProjectTargetBasedType[keyof typeof ProjectTargetBasedType];


/**
 *
 * @export
 */
export const ProjectType = {
    Permanent: 'Permanent',
    Disposable: 'Disposable',
    Draft: 'Draft'
} as const;
export type ProjectType = typeof ProjectType[keyof typeof ProjectType];

/**
 *
 * @export
 * @interface ProjectWithBaseSourceInfoModel
 */
export interface ProjectWithBaseSourceInfoModel {
    /**
     *
     * @type {SourceType}
     * @memberof ProjectWithBaseSourceInfoModel
     */
    sourceType?: SourceType;
    /**
     *
     * @type {string}
     * @memberof ProjectWithBaseSourceInfoModel
     */
    repositoryUrl?: string | null;
    /**
     *
     * @type {ProgrammingLanguages}
     * @memberof ProjectWithBaseSourceInfoModel
     */
    languages?: ProgrammingLanguages;
    /**
     *
     * @type {string}
     * @memberof ProjectWithBaseSourceInfoModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof ProjectWithBaseSourceInfoModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof ProjectWithBaseSourceInfoModel
     */
    settingsId?: string;
    /**
     *
     * @type {string}
     * @memberof ProjectWithBaseSourceInfoModel
     */
    creationDate?: string;
    /**
     *
     * @type {ProjectType}
     * @memberof ProjectWithBaseSourceInfoModel
     */
    projectType?: ProjectType;
    /**
     *
     * @type {string}
     * @memberof ProjectWithBaseSourceInfoModel
     */
    projectSettingsId?: string;
    /**
     *
     * @type {ProjectTargetBasedType}
     * @memberof ProjectWithBaseSourceInfoModel
     */
    projectTargetBasedType?: ProjectTargetBasedType;
    /**
     *
     * @type {string}
     * @memberof ProjectWithBaseSourceInfoModel
     */
    virtualBranchId?: string | null;
}
/**
 *
 * @export
 * @interface ProjectWithBranchCreationResultModel
 */
export interface ProjectWithBranchCreationResultModel {
    /**
     *
     * @type {string}
     * @memberof ProjectWithBranchCreationResultModel
     */
    projectId?: string;
    /**
     *
     * @type {string}
     * @memberof ProjectWithBranchCreationResultModel
     */
    branchId?: string;
}
/**
 *
 * @export
 * @interface ProjectWithScanInfoModel
 */
export interface ProjectWithScanInfoModel {
    /**
     *
     * @type {Array<LegacyProgrammingLanguageGroup>}
     * @memberof ProjectWithScanInfoModel
     */
    languages?: Array<LegacyProgrammingLanguageGroup> | null;
    /**
     *
     * @type {DefaultProjectSettingsModelLangPercentDistribution}
     * @memberof ProjectWithScanInfoModel
     */
    langPercentDistribution?: DefaultProjectSettingsModelLangPercentDistribution | null;
    /**
     *
     * @type {boolean}
     * @memberof ProjectWithScanInfoModel
     */
    isPinned?: boolean;
    /**
     *
     * @type {ScanStartErrorType}
     * @memberof ProjectWithScanInfoModel
     */
    scanStartErrors?: ScanStartErrorType;
    /**
     *
     * @type {ScanAppType}
     * @memberof ProjectWithScanInfoModel
     */
    scanAppType?: ScanAppType;
    /**
     *
     * @type {ExtendedScanStatisticModel}
     * @memberof ProjectWithScanInfoModel
     */
    lastScan?: ExtendedScanStatisticModel;
    /**
     *
     * @type {ExtendedScanStatisticModel}
     * @memberof ProjectWithScanInfoModel
     */
    prevScan?: ExtendedScanStatisticModel;
    /**
     *
     * @type {Array<PermissionType>}
     * @memberof ProjectWithScanInfoModel
     */
    permissions?: Array<PermissionType> | null;
    /**
     *
     * @type {BranchLightModel}
     * @memberof ProjectWithScanInfoModel
     */
    branch?: BranchLightModel;
    /**
     *
     * @type {string}
     * @memberof ProjectWithScanInfoModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof ProjectWithScanInfoModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof ProjectWithScanInfoModel
     */
    settingsId?: string;
    /**
     *
     * @type {string}
     * @memberof ProjectWithScanInfoModel
     */
    creationDate?: string;
    /**
     *
     * @type {ProjectType}
     * @memberof ProjectWithScanInfoModel
     */
    projectType?: ProjectType;
    /**
     *
     * @type {string}
     * @memberof ProjectWithScanInfoModel
     */
    projectSettingsId?: string;
    /**
     *
     * @type {ProjectTargetBasedType}
     * @memberof ProjectWithScanInfoModel
     */
    projectTargetBasedType?: ProjectTargetBasedType;
    /**
     *
     * @type {string}
     * @memberof ProjectWithScanInfoModel
     */
    virtualBranchId?: string | null;
}
/**
 *
 * @export
 * @interface ProxySettingsModel
 */
export interface ProxySettingsModel {
    /**
     *
     * @type {string}
     * @memberof ProxySettingsModel
     */
    url?: string | null;
    /**
     *
     * @type {string}
     * @memberof ProxySettingsModel
     */
    user?: string | null;
    /**
     *
     * @type {string}
     * @memberof ProxySettingsModel
     */
    password?: string | null;
    /**
     *
     * @type {string}
     * @memberof ProxySettingsModel
     */
    credentialsId?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof ProxySettingsModel
     */
    enabled?: boolean;
}

/**
 *
 * @export
 */
export const ProxyType = {
    Http: 'Http',
    HttpNoConnect: 'HttpNoConnect',
    Socks4: 'Socks4',
    Socks5: 'Socks5'
} as const;
export type ProxyType = typeof ProxyType[keyof typeof ProxyType];

/**
 *
 * @export
 * @interface PtOsvInputModel
 */
export interface PtOsvInputModel {
    /**
     *
     * @type {Array<string>}
     * @memberof PtOsvInputModel
     */
    aliases?: Array<string> | null;
    /**
     *
     * @type {Array<number>}
     * @memberof PtOsvInputModel
     */
    cwes?: Array<number> | null;
    /**
     *
     * @type {Array<ScaCvssModel>}
     * @memberof PtOsvInputModel
     */
    cvss?: Array<ScaCvssModel> | null;
    /**
     *
     * @type {string}
     * @memberof PtOsvInputModel
     */
    summary?: string | null;
    /**
     *
     * @type {string}
     * @memberof PtOsvInputModel
     */
    details?: string | null;
}
/**
 *
 * @export
 * @interface PtOsvModel
 */
export interface PtOsvModel {
    /**
     *
     * @type {string}
     * @memberof PtOsvModel
     */
    id?: string | null;
    /**
     *
     * @type {Array<string>}
     * @memberof PtOsvModel
     */
    sources?: Array<string> | null;
    /**
     *
     * @type {Array<number>}
     * @memberof PtOsvModel
     */
    cwes?: Array<number> | null;
    /**
     *
     * @type {Array<CvssModel>}
     * @memberof PtOsvModel
     */
    cvssItems?: Array<CvssModel> | null;
    /**
     *
     * @type {string}
     * @memberof PtOsvModel
     */
    descriptionMarkdown?: string | null;
    /**
     *
     * @type {string}
     * @memberof PtOsvModel
     */
    summary?: string | null;
}
/**
 *
 * @export
 * @interface PygrepVulnerabilityModel
 */
export interface PygrepVulnerabilityModel {
    /**
     *
     * @type {string}
     * @memberof PygrepVulnerabilityModel
     */
    targetRule?: string | null;
    /**
     *
     * @type {Array<MetaVarModel>}
     * @memberof PygrepVulnerabilityModel
     */
    metaVars?: Array<MetaVarModel> | null;
    /**
     *
     * @type {string}
     * @memberof PygrepVulnerabilityModel
     */
    recommendation?: string | null;
    /**
     *
     * @type {string}
     * @memberof PygrepVulnerabilityModel
     */
    description?: string | null;
}
/**
 *
 * @export
 * @interface PythonSettingsModel
 */
export interface PythonSettingsModel {
    /**
     *
     * @type {string}
     * @memberof PythonSettingsModel
     */
    launchParameters?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof PythonSettingsModel
     */
    useAvailablePublicAndProtectedMethods?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof PythonSettingsModel
     */
    downloadDependencies?: boolean;
    /**
     *
     * @type {string}
     * @memberof PythonSettingsModel
     */
    dependenciesPath?: string | null;
    /**
     *
     * @type {string}
     * @memberof PythonSettingsModel
     */
    dslRulesRelativePath?: string | null;
}
/**
 *
 * @export
 * @interface QueueItem
 */
export interface QueueItem {
    /**
     *
     * @type {string}
     * @memberof QueueItem
     */
    id: string;
    /**
     *
     * @type {string}
     * @memberof QueueItem
     */
    queueDateTime: string;
    /**
     *
     * @type {Initiator}
     * @memberof QueueItem
     */
    initiator?: Initiator | null;
    /**
     *
     * @type {ScanObject}
     * @memberof QueueItem
     */
    scanObject: ScanObject;
    /**
     *
     * @type {string}
     * @memberof QueueItem
     */
    scanResultId: string;
    /**
     *
     * @type {number}
     * @memberof QueueItem
     */
    position: number;
    /**
     *
     * @type {boolean}
     * @memberof QueueItem
     */
    manuallyMoved: boolean;
    /**
     *
     * @type {Priority}
     * @memberof QueueItem
     */
    priority: Priority;
    /**
     *
     * @type {string}
     * @memberof QueueItem
     */
    scanLabel?: string | null;
}
/**
 *
 * @export
 * @interface RefreshTokenResultModel
 */
export interface RefreshTokenResultModel {
    /**
     *
     * @type {string}
     * @memberof RefreshTokenResultModel
     */
    accessToken?: string | null;
    /**
     *
     * @type {string}
     * @memberof RefreshTokenResultModel
     */
    expiredAt?: string;
}
/**
 *
 * @export
 * @interface ReportGenerateModel
 */
export interface ReportGenerateModel {
    /**
     *
     * @type {UserReportParametersModel}
     * @memberof ReportGenerateModel
     */
    parameters?: UserReportParametersModel;
    /**
     *
     * @type {string}
     * @memberof ReportGenerateModel
     */
    sessionId?: string;
    /**
     *
     * @type {string}
     * @memberof ReportGenerateModel
     */
    scanResultId?: string | null;
    /**
     *
     * @type {string}
     * @memberof ReportGenerateModel
     */
    projectId?: string;
    /**
     *
     * @type {string}
     * @memberof ReportGenerateModel
     */
    localeId?: string | null;
    /**
     *
     * @type {UserReportFiltersModel}
     * @memberof ReportGenerateModel
     */
    filters?: UserReportFiltersModel;
}
/**
 *
 * @export
 * @interface ReportTemplateModel
 */
export interface ReportTemplateModel {
    /**
     *
     * @type {string}
     * @memberof ReportTemplateModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof ReportTemplateModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof ReportTemplateModel
     */
    data?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof ReportTemplateModel
     */
    isReadOnly?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof ReportTemplateModel
     */
    isFavorite?: boolean;
    /**
     *
     * @type {ReportType}
     * @memberof ReportTemplateModel
     */
    type?: ReportType;
    /**
     *
     * @type {string}
     * @memberof ReportTemplateModel
     */
    outputFileName?: string | null;
    /**
     *
     * @type {UserModel}
     * @memberof ReportTemplateModel
     */
    creator?: UserModel;
    /**
     *
     * @type {string}
     * @memberof ReportTemplateModel
     */
    creationDate?: string;
}
/**
 *
 * @export
 * @interface ReportTemplateUpsertModel
 */
export interface ReportTemplateUpsertModel {
    /**
     *
     * @type {string}
     * @memberof ReportTemplateUpsertModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof ReportTemplateUpsertModel
     */
    data?: string | null;
    /**
     *
     * @type {string}
     * @memberof ReportTemplateUpsertModel
     */
    outputFileName?: string | null;
}

/**
 *
 * @export
 */
export const ReportType = {
    Custom: 'Custom',
    PlainReport: 'PlainReport',
    AutoCheck: 'AutoCheck',
    Nist: 'Nist',
    Oud4: 'Oud4',
    Owasp: 'Owasp',
    Owaspm: 'Owaspm',
    Pcidss: 'Pcidss',
    Sans: 'Sans',
    Json: 'Json',
    Md: 'Md',
    Sarif: 'Sarif',
    Gitlab: 'Gitlab',
    JsonV2: 'JsonV2'
} as const;
export type ReportType = typeof ReportType[keyof typeof ReportType];


/**
 *
 * @export
 */
export const RepositoryType = {
    None: 'None',
    Git: 'Git'
} as const;
export type RepositoryType = typeof RepositoryType[keyof typeof RepositoryType];

/**
 *
 * @export
 * @interface RequestDataInputModel
 */
export interface RequestDataInputModel {
    /**
     *
     * @type {string}
     * @memberof RequestDataInputModel
     */
    text?: string | null;
    /**
     *
     * @type {string}
     * @memberof RequestDataInputModel
     */
    method?: string | null;
    /**
     *
     * @type {string}
     * @memberof RequestDataInputModel
     */
    url?: string | null;
}
/**
 *
 * @export
 * @interface RoleMappingModel
 */
export interface RoleMappingModel {
    /**
     *
     * @type {string}
     * @memberof RoleMappingModel
     */
    field?: string | null;
    /**
     *
     * @type {Array<string>}
     * @memberof RoleMappingModel
     */
    values?: Array<string> | null;
    /**
     *
     * @type {MemberRoleModel}
     * @memberof RoleMappingModel
     */
    role?: MemberRoleModel;
}
/**
 *
 * @export
 * @interface RoleModel
 */
export interface RoleModel {
    /**
     *
     * @type {string}
     * @memberof RoleModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof RoleModel
     */
    description?: string | null;
    /**
     *
     * @type {Array<PermissionType>}
     * @memberof RoleModel
     */
    permissions?: Array<PermissionType> | null;
    /**
     *
     * @type {string}
     * @memberof RoleModel
     */
    createdDateTime?: string;
    /**
     *
     * @type {boolean}
     * @memberof RoleModel
     */
    isSystem?: boolean;
}
/**
 *
 * @export
 * @interface RoleProjectModel
 */
export interface RoleProjectModel {
    /**
     *
     * @type {string}
     * @memberof RoleProjectModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof RoleProjectModel
     */
    name?: string | null;
}
/**
 *
 * @export
 * @interface RoleUpsertModel
 */
export interface RoleUpsertModel {
    /**
     *
     * @type {string}
     * @memberof RoleUpsertModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof RoleUpsertModel
     */
    description?: string | null;
    /**
     *
     * @type {Array<PermissionType>}
     * @memberof RoleUpsertModel
     */
    permissions?: Array<PermissionType> | null;
}
/**
 *
 * @export
 * @interface RubySettingsModel
 */
export interface RubySettingsModel {
    /**
     *
     * @type {string}
     * @memberof RubySettingsModel
     */
    launchParameters?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof RubySettingsModel
     */
    useAvailablePublicAndProtectedMethods?: boolean;
    /**
     *
     * @type {string}
     * @memberof RubySettingsModel
     */
    dslRulesRelativePath?: string | null;
}
/**
 *
 * @export
 * @interface SSOSettingsModel
 */
export interface SSOSettingsModel {
    /**
     *
     * @type {string}
     * @memberof SSOSettingsModel
     */
    sessionLifetime?: string;
    /**
     *
     * @type {string}
     * @memberof SSOSettingsModel
     */
    userInactivateInterval?: string;
    /**
     *
     * @type {boolean}
     * @memberof SSOSettingsModel
     */
    blockUsersAfterInactiveIntervalExpires?: boolean;
}

/**
 *
 * @export
 */
export const Saml2NameIdPolicy = {
    Unspecified: 'Unspecified',
    Persistent: 'Persistent',
    Transient: 'Transient',
    Email: 'Email'
} as const;
export type Saml2NameIdPolicy = typeof Saml2NameIdPolicy[keyof typeof Saml2NameIdPolicy];

/**
 *
 * @export
 * @interface Saml2SettingsModel
 */
export interface Saml2SettingsModel {
    /**
     *
     * @type {string}
     * @memberof Saml2SettingsModel
     */
    issuer?: string | null;
    /**
     *
     * @type {string}
     * @memberof Saml2SettingsModel
     */
    allowedIssuer?: string | null;
    /**
     *
     * @type {string}
     * @memberof Saml2SettingsModel
     */
    singleSignOnDestination?: string | null;
    /**
     *
     * @type {Saml2SignatureAlgorithm}
     * @memberof Saml2SettingsModel
     */
    signatureAlgorithm?: Saml2SignatureAlgorithm;
    /**
     *
     * @type {CertModel}
     * @memberof Saml2SettingsModel
     */
    signingCertificate?: CertModel;
    /**
     *
     * @type {CertModel}
     * @memberof Saml2SettingsModel
     */
    signingPrivateKey?: CertModel;
    /**
     *
     * @type {boolean}
     * @memberof Saml2SettingsModel
     */
    validateResponse?: boolean;
    /**
     *
     * @type {Saml2NameIdPolicy}
     * @memberof Saml2SettingsModel
     */
    nameIdPolicy?: Saml2NameIdPolicy;
    /**
     *
     * @type {boolean}
     * @memberof Saml2SettingsModel
     */
    signAuthnRequest?: boolean;
}

/**
 *
 * @export
 */
export const Saml2SignatureAlgorithm = {
    RsaSha1: 'RsaSha1',
    RsaSha256: 'RsaSha256',
    RsaSha512: 'RsaSha512'
} as const;
export type Saml2SignatureAlgorithm = typeof Saml2SignatureAlgorithm[keyof typeof Saml2SignatureAlgorithm];

/**
 *
 * @export
 * @interface ScaCvssModel
 */
export interface ScaCvssModel {
    /**
     *
     * @type {string}
     * @memberof ScaCvssModel
     */
    version?: string | null;
    /**
     *
     * @type {string}
     * @memberof ScaCvssModel
     */
    vector?: string | null;
    /**
     *
     * @type {number}
     * @memberof ScaCvssModel
     */
    score?: number;
    /**
     *
     * @type {IssueLevel}
     * @memberof ScaCvssModel
     */
    severity?: IssueLevel;
}
/**
 *
 * @export
 * @interface ScaSettingsModel
 */
export interface ScaSettingsModel {
    /**
     *
     * @type {string}
     * @memberof ScaSettingsModel
     */
    launchParameters?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof ScaSettingsModel
     */
    buildDependenciesGraph?: boolean;
}
/**
 *
 * @export
 * @interface ScanAgentConnectionSettingsModel
 */
export interface ScanAgentConnectionSettingsModel {
    /**
     *
     * @type {string}
     * @memberof ScanAgentConnectionSettingsModel
     */
    connectionUri?: string | null;
}
/**
 *
 * @export
 * @interface ScanAgentInfoModel
 */
export interface ScanAgentInfoModel {
    /**
     *
     * @type {string}
     * @memberof ScanAgentInfoModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof ScanAgentInfoModel
     */
    version?: string | null;
    /**
     *
     * @type {string}
     * @memberof ScanAgentInfoModel
     */
    operatingSystem?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof ScanAgentInfoModel
     */
    isDeleted?: boolean;
}

/**
 *
 * @export
 */
export const ScanAppType = {
    None: 'None',
    Binary: 'Binary',
    Configuration: 'Configuration',
    Fingerprint: 'Fingerprint',
    Java: 'Java',
    Php: 'PHP',
    PmTaint: 'PmTaint',
    BlackBox: 'BlackBox',
    JavaScript: 'JavaScript',
    DependencyCheck: 'DependencyCheck',
    Python: 'Python',
    Ruby: 'Ruby',
    JsaNet: 'JsaNet',
    Go: 'Go',
    Pygrep: 'Pygrep',
    Sca: 'Sca',
    Secret: 'Secret',
    MaliciousCodeDetection: 'MaliciousCodeDetection'
} as const;
export type ScanAppType = typeof ScanAppType[keyof typeof ScanAppType];

/**
 *
 * @export
 * @interface ScanArtifactsModel
 */
export interface ScanArtifactsModel {
    /**
     *
     * @type {ScanResultModel}
     * @memberof ScanArtifactsModel
     */
    scanResult?: ScanResultModel;
    /**
     *
     * @type {ScanSettingsModel}
     * @memberof ScanArtifactsModel
     */
    scanSettings?: ScanSettingsModel;
    /**
     *
     * @type {Array<IssueStatisticModel>}
     * @memberof ScanArtifactsModel
     */
    issueStatistics?: Array<IssueStatisticModel> | null;
    /**
     *
     * @type {VfsModel}
     * @memberof ScanArtifactsModel
     */
    vfs?: VfsModel;
    /**
     *
     * @type {Array<VulnerabilityFullModel>}
     * @memberof ScanArtifactsModel
     */
    vulnerabilities?: Array<VulnerabilityFullModel> | null;
}
/**
 *
 * @export
 * @interface ScanEnvironmentModel
 */
export interface ScanEnvironmentModel {
    /**
     *
     * @type {ComponentVersionModel}
     * @memberof ScanEnvironmentModel
     */
    infrastructureVersion?: ComponentVersionModel;
    /**
     *
     * @type {Array<ComponentVersionModel>}
     * @memberof ScanEnvironmentModel
     */
    componentVersions?: Array<ComponentVersionModel> | null;
    /**
     *
     * @type {ComponentVersionModel}
     * @memberof ScanEnvironmentModel
     */
    installatorVersion?: ComponentVersionModel;
    /**
     *
     * @type {ComponentVersionModel}
     * @memberof ScanEnvironmentModel
     */
    clientVersion?: ComponentVersionModel;
    /**
     *
     * @type {ScanExtraOptionsModel}
     * @memberof ScanEnvironmentModel
     */
    extraOptions?: ScanExtraOptionsModel;
}
/**
 *
 * @export
 * @interface ScanErrorModel
 */
export interface ScanErrorModel {
    /**
     *
     * @type {object}
     * @memberof ScanErrorModel
     */
    error?: object;
    /**
     *
     * @type {string}
     * @memberof ScanErrorModel
     */
    errorType?: string | null;
    /**
     *
     * @type {string}
     * @memberof ScanErrorModel
     */
    id?: string;
    /**
     *
     * @type {boolean}
     * @memberof ScanErrorModel
     */
    isCritical?: boolean;
    /**
     *
     * @type {ErrorLevel}
     * @memberof ScanErrorModel
     */
    level?: ErrorLevel;
    /**
     *
     * @type {string}
     * @memberof ScanErrorModel
     */
    message?: string | null;
    /**
     *
     * @type {string}
     * @memberof ScanErrorModel
     */
    scanResultId?: string;
}
/**
 *
 * @export
 * @interface ScanExtraOptionsModel
 */
export interface ScanExtraOptionsModel {
    /**
     *
     * @type {boolean}
     * @memberof ScanExtraOptionsModel
     */
    fullRescanOnNewFilesAdded?: boolean;
}
/**
 *
 * @export
 * @interface ScanInfo
 */
export interface ScanInfo {
    /**
     *
     * @type {ScanObject}
     * @memberof ScanInfo
     */
    object: ScanObject;
    /**
     *
     * @type {ScanProgress}
     * @memberof ScanInfo
     */
    progress: ScanProgress;
}

/**
 *
 * @export
 */
export const ScanMode = {
    FromEntryPoint: 'FromEntryPoint',
    FromPublicProtected: 'FromPublicProtected',
    Taint: 'Taint',
    FromRootFunction: 'FromRootFunction',
    Unknown: 'Unknown'
} as const;
export type ScanMode = typeof ScanMode[keyof typeof ScanMode];


/**
 *
 * @export
 */
export const ScanModuleType = {
    VulnerableSourceCode: 'VulnerableSourceCode',
    DataFlowAnalysis: 'DataFlowAnalysis',
    PatternMatching: 'PatternMatching',
    Components: 'Components',
    Configuration: 'Configuration',
    BlackBox: 'BlackBox',
    StaticCodeAnalysis: 'StaticCodeAnalysis',
    SoftwareCompositionAnalysis: 'SoftwareCompositionAnalysis',
    SecretDetection: 'SecretDetection',
    MaliciousCodeDetection: 'MaliciousCodeDetection'
} as const;
export type ScanModuleType = typeof ScanModuleType[keyof typeof ScanModuleType];

/**
 *
 * @export
 * @interface ScanObject
 */
export interface ScanObject {
    /**
     *
     * @type {string}
     * @memberof ScanObject
     */
    projectId: string;
    /**
     *
     * @type {string}
     * @memberof ScanObject
     */
    projectName: string;
    /**
     *
     * @type {string}
     * @memberof ScanObject
     */
    branchId: string;
    /**
     *
     * @type {string}
     * @memberof ScanObject
     */
    branchName: string;
}
/**
 *
 * @export
 * @interface ScanObjectModel
 */
export interface ScanObjectModel {
    /**
     *
     * @type {string}
     * @memberof ScanObjectModel
     */
    sbomFileName?: string | null;
    /**
     *
     * @type {SourceType}
     * @memberof ScanObjectModel
     */
    sourceType?: SourceType;
    /**
     *
     * @type {string}
     * @memberof ScanObjectModel
     */
    branchName?: string | null;
    /**
     *
     * @type {string}
     * @memberof ScanObjectModel
     */
    sourceName?: string | null;
    /**
     *
     * @type {LocalSourceType}
     * @memberof ScanObjectModel
     */
    localSourceType?: LocalSourceType;
    /**
     *
     * @type {string}
     * @memberof ScanObjectModel
     */
    repositoryUrl?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof ScanObjectModel
     */
    hasAiproj?: boolean;
}
/**
 *
 * @export
 * @interface ScanProgress
 */
export interface ScanProgress {
    /**
     *
     * @type {Stage}
     * @memberof ScanProgress
     */
    stage: Stage;
    /**
     *
     * @type {string}
     * @memberof ScanProgress
     */
    substage: string;
    /**
     *
     * @type {number}
     * @memberof ScanProgress
     */
    value: number;
}
/**
 *
 * @export
 * @interface ScanProgressAndStatisticCreationModel
 */
export interface ScanProgressAndStatisticCreationModel {
    /**
     *
     * @type {ScanProgressModel}
     * @memberof ScanProgressAndStatisticCreationModel
     */
    progress?: ScanProgressModel;
    /**
     *
     * @type {ShortScanStatisticModel}
     * @memberof ScanProgressAndStatisticCreationModel
     */
    statistic?: ShortScanStatisticModel;
}
/**
 *
 * @export
 * @interface ScanProgressModel
 */
export interface ScanProgressModel {
    /**
     *
     * @type {Stage}
     * @memberof ScanProgressModel
     */
    stage?: Stage;
    /**
     *
     * @type {string}
     * @memberof ScanProgressModel
     */
    subStage?: string | null;
    /**
     *
     * @type {number}
     * @memberof ScanProgressModel
     */
    value?: number;
}
/**
 *
 * @export
 * @interface ScanResultBaseInfoModel
 */
export interface ScanResultBaseInfoModel {
    /**
     *
     * @type {string}
     * @memberof ScanResultBaseInfoModel
     */
    scanResultId?: string;
    /**
     *
     * @type {string}
     * @memberof ScanResultBaseInfoModel
     */
    projectId?: string;
    /**
     *
     * @type {string}
     * @memberof ScanResultBaseInfoModel
     */
    projectName?: string | null;
    /**
     *
     * @type {string}
     * @memberof ScanResultBaseInfoModel
     */
    branchId?: string;
    /**
     *
     * @type {string}
     * @memberof ScanResultBaseInfoModel
     */
    branchName?: string | null;
    /**
     *
     * @type {ScanProgressModel}
     * @memberof ScanResultBaseInfoModel
     */
    progress?: ScanProgressModel;
    /**
     *
     * @type {InitiatorInfoModel}
     * @memberof ScanResultBaseInfoModel
     */
    initiator?: InitiatorInfoModel;
}
/**
 *
 * @export
 * @interface ScanResultCreationModel
 */
export interface ScanResultCreationModel {
    /**
     *
     * @type {ScanEnvironmentModel}
     * @memberof ScanResultCreationModel
     */
    scanEnvironment?: ScanEnvironmentModel;
    /**
     *
     * @type {ScanType}
     * @memberof ScanResultCreationModel
     */
    scanType?: ScanType;
    /**
     *
     * @type {string}
     * @memberof ScanResultCreationModel
     */
    scanLabel?: string | null;
    /**
     *
     * @type {string}
     * @memberof ScanResultCreationModel
     */
    queueDateTime?: string;
    /**
     *
     * @type {InitiatorInfoModel}
     * @memberof ScanResultCreationModel
     */
    initiator?: InitiatorInfoModel;
}
/**
 *
 * @export
 * @interface ScanResultModel
 */
export interface ScanResultModel {
    /**
     *
     * @type {string}
     * @memberof ScanResultModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof ScanResultModel
     */
    projectId?: string;
    /**
     *
     * @type {string}
     * @memberof ScanResultModel
     */
    branchId?: string;
    /**
     *
     * @type {string}
     * @memberof ScanResultModel
     */
    settingsId?: string;
    /**
     *
     * @type {string}
     * @memberof ScanResultModel
     */
    scanDate?: string;
    /**
     *
     * @type {ScanProgressModel}
     * @memberof ScanResultModel
     */
    progress?: ScanProgressModel;
    /**
     *
     * @type {ScanStatisticModel}
     * @memberof ScanResultModel
     */
    statistic?: ScanStatisticModel;
    /**
     *
     * @type {ScanStatisticModel}
     * @memberof ScanResultModel
     */
    statisticDelta?: ScanStatisticModel;
    /**
     *
     * @type {ScanEnvironmentModel}
     * @memberof ScanResultModel
     */
    scanEnvironment?: ScanEnvironmentModel;
    /**
     *
     * @type {boolean}
     * @memberof ScanResultModel
     */
    isRunFromQueue?: boolean;
    /**
     *
     * @type {ScanType}
     * @memberof ScanResultModel
     */
    scanType?: ScanType;
    /**
     *
     * @type {boolean}
     * @memberof ScanResultModel
     */
    isParentNode?: boolean;
    /**
     *
     * @type {FullScanReason}
     * @memberof ScanResultModel
     */
    fullScanReason?: FullScanReason;
    /**
     *
     * @type {InitiatorInfoModel}
     * @memberof ScanResultModel
     */
    initiator?: InitiatorInfoModel;
    /**
     *
     * @type {string}
     * @memberof ScanResultModel
     */
    queueDate?: string | null;
    /**
     *
     * @type {ScanAgentInfoModel}
     * @memberof ScanResultModel
     */
    scanAgentInfo?: ScanAgentInfoModel;
    /**
     *
     * @type {boolean}
     * @memberof ScanResultModel
     */
    hasDependencyGraph?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof ScanResultModel
     */
    hasSbom?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof ScanResultModel
     */
    hasErrors?: boolean;
    /**
     *
     * @type {ImportMetadataModel}
     * @memberof ScanResultModel
     */
    importMetadata?: ImportMetadataModel;
    /**
     *
     * @type {string}
     * @memberof ScanResultModel
     */
    previousScanResultId?: string | null;
    /**
     *
     * @type {string}
     * @memberof ScanResultModel
     */
    scanLabel?: string | null;
}

/**
 *
 * @export
 */
export const ScanScope = {
    Folder: 'Folder',
    Domain: 'Domain',
    Path: 'Path'
} as const;
export type ScanScope = typeof ScanScope[keyof typeof ScanScope];

/**
 *
 * @export
 * @interface ScanSettingsModel
 */
export interface ScanSettingsModel {
    /**
     *
     * @type {Array<ScanModuleType>}
     * @memberof ScanSettingsModel
     */
    enabledScanModules?: Array<ScanModuleType> | null;
    /**
     *
     * @type {string}
     * @memberof ScanSettingsModel
     */
    sbomFileName?: string | null;
    /**
     *
     * @type {string}
     * @memberof ScanSettingsModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof ScanSettingsModel
     */
    projectName?: string | null;
    /**
     *
     * @type {string}
     * @memberof ScanSettingsModel
     */
    branchName?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof ScanSettingsModel
     */
    wasOverriddenByAiproj?: boolean;
    /**
     *
     * @type {Array<LegacyProgrammingLanguageGroup>}
     * @memberof ScanSettingsModel
     */
    programmingLanguages?: Array<LegacyProgrammingLanguageGroup> | null;
    /**
     *
     * @type {DefaultProjectSettingsModelLangPercentDistribution}
     * @memberof ScanSettingsModel
     */
    langPercentDistribution?: DefaultProjectSettingsModelLangPercentDistribution | null;
    /**
     *
     * @type {Array<ScanModuleType>}
     * @memberof ScanSettingsModel
     */
    scanModules?: Array<ScanModuleType> | null;
    /**
     *
     * @type {string}
     * @memberof ScanSettingsModel
     */
    jsaScriptingFolder?: string | null;
    /**
     *
     * @type {string}
     * @memberof ScanSettingsModel
     */
    fileFolderExclusions?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof ScanSettingsModel
     */
    useSecurityPolicies?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof ScanSettingsModel
     */
    skipGitIgnoreFiles?: boolean;
    /**
     *
     * @type {BlackBoxSettingsBaseModel}
     * @memberof ScanSettingsModel
     */
    blackBoxSettings?: BlackBoxSettingsBaseModel;
    /**
     *
     * @type {DotNetSettingsModel}
     * @memberof ScanSettingsModel
     */
    dotNetSettings?: DotNetSettingsModel;
    /**
     *
     * @type {GoSettingsModel}
     * @memberof ScanSettingsModel
     */
    goSettings?: GoSettingsModel;
    /**
     *
     * @type {JavaScriptSettingsModel}
     * @memberof ScanSettingsModel
     */
    javaScriptSettings?: JavaScriptSettingsModel;
    /**
     *
     * @type {JavaSettingsModel}
     * @memberof ScanSettingsModel
     */
    javaSettings?: JavaSettingsModel;
    /**
     *
     * @type {PhpSettingsModel}
     * @memberof ScanSettingsModel
     */
    phpSettings?: PhpSettingsModel;
    /**
     *
     * @type {PmTaintSettingsModel}
     * @memberof ScanSettingsModel
     */
    pmTaintSettings?: PmTaintSettingsModel;
    /**
     *
     * @type {PythonSettingsModel}
     * @memberof ScanSettingsModel
     */
    pythonSettings?: PythonSettingsModel;
    /**
     *
     * @type {RubySettingsModel}
     * @memberof ScanSettingsModel
     */
    rubySettings?: RubySettingsModel;
    /**
     *
     * @type {ScaSettingsModel}
     * @memberof ScanSettingsModel
     */
    scaSettings?: ScaSettingsModel;
    /**
     *
     * @type {string}
     * @memberof ScanSettingsModel
     */
    emailRecipients?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof ScanSettingsModel
     */
    sendEmailWithReportsAfterScan?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof ScanSettingsModel
     */
    useIssueTrackerIntegration?: boolean;
    /**
     *
     * @type {SourceType}
     * @memberof ScanSettingsModel
     */
    sourceType?: SourceType;
    /**
     *
     * @type {string}
     * @memberof ScanSettingsModel
     */
    sourceName?: string | null;
    /**
     *
     * @type {LocalSourceType}
     * @memberof ScanSettingsModel
     */
    localSourceType?: LocalSourceType;
    /**
     *
     * @type {string}
     * @memberof ScanSettingsModel
     */
    repositoryUrl?: string | null;
}

/**
 *
 * @export
 */
export const ScanStartErrorType = {
    None: 'None',
    License: 'License',
    Sources: 'Sources',
    Language: 'Language',
    Modules: 'Modules',
    LicenseExpired: 'LicenseExpired',
    LanguageRequired: 'LanguageRequired'
} as const;
export type ScanStartErrorType = typeof ScanStartErrorType[keyof typeof ScanStartErrorType];

/**
 *
 * @export
 * @interface ScanStatisticLightModel
 */
export interface ScanStatisticLightModel {
    /**
     *
     * @type {string}
     * @memberof ScanStatisticLightModel
     */
    id?: string;
    /**
     *
     * @type {ScanProgressModel}
     * @memberof ScanStatisticLightModel
     */
    progress?: ScanProgressModel;
    /**
     *
     * @type {string}
     * @memberof ScanStatisticLightModel
     */
    queueDate?: string | null;
    /**
     *
     * @type {string}
     * @memberof ScanStatisticLightModel
     */
    scanDate?: string | null;
    /**
     *
     * @type {InitiatorInfoModel}
     * @memberof ScanStatisticLightModel
     */
    initiator?: InitiatorInfoModel;
}
/**
 *
 * @export
 * @interface ScanStatisticModel
 */
export interface ScanStatisticModel {
    /**
     *
     * @type {number}
     * @memberof ScanStatisticModel
     */
    high?: number;
    /**
     *
     * @type {number}
     * @memberof ScanStatisticModel
     */
    medium?: number;
    /**
     *
     * @type {number}
     * @memberof ScanStatisticModel
     */
    low?: number;
    /**
     *
     * @type {number}
     * @memberof ScanStatisticModel
     */
    potential?: number;
    /**
     *
     * @type {number}
     * @memberof ScanStatisticModel
     */
    total?: number;
    /**
     *
     * @type {number}
     * @memberof ScanStatisticModel
     */
    filesTotal?: number;
    /**
     *
     * @type {number}
     * @memberof ScanStatisticModel
     */
    filesScanned?: number;
    /**
     *
     * @type {number}
     * @memberof ScanStatisticModel
     */
    urlsScanned?: number;
    /**
     *
     * @type {number}
     * @memberof ScanStatisticModel
     */
    urlsTotal?: number;
    /**
     *
     * @type {string}
     * @memberof ScanStatisticModel
     */
    scanDuration?: string;
    /**
     *
     * @type {PolicyState}
     * @memberof ScanStatisticModel
     */
    policyState?: PolicyState;
    /**
     *
     * @type {SecurityPolicyStatus}
     * @memberof ScanStatisticModel
     */
    securityPolicyStatus?: SecurityPolicyStatus;
}

/**
 *
 * @export
 */
export const ScanType = {
    Full: 'Full',
    Incremental: 'Incremental'
} as const;
export type ScanType = typeof ScanType[keyof typeof ScanType];


/**
 *
 * @export
 */
export const Scope = {
    Full: 'Full',
    Incremental: 'Incremental'
} as const;
export type Scope = typeof Scope[keyof typeof Scope];

/**
 *
 * @export
 * @interface SecurityPoliciesModel
 */
export interface SecurityPoliciesModel {
    /**
     *
     * @type {boolean}
     * @memberof SecurityPoliciesModel
     */
    checkSecurityPoliciesAccordance?: boolean;
    /**
     *
     * @type {string}
     * @memberof SecurityPoliciesModel
     */
    securityPolicies?: string | null;
}
/**
 *
 * @export
 * @interface SecurityPolicyStatus
 */
export interface SecurityPolicyStatus {
    /**
     *
     * @type {PolicyState}
     * @memberof SecurityPolicyStatus
     */
    policyState?: PolicyState;
    /**
     *
     * @type {InitiatorModel}
     * @memberof SecurityPolicyStatus
     */
    initiator?: InitiatorModel;
    /**
     *
     * @type {string}
     * @memberof SecurityPolicyStatus
     */
    updatedAt?: string;
}
/**
 *
 * @export
 * @interface SecurityPolicyStatusModel
 */
export interface SecurityPolicyStatusModel {
    /**
     *
     * @type {PolicyState}
     * @memberof SecurityPolicyStatusModel
     */
    policyState?: PolicyState;
    /**
     *
     * @type {InitiatorModel}
     * @memberof SecurityPolicyStatusModel
     */
    initiator?: InitiatorModel;
    /**
     *
     * @type {string}
     * @memberof SecurityPolicyStatusModel
     */
    updatedAt?: string;
}

/**
 *
 * @export
 */
export const SemgrepCommitAction = {
    Replace: 'Replace',
    CreateCopy: 'CreateCopy',
    Skip: 'Skip'
} as const;
export type SemgrepCommitAction = typeof SemgrepCommitAction[keyof typeof SemgrepCommitAction];

/**
 *
 * @export
 * @interface SemgrepCommitPlanItem
 */
export interface SemgrepCommitPlanItem {
    /**
     *
     * @type {string}
     * @memberof SemgrepCommitPlanItem
     */
    candidateId: string;
    /**
     *
     * @type {SemgrepCommitAction}
     * @memberof SemgrepCommitPlanItem
     */
    action: SemgrepCommitAction;
    /**
     * Required for `Replace` and `CreateCopy`; ignored for `Skip`. Must reference an existing `PmRuleVulnType`.

     * @type {string}
     * @memberof SemgrepCommitPlanItem
     */
    vulnerabilityTypeId?: string | null;
}
/**
 *
 * @export
 * @interface SemgrepCommitRequest
 */
export interface SemgrepCommitRequest {
    /**
     * Candidates from the preview response (must be sent back unchanged).
     * @type {Array<SemgrepRuleCandidate>}
     * @memberof SemgrepCommitRequest
     */
    candidates: Array<SemgrepRuleCandidate>;
    /**
     *
     * @type {Array<SemgrepCommitPlanItem>}
     * @memberof SemgrepCommitRequest
     */
    plan: Array<SemgrepCommitPlanItem>;
}
/**
 *
 * @export
 * @interface SemgrepCommitResponse
 */
export interface SemgrepCommitResponse {
    /**
     *
     * @type {number}
     * @memberof SemgrepCommitResponse
     */
    created: number;
    /**
     *
     * @type {number}
     * @memberof SemgrepCommitResponse
     */
    updated: number;
    /**
     *
     * @type {number}
     * @memberof SemgrepCommitResponse
     */
    skipped: number;
    /**
     *
     * @type {Array<string>}
     * @memberof SemgrepCommitResponse
     */
    importedRuleNames?: Array<string>;
    /**
     *
     * @type {Array<string>}
     * @memberof SemgrepCommitResponse
     */
    skippedRuleNames?: Array<string>;
    /**
     *
     * @type {Array<SemgrepImportError>}
     * @memberof SemgrepCommitResponse
     */
    errors: Array<SemgrepImportError>;
}
/**
 *
 * @export
 * @interface SemgrepConflict
 */
export interface SemgrepConflict {
    /**
     *
     * @type {string}
     * @memberof SemgrepConflict
     */
    candidateId: string;
    /**
     *
     * @type {string}
     * @memberof SemgrepConflict
     */
    existingPmRuleId: string;
    /**
     *
     * @type {string}
     * @memberof SemgrepConflict
     */
    existingRuleName: string;
    /**
     * Last modification time of the existing PM rule (for conflict comparison UI).
     * @type {string}
     * @memberof SemgrepConflict
     */
    existingRuleUpdatedAt?: string | null;
}
/**
 *
 * @export
 * @interface SemgrepImportError
 */
export interface SemgrepImportError {
    /**
     * Present when the error relates to a specific import candidate.
     * @type {string}
     * @memberof SemgrepImportError
     */
    candidateId?: string | null;
    /**
     * Source file path/name when available (e.g. YAML or zip entry).
     * @type {string}
     * @memberof SemgrepImportError
     */
    fileName?: string | null;
    /**
     *
     * @type {ApiErrorType}
     * @memberof SemgrepImportError
     */
    errorCode: ApiErrorType;
    /**
     *
     * @type {string}
     * @memberof SemgrepImportError
     */
    message: string;
}
/**
 *
 * @export
 * @interface SemgrepPreviewResponse
 */
export interface SemgrepPreviewResponse {
    /**
     * Valid Semgrep rule candidates from preview (also sent back unchanged on commit).
     * @type {Array<SemgrepRuleCandidate>}
     * @memberof SemgrepPreviewResponse
     */
    candidates: Array<SemgrepRuleCandidate>;
    /**
     *
     * @type {Array<SemgrepConflict>}
     * @memberof SemgrepPreviewResponse
     */
    conflicts: Array<SemgrepConflict>;
    /**
     * Per-document or per-rule validation failures; import can still succeed partially.
     * @type {Array<SemgrepImportError>}
     * @memberof SemgrepPreviewResponse
     */
    errors: Array<SemgrepImportError>;
    /**
     * PM vulnerability type catalog for the import UI dropdown.
     * @type {Array<PmRuleVulnType>}
     * @memberof SemgrepPreviewResponse
     */
    vulnerabilityTypes: Array<PmRuleVulnType>;
}
/**
 *
 * @export
 * @interface SemgrepRuleCandidate
 */
export interface SemgrepRuleCandidate {
    /**
     * Stable id of the candidate within an import snapshot (ties preview, conflicts, errors, and commit plan).
     * @type {string}
     * @memberof SemgrepRuleCandidate
     */
    candidateId: string;
    /**
     * PM rule name; for Semgrep import typically matches YAML `id`.
     * @type {string}
     * @memberof SemgrepRuleCandidate
     */
    name: string;
    /**
     * Short description; often mapped from YAML `message` on import (may be truncated server-side).
     * @type {string}
     * @memberof SemgrepRuleCandidate
     */
    description?: string | null;
    /**
     *
     * @type {IssueLevel}
     * @memberof SemgrepRuleCandidate
     */
    level: IssueLevel;
    /**
     *
     * @type {DataFormat}
     * @memberof SemgrepRuleCandidate
     */
    dataFormat: DataFormat;
    /**
     * Full Semgrep YAML for one rule: root `rules` with exactly one list item. Formatting is preserved end-to-end until the scan engine consumes it.

     * @type {string}
     * @memberof SemgrepRuleCandidate
     */
    value: string;
    /**
     * If set, a PM rule with the same name already exists (used for conflict resolution).
     * @type {string}
     * @memberof SemgrepRuleCandidate
     */
    existingPmRuleId?: string | null;
    /**
     *
     * @type {SemgrepRuleCandidateSuggestedVulnerabilityType}
     * @memberof SemgrepRuleCandidate
     */
    suggestedVulnerabilityType?: SemgrepRuleCandidateSuggestedVulnerabilityType | null;
}
/**
 * PM vulnerability type suggested from YAML metadata.cwe.

 * @export
 * @interface SemgrepRuleCandidateSuggestedVulnerabilityType
 */
export interface SemgrepRuleCandidateSuggestedVulnerabilityType {
    /**
     *
     * @type {string}
     * @memberof SemgrepRuleCandidateSuggestedVulnerabilityType
     */
    id: string;
    /**
     *
     * @type {string}
     * @memberof SemgrepRuleCandidateSuggestedVulnerabilityType
     */
    name: string;
    /**
     *
     * @type {string}
     * @memberof SemgrepRuleCandidateSuggestedVulnerabilityType
     */
    description?: string | null;
    /**
     *
     * @type {PmRuleVulnCreationType}
     * @memberof SemgrepRuleCandidateSuggestedVulnerabilityType
     */
    creationType: PmRuleVulnCreationType;
}
/**
 *
 * @export
 * @interface SetIssuesAutoApprovalStateModel
 */
export interface SetIssuesAutoApprovalStateModel {
    /**
     *
     * @type {Array<string>}
     * @memberof SetIssuesAutoApprovalStateModel
     */
    issueIds?: Array<string> | null;
}
/**
 *
 * @export
 * @interface SettingsScopeModel
 */
export interface SettingsScopeModel {
    /**
     *
     * @type {BaseCveFeedSettings}
     * @memberof SettingsScopeModel
     */
    cveFeedSettings?: BaseCveFeedSettings;
}
/**
 *
 * @export
 * @interface ShortScanStatisticModel
 */
export interface ShortScanStatisticModel {
    /**
     *
     * @type {number}
     * @memberof ShortScanStatisticModel
     */
    filesTotal?: number;
    /**
     *
     * @type {number}
     * @memberof ShortScanStatisticModel
     */
    filesScanned?: number;
    /**
     *
     * @type {number}
     * @memberof ShortScanStatisticModel
     */
    urlsTotal?: number;
    /**
     *
     * @type {number}
     * @memberof ShortScanStatisticModel
     */
    urlsScanned?: number;
}

/**
 *
 * @export
 */
export const SortType = {
    Unknown: 'Unknown',
    Asc: 'Asc',
    Desc: 'Desc'
} as const;
export type SortType = typeof SortType[keyof typeof SortType];

/**
 *
 * @export
 * @interface SourceControlConnectionSettingsModel
 */
export interface SourceControlConnectionSettingsModel {
    /**
     *
     * @type {RepositoryType}
     * @memberof SourceControlConnectionSettingsModel
     */
    repositoryType?: RepositoryType;
    /**
     *
     * @type {string}
     * @memberof SourceControlConnectionSettingsModel
     */
    repositoryUrl?: string | null;
    /**
     *
     * @type {SourceControlCredentialsType}
     * @memberof SourceControlConnectionSettingsModel
     */
    sourceControlCredentialsType?: SourceControlCredentialsType;
    /**
     *
     * @type {string}
     * @memberof SourceControlConnectionSettingsModel
     */
    login?: string | null;
    /**
     *
     * @type {string}
     * @memberof SourceControlConnectionSettingsModel
     */
    password?: string | null;
    /**
     *
     * @type {string}
     * @memberof SourceControlConnectionSettingsModel
     */
    sshKey?: string | null;
    /**
     *
     * @type {string}
     * @memberof SourceControlConnectionSettingsModel
     */
    azurePersonalAccessToken?: string | null;
}
/**
 *
 * @export
 * @interface SourceControlCredentialsModel
 */
export interface SourceControlCredentialsModel {
    /**
     *
     * @type {SourceControlCredentialsType}
     * @memberof SourceControlCredentialsModel
     */
    sourceControlCredentialsType?: SourceControlCredentialsType;
    /**
     *
     * @type {string}
     * @memberof SourceControlCredentialsModel
     */
    login?: string | null;
    /**
     *
     * @type {string}
     * @memberof SourceControlCredentialsModel
     */
    password?: string | null;
    /**
     *
     * @type {string}
     * @memberof SourceControlCredentialsModel
     */
    sshKey?: string | null;
    /**
     *
     * @type {string}
     * @memberof SourceControlCredentialsModel
     */
    azurePersonalAccessToken?: string | null;
}

/**
 *
 * @export
 */
export const SourceControlCredentialsType = {
    None: 'None',
    Anonymous: 'Anonymous',
    Password: 'Password',
    AzureToken: 'AzureToken',
    SshKey: 'SshKey'
} as const;
export type SourceControlCredentialsType = typeof SourceControlCredentialsType[keyof typeof SourceControlCredentialsType];

/**
 *
 * @export
 * @interface SourceControlTargetEnvironmentModel
 */
export interface SourceControlTargetEnvironmentModel {
    /**
     *
     * @type {boolean}
     * @memberof SourceControlTargetEnvironmentModel
     */
    includesSubmodules?: boolean;
}
/**
 *
 * @export
 * @interface SourceControlTargetModel
 */
export interface SourceControlTargetModel {
    /**
     *
     * @type {SourceControlTargetEnvironmentModel}
     * @memberof SourceControlTargetModel
     */
    targetEnvironment?: SourceControlTargetEnvironmentModel;
    /**
     *
     * @type {string}
     * @memberof SourceControlTargetModel
     */
    branch?: string | null;
}

/**
 *
 * @export
 */
export const SourceType = {
    Empty: 'Empty',
    Local: 'Local',
    SourceControl: 'SourceControl',
    Sast: 'SAST',
    Bb: 'BB',
    Sca: 'SCA',
    Dc: 'DC'
} as const;
export type SourceType = typeof SourceType[keyof typeof SourceType];

/**
 *
 * @export
 * @interface SourcesSettingsModel
 */
export interface SourcesSettingsModel {
    /**
     *
     * @type {string}
     * @memberof SourcesSettingsModel
     */
    changingDate?: string;
    /**
     *
     * @type {UpdaterInfoModel}
     * @memberof SourcesSettingsModel
     */
    updater?: UpdaterInfoModel;
    /**
     *
     * @type {string}
     * @memberof SourcesSettingsModel
     */
    scanTargetName?: string | null;
    /**
     *
     * @type {LocalSourceType}
     * @memberof SourcesSettingsModel
     */
    localSourceType?: LocalSourceType;
    /**
     *
     * @type {string}
     * @memberof SourcesSettingsModel
     */
    vcsBranch?: string | null;
    /**
     *
     * @type {SourcesSettingsModelLangPercentDistribution}
     * @memberof SourcesSettingsModel
     */
    langPercentDistribution?: SourcesSettingsModelLangPercentDistribution | null;
}
/**
 *
 * @export
 * @interface SourcesSettingsModelLangPercentDistribution
 */
export interface SourcesSettingsModelLangPercentDistribution {
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    None?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    DotNet?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    Php?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    Java?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    Html?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    JavaScript?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    SandBox?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    Binary?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    PlSql?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    TSql?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    Aspx?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    C?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    CPlusPlus?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    ObjectiveC?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    Swift?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    MySql?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    Python?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    CSharpWinOnly?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    Go?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    Kotlin?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    TypeScript?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    Ruby?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    CSharpCrossPlatform?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    Solidity?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    Scala?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    OneC?: number;
    /**
     *
     * @type {number}
     * @memberof SourcesSettingsModelLangPercentDistribution
     */
    Dart?: number;
}
/**
 *
 * @export
 * @interface SourcesSettingsUpdateModel
 */
export interface SourcesSettingsUpdateModel {
    /**
     *
     * @type {string}
     * @memberof SourcesSettingsUpdateModel
     */
    scanTarget?: string | null;
    /**
     *
     * @type {string}
     * @memberof SourcesSettingsUpdateModel
     */
    scanTargetName?: string | null;
    /**
     *
     * @type {LocalSourceType}
     * @memberof SourcesSettingsUpdateModel
     */
    localSourceType?: LocalSourceType;
    /**
     *
     * @type {string}
     * @memberof SourcesSettingsUpdateModel
     */
    vcsBranch?: string | null;
    /**
     *
     * @type {SourcesSettingsModelLangPercentDistribution}
     * @memberof SourcesSettingsUpdateModel
     */
    langPercentDistribution?: SourcesSettingsModelLangPercentDistribution | null;
}

/**
 *
 * @export
 */
export const Stage = {
    Unknown: 'Unknown',
    VfsSetup: 'VFSSetup',
    Initialize: 'Initialize',
    Precheck: 'Precheck',
    Scan: 'Scan',
    Finalize: 'Finalize',
    Done: 'Done',
    Failed: 'Failed',
    Aborted: 'Aborted',
    Enqueued: 'Enqueued',
    Autocheck: 'Autocheck'
} as const;
export type Stage = typeof Stage[keyof typeof Stage];

/**
 *
 * @export
 * @interface StartAiTriageResponse
 */
export interface StartAiTriageResponse {
    /**
     *
     * @type {AiTriageStatus}
     * @memberof StartAiTriageResponse
     */
    status: AiTriageStatus;
    /**
     * True if this call enqueued triage; false if already InProgress or Finished (idempotent no-op).
     * @type {boolean}
     * @memberof StartAiTriageResponse
     */
    started: boolean;
}
/**
 *
 * @export
 * @interface StatisticByScanResultModel
 */
export interface StatisticByScanResultModel {
    /**
     *
     * @type {Array<VulnerabilityTimeDistribResultModel>}
     * @memberof StatisticByScanResultModel
     */
    records?: Array<VulnerabilityTimeDistribResultModel> | null;
    /**
     *
     * @type {number}
     * @memberof StatisticByScanResultModel
     */
    totalCount?: number;
}
/**
 *
 * @export
 * @interface StatisticVulnStateResultModel
 */
export interface StatisticVulnStateResultModel {
    /**
     *
     * @type {StatisticVulnStateRow}
     * @memberof StatisticVulnStateResultModel
     */
    lastState?: StatisticVulnStateRow;
    /**
     *
     * @type {StatisticVulnStateRow}
     * @memberof StatisticVulnStateResultModel
     */
    prevState?: StatisticVulnStateRow;
    /**
     *
     * @type {ThreatLevel}
     * @memberof StatisticVulnStateResultModel
     */
    level?: ThreatLevel;
}
/**
 *
 * @export
 * @interface StatisticVulnStateRow
 */
export interface StatisticVulnStateRow {
    /**
     *
     * @type {number}
     * @memberof StatisticVulnStateRow
     */
    total?: number;
    /**
     *
     * @type {number}
     * @memberof StatisticVulnStateRow
     */
    potential?: number;
    /**
     *
     * @type {number}
     * @memberof StatisticVulnStateRow
     */
    low?: number;
    /**
     *
     * @type {number}
     * @memberof StatisticVulnStateRow
     */
    medium?: number;
    /**
     *
     * @type {number}
     * @memberof StatisticVulnStateRow
     */
    high?: number;
    /**
     *
     * @type {ThreatLevel}
     * @memberof StatisticVulnStateRow
     */
    level?: ThreatLevel;
}
/**
 *
 * @export
 * @interface StatusType
 */
export interface StatusType {
    /**
     *
     * @type {string}
     * @memberof StatusType
     */
    id?: string | null;
    /**
     *
     * @type {string}
     * @memberof StatusType
     */
    name?: string | null;
}
/**
 *
 * @export
 * @interface SyncInfoModel
 */
export interface SyncInfoModel {
    /**
     *
     * @type {string}
     * @memberof SyncInfoModel
     */
    branchId?: string;
    /**
     *
     * @type {string}
     * @memberof SyncInfoModel
     */
    branchName?: string | null;
}

/**
 *
 * @export
 */
export const SyslogFormat = {
    Plain: 'Plain',
    Json: 'Json',
    Cef: 'Cef'
} as const;
export type SyslogFormat = typeof SyslogFormat[keyof typeof SyslogFormat];

/**
 *
 * @export
 * @interface SyslogTargetModel
 */
export interface SyslogTargetModel {
    /**
     *
     * @type {string}
     * @memberof SyslogTargetModel
     */
    host?: string | null;
    /**
     *
     * @type {number}
     * @memberof SyslogTargetModel
     */
    port?: number;
    /**
     *
     * @type {boolean}
     * @memberof SyslogTargetModel
     */
    isEnabled?: boolean;
    /**
     *
     * @type {SyslogFormat}
     * @memberof SyslogTargetModel
     */
    logFormat?: SyslogFormat;
    /**
     *
     * @type {LogLevel}
     * @memberof SyslogTargetModel
     */
    logLevel?: LogLevel;
}
/**
 *
 * @export
 * @interface TemplateValidationResult
 */
export interface TemplateValidationResult {
    /**
     *
     * @type {boolean}
     * @memberof TemplateValidationResult
     */
    hasErrors?: boolean;
    /**
     *
     * @type {Array<string>}
     * @memberof TemplateValidationResult
     */
    messages?: Array<string> | null;
}
/**
 *
 * @export
 * @interface TestMailModel
 */
export interface TestMailModel {
    /**
     *
     * @type {string}
     * @memberof TestMailModel
     */
    id?: string | null;
    /**
     *
     * @type {MailAuthenticationPatchModel}
     * @memberof TestMailModel
     */
    authentication?: MailAuthenticationPatchModel;
    /**
     *
     * @type {string}
     * @memberof TestMailModel
     */
    subject?: string | null;
    /**
     *
     * @type {string}
     * @memberof TestMailModel
     */
    smtpServerAddress?: string | null;
    /**
     *
     * @type {number}
     * @memberof TestMailModel
     */
    port?: number | null;
    /**
     *
     * @type {string}
     * @memberof TestMailModel
     */
    senderEmail?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof TestMailModel
     */
    enableSsl?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof TestMailModel
     */
    considerCertificateErrors?: boolean | null;
    /**
     *
     * @type {string}
     * @memberof TestMailModel
     */
    emailRecipient?: string | null;
}

/**
 *
 * @export
 */
export const ThreatLevel = {
    None: 'None',
    Potential: 'Potential',
    Low: 'Low',
    Medium: 'Medium',
    High: 'High'
} as const;
export type ThreatLevel = typeof ThreatLevel[keyof typeof ThreatLevel];

/**
 *
 * @export
 * @interface TicketModels
 */
export interface TicketModels {
    /**
     *
     * @type {string}
     * @memberof TicketModels
     */
    key?: string | null;
    /**
     *
     * @type {string}
     * @memberof TicketModels
     */
    project?: string | null;
    /**
     *
     * @type {string}
     * @memberof TicketModels
     */
    ticketType?: string | null;
    /**
     *
     * @type {Array<FieldInfoModel>}
     * @memberof TicketModels
     */
    fields?: Array<FieldInfoModel> | null;
}
/**
 *
 * @export
 * @interface TicketTypeModel
 */
export interface TicketTypeModel {
    /**
     *
     * @type {string}
     * @memberof TicketTypeModel
     */
    id?: string | null;
    /**
     *
     * @type {string}
     * @memberof TicketTypeModel
     */
    name?: string | null;
}
/**
 *
 * @export
 * @interface TrackerModel
 */
export interface TrackerModel {
    /**
     *
     * @type {TrackerType}
     * @memberof TrackerModel
     */
    type?: TrackerType;
    /**
     *
     * @type {Array<IssueTrackerAuthType>}
     * @memberof TrackerModel
     */
    authType?: Array<IssueTrackerAuthType> | null;
}

/**
 *
 * @export
 */
export const TrackerType = {
    Unknown: 'Unknown',
    Jira: 'Jira'
} as const;
export type TrackerType = typeof TrackerType[keyof typeof TrackerType];

/**
 *
 * @export
 * @interface UpdateAiTriageIntegrationStatusRequest
 */
export interface UpdateAiTriageIntegrationStatusRequest {
    /**
     *
     * @type {boolean}
     * @memberof UpdateAiTriageIntegrationStatusRequest
     */
    isEnabled: boolean;
    /**
     * Explicit user confirmation of the AI triage data-processing agreement. Must be `true` when `isEnabled` is `true`.

     * @type {boolean}
     * @memberof UpdateAiTriageIntegrationStatusRequest
     */
    agreementAccepted: boolean;
}
/**
 *
 * @export
 * @interface UpdateIssueExploitModel
 */
export interface UpdateIssueExploitModel {
    /**
     *
     * @type {string}
     * @memberof UpdateIssueExploitModel
     */
    exploitUrl?: string | null;
    /**
     *
     * @type {string}
     * @memberof UpdateIssueExploitModel
     */
    exploit?: string | null;
    /**
     *
     * @type {string}
     * @memberof UpdateIssueExploitModel
     */
    comment?: string | null;
}
/**
 *
 * @export
 * @interface UpdateMemberModel
 */
export interface UpdateMemberModel {
    /**
     *
     * @type {string}
     * @memberof UpdateMemberModel
     */
    id?: string;
    /**
     *
     * @type {Array<MemberRoleModel>}
     * @memberof UpdateMemberModel
     */
    roles?: Array<MemberRoleModel> | null;
}
/**
 *
 * @export
 * @interface UpdateProjectMemberModel
 */
export interface UpdateProjectMemberModel {
    /**
     *
     * @type {string}
     * @memberof UpdateProjectMemberModel
     */
    userId?: string;
    /**
     *
     * @type {Array<string>}
     * @memberof UpdateProjectMemberModel
     */
    roleIds?: Array<string> | null;
}

/**
 *
 * @export
 */
export const UpdateStatusType = {
    None: 'None'
} as const;
export type UpdateStatusType = typeof UpdateStatusType[keyof typeof UpdateStatusType];

/**
 *
 * @export
 * @interface UpdaterInfoModel
 */
export interface UpdaterInfoModel {
    /**
     *
     * @type {string}
     * @memberof UpdaterInfoModel
     */
    tokenName?: string | null;
    /**
     *
     * @type {string}
     * @memberof UpdaterInfoModel
     */
    email?: string | null;
    /**
     *
     * @type {string}
     * @memberof UpdaterInfoModel
     */
    userName?: string | null;
}
/**
 *
 * @export
 * @interface UploadSessionModel
 */
export interface UploadSessionModel {
    /**
     *
     * @type {string}
     * @memberof UploadSessionModel
     */
    id?: string;
    /**
     *
     * @type {number}
     * @memberof UploadSessionModel
     */
    maxBytes?: number;
    /**
     *
     * @type {number}
     * @memberof UploadSessionModel
     */
    maxFiles?: number;
}
/**
 *
 * @export
 * @interface UserLoginModel
 */
export interface UserLoginModel {
    /**
     *
     * @type {string}
     * @memberof UserLoginModel
     */
    login?: string | null;
    /**
     *
     * @type {string}
     * @memberof UserLoginModel
     */
    password?: string | null;
}

/**
 *
 * @export
 */
export const UserMappingFieldType = {
    Login: 'Login',
    Name: 'Name',
    Email: 'Email'
} as const;
export type UserMappingFieldType = typeof UserMappingFieldType[keyof typeof UserMappingFieldType];

/**
 *
 * @export
 * @interface UserMappingModel
 */
export interface UserMappingModel {
    /**
     *
     * @type {UserMappingFieldType}
     * @memberof UserMappingModel
     */
    field?: UserMappingFieldType;
    /**
     *
     * @type {string}
     * @memberof UserMappingModel
     */
    value?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof UserMappingModel
     */
    canEdit?: boolean;
}
/**
 *
 * @export
 * @interface UserModel
 */
export interface UserModel {
    /**
     *
     * @type {string}
     * @memberof UserModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof UserModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof UserModel
     */
    email?: string | null;
    /**
     *
     * @type {string}
     * @memberof UserModel
     */
    login?: string | null;
}
/**
 *
 * @export
 * @interface UserReportFiltersModel
 */
export interface UserReportFiltersModel {
    /**
     *
     * @type {Array<string>}
     * @memberof UserReportFiltersModel
     */
    types?: Array<string> | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    levelHigh?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    levelMedium?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    levelLow?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    levelPotential?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    statusUndefined?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    statusConfirmed?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    statusConfirmedAuto?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    statusRejected?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    modeEntryPoint?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    modePublicMethods?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    modeRootFunction?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    modeOthers?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    foundThisScan?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    foundPrevScan?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    conditional?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    nonConditional?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    suppressed?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    nonSuppressed?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    suspected?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    secondLevel?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    noPlaceToFix?: boolean | null;
    /**
     *
     * @type {boolean}
     * @memberof UserReportFiltersModel
     */
    onlyFavorite?: boolean | null;
    /**
     *
     * @type {Array<ScanModuleType>}
     * @memberof UserReportFiltersModel
     */
    scanModules?: Array<ScanModuleType> | null;
    /**
     *
     * @type {number}
     * @memberof UserReportFiltersModel
     */
    limit?: number | null;
    /**
     *
     * @type {Array<ProgrammingLanguageGroup>}
     * @memberof UserReportFiltersModel
     */
    languages?: Array<ProgrammingLanguageGroup> | null;
}
/**
 *
 * @export
 * @interface UserReportParametersModel
 */
export interface UserReportParametersModel {
    /**
     *
     * @type {boolean}
     * @memberof UserReportParametersModel
     */
    useFilters?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof UserReportParametersModel
     */
    includeDFD?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof UserReportParametersModel
     */
    includeGlossary?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof UserReportParametersModel
     */
    includeComments?: boolean;
    /**
     *
     * @type {string}
     * @memberof UserReportParametersModel
     */
    reportTemplateId?: string;
}
/**
 *
 * @export
 * @interface UserTrackerModel
 */
export interface UserTrackerModel {
    /**
     *
     * @type {string}
     * @memberof UserTrackerModel
     */
    name?: string | null;
    /**
     *
     * @type {string}
     * @memberof UserTrackerModel
     */
    displayName?: string | null;
    /**
     *
     * @type {string}
     * @memberof UserTrackerModel
     */
    email?: string | null;
}
/**
 *
 * @export
 * @interface VcsBranchCheckoutResultModel
 */
export interface VcsBranchCheckoutResultModel {
    /**
     *
     * @type {string}
     * @memberof VcsBranchCheckoutResultModel
     */
    branchId?: string;
    /**
     *
     * @type {string}
     * @memberof VcsBranchCheckoutResultModel
     */
    operationId?: string;
}
/**
 *
 * @export
 * @interface VcsConnectionSettingsModel
 */
export interface VcsConnectionSettingsModel {
    /**
     *
     * @type {string}
     * @memberof VcsConnectionSettingsModel
     */
    repositoryUrl?: string | null;
    /**
     *
     * @type {string}
     * @memberof VcsConnectionSettingsModel
     */
    login?: string | null;
    /**
     *
     * @type {string}
     * @memberof VcsConnectionSettingsModel
     */
    password?: string | null;
    /**
     *
     * @type {string}
     * @memberof VcsConnectionSettingsModel
     */
    sshKey?: string | null;
    /**
     *
     * @type {boolean}
     * @memberof VcsConnectionSettingsModel
     */
    includeSubmodules?: boolean;
    /**
     *
     * @type {SourceControlCredentialsType}
     * @memberof VcsConnectionSettingsModel
     */
    sourceControlCredentialsType?: SourceControlCredentialsType;
    /**
     *
     * @type {RepositoryType}
     * @memberof VcsConnectionSettingsModel
     */
    repositoryType?: RepositoryType;
    /**
     *
     * @type {string}
     * @memberof VcsConnectionSettingsModel
     */
    credentialsId?: string | null;
    /**
     *
     * @type {string}
     * @memberof VcsConnectionSettingsModel
     */
    azurePersonalAccessToken?: string | null;
}
/**
 *
 * @export
 * @interface VfsModel
 */
export interface VfsModel {
    /**
     *
     * @type {string}
     * @memberof VfsModel
     */
    scanResultId?: string;
    /**
     *
     * @type {string}
     * @memberof VfsModel
     */
    rootPath?: string | null;
    /**
     *
     * @type {Array<VfsNodeModel>}
     * @memberof VfsModel
     */
    nodes?: Array<VfsNodeModel> | null;
}
/**
 *
 * @export
 * @interface VfsNodeCreationModel
 */
export interface VfsNodeCreationModel {
    /**
     *
     * @type {string}
     * @memberof VfsNodeCreationModel
     */
    rootPath?: string | null;
    /**
     *
     * @type {Array<VfsNodeModel>}
     * @memberof VfsNodeCreationModel
     */
    nodes?: Array<VfsNodeModel> | null;
}
/**
 *
 * @export
 * @interface VfsNodeModel
 */
export interface VfsNodeModel {
    /**
     *
     * @type {NodeType}
     * @memberof VfsNodeModel
     */
    type?: NodeType;
    /**
     *
     * @type {string}
     * @memberof VfsNodeModel
     */
    relativePath?: string | null;
    /**
     *
     * @type {number}
     * @memberof VfsNodeModel
     */
    lastModifiedDate?: number;
    /**
     *
     * @type {number}
     * @memberof VfsNodeModel
     */
    size?: number;
    /**
     *
     * @type {string}
     * @memberof VfsNodeModel
     */
    hash?: string | null;
    /**
     *
     * @type {Array<string>}
     * @memberof VfsNodeModel
     */
    relatedFiles?: Array<string> | null;
    /**
     *
     * @type {{ [key: string]: NodeState; }}
     * @memberof VfsNodeModel
     */
    stateByCores?: { [key: string]: NodeState; } | null;
}
/**
 *
 * @export
 * @interface VulnTimeDistribFilterModel
 */
export interface VulnTimeDistribFilterModel {
    /**
     *
     * @type {Array<string>}
     * @memberof VulnTimeDistribFilterModel
     */
    projectIds?: Array<string> | null;
    /**
     *
     * @type {string}
     * @memberof VulnTimeDistribFilterModel
     */
    from?: string | null;
    /**
     *
     * @type {string}
     * @memberof VulnTimeDistribFilterModel
     */
    to?: string | null;
}
/**
 *
 * @export
 * @interface VulnerabilityFullModel
 */
export interface VulnerabilityFullModel {
    /**
     *
     * @type {string}
     * @memberof VulnerabilityFullModel
     */
    aiTriageComment?: string | null;
    /**
     *
     * @type {AiTriageVerdict}
     * @memberof VulnerabilityFullModel
     */
    aiTriageVerdict?: AiTriageVerdict;
    /**
     *
     * @type {AiTriageStatus}
     * @memberof VulnerabilityFullModel
     */
    aiTriageStatus?: AiTriageStatus;
    /**
     *
     * @type {boolean}
     * @memberof VulnerabilityFullModel
     */
    aiTriageSupportedForIssueType?: boolean;
    /**
     *
     * @type {string}
     * @memberof VulnerabilityFullModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof VulnerabilityFullModel
     */
    hash?: string | null;
    /**
     *
     * @type {string}
     * @memberof VulnerabilityFullModel
     */
    scanResultId?: string;
    /**
     *
     * @type {number}
     * @memberof VulnerabilityFullModel
     */
    counter?: number;
    /**
     *
     * @type {string}
     * @memberof VulnerabilityFullModel
     */
    _function?: string | null;
    /**
     *
     * @type {CodeChunkModel}
     * @memberof VulnerabilityFullModel
     */
    vulnerableExpression?: CodeChunkModel;
    /**
     *
     * @type {string}
     * @memberof VulnerabilityFullModel
     */
    type?: string | null;
    /**
     *
     * @type {IssueLevel}
     * @memberof VulnerabilityFullModel
     */
    level?: IssueLevel;
    /**
     *
     * @type {ScanMode}
     * @memberof VulnerabilityFullModel
     */
    scanMode?: ScanMode;
    /**
     *
     * @type {boolean}
     * @memberof VulnerabilityFullModel
     */
    isFavorite?: boolean;
    /**
     *
     * @type {IssueApprovalState}
     * @memberof VulnerabilityFullModel
     */
    approvalState?: IssueApprovalState;
    /**
     *
     * @type {boolean}
     * @memberof VulnerabilityFullModel
     */
    isSuppressed?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof VulnerabilityFullModel
     */
    isSuspected?: boolean;
    /**
     *
     * @type {IssueType}
     * @memberof VulnerabilityFullModel
     */
    issueType?: IssueType;
    /**
     *
     * @type {ScanModuleType}
     * @memberof VulnerabilityFullModel
     */
    scanModule?: ScanModuleType;
    /**
     *
     * @type {VulnerableConfigurationModel}
     * @memberof VulnerabilityFullModel
     */
    vulnerableConfiguration?: VulnerableConfigurationModel;
    /**
     *
     * @type {VulnerableComponentFullModel}
     * @memberof VulnerabilityFullModel
     */
    vulnerableComponent?: VulnerableComponentFullModel;
    /**
     *
     * @type {VulnerableScaComponentModel}
     * @memberof VulnerabilityFullModel
     */
    vulnerableScaComponent?: VulnerableScaComponentModel;
    /**
     *
     * @type {BlackboxVulnerabilityModel}
     * @memberof VulnerabilityFullModel
     */
    blackBox?: BlackboxVulnerabilityModel;
    /**
     *
     * @type {JiraTicketLinkModel}
     * @memberof VulnerabilityFullModel
     */
    jiraTicketLink?: JiraTicketLinkModel;
    /**
     *
     * @type {VulnerableCodeModel}
     * @memberof VulnerabilityFullModel
     */
    vulnerableCode?: VulnerableCodeModel;
    /**
     *
     * @type {PygrepVulnerabilityModel}
     * @memberof VulnerabilityFullModel
     */
    pygrep?: PygrepVulnerabilityModel;
    /**
     *
     * @type {MaliciousCodeModel}
     * @memberof VulnerabilityFullModel
     */
    maliciousCode?: MaliciousCodeModel;
    /**
     *
     * @type {ProgrammingLanguageGroup}
     * @memberof VulnerabilityFullModel
     */
    language?: ProgrammingLanguageGroup;
}
/**
 *
 * @export
 * @interface VulnerabilityModel
 */
export interface VulnerabilityModel {
    /**
     *
     * @type {AiTriageVerdict}
     * @memberof VulnerabilityModel
     */
    aiTriageVerdict?: AiTriageVerdict;
    /**
     *
     * @type {AiTriageStatus}
     * @memberof VulnerabilityModel
     */
    aiTriageStatus?: AiTriageStatus;
    /**
     *
     * @type {string}
     * @memberof VulnerabilityModel
     */
    id?: string;
    /**
     *
     * @type {string}
     * @memberof VulnerabilityModel
     */
    hash?: string | null;
    /**
     *
     * @type {number}
     * @memberof VulnerabilityModel
     */
    counter?: number;
    /**
     *
     * @type {boolean}
     * @memberof VulnerabilityModel
     */
    isNew?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof VulnerabilityModel
     */
    isSecondOrder?: boolean;
    /**
     *
     * @type {string}
     * @memberof VulnerabilityModel
     */
    type?: string | null;
    /**
     *
     * @type {IssueLevel}
     * @memberof VulnerabilityModel
     */
    level?: IssueLevel;
    /**
     *
     * @type {ScanMode}
     * @memberof VulnerabilityModel
     */
    scanMode?: ScanMode;
    /**
     *
     * @type {boolean}
     * @memberof VulnerabilityModel
     */
    isFavorite?: boolean;
    /**
     *
     * @type {IssueApprovalState}
     * @memberof VulnerabilityModel
     */
    approvalState?: IssueApprovalState;
    /**
     *
     * @type {boolean}
     * @memberof VulnerabilityModel
     */
    hasJiraTicket?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof VulnerabilityModel
     */
    isSuppressed?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof VulnerabilityModel
     */
    isSuspected?: boolean;
    /**
     *
     * @type {string}
     * @memberof VulnerabilityModel
     */
    vulnerableValue?: string | null;
    /**
     *
     * @type {IssueType}
     * @memberof VulnerabilityModel
     */
    issueType?: IssueType;
    /**
     *
     * @type {string}
     * @memberof VulnerabilityModel
     */
    _function?: string | null;
    /**
     *
     * @type {ScanModuleType}
     * @memberof VulnerabilityModel
     */
    scanModule?: ScanModuleType;
    /**
     *
     * @type {string}
     * @memberof VulnerabilityModel
     */
    entryPointFile?: string | null;
    /**
     *
     * @type {number}
     * @memberof VulnerabilityModel
     */
    entryPointLine?: number | null;
    /**
     *
     * @type {string}
     * @memberof VulnerabilityModel
     */
    sourceFile?: string | null;
    /**
     *
     * @type {number}
     * @memberof VulnerabilityModel
     */
    sourceBeginLine?: number | null;
    /**
     *
     * @type {number}
     * @memberof VulnerabilityModel
     */
    sourceEndLine?: number | null;
    /**
     *
     * @type {number}
     * @memberof VulnerabilityModel
     */
    sourceBeginColumn?: number | null;
    /**
     *
     * @type {number}
     * @memberof VulnerabilityModel
     */
    sourceEndColumn?: number | null;
    /**
     *
     * @type {VulnerableComponentModel}
     * @memberof VulnerabilityModel
     */
    vulnerableComponent?: VulnerableComponentModel;
    /**
     *
     * @type {VulnerableComponentModel}
     * @memberof VulnerabilityModel
     */
    vulnerableScaComponent?: VulnerableComponentModel;
    /**
     *
     * @type {boolean}
     * @memberof VulnerabilityModel
     */
    hasAdditionalConditions?: boolean;
    /**
     *
     * @type {ProgrammingLanguageGroup}
     * @memberof VulnerabilityModel
     */
    language?: ProgrammingLanguageGroup;
}
/**
 *
 * @export
 * @interface VulnerabilityTimeDistribResultModel
 */
export interface VulnerabilityTimeDistribResultModel {
    /**
     *
     * @type {string}
     * @memberof VulnerabilityTimeDistribResultModel
     */
    scanDate?: string;
    /**
     *
     * @type {number}
     * @memberof VulnerabilityTimeDistribResultModel
     */
    total?: number;
    /**
     *
     * @type {number}
     * @memberof VulnerabilityTimeDistribResultModel
     */
    potential?: number;
    /**
     *
     * @type {number}
     * @memberof VulnerabilityTimeDistribResultModel
     */
    low?: number;
    /**
     *
     * @type {number}
     * @memberof VulnerabilityTimeDistribResultModel
     */
    medium?: number;
    /**
     *
     * @type {number}
     * @memberof VulnerabilityTimeDistribResultModel
     */
    high?: number;
    /**
     *
     * @type {ThreatLevel}
     * @memberof VulnerabilityTimeDistribResultModel
     */
    level?: ThreatLevel;
}
/**
 *
 * @export
 * @interface VulnerableCodeModel
 */
export interface VulnerableCodeModel {
    /**
     *
     * @type {CodeChunkModel}
     * @memberof VulnerableCodeModel
     */
    entryPoint?: CodeChunkModel;
    /**
     *
     * @type {Array<CodeChunkModel>}
     * @memberof VulnerableCodeModel
     */
    dataTrace?: Array<CodeChunkModel> | null;
    /**
     *
     * @type {Array<CodeChunkModel>}
     * @memberof VulnerableCodeModel
     */
    taintDataEntries?: Array<CodeChunkModel> | null;
    /**
     *
     * @type {IssueExploitDataModel}
     * @memberof VulnerableCodeModel
     */
    autocheckExploit?: IssueExploitDataModel;
    /**
     *
     * @type {IssueExploitDataModel}
     * @memberof VulnerableCodeModel
     */
    requestExploit?: IssueExploitDataModel;
    /**
     *
     * @type {string}
     * @memberof VulnerableCodeModel
     */
    condition?: string | null;
}
/**
 *
 * @export
 * @interface VulnerableComponentFullModel
 */
export interface VulnerableComponentFullModel {
    /**
     *
     * @type {Array<string>}
     * @memberof VulnerableComponentFullModel
     */
    cveIds?: Array<string> | null;
    /**
     *
     * @type {string}
     * @memberof VulnerableComponentFullModel
     */
    component?: string | null;
    /**
     *
     * @type {string}
     * @memberof VulnerableComponentFullModel
     */
    version?: string | null;
}
/**
 *
 * @export
 * @interface VulnerableComponentModel
 */
export interface VulnerableComponentModel {
    /**
     *
     * @type {string}
     * @memberof VulnerableComponentModel
     */
    component?: string | null;
    /**
     *
     * @type {string}
     * @memberof VulnerableComponentModel
     */
    version?: string | null;
}
/**
 *
 * @export
 * @interface VulnerableConfigurationModel
 */
export interface VulnerableConfigurationModel {
    /**
     *
     * @type {string}
     * @memberof VulnerableConfigurationModel
     */
    existingValue?: string | null;
    /**
     *
     * @type {string}
     * @memberof VulnerableConfigurationModel
     */
    recommendedValue?: string | null;
}
/**
 *
 * @export
 * @interface VulnerableScaComponentModel
 */
export interface VulnerableScaComponentModel {
    /**
     *
     * @type {Array<string>}
     * @memberof VulnerableScaComponentModel
     */
    licenses?: Array<string> | null;
    /**
     *
     * @type {Array<string>}
     * @memberof VulnerableScaComponentModel
     */
    ptOsvs?: Array<string> | null;
    /**
     *
     * @type {string}
     * @memberof VulnerableScaComponentModel
     */
    component?: string | null;
    /**
     *
     * @type {string}
     * @memberof VulnerableScaComponentModel
     */
    version?: string | null;
}
/**
 *
 * @export
 * @interface WafPatchGenerateModel
 */
export interface WafPatchGenerateModel {
    /**
     *
     * @type {string}
     * @memberof WafPatchGenerateModel
     */
    scanResultId?: string | null;
    /**
     *
     * @type {string}
     * @memberof WafPatchGenerateModel
     */
    projectId?: string;
    /**
     *
     * @type {string}
     * @memberof WafPatchGenerateModel
     */
    localeId?: string | null;
    /**
     *
     * @type {UserReportFiltersModel}
     * @memberof WafPatchGenerateModel
     */
    filters?: UserReportFiltersModel;
}
/**
 *
 * @export
 * @interface WhiteBoxSettingsModel
 */
export interface WhiteBoxSettingsModel {
    /**
     *
     * @type {boolean}
     * @memberof WhiteBoxSettingsModel
     */
    staticCodeAnalysisEnabled?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof WhiteBoxSettingsModel
     */
    patternMatchingEnabled?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof WhiteBoxSettingsModel
     */
    searchForVulnerableComponentsEnabled?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof WhiteBoxSettingsModel
     */
    searchForConfigurationFlawsEnabled?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof WhiteBoxSettingsModel
     */
    searchWithScaEnabled?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof WhiteBoxSettingsModel
     */
    secretDetectionEnabled?: boolean;
    /**
     *
     * @type {boolean}
     * @memberof WhiteBoxSettingsModel
     */
    searchForMaliciousCodeEnabled?: boolean;
}
