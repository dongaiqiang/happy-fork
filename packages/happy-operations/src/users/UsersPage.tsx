import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Input,
  List,
  Row,
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
  fetchAdminMachines,
  fetchAdminOrders,
  fetchAdminQuota,
  fetchAdminSessions,
  fetchAdminUsers,
  type AdminAuditLog,
  type AdminMachine,
  type AdminOrder,
  type AdminSession,
  type AdminUser,
} from '../api/admin';

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

function formatTier(tier: string) {
  return tier.toUpperCase();
}

function statusColor(status: string) {
  if (status === 'active') {
    return 'green';
  }

  if (status === 'free') {
    return 'default';
  }

  return 'gold';
}

function paymentStatusColor(status: string) {
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

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    paid: '已支付',
    pending: '待支付',
    failed: '支付失败',
    expired: '已过期',
    refunded: '已退款',
  };

  return labels[status] ?? status;
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

function toTimestamp(value: string | null) {
  if (!value) {
    return 0;
  }

  return new Date(value).getTime();
}

function latestActivityAt(user: AdminUser, machines: AdminMachine[], orders: AdminOrder[]) {
  return [user.updatedAt, ...machines.map((item) => item.lastActiveAt), ...orders.map((item) => item.updatedAt)]
    .filter(Boolean)
    .sort((left, right) => toTimestamp(right) - toTimestamp(left))[0] ?? null;
}

function userConnectionLabel(machines: AdminMachine[]) {
  if (machines.length === 0) {
    return '未连接设备';
  }

  const activeCount = machines.filter((item) => item.active).length;
  return activeCount > 0 ? `在线 ${activeCount}/${machines.length}` : '全部离线';
}

function userRiskLabel(machines: AdminMachine[], orders: AdminOrder[]) {
  const failedOrders = orders.filter((item) => item.status === 'failed' || item.status === 'refunded').length;
  const activeMachines = machines.filter((item) => item.active).length;

  if (failedOrders > 0 || (machines.length > 0 && activeMachines === 0)) {
    return '高';
  }

  if (orders.some((item) => item.status === 'pending' || item.status === 'expired')) {
    return '中';
  }

  return '低';
}

