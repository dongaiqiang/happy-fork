import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
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
  fetchAdminOrders,
  fetchAdminOverview,
  type AdminAuditLog,
  type AdminOrder,
} from '../api/admin';

const { Title, Text } = Typography;

function buildQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    const normalized = value?.trim();
    if (normalized) {
      query.set(key, normalized);
    }
  });
  const search = query.toString();
  return search ? `?${search}` : '';
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

function formatMoney(amountCents: number, currency: string) {
  return `${(amountCents / 100).toFixed(2)} ${currency}`;
}

function paymentMethodLabel(value: string) {
  const labels: Record<string, string> = {
    stripe: 'Stripe',
    paypal: 'PayPal',
    wechat: '微信支付',
    alipay: '支付宝',
  };

  return labels[value] ?? value;
}

function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    paid: '已支付',
    pending: '待支付',
    failed: '支付失败',
    expired: '已过期',
    refunded: '已退款',
  };

  return labels[status] ?? status;
}

function orderStatusColor(status: string) {
  if (status === 'paid') {
    return 'green';
  }
  if (status === 'pending') {
    return 'gold';
  }
  if (status === 'failed' || status === 'expired' || status === 'refunded') {
    return 'red';
  }
  return 'default';
}

function auditResultColor(result: string) {
  if (result === 'success') {
    return 'green';
  }
  if (result === 'failed') {
    return 'red';
  }
  return 'gold';
}

function loadErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '未知错误';
}

