export const SettingsSection = {
  Scan: 'scan',
  PmGroups: 'pm_groups',
  Policies: 'policies',
  Blackbox: 'blackbox',
  PreferredAgents: 'preferred_agents',
} as const;
export type SettingsSection = (typeof SettingsSection)[keyof typeof SettingsSection];
