import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  List,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  fetchAdminAuditLogs,
  fetchAdminOrders,
  fetchAdminQuota,
  type AdminAuditLog,
  type AdminOrder,
} from '../api/admin';
import { useNavigate, useSearchParams } from 'react-router-dom';

const { Search } = Input;
const { Title, Text } = Typography;

function formatDateTime(value: string | null) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

function withinTimeWindow(value: string, range: string) {
  if (range === 'all') {
    return true;
  }

  const timestamp = new Date(value).getTime();
  const hoursMap: Record<string, number> = {
    '24h': 24,
    '3d': 72,
    '7d': 168,
  };
  const hours = hoursMap[range];
  if (!hours) {
    return true;
  }

  return Date.now() - timestamp <= hours * 60 * 60 * 1000;
}

function formatTier(tier: string) {
  return tier.toUpperCase();
}

function formatBillingPeriod(value: string) {
  if (value === 'monthly') {
    return '月付';
  }

  if (value === 'annual') {
    return '年付';
  }

  return value;
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

function statusColor(status: string) {
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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    paid: '已支付',
    pending: '待支付',
    failed: '支付失败',
    expired: '已过期',
    refunded: '已退款',
  };

  return labels[status] ?? status;
}

function formatMoney(amountCents: number, currency: string) {
  return `${(amountCents / 100).toFixed(2)} ${currency}`;
}

function refundStatusLabel(order: AdminOrder) {
  return order.status === 'refunded' ? '已退款' : '未退款';
}

function refundStatusColor(order: AdminOrder) {
  return order.status === 'refunded' ? 'red' : 'default';
}

function extractAuditValues(log: AdminAuditLog) {
  return new Set(
    [log.targetId, ...(log.metadata ? Object.values(log.metadata).map((value) => String(value)) : [])].filter(Boolean) as string[],
  );
}

function isOrderAudit(log: AdminAuditLog, order: AdminOrder) {
  const values = extractAuditValues(log);
  return (
    values.has(order.id) ||
    values.has(order.orderNo) ||
    (order.providerRef ? values.has(order.providerRef) : false) ||
    log.targetType === 'payment_order'
  );
}

function isQuotaAudit(log: AdminAuditLog, accountId: string) {
  return log.action.startsWith('admin.quota.') && log.targetId === accountId;
}

function auditEventSummary(log: AdminAuditLog) {
  return `${log.action} / ${log.targetType} / ${log.targetId || '--'}`;
}

function queryValue(params: URLSearchParams, key: string) {
  return params.get(key)?.trim() ?? '';
}

function validTimeRange(value: string) {
  return ['24h', '3d', '7d', 'all'].includes(value) ? value : '7d';
}

function validOptionalValue(value: string, allowed: string[]) {
  return allowed.includes(value) ? value : undefined;
}

