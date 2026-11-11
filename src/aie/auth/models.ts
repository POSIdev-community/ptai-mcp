import type { AieApi } from '../api/client.js';

export const LoginState = {
  Waiting: 'waiting',
  Exchanging: 'exchanging',
  Connected: 'connected',
  Cancelled: 'cancelled',
  Expired: 'expired',
  Failed: 'failed',
} as const;
export type LoginState = (typeof LoginState)[keyof typeof LoginState];
export const AuthAction = { Login: 'login', Logout: 'logout', CancelLogin: 'cancel_login' } as const;
export type AuthAction = (typeof AuthAction)[keyof typeof AuthAction];
export const LoginPage = { Manual: 'manual', Success: 'success' } as const;
export const SessionAction = { Login: AuthAction.Login, Logout: AuthAction.Logout, Pickup: 'session_pickup' } as const;
export type SessionAction = (typeof SessionAction)[keyof typeof SessionAction];
export interface AuthArguments {
  action: AuthAction;
  server_url?: string;
  force_login?: boolean;
  login_id?: string;
}

export interface SharedSession {
  AccessToken: string;
  RefreshToken: string;
  EnterpriseApiUri: string;
}

export interface ConnectedSession {
  api: AieApi;
  identity: string;
  version: string;
  server_url: string;
  user: { id: string; name?: string | null; login?: string | null };
  permissions: unknown[];
  permissions_complete: boolean;
  permissions_error?: string;
}
