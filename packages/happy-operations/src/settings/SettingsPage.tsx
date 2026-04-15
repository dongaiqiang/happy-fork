import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  fetchAdminAuditLogs,
  fetchAdminAuthSession,
  fetchAdminOverview,
  fetchAdminProviders,
  type AdminAuditLog,
  type AdminProvider,
  updateAdminDefaultProvider,
} from '../api/admin';

const { Title, Text } = Typography;

type SettingsGroup = {
  key: string;
  title: string;
  summary: string;
  detail: string;
  currentValue: string;
  scope: string;
  risk: string;
  writable: boolean;
  recentChanges: AdminAuditLog[];
  tags: string[];
  linkedPages: Array<{
    label: string;
    path: string;
  }>;
  nextStep: string;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

function loadErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '未知错误';
}

function toAuditLabel(log: AdminAuditLog) {
  return `${log.action} / ${log.result} / ${formatDateTime(log.createdAt)}`;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [selectedGroupKey, setSelectedGroupKey] = React.useState<string>('base');
  const [defaultProviderDraft, setDefaultProviderDraft] = React.useState<AdminProvider['provider'] | null>(null);

  const authSessionQuery = useQuery({
    queryKey: ['admin-auth-session'],
    queryFn: fetchAdminAuthSession,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const overviewQuery = useQuery({
    queryKey: ['admin-overview', 'settings-page'],
    queryFn: fetchAdminOverview,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const providersQuery = useQuery({
    queryKey: ['admin-providers', 'settings-page'],
    queryFn: fetchAdminProviders,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const auditQuery = useQuery({
    queryKey: ['admin-audit-logs', 'settings-page'],
    queryFn: () => fetchAdminAuditLogs({ limit: 100 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const isLoading =
    authSessionQuery.isLoading || overviewQuery.isLoading || providersQuery.isLoading || auditQuery.isLoading;
  const hasError =
    authSessionQuery.isError || overviewQuery.isError || providersQuery.isError || auditQuery.isError;

  const authSession = authSessionQuery.data?.admin ?? null;
  const authDisabled = authSessionQuery.data?.authDisabled ?? false;
  const metrics = overviewQuery.data?.metrics ?? {
    accountsTotal: 0,
    machinesTotal: 0,
    activeMachines: 0,
    subscriptionsTotal: 0,
    activeSessions: 0,
    messagesTotal: 0,
  };
  const providerPayload = providersQuery.data ?? {
    success: true as const,
    providers: [],
    defaultProvider: null,
  };
  const auditLogs = auditQuery.data?.logs ?? [];
  const availableProviders = providerPayload.providers.map((provider) => provider.provider);

  const defaultProviderMutation = useMutation({
    mutationFn: (provider: AdminProvider['provider']) => updateAdminDefaultProvider(provider),
    onSuccess: async ({ provider }) => {
      messageApi.success(`默认支付通道已切换为 ${provider}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-providers'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] }),
      ]);
    },
    onError: (error: unknown) => {
      messageApi.error(loadErrorMessage(error));
    },
  });

  const governanceLogs = auditLogs.filter((log) =>
    ['admin.role.upsert', 'admin.provider.default.update', 'admin.login', 'admin.logout'].includes(log.action),
  );
  const providerChangeLogs = auditLogs.filter((log) => log.action === 'admin.provider.default.update');
  const authLogs = auditLogs.filter((log) => ['admin.login', 'admin.logout'].includes(log.action));

  const configuredProviders = providerPayload.providers.filter((provider) => provider.configured).length;
  const activeRatio =
    metrics.machinesTotal > 0 ? `${metrics.activeMachines}/${metrics.machinesTotal}` : `${metrics.activeMachines}/0`;

  const groups = React.useMemo<SettingsGroup[]>(
    () => [
      {
        key: 'base',
        title: '基础配置',
        summary: '后台登录态、运行主体和当前开放方式。',
        detail: '首版直接承接 `/admin/auth/session` 的真实登录态结果，说明后台当前是谁在操作、鉴权是否关闭、当前会话源自哪里。',
        currentValue: authSession
          ? `${authSession.id} / ${authSession.roles.join(', ')} / ${authDisabled ? '免鉴权' : '需鉴权'}`
          : '--',
        scope: '后台自身 / 全局生效',
        risk: authDisabled ? '当前后台鉴权关闭，适合联调但不适合作为正式长期口径。' : '当前后台鉴权已开启。',
        writable: false,
        recentChanges: authLogs.slice(0, 5),
        tags: [authDisabled ? '免鉴权' : '需鉴权', authSession?.source || 'source 未知'],
        linkedPages: [
          { label: '打开审计页', path: '/operations/audit' },
          { label: '打开驾驶舱页', path: '/operations' },
        ],
        nextStep: authDisabled ? '优先回到审计页核对登录/登出记录，再评估是否恢复鉴权。' : '优先确认后台登录态来源和最近审计是否一致。',
      },
      {
        key: 'default-strategy',
        title: '默认策略',
        summary: '支付默认通道和当前配置状态。',
        detail: '优先承接 `/admin/providers` 的真实结果，把默认支付通道、各通道配置情况和是否仍为空状态集中查看。',
        currentValue:
          providerPayload.defaultProvider !== null
            ? `默认 ${providerPayload.defaultProvider}`
            : `未设置默认通道 / 已配置 ${configuredProviders} 个`,
        scope: '支付侧 / 影响下单默认路径',
        risk:
          providerPayload.defaultProvider === null
            ? '当前没有默认支付通道，若后续接正式支付需补齐默认值与凭证配置。'
            : '默认支付通道已设置，仍需继续核对最近变更是否留下审计。',
        writable: providerPayload.providers.length > 0,
        recentChanges: providerChangeLogs.slice(0, 5),
        tags: providerPayload.providers.map((provider) =>
          `${provider.provider}:${provider.configured ? '已配' : '未配'}`,
        ),
        linkedPages: [
          { label: '打开支付通道页', path: '/operations/payment-channels' },
          { label: '打开订单页', path: '/operations/orders' },
          { label: '打开审计页', path: '/operations/audit' },
        ],
        nextStep: '先核对默认支付通道是否符合当前运营口径，再到支付通道页和审计页复核最近变更。',
      },
      {
        key: 'environment',
        title: '环境状态',
        summary: '当前运行规模、在线度和链路活跃度。',
        detail: '直接承接 `/admin/overview`，先看账号数、设备活跃度、会话活跃度和消息规模，避免系统配置页变成纯说明文档。',
        currentValue: `账号 ${metrics.accountsTotal} / 设备活跃 ${activeRatio} / 活跃会话 ${metrics.activeSessions}`,
        scope: '运行态 / 当前环境',
        risk:
          metrics.activeSessions === 0
            ? '当前没有活跃会话，需先确认设备链路是否正常。'
            : metrics.activeMachines === 0
              ? '当前没有活跃设备，需优先核对设备在线链路。'
              : '当前已存在真实在线设备和活跃会话。',
        writable: false,
        recentChanges: auditLogs.slice(0, 5),
        tags: [`messages:${metrics.messagesTotal}`, `subscriptions:${metrics.subscriptionsTotal}`],
        linkedPages: [
          { label: '打开驾驶舱页', path: '/operations' },
          { label: '打开设备页', path: '/operations/machines' },
          { label: '打开用户页', path: '/operations/users' },
        ],
        nextStep: '先看驾驶舱总体风险，再根据设备活跃度和会话活跃度下钻到设备页或用户页排查。',
      },
      {
        key: 'release-gate',
        title: '发布与闸门',
        summary: '哪些能力已经真实接通，哪些仍处于只读承接。',
        detail: '本轮以真实运行现状做闸门面板，不补伪开关。重点明确 Agent 管理、支付通道和后台登录态哪些只是可见，哪些已有真实数据承接。',
        currentValue: [
          `Agent 管理: ${metrics.activeSessions > 0 ? '已有真实会话' : '当前没有真实会话样本'}`,
          `支付通道: ${configuredProviders > 0 ? '已有配置' : '仅只读空态'}`,
          `后台登录: ${authDisabled ? '联调开放' : '受鉴权保护'}`,
        ].join(' / '),
        scope: '交付闸门 / 当前版本',
        risk: '该分组当前主要用于看清真实接通程度，不支持直接切闸或在线修改。',
        writable: false,
        recentChanges: governanceLogs.slice(0, 5),
        tags: ['只读承接', '后续补写'],
        linkedPages: [
          { label: '打开 Agent 管理页', path: '/operations/providers' },
          { label: '打开支付通道页', path: '/operations/payment-channels' },
          { label: '打开审计页', path: '/operations/audit' },
        ],
        nextStep: '逐项核对哪些模块已有真实数据承接，哪些还只是只读可见，再决定后续补写顺序。',
      },
      {
        key: 'governance',
        title: '权限与治理',
        summary: '后台治理动作和最近配置改动记录。',
        detail: '优先复用真实审计流，把角色写入、默认通道切换、登录登出等配置治理动作汇总在这里，便于核对谁改了什么。',
        currentValue: `最近治理动作 ${governanceLogs.length} 条 / 操作主体 ${authSession?.id || '--'}`,
        scope: '后台治理 / 审计可追溯',
        risk:
          governanceLogs.length === 0
            ? '当前窗口内没有治理动作，后续可继续扩大查询窗口。'
            : '已有治理动作记录，可继续联动审计页做追溯。',
        writable: false,
        recentChanges: governanceLogs.slice(0, 8),
        tags: authSession?.roles ?? [],
        linkedPages: [
          { label: '打开审计页', path: '/operations/audit' },
          { label: '打开系统配置页', path: '/operations/settings' },
        ],
        nextStep: '优先核对最近治理动作的主体、对象和结果，再到审计页继续追踪完整上下文。',
      },
    ],
    [
      activeRatio,
      auditLogs,
      authDisabled,
      authLogs,
      authSession,
      configuredProviders,
      governanceLogs,
      metrics,
      providerChangeLogs,
      providerPayload.defaultProvider,
      providerPayload.providers,
    ],
  );

  React.useEffect(() => {
    if (!groups.some((group) => group.key === selectedGroupKey)) {
      setSelectedGroupKey(groups[0]?.key ?? 'base');
    }
  }, [groups, selectedGroupKey]);

  React.useEffect(() => {
    if (!defaultProviderDraft || !availableProviders.includes(defaultProviderDraft)) {
      setDefaultProviderDraft(providerPayload.defaultProvider ?? providerPayload.providers[0]?.provider ?? null);
    }
  }, [availableProviders, defaultProviderDraft, providerPayload.defaultProvider, providerPayload.providers]);

  const currentGroup = groups.find((group) => group.key === selectedGroupKey) ?? groups[0] ?? null;
  const canSubmitDefaultProvider =
    currentGroup?.key === 'default-strategy' &&
    defaultProviderDraft !== null &&
    defaultProviderDraft !== providerPayload.defaultProvider;

  return (
    <>
      {messageContextHolder}
      <Space direction="vertical" size={24} style={{ display: 'flex' }}>
      <Card className="hero-card">
        <Row gutter={[16, 16]} align="middle">
          <Col span={16}>
            <Space direction="vertical" size={8}>
              <Tag color="cyan">/operations/settings</Tag>
              <Title level={2} style={{ margin: 0 }}>
                系统配置
              </Title>
              <Text type="secondary">
                先把后台自身的系统策略、环境信息和配置治理看清楚，再逐步补写能力。当前页面全部承接真实管理员接口，不做空壳设置页。
              </Text>
            </Space>
          </Col>
          <Col span={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                type={authDisabled ? 'warning' : 'success'}
                showIcon
                message={authDisabled ? '当前后台仍处于联调开放态' : '当前后台鉴权已开启'}
                description={
                  currentGroup
                    ? `${currentGroup.title} 当前为${currentGroup.writable ? '可改' : '只读承接'}口径。`
                    : '当前系统配置页已接入真实数据。'
                }
              />
              <Button
                onClick={() => {
                  void authSessionQuery.refetch();
                  void overviewQuery.refetch();
                  void providersQuery.refetch();
                  void auditQuery.refetch();
                }}
              >
                刷新页面
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {isLoading ? (
        <div className="state-block">
          <Spin />
        </div>
      ) : null}

      {hasError ? (
        <Alert
          type="error"
          showIcon
          message="系统配置数据加载失败"
          description={[
            authSessionQuery.isError ? `authSession: ${loadErrorMessage(authSessionQuery.error)}` : null,
            overviewQuery.isError ? `overview: ${loadErrorMessage(overviewQuery.error)}` : null,
            providersQuery.isError ? `providers: ${loadErrorMessage(providersQuery.error)}` : null,
            auditQuery.isError ? `audit: ${loadErrorMessage(auditQuery.error)}` : null,
          ]
            .filter(Boolean)
            .join(' | ')}
        />
      ) : null}

      {!isLoading && !hasError ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={8}>
            <Card title="配置分组">
              <List
                dataSource={groups}
                renderItem={(group) => {
                  const active = currentGroup?.key === group.key;
                  return (
                    <List.Item
                      className={active ? 'settings-group-item settings-group-item-active' : 'settings-group-item'}
                      onClick={() => setSelectedGroupKey(group.key)}
                    >
                      <Space direction="vertical" size={4} style={{ display: 'flex', width: '100%' }}>
                        <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                          <Text strong>{group.title}</Text>
                          <Tag color={group.writable ? 'green' : 'default'}>{group.writable ? '可改' : '只读'}</Tag>
                        </Space>
                        <Text type="secondary">{group.summary}</Text>
                        <Space size={8} wrap>
                          {group.tags.length > 0 ? group.tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : <Tag>未标记</Tag>}
                        </Space>
                      </Space>
                    </List.Item>
                  );
                }}
              />
            </Card>
          </Col>
          <Col xs={24} xl={16}>
            <Card title={currentGroup ? `${currentGroup.title} / 详情区` : '详情区'}>
              {currentGroup ? (
                <Space direction="vertical" size={16} style={{ display: 'flex' }}>
                  <Descriptions column={2} bordered size="small">
                    <Descriptions.Item label="配置说明" span={2}>
                      {currentGroup.detail}
                    </Descriptions.Item>
                    <Descriptions.Item label="当前值" span={2}>
                      {currentGroup.currentValue}
                    </Descriptions.Item>
                    <Descriptions.Item label="生效范围">{currentGroup.scope}</Descriptions.Item>
                    <Descriptions.Item label="是否支持后台修改">
                      <Tag color={currentGroup.writable ? 'green' : 'default'}>
                        {currentGroup.writable ? '支持' : '暂不支持'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="风险提示" span={2}>
                      {currentGroup.risk}
                    </Descriptions.Item>
                  </Descriptions>

                  {currentGroup.key === 'default-strategy' ? (
                    <Card title="后台写动作" size="small">
                      <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                        <Text type="secondary">
                          当前直接调用真实 `POST /admin/providers/default`，切换完成后会刷新支付通道与审计数据。
                        </Text>
                        <Space wrap>
                          <Select
                            style={{ minWidth: 220 }}
                            value={defaultProviderDraft ?? undefined}
                            placeholder="选择默认支付通道"
                            options={providerPayload.providers.map((provider) => ({
                              value: provider.provider,
                              label: `${provider.provider} / ${provider.configured ? '已配置' : '未配置'}`,
                            }))}
                            onChange={(value: AdminProvider['provider']) => setDefaultProviderDraft(value)}
                            disabled={providerPayload.providers.length === 0 || defaultProviderMutation.isPending}
                          />
                          <Button
                            type="primary"
                            onClick={() => {
                              if (defaultProviderDraft) {
                                defaultProviderMutation.mutate(defaultProviderDraft);
                              }
                            }}
                            disabled={!canSubmitDefaultProvider}
                            loading={defaultProviderMutation.isPending}
                          >
                            更新默认支付通道
                          </Button>
                        </Space>
                        <Alert
                          type={providerPayload.defaultProvider ? 'success' : 'warning'}
                          showIcon
                          message={
                            providerPayload.defaultProvider
                              ? `当前默认支付通道：${providerPayload.defaultProvider}`
                              : '当前尚未设置默认支付通道'
                          }
                          description="写入后会同步写审计日志，支付通道页和系统配置页刷新后会看到最新结果。"
                        />
                      </Space>
                    </Card>
                  ) : null}

                  <Card title="关联工作台" size="small">
                    <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                      <Text type="secondary">{currentGroup.nextStep}</Text>
                      <Space size={8} wrap>
                        {currentGroup.linkedPages.map((item) => (
                          <Button key={item.path} onClick={() => navigate(item.path)}>
                            {item.label}
                          </Button>
                        ))}
                      </Space>
                    </Space>
                  </Card>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                      <Card title="最近变更" size="small">
                        {currentGroup.recentChanges.length > 0 ? (
                          <List
                            dataSource={currentGroup.recentChanges}
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
                                  <Text type="secondary">{toAuditLabel(log)}</Text>
                                </Space>
                              </List.Item>
                            )}
                          />
                        ) : (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前分组没有可见的最近变更" />
                        )}
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card title="变更提示区" size="small">
                        <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                          <Alert
                            type={currentGroup.writable ? 'success' : 'info'}
                            showIcon
                            message={currentGroup.writable ? '当前支持后台修改' : '当前只读承接'}
                            description={
                              currentGroup.writable
                                ? '本分组后续可以继续补写后台修改动作。'
                                : '当前优先把真实运行信息和配置现状看清楚，不直接在本页写入。'
                            }
                          />
                          <Alert
                            type="warning"
                            showIcon
                            message="后续补强"
                            description="如果后端后续补齐专门的管理员配置读接口，这里继续替换为更细的真实配置项，不保留演示字段。"
                          />
                        </Space>
                      </Card>
                    </Col>
                  </Row>
                </Space>
              ) : (
                <div className="state-block">
                  <Empty description="请选择配置分组查看详情" />
                </div>
              )}
            </Card>
          </Col>
        </Row>
      ) : null}
      </Space>
    </>
  );
}