export function OrdersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = React.useState(() => queryValue(searchParams, 'keyword'));
  const [timeRange, setTimeRange] = React.useState<string>(() => validTimeRange(queryValue(searchParams, 'timeRange')));
  const [statusFilter, setStatusFilter] = React.useState<string | undefined>(() =>
    validOptionalValue(queryValue(searchParams, 'status'), ['pending', 'paid', 'failed', 'expired', 'refunded']),
  );
  const [paymentFilter, setPaymentFilter] = React.useState<string | undefined>(() =>
    validOptionalValue(queryValue(searchParams, 'payment'), ['wechat', 'alipay', 'stripe', 'paypal']),
  );
  const [tierFilter, setTierFilter] = React.useState<string | undefined>(() =>
    validOptionalValue(queryValue(searchParams, 'tier'), ['student', 'pro', 'team', 'enterprise']),
  );
  const [refundFilter, setRefundFilter] = React.useState<string | undefined>(() =>
    validOptionalValue(queryValue(searchParams, 'refund'), ['refunded', 'not_refunded']),
  );
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setKeyword(queryValue(searchParams, 'keyword'));
    setTimeRange(validTimeRange(queryValue(searchParams, 'timeRange')));
    setStatusFilter(validOptionalValue(queryValue(searchParams, 'status'), ['pending', 'paid', 'failed', 'expired', 'refunded']));
    setPaymentFilter(validOptionalValue(queryValue(searchParams, 'payment'), ['wechat', 'alipay', 'stripe', 'paypal']));
    setTierFilter(validOptionalValue(queryValue(searchParams, 'tier'), ['student', 'pro', 'team', 'enterprise']));
    setRefundFilter(validOptionalValue(queryValue(searchParams, 'refund'), ['refunded', 'not_refunded']));
  }, [searchParams]);

  const ordersQuery = useQuery({
    queryKey: ['admin-orders'],
    queryFn: fetchAdminOrders,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const auditQuery = useQuery({
    queryKey: ['admin-audit-logs', 'orders-page'],
    queryFn: () => fetchAdminAuditLogs({ limit: 100 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const orders = ordersQuery.data?.orders ?? [];
  const auditLogs = auditQuery.data?.logs ?? [];

  React.useEffect(() => {
    if (!selectedOrderId && orders.length > 0) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredOrders = orders.filter((order) => {
    if (!withinTimeWindow(order.createdAt, timeRange)) {
      return false;
    }
    if (statusFilter && order.status !== statusFilter) {
      return false;
    }
    if (paymentFilter && order.paymentMethod !== paymentFilter) {
      return false;
    }
    if (tierFilter && order.tier !== tierFilter) {
      return false;
    }
    if (refundFilter === 'refunded' && order.status !== 'refunded') {
      return false;
    }
    if (refundFilter === 'not_refunded' && order.status === 'refunded') {
      return false;
    }
    if (!normalizedKeyword) {
      return true;
    }

    return [
      order.orderNo,
      order.account.id,
      order.account.username ?? '',
      order.tier,
      order.status,
      order.paymentMethod,
      order.providerRef ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedKeyword);
  });

  const selectedOrder =
    filteredOrders.find((order) => order.id === selectedOrderId) ??
    orders.find((order) => order.id === selectedOrderId) ??
    filteredOrders[0] ??
    null;

  const quotaQuery = useQuery({
    queryKey: ['admin-order-account-quota', selectedOrder?.account.id],
    queryFn: () => fetchAdminQuota(selectedOrder!.account.id),
    enabled: Boolean(selectedOrder?.account.id),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const selectedOrderAuditLogs = selectedOrder
    ? auditLogs.filter((log) => isOrderAudit(log, selectedOrder)).slice(0, 5)
    : [];
  const selectedQuotaAuditLogs = selectedOrder
    ? auditLogs.filter((log) => isQuotaAudit(log, selectedOrder.account.id)).slice(0, 5)
    : [];

  const paidOrders = orders.filter((order) => order.status === 'paid');
  const reviewOrders = orders.filter((order) => order.status !== 'paid');
  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.amountCents, 0);

  const columns: ColumnsType<AdminOrder> = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      render: (_, order) => (
        <Space direction="vertical" size={0}>
          <Text strong>{order.orderNo}</Text>
          <Text type="secondary">{order.id}</Text>
        </Space>
      ),
    },
    {
      title: '用户',
      key: 'account',
      render: (_, order) => (
        <Space direction="vertical" size={0}>
          <Text>{order.account.username || '未命名用户'}</Text>
          <Text type="secondary">{order.account.id}</Text>
        </Space>
      ),
    },
    {
      title: '套餐',
      dataIndex: 'tier',
      key: 'tier',
      render: (value: string) => <Tag color="purple">{formatTier(value)}</Tag>,
    },
    {
      title: '金额',
      key: 'amount',
      render: (_, order) => formatMoney(order.amountCents, order.currency),
    },
    {
      title: '支付方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (value: string) => paymentMethodLabel(value),
    },
    {
      title: '支付状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => <Tag color={statusColor(value)}>{statusLabel(value)}</Tag>,
    },
    {
      title: '退款状态',
      key: 'refundStatus',
      render: (_, order) => <Tag color={refundStatusColor(order)}>{refundStatusLabel(order)}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '支付时间',
      dataIndex: 'paidAt',
      key: 'paidAt',
      render: (value: string | null) => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, order) => (
        <Button type="link" onClick={() => setSelectedOrderId(order.id)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={24} style={{ display: 'flex' }}>
      <Card className="hero-card">
        <Row gutter={[16, 16]} align="middle">
          <Col span={14}>
            <Space direction="vertical" size={8}>
              <Tag color="cyan">/operations/orders</Tag>
              <Title level={2} style={{ margin: 0 }}>
                订单与计费
              </Title>
              <Text type="secondary">
                当前页面以真实订单核对为中心，前端直接读取 `GET /admin/orders`，并串联 `GET /admin/audit/logs` 与账户配额快照，先把支付状态、退款状态和关联处置链路看清楚。
              </Text>
            </Space>
          </Col>
          <Col span={10}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="可见订单" value={orders.length} />
              </Col>
              <Col span={8}>
                <Statistic title="待复核订单" value={reviewOrders.length} />
              </Col>
              <Col span={8}>
                <Statistic title="已支付金额" value={Number((totalRevenue / 100).toFixed(2))} precision={2} suffix="CNY" />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Card>
        <Space className="toolbar" size={12} wrap>
          <Space size={12} wrap>
            <Search
              allowClear
              placeholder="按订单号、用户、套餐、支付方式搜索"
              onSearch={setKeyword}
              onChange={(event) => setKeyword(event.target.value)}
              value={keyword}
              style={{ width: 320 }}
            />
            <Select
              value={timeRange}
              onChange={setTimeRange}
              style={{ width: 140 }}
              options={[
                { value: '24h', label: '最近 24 小时' },
                { value: '3d', label: '最近 3 天' },
                { value: '7d', label: '最近 7 天' },
                { value: 'all', label: '全部时间' },
              ]}
            />
            <Select
              allowClear
              placeholder="订单状态"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 132 }}
              options={[
                { value: 'pending', label: '待支付' },
                { value: 'paid', label: '已支付' },
                { value: 'failed', label: '支付失败' },
                { value: 'expired', label: '已过期' },
                { value: 'refunded', label: '已退款' },
              ]}
            />
            <Select
              allowClear
              placeholder="支付方式"
              value={paymentFilter}
              onChange={setPaymentFilter}
              style={{ width: 132 }}
              options={[
                { value: 'wechat', label: '微信支付' },
                { value: 'alipay', label: '支付宝' },
                { value: 'stripe', label: 'Stripe' },
                { value: 'paypal', label: 'PayPal' },
              ]}
            />
            <Select
              allowClear
              placeholder="套餐类型"
              value={tierFilter}
              onChange={setTierFilter}
              style={{ width: 132 }}
              options={[
                { value: 'student', label: 'STUDENT' },
                { value: 'pro', label: 'PRO' },
                { value: 'team', label: 'TEAM' },
                { value: 'enterprise', label: 'ENTERPRISE' },
              ]}
            />
            <Select
              allowClear
              placeholder="退款状态"
              value={refundFilter}
              onChange={setRefundFilter}
              style={{ width: 132 }}
              options={[
                { value: 'refunded', label: '已退款' },
                { value: 'not_refunded', label: '未退款' },
              ]}
            />
          </Space>
          <Button
            onClick={() => {
              void ordersQuery.refetch();
              void auditQuery.refetch();
              if (selectedOrder?.account.id) {
                void quotaQuery.refetch();
              }
            }}
          >
            刷新页面
          </Button>
        </Space>

        {ordersQuery.isLoading || auditQuery.isLoading ? (
          <div className="state-block">
            <Spin />
          </div>
        ) : null}

        {ordersQuery.isError || auditQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="订单列表加载失败"
            description={[
              ordersQuery.error instanceof Error ? `orders: ${ordersQuery.error.message}` : null,
              auditQuery.error instanceof Error ? `audit: ${auditQuery.error.message}` : null,
            ]
              .filter(Boolean)
              .join(' | ') || '未知错误'}
          />
        ) : null}

        {!ordersQuery.isLoading && !auditQuery.isLoading && !ordersQuery.isError && !auditQuery.isError && filteredOrders.length === 0 ? (
          <div className="state-block">
            <Empty description="当前没有匹配的订单" />
          </div>
        ) : null}

        {!ordersQuery.isLoading && !auditQuery.isLoading && !ordersQuery.isError && !auditQuery.isError && filteredOrders.length > 0 ? (
          <Table
            rowKey="id"
            className="users-table"
            dataSource={filteredOrders}
            columns={columns}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            onRow={(order) => ({
              onClick: () => setSelectedOrderId(order.id),
            })}
          />
        ) : null}
      </Card>

      <Card title={selectedOrder ? `${selectedOrder.orderNo} / 订单详情` : '订单详情'}>
        {selectedOrder ? (
          <Space direction="vertical" size={16} style={{ display: 'flex' }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="订单号">{selectedOrder.orderNo}</Descriptions.Item>
              <Descriptions.Item label="订单主键">{selectedOrder.id}</Descriptions.Item>
              <Descriptions.Item label="用户">{selectedOrder.account.username || '未命名用户'}</Descriptions.Item>
              <Descriptions.Item label="账户 ID">{selectedOrder.account.id}</Descriptions.Item>
              <Descriptions.Item label="套餐">
                <Tag color="purple">{formatTier(selectedOrder.tier)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="计费周期">{formatBillingPeriod(selectedOrder.billingPeriod)}</Descriptions.Item>
              <Descriptions.Item label="支付方式">{paymentMethodLabel(selectedOrder.paymentMethod)}</Descriptions.Item>
              <Descriptions.Item label="支付状态">
                <Tag color={statusColor(selectedOrder.status)}>{statusLabel(selectedOrder.status)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="退款状态">
                <Tag color={refundStatusColor(selectedOrder)}>{refundStatusLabel(selectedOrder)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="订单金额">{formatMoney(selectedOrder.amountCents, selectedOrder.currency)}</Descriptions.Item>
              <Descriptions.Item label="支付参考号">{selectedOrder.providerRef || '--'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTime(selectedOrder.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="支付时间">{formatDateTime(selectedOrder.paidAt)}</Descriptions.Item>
              <Descriptions.Item label="到期时间">{formatDateTime(selectedOrder.expiresAt)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatDateTime(selectedOrder.updatedAt)}</Descriptions.Item>
            </Descriptions>

            <Card title="关联对象" size="small">
              <List
                dataSource={[
                  {
                    key: 'user',
                    title: '关联用户',
                    value: `${selectedOrder.account.username || '未命名用户'} / ${selectedOrder.account.id}`,
                    action: () => navigate('/operations/users'),
                    actionLabel: '打开用户页',
                  },
                  {
                    key: 'quota',
                    title: '关联配额',
                    value: quotaQuery.data
                      ? `${formatTier(quotaQuery.data.subscription.tier)} / ${quotaQuery.data.subscription.status}`
                      : '等待加载',
                    action: () => navigate('/operations/quota'),
                    actionLabel: '打开配额页',
                  },
                  {
                    key: 'audit',
                    title: '关联审计',
                    value:
                      selectedOrderAuditLogs.length > 0 || selectedQuotaAuditLogs.length > 0
                        ? `订单事件 ${selectedOrderAuditLogs.length} / 配额事件 ${selectedQuotaAuditLogs.length}`
                        : '当前未命中',
                    action: () => navigate('/operations/audit'),
                    actionLabel: '打开审计页',
                  },
                ]}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button key={item.key} type="link" onClick={item.action}>
                        {item.actionLabel}
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta title={item.title} description={item.value} />
                  </List.Item>
                )}
              />
            </Card>

            <Card title="关联账户当前权益" size="small">
              {quotaQuery.isLoading ? <Spin /> : null}
              {quotaQuery.isError ? (
                <Alert
                  type="error"
                  showIcon
                  message="关联配额加载失败"
                  description={quotaQuery.error instanceof Error ? quotaQuery.error.message : '未知错误'}
                />
              ) : null}
              {quotaQuery.data ? (
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="当前套餐">{formatTier(quotaQuery.data.subscription.tier)}</Descriptions.Item>
                  <Descriptions.Item label="订阅状态">{quotaQuery.data.subscription.status}</Descriptions.Item>
                  <Descriptions.Item label="日额度">
                    {quotaQuery.data.quota.dailyUsed} / {quotaQuery.data.quota.dailyLimit}
                  </Descriptions.Item>
                  <Descriptions.Item label="月额度">
                    {quotaQuery.data.quota.monthlyUsed} / {quotaQuery.data.quota.monthlyLimit}
                  </Descriptions.Item>
                  <Descriptions.Item label="剩余日额度">{quotaQuery.data.quota.dailyRemaining}</Descriptions.Item>
                  <Descriptions.Item label="剩余月额度">{quotaQuery.data.quota.monthlyRemaining}</Descriptions.Item>
                  <Descriptions.Item label="当前速率限制">{quotaQuery.data.quota.rateLimit}</Descriptions.Item>
                  <Descriptions.Item label="当前存储上限">{quotaQuery.data.quota.storageLimit}</Descriptions.Item>
                </Descriptions>
              ) : null}
            </Card>

            <Card title="关联配额变更" size="small">
              {selectedQuotaAuditLogs.length > 0 ? (
                <List
                  dataSource={selectedQuotaAuditLogs}
                  renderItem={(log) => (
                    <List.Item>
                      <Space direction="vertical" size={4}>
                        <Space size={8} wrap>
                          <Tag color="blue">{log.action}</Tag>
                          <Tag color={log.result === 'success' ? 'green' : 'red'}>{log.result}</Tag>
                        </Space>
                        <Text>{auditEventSummary(log)}</Text>
                        <Text type="secondary">{formatDateTime(log.createdAt)}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前订单账户没有命中的配额变更审计" />
              )}
            </Card>

            <Card title="关联审计事件" size="small">
              {selectedOrderAuditLogs.length > 0 ? (
                <List
                  dataSource={selectedOrderAuditLogs}
                  renderItem={(log) => (
                    <List.Item>
                      <Space direction="vertical" size={4}>
                        <Space size={8} wrap>
                          <Tag color="blue">{log.action}</Tag>
                          <Tag color={log.result === 'success' ? 'green' : 'red'}>{log.result}</Tag>
                        </Space>
                        <Text>{auditEventSummary(log)}</Text>
                        <Text type="secondary">{formatDateTime(log.createdAt)}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前订单没有命中的审计事件" />
              )}
            </Card>

            <Card title="上下文说明" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="核对建议">
                  {selectedOrder.status === 'paid'
                    ? '优先核对账户权益是否已同步到当前套餐与额度。'
                    : selectedOrder.status === 'refunded'
                      ? '优先核对退款后的账户权益、配额和关联审计是否一致。'
                      : '优先核对失败原因、支付参考号和后续是否需要进入审计页继续追踪。'}
                </Descriptions.Item>
                <Descriptions.Item label="关联链路">
                  {[selectedOrder.account.id, selectedOrder.orderNo, selectedOrder.providerRef].filter(Boolean).join(' -> ') || '--'}
                </Descriptions.Item>
                <Descriptions.Item label="最近审计命中">
                  {selectedOrderAuditLogs[0] ? formatDateTime(selectedOrderAuditLogs[0].createdAt) : '--'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Alert
              type="info"
              showIcon
              message="当前阶段说明"
              description="本页当前先把真实订单、退款状态、关联账户权益和命中的审计链路串起来；更细的退款时间线和财务对账后续再补。"
            />
          </Space>
        ) : (
          <div className="state-block">
            <Empty description="请选择订单查看详情" />
          </div>
        )}
      </Card>
    </Space>
  );
}