function userRiskColor(risk: string) {
  if (risk === '高') {
    return 'red';
  }

  if (risk === '中') {
    return 'gold';
  }

  return 'green';
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

function userSessionSummary(sessions: AdminSession[]) {
  if (sessions.length === 0) {
    return '无会话';
  }

  const activeCount = sessions.filter((session) => session.active).length;
  const latestModel = sessions.find((session) => session.model)?.model;
  const base = activeCount > 0 ? `在线 ${activeCount}/${sessions.length}` : `共 ${sessions.length} 条`;
  return latestModel ? `${base} / ${latestModel}` : base;
}

function isUserAudit(log: AdminAuditLog, userId: string) {
  if (log.targetId === userId) {
    return true;
  }

  if (!log.metadata) {
    return false;
  }

  return Object.values(log.metadata).some((value) => String(value) === userId);
}

export function UsersPage() {
  const [keyword, setKeyword] = React.useState('');
  const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null);

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchAdminUsers,
  });
  const sessionsSummaryQuery = useQuery({
    queryKey: ['admin-sessions', 'users-page'],
    queryFn: () => fetchAdminSessions({ limit: 100 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const quotaQuery = useQuery({
    queryKey: ['admin-user-quota', selectedUser?.id],
    queryFn: () => fetchAdminQuota(selectedUser!.id),
    enabled: Boolean(selectedUser?.id),
  });
  const sessionsQuery = useQuery({
    queryKey: ['admin-user-sessions', selectedUser?.id],
    queryFn: () => fetchAdminSessions({ accountId: selectedUser!.id, limit: 5 }),
    enabled: Boolean(selectedUser?.id),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const machinesQuery = useQuery({
    queryKey: ['admin-machines', 'users-page'],
    queryFn: fetchAdminMachines,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const ordersQuery = useQuery({
    queryKey: ['admin-orders', 'users-page'],
    queryFn: fetchAdminOrders,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const auditQuery = useQuery({
    queryKey: ['admin-audit-logs', 'users-page'],
    queryFn: () => fetchAdminAuditLogs({ limit: 100 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const users = usersQuery.data?.users ?? [];
  const userSessions = sessionsSummaryQuery.data?.sessions ?? [];
  const machines = machinesQuery.data?.machines ?? [];
  const orders = ordersQuery.data?.orders ?? [];
  const auditLogs = auditQuery.data?.logs ?? [];
  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredUsers = normalizedKeyword
    ? users.filter((user) => {
        const userMachines = machines.filter((machine) => machine.accountId === user.id);
        const userOrders = orders.filter((order) => order.account.id === user.id);
        const sessions = userSessions.filter((session) => session.account.id === user.id);
        const connection = userConnectionLabel(userMachines);
        const risk = userRiskLabel(userMachines, userOrders);
        const sessionSummary = userSessionSummary(sessions);
        return [user.id, user.username ?? '', user.subscription.tier, user.subscription.status, connection, risk, sessionSummary]
          .join(' ')
          .toLowerCase()
          .includes(normalizedKeyword);
      })
    : users;

  const selectedUserMachines = selectedUser ? machines.filter((machine) => machine.accountId === selectedUser.id) : [];
  const selectedUserOrders = selectedUser ? orders.filter((order) => order.account.id === selectedUser.id).slice(0, 5) : [];
  const selectedUserAudits = selectedUser ? auditLogs.filter((log) => isUserAudit(log, selectedUser.id)).slice(0, 5) : [];
  const selectedUserSessions = sessionsQuery.data?.sessions ?? [];

  const columns: ColumnsType<AdminUser> = [
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      render: (_, user) => (
        <Space direction="vertical" size={0}>
          <Text strong>{user.username || '未命名用户'}</Text>
          <Text type="secondary">{user.id}</Text>
        </Space>
      ),
    },
    {
      title: '套餐',
      dataIndex: ['subscription', 'tier'],
      key: 'tier',
      render: (value: string) => <Tag color="purple">{formatTier(value)}</Tag>,
    },
    {
      title: '订阅状态',
      dataIndex: ['subscription', 'status'],
      key: 'status',
      render: (value: string) => <Tag color={statusColor(value)}>{value}</Tag>,
    },
    {
      title: '到期时间',
      dataIndex: ['subscription', 'endDate'],
      key: 'endDate',
      render: (value: string | null) => formatDateTime(value),
    },
    {
      title: '设备数',
      key: 'machineCount',
      render: (_, user) => machines.filter((machine) => machine.accountId === user.id).length,
    },
    {
      title: '会话摘要',
      key: 'sessionSummary',
      render: (_, user) => {
        const sessions = userSessions.filter((session) => session.account.id === user.id);
        const activeCount = sessions.filter((session) => session.active).length;
        return (
          <Tag color={activeCount > 0 ? 'blue' : sessions.length > 0 ? 'default' : 'default'}>
            {userSessionSummary(sessions)}
          </Tag>
        );
      },
    },
    {
      title: '最近订单',
      key: 'orderCount',
      render: (_, user) => orders.filter((order) => order.account.id === user.id).length,
    },
    {
      title: '连接状态',
      key: 'connection',
      render: (_, user) => {
        const userMachines = machines.filter((machine) => machine.accountId === user.id);
        const label = userConnectionLabel(userMachines);
        const activeCount = userMachines.filter((machine) => machine.active).length;
        return <Tag color={activeCount > 0 ? 'green' : userMachines.length > 0 ? 'gold' : 'default'}>{label}</Tag>;
      },
    },
    {
      title: '风险等级',
      key: 'risk',
      render: (_, user) => {
        const userMachines = machines.filter((machine) => machine.accountId === user.id);
        const userOrders = orders.filter((order) => order.account.id === user.id);
        const risk = userRiskLabel(userMachines, userOrders);
        return <Tag color={userRiskColor(risk)}>{risk}</Tag>;
      },
    },
    {
      title: '最近活跃',
      key: 'recentActive',
      render: (_, user) => formatDateTime(latestActivityAt(user, machines.filter((item) => item.accountId === user.id), orders.filter((item) => item.account.id === user.id))),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, user) => (
        <Button type="link" onClick={() => setSelectedUser(user)}>
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
              <Tag color="purple">/operations/users</Tag>
              <Title level={2} style={{ margin: 0 }}>
                用户管理
              </Title>
              <Text type="secondary">
                当前页面围绕“用户”做真实串联：主表已补套餐、设备、会话摘要、风险和最近活跃，详情继续联动设备、会话、订单、审计和配额。
              </Text>
            </Space>
          </Col>
          <Col span={10}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="用户总数" value={users.length} />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Pro 套餐"
                  value={users.filter((user) => user.subscription.tier === 'pro').length}
                />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Card>
        <Space className="toolbar" size={12} wrap>
          <Search
            allowClear
            placeholder="按用户 ID、用户名、套餐、状态、连接状态、风险搜索"
            onSearch={setKeyword}
            onChange={(event) => setKeyword(event.target.value)}
            value={keyword}
            style={{ width: 360 }}
          />
          <Button
            onClick={() => {
              void usersQuery.refetch();
              void sessionsSummaryQuery.refetch();
              void machinesQuery.refetch();
              void ordersQuery.refetch();
              void auditQuery.refetch();
            }}
          >
            刷新页面
          </Button>
        </Space>

        {usersQuery.isLoading || sessionsSummaryQuery.isLoading || machinesQuery.isLoading || ordersQuery.isLoading || auditQuery.isLoading ? (
          <div className="state-block">
            <Spin />
          </div>
        ) : null}

        {usersQuery.isError || sessionsSummaryQuery.isError || machinesQuery.isError || ordersQuery.isError || auditQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="用户列表加载失败"
            description={[
              usersQuery.error instanceof Error ? `users: ${usersQuery.error.message}` : null,
              sessionsSummaryQuery.error instanceof Error ? `sessions: ${sessionsSummaryQuery.error.message}` : null,
              machinesQuery.error instanceof Error ? `machines: ${machinesQuery.error.message}` : null,
              ordersQuery.error instanceof Error ? `orders: ${ordersQuery.error.message}` : null,
              auditQuery.error instanceof Error ? `audit: ${auditQuery.error.message}` : null,
            ]
              .filter(Boolean)
              .join(' | ') || '未知错误'}
          />
        ) : null}

        {!usersQuery.isLoading && !sessionsSummaryQuery.isLoading && !machinesQuery.isLoading && !ordersQuery.isLoading && !auditQuery.isLoading &&
        !usersQuery.isError && !sessionsSummaryQuery.isError && !machinesQuery.isError && !ordersQuery.isError && !auditQuery.isError && filteredUsers.length === 0 ? (
          <div className="state-block">
            <Empty description="当前没有匹配的用户" />
          </div>
        ) : null}

        {!usersQuery.isLoading && !sessionsSummaryQuery.isLoading && !machinesQuery.isLoading && !ordersQuery.isLoading && !auditQuery.isLoading &&
        !usersQuery.isError && !sessionsSummaryQuery.isError && !machinesQuery.isError && !ordersQuery.isError && !auditQuery.isError && filteredUsers.length > 0 ? (
          <Table
            rowKey="id"
            className="users-table"
            dataSource={filteredUsers}
            columns={columns}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
          />
        ) : null}
      </Card>

      <Drawer
        title={selectedUser?.username || selectedUser?.id || '用户详情'}
        width={520}
        open={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        destroyOnClose
      >
        {selectedUser ? (
          <Space direction="vertical" size={16} style={{ display: 'flex' }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="用户 ID">{selectedUser.id}</Descriptions.Item>
              <Descriptions.Item label="用户名">{selectedUser.username || '未命名用户'}</Descriptions.Item>
              <Descriptions.Item label="套餐">
                <Tag color="purple">{formatTier(selectedUser.subscription.tier)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="订阅状态">
                <Tag color={statusColor(selectedUser.subscription.status)}>{selectedUser.subscription.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTime(selectedUser.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatDateTime(selectedUser.updatedAt)}</Descriptions.Item>
            </Descriptions>

            <Card title="配额详情">
              {quotaQuery.isLoading ? <Spin /> : null}
              {quotaQuery.isError ? (
                <Alert
                  type="error"
                  showIcon
                  message="配额详情加载失败"
                  description={quotaQuery.error instanceof Error ? quotaQuery.error.message : '未知错误'}
                />
              ) : null}
              {quotaQuery.data ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="当前套餐">{formatTier(quotaQuery.data.subscription.tier)}</Descriptions.Item>
                  <Descriptions.Item label="日额度">
                    {quotaQuery.data.quota.dailyUsed} / {quotaQuery.data.quota.dailyLimit}
                  </Descriptions.Item>
                  <Descriptions.Item label="月额度">
                    {quotaQuery.data.quota.monthlyUsed} / {quotaQuery.data.quota.monthlyLimit}
                  </Descriptions.Item>
                  <Descriptions.Item label="剩余日额度">{quotaQuery.data.quota.dailyRemaining}</Descriptions.Item>
                  <Descriptions.Item label="剩余月额度">{quotaQuery.data.quota.monthlyRemaining}</Descriptions.Item>
                  <Descriptions.Item label="下次到期">{formatDateTime(quotaQuery.data.subscription.endDate)}</Descriptions.Item>
                </Descriptions>
              ) : null}
            </Card>

            <Card title="关联设备">
              {selectedUserMachines.length > 0 ? (
                <List
                  dataSource={selectedUserMachines}
                  renderItem={(machine) => (
                    <List.Item>
                      <Space direction="vertical" size={4}>
                        <Space size={8} wrap>
                          <Text strong>{machine.id}</Text>
                          <Tag color={machine.active ? 'green' : 'default'}>{machine.active ? '在线' : '离线'}</Tag>
                        </Space>
                        <Text type="secondary">最后活跃 {formatDateTime(machine.lastActiveAt)}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前用户没有关联设备" />
              )}
            </Card>

            <Card title="最近会话">
              {sessionsQuery.isLoading ? <Spin /> : null}
              {sessionsQuery.isError ? (
                <Alert
                  type="error"
                  showIcon
                  message="最近会话加载失败"
                  description={sessionsQuery.error instanceof Error ? sessionsQuery.error.message : '未知错误'}
                />
              ) : null}
              {!sessionsQuery.isLoading && !sessionsQuery.isError ? (
                selectedUserSessions.length > 0 ? (
                  <List
                    dataSource={selectedUserSessions}
                    renderItem={(session) => (
                      <List.Item>
                        <Space direction="vertical" size={4}>
                          <Space size={8} wrap>
                            <Text strong>{displaySessionName(session)}</Text>
                            <Tag color={sessionStateColor(session.active)}>{session.active ? '在线' : '离线'}</Tag>
                            {session.pendingToolCalls > 0 ? <Tag color="gold">待处理工具 {session.pendingToolCalls}</Tag> : null}
                          </Space>
                          <Text>{sessionMetaLine(session)}</Text>
                          <Text type="secondary">
                            最后消息 {session.lastMessage || '--'}
                          </Text>
                          <Text type="secondary">
                            控制端 {session.controller || '--'} / 交接 {session.handoffState || '--'}
                          </Text>
                          <Text type="secondary">
                            路径 {session.path || '--'}
                          </Text>
                          <Text type="secondary">
                            最后消息时间 {formatDateTime(session.lastMessageAt)}
                          </Text>
                          <Text type="secondary">
                            最后活跃 {formatDateTime(session.lastActiveAt)}
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前用户没有可见会话" />
                )
              ) : null}
            </Card>

            <Card title="最近订单">
              {selectedUserOrders.length > 0 ? (
                <List
                  dataSource={selectedUserOrders}
                  renderItem={(order) => (
                    <List.Item>
                      <Space direction="vertical" size={4}>
                        <Space size={8} wrap>
                          <Text strong>{order.orderNo}</Text>
                          <Tag color="purple">{formatTier(order.tier)}</Tag>
                          <Tag color={paymentStatusColor(order.status)}>{paymentStatusLabel(order.status)}</Tag>
                        </Space>
                        <Text type="secondary">更新时间 {formatDateTime(order.updatedAt)}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前用户没有可见订单" />
              )}
            </Card>

            <Card title="最近审计">
              {selectedUserAudits.length > 0 ? (
                <List
                  dataSource={selectedUserAudits}
                  renderItem={(log) => (
                    <List.Item>
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
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前用户没有命中的审计记录" />
              )}
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
