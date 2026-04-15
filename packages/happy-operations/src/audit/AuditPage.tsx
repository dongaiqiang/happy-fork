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
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchAdminAuditLogs,
  fetchAdminMachines,
  fetchAdminOrders,
  fetchAdminUsers,
  type AdminAuditLog,
  type AdminMachine,
  type AdminOrder,
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

function resultColor(result: string) {
  if (result === 'success') {
    return 'green';
  }

  if (result === 'failed') {
    return 'red';
  }

  return 'gold';
}

function summarizeMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return '--';
  }

  const keys = Object.keys(metadata);
  return keys.length > 0 ? keys.join(', ') : '--';
}

function prettyJson(value: unknown) {
  if (!value) {
    return '--';
  }

  return JSON.stringify(value, null, 2);
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

function extractRelatedIds(log: AdminAuditLog) {
  const values = [
    log.targetId,
    ...(log.metadata ? Object.values(log.metadata).map((value) => String(value)) : []),
  ].filter(Boolean) as string[];
  return new Set(values);
}

function findRelatedUser(log: AdminAuditLog, users: AdminUser[], machines: AdminMachine[], orders: AdminOrder[]) {
  const ids = extractRelatedIds(log);
  const directUser = users.find((user) => ids.has(user.id));
  if (directUser) {
    return directUser;
  }

  const machine = machines.find((item) => ids.has(item.id));
  if (machine) {
    return users.find((user) => user.id === machine.accountId) ?? null;
  }

  const order = orders.find((item) => ids.has(item.id) || ids.has(item.orderNo));
  if (order) {
    return users.find((user) => user.id === order.account.id) ?? null;
  }

  return null;
}

function findRelatedMachine(log: AdminAuditLog, machines: AdminMachine[]) {
  const ids = extractRelatedIds(log);
  return machines.find((machine) => ids.has(machine.id)) ?? null;
}

function findRelatedOrder(log: AdminAuditLog, orders: AdminOrder[]) {
  const ids = extractRelatedIds(log);
  return orders.find((order) => ids.has(order.id) || ids.has(order.orderNo)) ?? null;
}

function eventSummary(log: AdminAuditLog) {
  const target = [log.targetType, log.targetId || '--'].join(' / ');
  return `${log.adminId} 对 ${target} 执行了 ${log.action}，结果为 ${log.result}${log.reason ? `，原因：${log.reason}` : ''}。`;
}

function queryValue(params: URLSearchParams, key: string) {
  return params.get(key)?.trim() ?? '';
}

function validTimeRange(value: string) {
  return ['24h', '3d', '7d', 'all'].includes(value) ? value : '7d';
}

export function AuditPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = React.useState(() => queryValue(searchParams, 'keyword'));
  const [timeRange, setTimeRange] = React.useState<string>(() => validTimeRange(queryValue(searchParams, 'timeRange')));
  const [actionFilter, setActionFilter] = React.useState<string | undefined>(() => {
    const value = queryValue(searchParams, 'action');
    return value || undefined;
  });
  const [resultFilter, setResultFilter] = React.useState<string | undefined>(() => {
    const value = queryValue(searchParams, 'result');
    return value || undefined;
  });
  const [targetTypeFilter, setTargetTypeFilter] = React.useState<string | undefined>(() => {
    const value = queryValue(searchParams, 'targetType');
    return value || undefined;
  });
  const [adminIdFilter, setAdminIdFilter] = React.useState<string | undefined>(() => {
    const value = queryValue(searchParams, 'adminId');
    return value || undefined;
  });
  const [selectedLogId, setSelectedLogId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setKeyword(queryValue(searchParams, 'keyword'));
    setTimeRange(validTimeRange(queryValue(searchParams, 'timeRange')));
    setActionFilter(queryValue(searchParams, 'action') || undefined);
    setResultFilter(queryValue(searchParams, 'result') || undefined);
    setTargetTypeFilter(queryValue(searchParams, 'targetType') || undefined);
    setAdminIdFilter(queryValue(searchParams, 'adminId') || undefined);
  }, [searchParams]);

  const auditQuery = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => fetchAdminAuditLogs({ limit: 100 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const usersQuery = useQuery({
    queryKey: ['admin-users', 'audit-page'],
    queryFn: fetchAdminUsers,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const machinesQuery = useQuery({
    queryKey: ['admin-machines', 'audit-page'],
    queryFn: fetchAdminMachines,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const ordersQuery = useQuery({
    queryKey: ['admin-orders', 'audit-page'],
    queryFn: fetchAdminOrders,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const logs = auditQuery.data?.logs ?? [];
  const users = usersQuery.data?.users ?? [];
  const machines = machinesQuery.data?.machines ?? [];
  const orders = ordersQuery.data?.orders ?? [];

  React.useEffect(() => {
    if (!selectedLogId && logs.length > 0) {
      setSelectedLogId(logs[0].id);
    }
  }, [logs, selectedLogId]);

  const actionOptions = React.useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).map((value) => ({ value, label: value })),
    [logs],
  );
  const resultOptions = React.useMemo(
    () => Array.from(new Set(logs.map((log) => log.result))).map((value) => ({ value, label: value })),
    [logs],
  );
  const targetTypeOptions = React.useMemo(
    () => Array.from(new Set(logs.map((log) => log.targetType))).map((value) => ({ value, label: value })),
    [logs],
  );
  const adminIdOptions = React.useMemo(
    () => Array.from(new Set(logs.map((log) => log.adminId))).map((value) => ({ value, label: value })),
    [logs],
  );

  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredLogs = logs.filter((log) => {
    if (actionFilter && log.action !== actionFilter) {
      return false;
    }
    if (resultFilter && log.result !== resultFilter) {
      return false;
    }
    if (targetTypeFilter && log.targetType !== targetTypeFilter) {
      return false;
    }
    if (adminIdFilter && log.adminId !== adminIdFilter) {
      return false;
    }
    if (!withinTimeWindow(log.createdAt, timeRange)) {
      return false;
    }
    if (!normalizedKeyword) {
      return true;
    }

    return [
      log.id,
      log.adminId,
      log.action,
      log.targetType,
      log.targetId ?? '',
      log.result,
      log.reason ?? '',
      prettyJson(log.metadata),
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedKeyword);
  });

  const selectedLog =
    filteredLogs.find((log) => log.id === selectedLogId) ??
    logs.find((log) => log.id === selectedLogId) ??
    filteredLogs[0] ??
    null;
  const relatedUser = selectedLog ? findRelatedUser(selectedLog, users, machines, orders) : null;
  const relatedMachine = selectedLog ? findRelatedMachine(selectedLog, machines) : null;
  const relatedOrder = selectedLog ? findRelatedOrder(selectedLog, orders) : null;

  const failedCount = logs.filter((log) => log.result === 'failed').length;
  const distinctAdmins = new Set(logs.map((log) => log.adminId)).size;
  const targetAccounts = logs.filter((log) => log.targetType === 'account').length;

  const columns: ColumnsType<AdminAuditLog> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '操作人',
      dataIndex: 'adminId',
      key: 'adminId',
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: '事件说明',
      key: 'summary',
      render: (_, log) => (
        <Space direction="vertical" size={0}>
          <Text>{log.action}</Text>
          <Text type="secondary">{`${log.targetType} / ${log.targetId || '--'}`}</Text>
        </Space>
      ),
    },
    {
      title: '动作类型',
      dataIndex: 'action',
      key: 'action',
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '对象类型',
      dataIndex: 'targetType',
      key: 'targetType',
    },
    {
      title: '对象 ID',
      dataIndex: 'targetId',
      key: 'targetId',
      render: (value: string | null) => value || '--',
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      render: (value: string) => <Tag color={resultColor(value)}>{value}</Tag>,
    },
    {
      title: '元数据摘要',
      dataIndex: 'metadata',
      key: 'metadata',
      render: (value: Record<string, unknown> | null) => summarizeMetadata(value),
    },
    {
      title: '操作',
      key: 'action-open',
      render: (_, log) => (
        <Button type="link" onClick={() => setSelectedLogId(log.id)}>
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
              <Tag color="volcano">/operations/audit</Tag>
              <Title level={2} style={{ margin: 0 }}>
                审计日志
              </Title>
              <Text type="secondary">
                当前页面围绕后台动作追踪和治理复核展开，直接读取 `GET /admin/audit/logs`，先把谁做了什么、打到哪个对象、结果如何看清楚。
              </Text>
            </Space>
          </Col>
          <Col span={10}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="当前窗口事件" value={logs.length} />
              </Col>
              <Col span={8}>
                <Statistic title="失败事件" value={failedCount} />
              </Col>
              <Col span={8}>
                <Statistic title="账户相关事件" value={targetAccounts} />
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
              placeholder="按操作人、动作、对象、原因、元数据搜索"
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
              placeholder="动作类型"
              value={actionFilter}
              onChange={setActionFilter}
              style={{ width: 220 }}
              options={actionOptions}
              showSearch
            />
            <Select
              allowClear
              placeholder="结果"
              value={resultFilter}
              onChange={setResultFilter}
              style={{ width: 132 }}
              options={resultOptions}
            />
            <Select
              allowClear
              placeholder="对象类型"
              value={targetTypeFilter}
              onChange={setTargetTypeFilter}
              style={{ width: 150 }}
              options={targetTypeOptions}
            />
            <Select
              allowClear
              placeholder="操作人"
              value={adminIdFilter}
              onChange={setAdminIdFilter}
              style={{ width: 180 }}
              options={adminIdOptions}
              showSearch
            />
          </Space>
          <Space>
            <Tag color="purple">可见操作人 {distinctAdmins}</Tag>
            <Button
              onClick={() => {
                void auditQuery.refetch();
                void usersQuery.refetch();
                void machinesQuery.refetch();
                void ordersQuery.refetch();
              }}
            >
              刷新页面
            </Button>
          </Space>
        </Space>

        {auditQuery.isLoading || usersQuery.isLoading || machinesQuery.isLoading || ordersQuery.isLoading ? (
          <div className="state-block">
            <Spin />
          </div>
        ) : null}

        {auditQuery.isError || usersQuery.isError || machinesQuery.isError || ordersQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="审计列表加载失败"
            description={[
              auditQuery.error instanceof Error ? `audit: ${auditQuery.error.message}` : null,
              usersQuery.error instanceof Error ? `users: ${usersQuery.error.message}` : null,
              machinesQuery.error instanceof Error ? `machines: ${machinesQuery.error.message}` : null,
              ordersQuery.error instanceof Error ? `orders: ${ordersQuery.error.message}` : null,
            ]
              .filter(Boolean)
              .join(' | ') || '未知错误'}
          />
        ) : null}

        {!auditQuery.isLoading && !usersQuery.isLoading && !machinesQuery.isLoading && !ordersQuery.isLoading &&
        !auditQuery.isError && !usersQuery.isError && !machinesQuery.isError && !ordersQuery.isError && filteredLogs.length === 0 ? (
          <div className="state-block">
            <Empty description="当前没有匹配的审计事件" />
          </div>
        ) : null}

        {!auditQuery.isLoading && !usersQuery.isLoading && !machinesQuery.isLoading && !ordersQuery.isLoading &&
        !auditQuery.isError && !usersQuery.isError && !machinesQuery.isError && !ordersQuery.isError && filteredLogs.length > 0 ? (
          <Table
            rowKey="id"
            className="users-table"
            dataSource={filteredLogs}
            columns={columns}
            pagination={{ pageSize: 10 }}
            onRow={(log) => ({
              onClick: () => setSelectedLogId(log.id),
            })}
          />
        ) : null}
      </Card>

      <Card title={selectedLog ? `${selectedLog.action} / 事件详情` : '事件详情'}>
        {selectedLog ? (
          <Space direction="vertical" size={16} style={{ display: 'flex' }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="事件 ID">{selectedLog.id}</Descriptions.Item>
              <Descriptions.Item label="时间">{formatDateTime(selectedLog.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="操作人">{selectedLog.adminId}</Descriptions.Item>
              <Descriptions.Item label="执行结果">
                <Tag color={resultColor(selectedLog.result)}>{selectedLog.result}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="动作类型">{selectedLog.action}</Descriptions.Item>
              <Descriptions.Item label="对象类型">{selectedLog.targetType}</Descriptions.Item>
              <Descriptions.Item label="对象 ID">{selectedLog.targetId || '--'}</Descriptions.Item>
              <Descriptions.Item label="失败原因">{selectedLog.reason || '--'}</Descriptions.Item>
            </Descriptions>

            <Card title="元数据" size="small">
              {selectedLog.metadata ? (
                <pre className="json-block">{prettyJson(selectedLog.metadata)}</pre>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前事件没有元数据" />
              )}
            </Card>

            <Card title="事件说明" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="上下文摘要">{eventSummary(selectedLog)}</Descriptions.Item>
                <Descriptions.Item label="可关联方向">
                  {relatedUser || relatedMachine || relatedOrder
                    ? '当前事件已识别出关联对象，可直接下钻到用户、设备或订单页继续复核。'
                    : '当前事件未识别出明确关联对象，可先结合元数据和对象类型继续人工排查。'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="关联对象" size="small">
              <List
                dataSource={[
                  {
                    key: 'user',
                    title: '关联用户',
                    value: relatedUser ? `${relatedUser.username || '未命名用户'} / ${relatedUser.id}` : '--',
                    action: relatedUser ? () => navigate('/operations/users') : null,
                    actionLabel: '打开用户页',
                  },
                  {
                    key: 'machine',
                    title: '关联机器',
                    value: relatedMachine ? `${String(relatedMachine.metadata.displayName ?? relatedMachine.id)} / ${relatedMachine.id}` : '--',
                    action: relatedMachine ? () => navigate('/operations/machines') : null,
                    actionLabel: '打开设备页',
                  },
                  {
                    key: 'order',
                    title: '关联订单/配额',
                    value: relatedOrder ? `${relatedOrder.orderNo} / ${relatedOrder.account.id}` : selectedLog.targetType.includes('quota') ? `${selectedLog.targetType} / ${selectedLog.targetId || '--'}` : '--',
                    action: relatedOrder ? () => navigate('/operations/orders') : null,
                    actionLabel: '打开订单页',
                  },
                ]}
                renderItem={(item) => (
                  <List.Item
                    actions={
                      item.action
                        ? [
                            <Button key={item.key} type="link" onClick={item.action}>
                              {item.actionLabel}
                            </Button>,
                          ]
                        : undefined
                    }
                  >
                    <List.Item.Meta title={item.title} description={item.value} />
                  </List.Item>
                )}
              />
            </Card>

            <Card title="上下文说明" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="元数据键">{summarizeMetadata(selectedLog.metadata)}</Descriptions.Item>
                <Descriptions.Item label="对象链路">
                  {[relatedUser?.id, relatedMachine?.id, relatedOrder?.orderNo].filter(Boolean).join(' -> ') || '--'}
                </Descriptions.Item>
                <Descriptions.Item label="复核建议">
                  {selectedLog.result === 'failed'
                    ? '优先核对失败原因、关联对象当前状态，以及是否需要回到用户/设备/订单页继续追踪。'
                    : '优先核对该动作是否已在目标对象页反映为预期状态。'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Space>
        ) : (
          <div className="state-block">
            <Empty description="请选择审计事件查看详情" />
          </div>
        )}
      </Card>
    </Space>
  );
}
