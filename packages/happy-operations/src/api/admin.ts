export type AdminUser = {
  id: string;
  username: string | null;
  createdAt: string;
  updatedAt: string;
  subscription: {
    tier: string;
    status: string;
    endDate: string | null;
  };
};

export type AdminUsersResponse = {
  success: true;
  users: AdminUser[];
};

export type AdminMachine = {
  id: string;
  accountId: string;
  metadata: Record<string, unknown>;
  metadataVersion: number;
  daemonState: Record<string, unknown>;
  daemonStateVersion: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
};

export type AdminMachinesResponse = {
  success: true;
  machines: AdminMachine[];
};

export type AdminSession = {
  id: string;
  tag: string | null;
  account: {
    id: string;
    username: string | null;
  };
  active: boolean;
  machineId: string | null;
  path: string | null;
  host: string | null;
  flavor: string | null;
  model: string | null;
  claudeSessionId: string | null;
  controller: string | null;
  handoffState: string | null;
  handoffReason: string | null;
  pendingToolCalls: number;
  completedToolCalls: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastActiveAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminSessionsResponse = {
  success: true;
  sessions: AdminSession[];
};

export type AdminOverviewResponse = {
  success: true;
  metrics: {
    accountsTotal: number;
    machinesTotal: number;
    activeMachines: number;
    subscriptionsTotal: number;
    activeSessions: number;
    messagesTotal: number;
  };
};

export type AdminAuthSessionResponse = {
  success: true;
  authDisabled: boolean;
  admin: {
    id: string;
    roles: string[];
    source: string;
    sessionId: string | null;
  };
};

export type AdminQuotaResponse = {
  success: true;
  account: {
    id: string;
    username: string | null;
  };
  subscription: {
    tier: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    features: {
      dailyLimit: number;
      monthlyLimit: number;
      rateLimit: number;
      storageLimit: string;
    };
  };
  quota: {
    tier: string;
    dailyLimit: number;
    dailyUsed: number;
    dailyRemaining: number;
    monthlyLimit: number;
    monthlyUsed: number;
    monthlyRemaining: number;
    rateLimit: number;
    storageLimit: string;
  };
};

export type AdminOrder = {
  id: string;
  orderNo: string;
  account: {
    id: string;
    username: string | null;
  };
  tier: string;
  billingPeriod: string;
  paymentMethod: string;
  amountCents: number;
  currency: string;
  status: string;
  paidAt: string | null;
  expiresAt: string;
  providerRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrdersResponse = {
  success: true;
  orders: AdminOrder[];
  operator: string;
};

export type AdminAuditLog = {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  result: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AdminAuditLogsResponse = {
  success: true;
  total: number;
  logs: AdminAuditLog[];
};

export type AdminProvider = {
  provider: string;
  configured: boolean;
  isDefault: boolean;
};

export type AdminProvidersResponse = {
  success: true;
  providers: AdminProvider[];
  defaultProvider: string | null;
};

export type AdminProviderDefaultUpdateResponse = {
  success: true;
  provider: AdminProvider['provider'];
};

export type AdminModelProvider = {
  key: string;
  label: string;
  vendor: string | null;
  description: string;
  activeSessions: number;
  totalSessions: number;
  accounts: number;
  connectedAccounts: number;
  discoveredModels: string[];
  latestModel: string | null;
  lastSeenAt: string | null;
  status: 'active' | 'configured' | 'empty';
  missingCapabilities: string[];
};

export type AdminModelProvidersResponse = {
  success: true;
  providers: AdminModelProvider[];
  summary: {
    activeSessions: number;
    discoveredModels: number;
    connectedAccounts: number;
  };
};

type ErrorPayload = {
  message?: string;
  error?: string;
};

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://127.0.0.1:3005';

async function requestJson<T>(path: string, options?: RequestOptions): Promise<T> {
  const body = options?.body !== undefined ? JSON.stringify(options.body) : undefined;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options?.method ?? 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body,
  });
  const payload = (await response.json()) as T | ErrorPayload;

  if (!response.ok) {
    const errorPayload = payload as ErrorPayload;
    throw new Error(errorPayload.message || errorPayload.error || `Request failed: ${response.status}`);
  }

  return payload as T;
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export function fetchAdminUsers(): Promise<AdminUsersResponse> {
  return requestJson<AdminUsersResponse>('/admin/users');
}

export function fetchAdminMachines(): Promise<AdminMachinesResponse> {
  return requestJson<AdminMachinesResponse>('/admin/machines');
}

export function fetchAdminSessions(params?: {
  accountId?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}): Promise<AdminSessionsResponse> {
  const active = typeof params?.active === 'boolean' ? String(params.active) : undefined;
  return requestJson<AdminSessionsResponse>(`/admin/sessions${buildQueryString({ ...params, active })}`);
}

export function fetchAdminOverview(): Promise<AdminOverviewResponse> {
  return requestJson<AdminOverviewResponse>('/admin/overview');
}

export function fetchAdminAuthSession(): Promise<AdminAuthSessionResponse> {
  return requestJson<AdminAuthSessionResponse>('/admin/auth/session');
}

export function fetchAdminQuota(accountId: string): Promise<AdminQuotaResponse> {
  return requestJson<AdminQuotaResponse>(`/admin/account-quota?accountId=${encodeURIComponent(accountId)}`);
}

export function fetchAdminOrders(): Promise<AdminOrdersResponse> {
  return requestJson<AdminOrdersResponse>('/admin/orders');
}

export function fetchAdminAuditLogs(params?: { adminId?: string; action?: string; limit?: number; offset?: number }): Promise<AdminAuditLogsResponse> {
  return requestJson<AdminAuditLogsResponse>(`/admin/audit/logs${buildQueryString(params ?? {})}`);
}

export function fetchAdminProviders(): Promise<AdminProvidersResponse> {
  return requestJson<AdminProvidersResponse>('/admin/providers');
}

export function fetchAdminModelProviders(): Promise<AdminModelProvidersResponse> {
  return requestJson<AdminModelProvidersResponse>('/admin/model-providers');
}

export function updateAdminDefaultProvider(provider: AdminProvider['provider']): Promise<AdminProviderDefaultUpdateResponse> {
  return requestJson<AdminProviderDefaultUpdateResponse>('/admin/providers/default', {
    method: 'POST',
    body: { provider },
  });
}
