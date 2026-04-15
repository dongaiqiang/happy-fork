import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  List,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import {
  fetchAdminAuditLogs,
  fetchAdminModelProviders,
  fetchAdminOrders,
  fetchAdminProviders,
  fetchAdminSessions,
  type AdminAuditLog,
  type AdminModelProvider,
  type AdminOrder,
  type AdminProvider,
  type AdminSession,
} from '../api/admin';

const { Title, Text } = Typography;

type ProviderStatus = 'ready' | 'attention' | 'pending' | 'offline';

type ProviderSummary = {
  provider: string;
  configured: boolean;
  isDefault: boolean;
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  failedOrders: number;
  recentAuditCount: number;
  lastOrderAt: string | null;
  lastAuditAt: string | null;
  status: ProviderStatus;
  summary: string;
  audits: AdminAuditLog[];
};

function modelStatusColor(status: AdminModelProvider['status']) {
  if (status === 'active') {
    return 'green';
  }
  if (status === 'configured') {
    return 'gold';
  }
  return 'default';
}

function modelStatusLabel(status: AdminModelProvider['status']) {
  if (status === 'active') {
    return '活跃';
  }
  if (status === 'configured') {
    return '已接入';
  }
  return '待补齐';
}

function sessionStateColor(active: boolean) {
  return active ? 'green' : 'default';
}

function displaySessionName(session: AdminSession) {
  return session.tag || session.path || session.id;
}

function sessionMetaLine(session: AdminSession) {
  return [session.model, session.flavor, session.host].filter(Boolean).join(' / ') || '--';
}

function providerHealthSummary(provider: AdminModelProvider) {
  if (provider.activeSessions > 0) {
    return `当前有 ${provider.activeSessions} 个活跃会话，优先核对最新模型和关联账号。`;
  }
  if (provider.totalSessions > 0) {
    return `当前无活跃会话，但已有 ${provider.totalSessions} 个历史样本，可继续核对最后活跃时间。`;
  }
  if (provider.connectedAccounts > 0) {
    return `当前已接入 ${provider.connectedAccounts} 个账号，但还没有会话样本，需继续核对接入链路。`;
  }
  return '当前没有真实会话样本，先保留为待补齐状态。';
}

function isSessionForProvider(session: AdminSession, provider: AdminModelProvider) {
  const values = [
    provider.key,
    provider.label,
    provider.vendor ?? '',
    session.flavor ?? '',
    session.model ?? '',
  ].map((value) => String(value).toLowerCase());
  const [providerKey, providerLabel, providerVendor, sessionFlavor, sessionModel] = values;

  if (sessionFlavor === providerKey || sessionFlavor === providerVendor) {
    return true;
  }

  if (sessionModel.includes(providerKey) || sessionModel.includes(providerLabel.toLowerCase()) || (providerVendor && sessionModel.includes(providerVendor))) {
    return true;
  }

  return false;
}

function isProviderGovernanceAudit(log: AdminAuditLog, provider: AdminModelProvider) {
  const providerValues = [provider.key, provider.label, provider.vendor ?? '']
    .map((value) => value.toLowerCase())
    .filter(Boolean);
  const metadataValues = log.metadata ? Object.values(log.metadata).map((value) => String(value).toLowerCase()) : [];

  if (providerValues.some((value) => log.action.toLowerCase().includes(value) || String(log.targetId || '').toLowerCase() === value)) {
    return true;
  }

  return providerValues.some((value) => metadataValues.includes(value));
}