export function OperationsPage() {
  const navigate = useNavigate();

  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: fetchAdminOverview,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const ordersQuery = useQuery({
    queryKey: ['admin-orders', 'operations-dashboard'],
    queryFn: fetchAdminOrders,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const auditQuery = useQuery({
    queryKey: ['admin-audit-logs', 'operations-dashboard'],
    queryFn: () => fetchAdminAuditLogs({ limit: 20 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const metrics = overviewQuery.data?.metrics ?? {
    accountsTotal: 0,
    machinesTotal: 0,
    activeMachines: 0,
    subscriptionsTotal: 0,
    activeSessions: 0,
    messagesTotal: 0,
  };
  const orders = ordersQuery.data?.orders ?? [];
  const auditLogs = auditQuery.data?.logs ?? [];

  const isLoading = overviewQuery.isLoading || ordersQuery.isLoading || auditQuery.isLoading;
  const hasError = overviewQuery.isError || ordersQuery.isError || auditQuery.isError;

  const abnormalOrders = React.useMemo(
    () => orders.filter((order) => order.status !== 'paid').slice(0, 5),
    [orders],
  );
  const recentOrders = React.useMemo(() => orders.slice(0, 5), [orders]);
  const failedAudits = React.useMemo(
    () => auditLogs.filter((log) => log.result === 'failed').slice(0, 5),
    [auditLogs],
  );
  const recentAudits = React.useMemo(() => auditLogs.slice(0, 5), [auditLogs]);

  const offlineMachines = Math.max(metrics.machinesTotal - metrics.activeMachines, 0);
  const paidTodayCount = orders.filter((order) => order.status === 'paid').length;
  const highRiskEvents = abnormalOrders.length + failedAudits.length;
  const pendingActions = [
    abnormalOrders.length > 0 ? `待处理订单 ${abnormalOrders.length} 条` : null,
    failedAudits.length > 0 ? `失败审计 ${failedAudits.length} 条` : null,
    offlineMachines > 0 ? `离线设备 ${offlineMachines} 台` : null,
    metrics.activeSessions === 0 ? '当前没有活跃会话' : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <Space direction="vertical" size={24} style={{ display: 'flex' }}>
      <Card className="hero-card">
        <Row gutter={[16, 16]} align="middle">
          <Col span={16}>
            <Space direction="vertical" size={8}>
              <Tag color="purple">/operations</Tag>
              <Title level={2} style={{ margin: 0 }}>
                经营驾驶舱
              </Title>
              <Text type="secondary">
                首页先回答三个问题：平台现在是否健康、今天先处理什么、从哪里进入具体工作台。当前直接联 `GET /admin/overview`、`GET /admin/orders`、`GET /admin/audit/logs`。
              </Text>
            </Space>
          </Col>
          <Col span={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                type={highRiskEvents > 0 || offlineMachines > 0 ? 'warning' : 'success'}
                showIcon
                message={highRiskEvents > 0 || offlineMachines > 0 ? '当前存在待处理风险' : '当前核心链路平稳'}
                description={
                  pendingActions.length > 0 ? pendingActions.join('，') : '当前未发现待处理订单、失败审计或离线设备。'
                }
              />
              <Button
                onClick={() => {
                  void overviewQuery.refetch();
                  void ordersQuery.refetch();
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
          message="经营驾驶舱数据加载失败"
          description={[
            overviewQuery.isError ? `overview: ${loadErrorMessage(overviewQuery.error)}` : null,
            ordersQuery.isError ? `orders: ${loadErrorMessage(ordersQuery.error)}` : null,
            auditQuery.isError ? `audit: ${loadErrorMessage(auditQuery.error)}` : null,
          ]
            .filter(Boolean)
            .join(' | ')}
        />
      ) : null}

      {!isLoading && !hasError ? (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8} xl={4}>
              <Card hoverable className="dashboard-link-card" onClick={() => navigate('/operations/users')}>
                <Statistic title="总用户" value={metrics.accountsTotal} />
              </Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card
                hoverable
                className="dashboard-link-card"
                onClick={() => navigate(`/operations/machines${buildQuery({ status: 'active' })}`)}
              >
                <Statistic title="在线设备" value={metrics.activeMachines} />
              </Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card>
                <Statistic title="活跃会话" value={metrics.activeSessions} />
              </Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card
                hoverable
                className="dashboard-link-card"
                onClick={() => navigate(`/operations/machines${buildQuery({ status: 'inactive' })}`)}
              >
                <Statistic title="异常设备" value={offlineMachines} />
              </Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card
                hoverable
                className="dashboard-link-card"
                onClick={() => navigate(`/operations/orders${buildQuery({ status: 'paid', timeRange: '24h' })}`)}
              >
                <Statistic title="今日订单" value={paidTodayCount} />
              </Card>
            </Col>
            <Col xs={24} md={8} xl={4}>
              <Card
                hoverable
                className="dashboard-link-card"
                onClick={() => navigate(`/operations/audit${buildQuery({ result: 'failed', timeRange: '7d' })}`)}
              >
                <Statistic title="高风险事件" value={highRiskEvents} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <Card title="今日待处理 / 风险账号">
                {abnormalOrders.length > 0 ? (
                  <List
                    dataSource={abnormalOrders}
                    renderItem={(order) => (
                      <OrderRiskItem
                        order={order}
                        onOpen={() =>
                          navigate(
                            `/operations/orders${buildQuery({ status: order.status, timeRange: '7d', keyword: order.orderNo })}`,
                          )
                        }
                      />
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有待处理订单风险" />
                )}
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card title="今日待处理 / 掉线设备与失败审计">
                <Space direction="vertical" size={16} style={{ display: 'flex' }}>
                  <Alert
                    type={offlineMachines > 0 ? 'warning' : 'success'}
                    showIcon
                    message={offlineMachines > 0 ? `当前离线设备 ${offlineMachines} 台` : '当前没有离线设备'}
                    description={`设备总数 ${metrics.machinesTotal}，在线设备 ${metrics.activeMachines}，活跃会话 ${metrics.activeSessions}。`}
                  />
                  {failedAudits.length > 0 ? (
                    <List
                      dataSource={failedAudits}
                      renderItem={(log) => (
                        <AuditRiskItem
                          log={log}
                          onOpen={() =>
                            navigate(
                              `/operations/audit${buildQuery({
                                result: 'failed',
                                timeRange: '7d',
                                keyword: log.targetId ?? undefined,
                              })}`,
                            )
                          }
                        />
                      )}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有失败审计事件" />
                  )}
                </Space>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <Card title="最近订单变化">
                {recentOrders.length > 0 ? (
                  <List
                    dataSource={recentOrders}
                    renderItem={(order) => (
                      <RecentOrderItem
                        order={order}
                        onOpen={() =>
                          navigate(`/operations/orders${buildQuery({ timeRange: '7d', keyword: order.orderNo })}`)
                        }
                      />
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有订单变化" />
                )}
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card title="最近审计事件">
                {recentAudits.length > 0 ? (
                  <List
                    dataSource={recentAudits}
                    renderItem={(log) => (
                      <RecentAuditItem
                        log={log}
                        onOpen={() =>
                          navigate(
                            `/operations/audit${buildQuery({ timeRange: '7d', keyword: log.targetId ?? undefined })}`,
                          )
                        }
                      />
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有审计事件" />
                )}
              </Card>
            </Col>
          </Row>

          <Card title="快捷入口">
            <Row gutter={[12, 12]}>
              {[
                { path: '/operations/users', label: '用户管理', hint: `当前共 ${metrics.accountsTotal} 个用户可核对` },
                { path: '/operations/machines', label: '设备管理', hint: `在线 ${metrics.activeMachines} / 总计 ${metrics.machinesTotal}` },
                { path: '/operations/quota', label: '配额与套餐', hint: `当前共 ${metrics.subscriptionsTotal} 个订阅计划` },
                { path: '/operations/orders', label: '订单与计费', hint: `最近窗口 ${orders.length} 条订单变化` },
                { path: '/operations/audit', label: '审计日志', hint: `最近窗口 ${auditLogs.length} 条审计事件` },
                { path: '/operations/providers', label: 'Agent 管理', hint: '查看编程 Agent、会话样本与接入状态' },
                { path: '/operations/payment-channels', label: '支付通道', hint: '查看默认支付通道与配置状态' },
                  { path: '/operations/settings', label: '系统配置', hint: '查看配置分组、治理动作与下钻入口' },
              ].map((item) => (
                <Col key={item.path} xs={24} md={12} xl={8}>
                  <Card hoverable className="dashboard-link-card" onClick={() => navigate(item.path)}>
                    <Space direction="vertical" size={4}>
                      <Text strong>{item.label}</Text>
                      <Text type="secondary">{item.hint}</Text>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </>
      ) : null}
    </Space>
  );
}

function OrderRiskItem({ order, onOpen }: { order: AdminOrder; onOpen: () => void }) {
  return (
    <List.Item
      actions={[
        <Button key="open" type="link" onClick={onOpen}>
          打开订单页
        </Button>,
      ]}
    >
      <Space direction="vertical" size={4}>
        <Space size={8} wrap>
          <Text strong>{order.orderNo}</Text>
          <Tag color={orderStatusColor(order.status)}>{orderStatusLabel(order.status)}</Tag>
          <Tag>{paymentMethodLabel(order.paymentMethod)}</Tag>
        </Space>
        <Text>
          {order.account.username || '未命名用户'} / {order.account.id}
        </Text>
        <Text type="secondary">
          {formatMoney(order.amountCents, order.currency)} · {formatDateTime(order.updatedAt)}
        </Text>
      </Space>
    </List.Item>
  );
}

function AuditRiskItem({ log, onOpen }: { log: AdminAuditLog; onOpen: () => void }) {
  return (
    <List.Item
      actions={[
        <Button key="open" type="link" onClick={onOpen}>
          打开审计页
        </Button>,
      ]}
    >
      <Space direction="vertical" size={4}>
        <Space size={8} wrap>
          <Tag color="red">{log.action}</Tag>
          <Tag color={auditResultColor(log.result)}>{log.result}</Tag>
        </Space>
        <Text>
          {log.targetType} / {log.targetId || '--'}
        </Text>
        <Text type="secondary">{formatDateTime(log.createdAt)}</Text>
      </Space>
    </List.Item>
  );
}

function RecentOrderItem({ order, onOpen }: { order: AdminOrder; onOpen: () => void }) {
  return (
    <List.Item
      actions={[
        <Button key="open" type="link" onClick={onOpen}>
          打开订单页
        </Button>,
      ]}
    >
      <Space direction="vertical" size={4}>
        <Space size={8} wrap>
          <Text strong>{order.orderNo}</Text>
          <Tag color={orderStatusColor(order.status)}>{orderStatusLabel(order.status)}</Tag>
        </Space>
        <Text>
          {order.account.username || '未命名用户'} / {order.tier.toUpperCase()} / {paymentMethodLabel(order.paymentMethod)}
        </Text>
        <Text type="secondary">{formatDateTime(order.updatedAt)}</Text>
      </Space>
    </List.Item>
  );
}

function RecentAuditItem({ log, onOpen }: { log: AdminAuditLog; onOpen: () => void }) {
  return (
    <List.Item
      actions={[
        <Button key="open" type="link" onClick={onOpen}>
          打开审计页
        </Button>,
      ]}
    >
      <Space direction="vertical" size={4}>
        <Space size={8} wrap>
          <Tag color="blue">{log.action}</Tag>
          <Tag color={auditResultColor(log.result)}>{log.result}</Tag>
        </Space>
        <Text>
          {log.targetType} / {log.targetId || '--'}
        </Text>
        <Text type="secondary">{formatDateTime(log.createdAt)}</Text>
      </Space>
    </List.Item>
  );
}
