export const PmKind = { Rules: 'rules', Groups: 'groups', Types: 'types' } as const;
export type PmKind = (typeof PmKind)[keyof typeof PmKind];
export const PmAction = { Create: 'create', Update: 'update' } as const;
export type PmAction = (typeof PmAction)[keyof typeof PmAction];