export function ProvidersPage() {
  const navigate = useNavigate();
  const [selectedProviderKey, setSelectedProviderKey] = React.useState<string | null>(null);

  const providersQuery = useQuery({
    queryKey: ['admin-model-providers'],
    queryFn: fetchAdminModelProviders,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const sessionsQuery = useQuery({
    queryKey: ['admin-sessions', 'providers-page'],
    queryFn: () => fetchAdminSessions({ limit: 100 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const auditQuery = useQuery({
    queryKey: ['admin-audit-logs', 'providers-page'],
    queryFn: () => fetchAdminAuditLogs({ limit: 100 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const providers = providersQuery.data?.providers ?? [];
  const sessions = sessionsQuery.data?.sessions ?? [];
  const auditLogs = auditQuery.data?.logs ?? [];
  const summary = providersQuery.data?.summary ?? {
    activeSessions: 0,
    discoveredModels: 0,
    connectedAccounts: 0,
  };

  React.useEffect(() => {
    if (!selectedProviderKey && providers.length > 0) {
      setSelectedProviderKey(providers[0].key);
    }
  }, [providers, selectedProviderKey]);

  const currentProvider =
    providers.find((provider) => provider.key === selectedProviderKey) ??
    providers[0] ??
    null;
  const currentProviderSessions = currentProvider ? sessions.filter((session) => isSessionForProvider(session, currentProvider)).slice(0, 5) : [];
  const currentProviderAuditLogs = currentProvider
    ? auditLogs.filter((log) => isProviderGovernanceAudit(log, currentProvider)).slice(0, 5)
    : [];
  const isLoading = providersQuery.isLoading || sessionsQuery.isLoading || auditQuery.isLoading;
  const hasError = providersQuery.isError || sessionsQuery.isError || auditQuery.isError;

  return (
    <Space direction="vertical" size={24} style={{ display: 'flex' }}>
      <Card className="hero-card">
        <Row gutter={[16, 16]} align="middle">
          <Col span={14}>
            <Space direction="vertical" size={8}>
              <Tag color="geekblue">/operations/providers</Tag>
              <Title level={2} style={{ margin: 0 }}>
                Agent 管理
              </Title>
              <Text type="secondary">
                当前页面先承接编程 Agent 管理：围绕 Claude、Codex、OpenCode、Gemini 的真实会话使用、已接入服务、治理变更和已识别模型快照做核对；更细的底层模型路由与健康探测这轮继续留到后面。
              </Text>
            </Space>
          </Col>
          <Col span={10}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="Agent 类型" value={providers.length} />
              </Col>
              <Col span={8}>
                <Statistic title="活跃会话" value={summary.activeSessions} />
              </Col>
              <Col span={8}>
                <Statistic title="已识别模型" value={summary.discoveredModels} />
              </Col>
              <Col span={8}>
                <Statistic title="治理事件" value={auditLogs.length} />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Card>
        <Space className="toolbar" size={12} wrap>
          <Space size={12} wrap>
            <Tag color="purple">已接入账号 {summary.connectedAccounts}</Tag>
            <Tag color="blue">可见 Agent {providers.length}</Tag>
            <Tag color="cyan">会话窗口 {sessions.length}</Tag>
          </Space>
          <Space>
            <Button onClick={() => navigate('/operations/payment-channels')}>打开支付通道页</Button>
            <Button
              onClick={() => {
                void providersQuery.refetch();
                void sessionsQuery.refetch();
                void auditQuery.refetch();
              }}
            >
              刷新页面
            </Button>
          </Space>
        </Space>

        <Alert
          type="info"
          showIcon
          message="当前阶段说明"
          description="这页先把 Agent 侧真实证据看清：当前有哪些编程 Agent 已接入、最近有没有真实会话使用、会话里识别到哪些模型，以及最近有哪些治理变更。更细的默认模型、限流、降级、健康探测等能力这轮可以先空着。"
          style={{ marginBottom: 16 }}
        />

        {isLoading ? (
          <div className="state-block">
            <Spin />
          </div>
        ) : null}

        {hasError ? (
          <Alert
            type="error"
            showIcon
            message="Agent 管理数据加载失败"
            description={[
              providersQuery.isError ? `providers: ${loadErrorMessage(providersQuery.error)}` : null,
              sessionsQuery.isError ? `sessions: ${loadErrorMessage(sessionsQuery.error)}` : null,
              auditQuery.isError ? `audit: ${loadErrorMessage(auditQuery.error)}` : null,
            ]
              .filter(Boolean)
              .join(' | ')}
          />
        ) : null}

        {!isLoading && !hasError && providers.length === 0 ? (
          <div className="state-block">
            <Empty description="当前没有可见的 Agent 管理数据" />
          </div>
        ) : null}

        {!isLoading && !hasError && providers.length > 0 ? (
          <Row gutter={[16, 16]}>
            {providers.map((provider) => {
              const active = currentProvider?.key === provider.key;
              return (
                <Col key={provider.key} xs={24} md={12}>
                  <Card
                    hoverable
                    className={active ? 'provider-summary-card provider-summary-card-active' : 'provider-summary-card'}
                    onClick={() => setSelectedProviderKey(provider.key)}
                  >
                    <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                      <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <Title level={4} style={{ margin: 0 }}>
                          {provider.label}
                        </Title>
                        <Tag color={modelStatusColor(provider.status)}>{modelStatusLabel(provider.status)}</Tag>
                      </Space>
                      <Text type="secondary">{provider.description}</Text>
                      <Text type="secondary">{providerHealthSummary(provider)}</Text>
                      <Row gutter={12}>
                        <Col span={8}>
                          <Statistic title="活跃会话" value={provider.activeSessions} />
                        </Col>
                        <Col span={8}>
                          <Statistic title="总会话" value={provider.totalSessions} />
                        </Col>
                        <Col span={8}>
                          <Statistic title="已接入账号" value={provider.connectedAccounts} />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="治理命中"
                            value={auditLogs.filter((log) => isProviderGovernanceAudit(log, provider)).length}
                          />
                        </Col>
                      </Row>
                      <Space size={8} wrap>
                        {provider.vendor ? <Tag color="blue">{provider.vendor}</Tag> : <Tag>vendor 待补</Tag>}
                        <Tag>最近模型 {provider.latestModel || '--'}</Tag>
                        <Tag>最近活跃 {formatDateTime(provider.lastSeenAt)}</Tag>
                      </Space>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        ) : null}
      </Card>

      <Card title={currentProvider ? `${currentProvider.label} / Agent 详情` : 'Agent 详情'}>
        {currentProvider ? (
          <Space direction="vertical" size={16} style={{ display: 'flex' }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Agent">{currentProvider.label}</Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={modelStatusColor(currentProvider.status)}>{modelStatusLabel(currentProvider.status)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="供应商">{currentProvider.vendor || '--'}</Descriptions.Item>
              <Descriptions.Item label="描述">{currentProvider.description}</Descriptions.Item>
              <Descriptions.Item label="活跃会话">{currentProvider.activeSessions}</Descriptions.Item>
              <Descriptions.Item label="总会话">{currentProvider.totalSessions}</Descriptions.Item>
              <Descriptions.Item label="涉及账号">{currentProvider.accounts}</Descriptions.Item>
              <Descriptions.Item label="已接入账号">{currentProvider.connectedAccounts}</Descriptions.Item>
              <Descriptions.Item label="最近模型">{currentProvider.latestModel || '--'}</Descriptions.Item>
              <Descriptions.Item label="最近活跃">{formatDateTime(currentProvider.lastSeenAt)}</Descriptions.Item>
              <Descriptions.Item label="健康摘要" span={2}>
                {providerHealthSummary(currentProvider)}
              </Descriptions.Item>
            </Descriptions>

            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card title="已识别模型" size="small">
                  {currentProvider.discoveredModels.length > 0 ? (
                    <Space size={8} wrap>
                      {currentProvider.discoveredModels.map((model) => (
                        <Tag key={model} color="purple">
                          {model}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有已识别模型快照" />
                  )}
                </Card>
              </Col>
              <Col span={8}>
                <Card title="关联会话概览" size="small">
                  {currentProviderSessions.length > 0 ? (
                    <List
                      dataSource={currentProviderSessions}
                      renderItem={(session) => (
                        <List.Item>
                          <Space direction="vertical" size={4}>
                            <Space size={8} wrap>
                              <Text strong>{displaySessionName(session)}</Text>
                              <Tag color={sessionStateColor(session.active)}>{session.active ? '在线' : '离线'}</Tag>
                            </Space>
                            <Text>{sessionMetaLine(session)}</Text>
                            <Text type="secondary">账户 {session.account.username || session.account.id}</Text>
                            <Text type="secondary">最后活跃 {formatDateTime(session.lastActiveAt)}</Text>
                          </Space>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有命中的关联会话" />
                  )}
                </Card>
              </Col>
              <Col span={8}>
                <Card title="最近治理变更" size="small">
                  {currentProviderAuditLogs.length > 0 ? (
                    <List
                      size="small"
                      dataSource={currentProviderAuditLogs}
                      renderItem={(log) => (
                        <List.Item>
                          <Space direction="vertical" size={4}>
                            <Space size={8} wrap>
                              <Tag color="blue">{log.action}</Tag>
                              <Tag color={log.result === 'success' ? 'green' : log.result === 'failed' ? 'red' : 'gold'}>
                                {log.result}
                              </Tag>
                            </Space>
                            <Text>{log.targetType} / {log.targetId || '--'}</Text>
                            <Text type="secondary">{formatDateTime(log.createdAt)}</Text>
                          </Space>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有命中的治理变更" />
                  )}
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="当前缺口" size="small">
                  {currentProvider.missingCapabilities.length > 0 ? (
                    <List
                      size="small"
                      dataSource={currentProvider.missingCapabilities}
                      renderItem={(item) => <List.Item>{item}</List.Item>}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前基础信息已可见，后续再补治理动作。" />
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card title="核对建议" size="small">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="首要核对项">
                      {currentProvider.activeSessions > 0
                        ? '优先核对活跃会话使用的最新模型、账号归属和最近活跃时间。'
                        : '优先核对当前 Provider 是否已有接入账号，以及为何没有真实会话样本。'}
                    </Descriptions.Item>
                    <Descriptions.Item label="治理维度">
                      {currentProviderAuditLogs.length > 0
                        ? `当前窗口命中 ${currentProviderAuditLogs.length} 条治理记录，可继续到审计页深挖。`
                        : '当前窗口没有治理记录，后续可扩大审计窗口继续观察。'}
                    </Descriptions.Item>
                    <Descriptions.Item label="后续补强">
                      Agent 默认路由、限流策略和更细的健康探测后续再补专门聚合接口，本页先把真实会话和治理证据串起来。
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>
          </Space>
        ) : (
          <div className="state-block">
            <Empty description="请选择 Agent 查看详情" />
          </div>
        )}
      </Card>
    </Space>
  );
}

function providerLabel(value: string) {
  const labels: Record<string, string> = {
    wechat: '微信支付',
    alipay: '支付宝',
    stripe: 'Stripe',
    paypal: 'PayPal',
  };

  return labels[value] ?? value;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

function isProviderAudit(log: AdminAuditLog, provider: string) {
  if (log.targetId === provider) {
    return true;
  }

  if (log.action.includes('provider')) {
    return true;
  }

  const metadata = log.metadata;
  if (!metadata) {
    return false;
  }

  return Object.values(metadata).some((value) => String(value).toLowerCase() === provider);
}

function buildProviderSummary(provider: AdminProvider, orders: AdminOrder[], logs: AdminAuditLog[]): ProviderSummary {
  const providerOrders = orders.filter((order) => order.paymentMethod === provider.provider);
  const providerAudits = logs.filter((log) => isProviderAudit(log, provider.provider));
  const paidOrders = providerOrders.filter((order) => order.status === 'paid').length;
  const pendingOrders = providerOrders.filter((order) => order.status === 'pending').length;
  const failedOrders = providerOrders.filter((order) => ['failed', 'expired', 'refunded'].includes(order.status)).length;

  let status: ProviderStatus = 'pending';
  if (!provider.configured) {
    status = 'offline';
  } else if (failedOrders > paidOrders && providerOrders.length > 0) {
    status = 'attention';
  } else if (provider.isDefault || paidOrders > 0) {
    status = 'ready';
  }

  let summary = '已配置，当前窗口没有订单流量，可作为待验证通道继续观察。';
  if (!provider.configured) {
    summary = '当前未检测到配置，先保留为只读可见通道。';
  } else if (status === 'attention') {
    summary = `最近窗口内异常订单 ${failedOrders} 条，需优先复核支付链路。`;
  } else if (provider.isDefault) {
    summary = `当前默认支付通道，最近窗口订单 ${providerOrders.length} 条。`;
  } else if (providerOrders.length > 0) {
    summary = `最近窗口订单 ${providerOrders.length} 条，已支付 ${paidOrders} 条。`;
  }

  return {
    provider: provider.provider,
    configured: provider.configured,
    isDefault: provider.isDefault,
    totalOrders: providerOrders.length,
    paidOrders,
    pendingOrders,
    failedOrders,
    recentAuditCount: providerAudits.length,
    lastOrderAt: providerOrders[0]?.createdAt ?? null,
    lastAuditAt: providerAudits[0]?.createdAt ?? null,
    status,
    summary,
    audits: providerAudits.slice(0, 5),
  };
}

function statusColor(status: ProviderStatus) {
  if (status === 'ready') {
    return 'green';
  }
  if (status === 'attention') {
    return 'red';
  }
  if (status === 'pending') {
    return 'gold';
  }
  return 'default';
}

function statusLabel(status: ProviderStatus) {
  if (status === 'ready') {
    return '可用';
  }
  if (status === 'attention') {
    return '关注';
  }
  if (status === 'pending') {
    return '待验证';
  }
  return '未配置';
}

function loadErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '未知错误';
}

export function PaymentChannelsPage() {
  const [selectedProvider, setSelectedProvider] = React.useState<string | null>(null);

  const providersQuery = useQuery({
    queryKey: ['admin-providers'],
    queryFn: fetchAdminProviders,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const ordersQuery = useQuery({
    queryKey: ['admin-orders', 'payment-channels-page'],
    queryFn: fetchAdminOrders,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const auditQuery = useQuery({
    queryKey: ['admin-audit-logs', 'payment-channels-page'],
    queryFn: () => fetchAdminAuditLogs({ limit: 100 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const providerRows = providersQuery.data?.providers ?? [];
  const orders = ordersQuery.data?.orders ?? [];
  const logs = auditQuery.data?.logs ?? [];

  const providers = React.useMemo(
    () => providerRows.map((provider) => buildProviderSummary(provider, orders, logs)),
    [logs, orders, providerRows],
  );

  React.useEffect(() => {
    if (!selectedProvider && providers.length > 0) {
      setSelectedProvider(providers[0].provider);
    }
  }, [providers, selectedProvider]);

  const currentProvider =
    providers.find((provider) => provider.provider === selectedProvider) ??
    providers[0] ??
    null;

  const configuredCount = providers.filter((provider) => provider.configured).length;
  const attentionCount = providers.filter((provider) => provider.status === 'attention' || provider.status === 'offline').length;
  const defaultProvider = providers.find((provider) => provider.isDefault) ?? null;

  const hasError = providersQuery.isError || ordersQuery.isError || auditQuery.isError;
  const isLoading = providersQuery.isLoading || ordersQuery.isLoading || auditQuery.isLoading;

  return (
    <Space direction="vertical" size={24} style={{ display: 'flex' }}>
      <Card className="hero-card">
        <Row gutter={[16, 16]} align="middle">
          <Col span={14}>
            <Space direction="vertical" size={8}>
              <Tag color="geekblue">/operations/payment-channels</Tag>
              <Title level={2} style={{ margin: 0 }}>
                支付通道
              </Title>
              <Text type="secondary">
                当前页面先承接真实支付通道管理：主读 `GET /admin/providers`，再联动订单和审计接口，把默认值、配置状态、最近流量和最近变更放到同一页核对。
              </Text>
            </Space>
          </Col>
          <Col span={10}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="可见通道" value={providers.length} />
              </Col>
              <Col span={8}>
                <Statistic title="已配置" value={configuredCount} />
              </Col>
              <Col span={8}>
                <Statistic title="需关注" value={attentionCount} />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Card>
        <Space className="toolbar" size={12} wrap>
          <Space size={12} wrap>
            <Tag color="purple">默认通道 {defaultProvider ? providerLabel(defaultProvider.provider) : '未设置'}</Tag>
            <Tag color="blue">最近审计窗口 {logs.length}</Tag>
            <Tag color="cyan">最近订单窗口 {orders.length}</Tag>
          </Space>
          <Space>
            <Button
              onClick={() => {
                if (defaultProvider) {
                  setSelectedProvider(defaultProvider.provider);
                }
              }}
            >
              定位默认通道
            </Button>
            <Button
              onClick={() => {
                void providersQuery.refetch();
                void ordersQuery.refetch();
                void auditQuery.refetch();
              }}
            >
              刷新页面
            </Button>
          </Space>
        </Space>

        <Alert
          type="info"
          showIcon
          message="当前阶段说明"
          description="本页当前承接的真实对象是支付通道（微信支付、支付宝、Stripe、PayPal）；模型路由和会话级通道健康概览后续再做独立聚合。"
          style={{ marginBottom: 16 }}
        />

        {isLoading ? (
          <div className="state-block">
            <Spin />
          </div>
        ) : null}

        {hasError ? (
          <Alert
            type="error"
            showIcon
            message="支付通道数据加载失败"
            description={[
              providersQuery.isError ? `providers: ${loadErrorMessage(providersQuery.error)}` : null,
              ordersQuery.isError ? `orders: ${loadErrorMessage(ordersQuery.error)}` : null,
              auditQuery.isError ? `audit: ${loadErrorMessage(auditQuery.error)}` : null,
            ]
              .filter(Boolean)
              .join(' | ')}
          />
        ) : null}

        {!isLoading && !hasError && providers.length === 0 ? (
          <div className="state-block">
            <Empty description="当前没有可见的支付通道" />
          </div>
        ) : null}

        {!isLoading && !hasError && providers.length > 0 ? (
          <Row gutter={[16, 16]}>
            {providers.map((provider) => {
              const active = currentProvider?.provider === provider.provider;
              return (
                <Col key={provider.provider} xs={24} md={12}>
                  <Card
                    hoverable
                    className={active ? 'provider-summary-card provider-summary-card-active' : 'provider-summary-card'}
                    onClick={() => setSelectedProvider(provider.provider)}
                  >
                    <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                      <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <Title level={4} style={{ margin: 0 }}>
                          {providerLabel(provider.provider)}
                        </Title>
                        <Space size={8} wrap>
                          {provider.isDefault ? <Tag color="purple">默认</Tag> : null}
                          <Tag color={statusColor(provider.status)}>{statusLabel(provider.status)}</Tag>
                        </Space>
                      </Space>
                      <Text type="secondary">{provider.summary}</Text>
                      <Row gutter={12}>
                        <Col span={8}>
                          <Statistic title="最近订单" value={provider.totalOrders} />
                        </Col>
                        <Col span={8}>
                          <Statistic title="异常订单" value={provider.failedOrders} />
                        </Col>
                        <Col span={8}>
                          <Statistic title="相关审计" value={provider.recentAuditCount} />
                        </Col>
                      </Row>
                      <Space size={8} wrap>
                        <Tag color={provider.configured ? 'green' : 'default'}>
                          {provider.configured ? '已配置' : '未配置'}
                        </Tag>
                        <Tag>最近订单 {formatDateTime(provider.lastOrderAt)}</Tag>
                        <Tag>最近审计 {formatDateTime(provider.lastAuditAt)}</Tag>
                      </Space>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        ) : null}
      </Card>

      <Card title={currentProvider ? `${providerLabel(currentProvider.provider)} / 通道详情` : '通道详情'}>
        {currentProvider ? (
          <Space direction="vertical" size={16} style={{ display: 'flex' }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="支付通道">{providerLabel(currentProvider.provider)}</Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={statusColor(currentProvider.status)}>{statusLabel(currentProvider.status)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="默认通道">
                <Tag color={currentProvider.isDefault ? 'purple' : 'default'}>
                  {currentProvider.isDefault ? '是' : '否'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="配置状态">
                <Tag color={currentProvider.configured ? 'green' : 'default'}>
                  {currentProvider.configured ? '已配置' : '未配置'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="最近订单总数">{currentProvider.totalOrders}</Descriptions.Item>
              <Descriptions.Item label="最近已支付">{currentProvider.paidOrders}</Descriptions.Item>
              <Descriptions.Item label="最近待支付">{currentProvider.pendingOrders}</Descriptions.Item>
              <Descriptions.Item label="最近异常订单">{currentProvider.failedOrders}</Descriptions.Item>
              <Descriptions.Item label="最近相关审计">{currentProvider.recentAuditCount}</Descriptions.Item>
              <Descriptions.Item label="最近订单时间">{formatDateTime(currentProvider.lastOrderAt)}</Descriptions.Item>
              <Descriptions.Item label="最近审计时间" span={2}>
                {formatDateTime(currentProvider.lastAuditAt)}
              </Descriptions.Item>
              <Descriptions.Item label="健康摘要" span={2}>
                {currentProvider.summary}
              </Descriptions.Item>
            </Descriptions>

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="最近审计变更" size="small">
                  {currentProvider.audits.length > 0 ? (
                    <List
                      dataSource={currentProvider.audits}
                      renderItem={(log) => (
                        <List.Item>
                          <Space direction="vertical" size={4}>
                            <Space size={8} wrap>
                              <Tag color="blue">{log.action}</Tag>
                              <Tag color={log.result === 'success' ? 'green' : log.result === 'failed' ? 'red' : 'gold'}>
                                {log.result}
                              </Tag>
                            </Space>
                            <Text>{log.targetType} / {log.targetId || '--'}</Text>
                            <Text type="secondary">{formatDateTime(log.createdAt)}</Text>
                          </Space>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前通道没有相关审计" />
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card title="核对建议" size="small">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="首要核对项">
                      {currentProvider.isDefault ? '默认值是否符合当前运营口径，切换后是否留下审计记录。' : '作为非默认通道，重点核对配置是否完整以及最近是否有真实订单流量。'}
                    </Descriptions.Item>
                    <Descriptions.Item label="订单维度">
                      {currentProvider.totalOrders > 0 ? `最近窗口已有 ${currentProvider.totalOrders} 条真实订单，可继续对照订单页核对状态流转。` : '最近窗口没有订单，当前更适合做配置可见性核对。'}
                    </Descriptions.Item>
                    <Descriptions.Item label="后续补强">
                      模型能力、会话占用和更细的通道健康探测后续再补独立读模型，本页先把默认值、配置状态和支付侧真实数据看清楚。
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>
          </Space>
        ) : (
          <div className="state-block">
            <Empty description="请选择支付通道查看详情" />
          </div>
        )}
      </Card>
    </Space>
  );
}
