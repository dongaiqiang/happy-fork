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
  fetchAdminSessions,
  fetchAdminUsers,
  type AdminAuditLog,
  type AdminMachine,
  type AdminSession,
  type AdminUser,
} from '../api/admin';
import { useSearchParams } from 'react-router-dom';

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

function formatMachineStatus(active: boolean) {
  return active ? '在线' : '离线';
}

function formatMachineId(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function metadataValue(machine: AdminMachine, key: string) {
  const metadata = machine.metadata && typeof machine.metadata === 'object' ? machine.metadata : {};
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value : '--';
}

function daemonValue(machine: AdminMachine, key: string) {
  const daemonState = machine.daemonState && typeof machine.daemonState === 'object' ? machine.daemonState : {};
  const value = daemonState[key];
  if (typeof value === 'number') {
    return String(value);
  }
  return typeof value === 'string' && value.trim() ? value : '--';
}

function findMachineSessions(machine: AdminMachine, sessions: AdminSession[]) {
  const host = metadataValue(machine, 'host');
  return sessions.filter((session) => {
    if (session.machineId === machine.id) {
      return true;
    }
    if (session.account.id !== machine.accountId) {
      return false;
    }
    return host !== '--' && session.host === host;
  });
}

function recentDirectories(sessions: AdminSession[]) {
  return [...new Set(sessions.map((session) => session.path).filter((path): path is string => Boolean(path)))].slice(0, 5);
}

function isMachineAudit(log: AdminAuditLog, machineId: string) {
  if (log.targetId === machineId) {
    return true;
  }

  if (!log.metadata) {
    return false;
  }

  return Object.values(log.metadata).some((value) => String(value) === machineId);
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

function queryValue(params: URLSearchParams, key: string) {
  return params.get(key)?.trim() ?? '';
}

function validStatus(value: string) {
  return value === 'active' || value === 'inactive' ? value : undefined;
}

function MachineDetail({ machine, user }: { machine: AdminMachine; user?: AdminUser }) {
  return (
    <Descriptions column={1} bordered size="small">
      <Descriptions.Item label="设备 ID">{machine.id}</Descriptions.Item>
      <Descriptions.Item label="展示名">{metadataValue(machine, 'displayName')}</Descriptions.Item>
      <Descriptions.Item label="所属用户">{user?.username || '未命名用户'}</Descriptions.Item>
      <Descriptions.Item label="所属账户 ID">{machine.accountId}</Descriptions.Item>
      <Descriptions.Item label="主机">{metadataValue(machine, 'host')}</Descriptions.Item>
      <Descriptions.Item label="平台">{metadataValue(machine, 'platform')}</Descriptions.Item>
      <Descriptions.Item label="CLI 版本">
        {metadataValue(machine, 'happyCliVersion') !== '--'
          ? metadataValue(machine, 'happyCliVersion')
          : daemonValue(machine, 'startedWithCliVersion')}
      </Descriptions.Item>
      <Descriptions.Item label="设备状态">
        <Tag color={machine.active ? 'green' : 'default'}>{formatMachineStatus(machine.active)}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="最后活跃时间">{formatDateTime(machine.lastActiveAt)}</Descriptions.Item>
      <Descriptions.Item label="创建时间">{formatDateTime(machine.createdAt)}</Descriptions.Item>
      <Descriptions.Item label="更新时间">{formatDateTime(machine.updatedAt)}</Descriptions.Item>
    </Descriptions>
  );
}

export function MachinesPage() {
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = React.useState(() => queryValue(searchParams, 'keyword'));
  const [statusFilter, setStatusFilter] = React.useState<'active' | 'inactive' | undefined>(() =>
    validStatus(queryValue(searchParams, 'status')),
  );
  const [selectedMachine, setSelectedMachine] = React.useState<AdminMachine | null>(null);

  React.useEffect(() => {
    setKeyword(queryValue(searchParams, 'keyword'));
    setStatusFilter(validStatus(queryValue(searchParams, 'status')));
  }, [searchParams]);

  const machinesQuery = useQuery({
    queryKey: ['admin-machines'],
    queryFn: fetchAdminMachines,
  });

  const usersQuery = useQuery({
    queryKey: ['admin-users-lookup'],
    queryFn: fetchAdminUsers,
  });
  const sessionsQuery = useQuery({
    queryKey: ['admin-sessions', 'machines-page'],
    queryFn: () => fetchAdminSessions({ limit: 100 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const auditQuery = useQuery({
    queryKey: ['admin-audit-logs', 'machines-page'],
    queryFn: () => fetchAdminAuditLogs({ limit: 100 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const machines = machinesQuery.data?.machines ?? [];
  const users = usersQuery.data?.users ?? [];
  const sessions = sessionsQuery.data?.sessions ?? [];
  const auditLogs = auditQuery.data?.logs ?? [];
  const userMap = React.useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const normalizedKeyword = keyword.trim().toLowerCase();

  const filteredMachines = normalizedKeyword
    ? machines.filter((machine) => {
        const user = userMap.get(machine.accountId);
        if (statusFilter === 'active' && !machine.active) {
          return false;
        }
        if (statusFilter === 'inactive' && machine.active) {
          return false;
        }
        return [
          machine.id,
          machine.accountId,
          user?.username ?? '',
          metadataValue(machine, 'displayName'),
          metadataValue(machine, 'host'),
          metadataValue(machine, 'platform'),
          metadataValue(machine, 'happyCliVersion'),
          machine.active ? '在线 active' : '离线 inactive',
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedKeyword);
      })
    : machines.filter((machine) => {
        if (statusFilter === 'active') {
          return machine.active;
        }
        if (statusFilter === 'inactive') {
          return !machine.active;
        }
        return true;
      });

  const selectedUser = selectedMachine ? userMap.get(selectedMachine.accountId) : undefined;
  const selectedMachineSessions = selectedMachine ? findMachineSessions(selectedMachine, sessions).slice(0, 5) : [];
  const selectedMachineAudits = selectedMachine ? auditLogs.filter((log) => isMachineAudit(log, selectedMachine.id)).slice(0, 5) : [];
  const selectedDirectories = recentDirectories(selectedMachineSessions);
  const activeCount = machines.filter((machine) => machine.active).length;
  const offlineCount = machines.length - activeCount;

  const columns: ColumnsType<AdminMachine> = [
    {
      title: '设备',
      dataIndex: 'id',
      key: 'id',
      render: (value: string) => (
        <Space direction="vertical" size={0}>
          <Text strong>{formatMachineId(value)}</Text>
          <Text type="secondary">{value}</Text>
        </Space>
      ),
    },
    {
      title: '设备信息',
      key: 'machineInfo',
      render: (_, machine) => (
        <Space direction="vertical" size={0}>
          <Text strong>{metadataValue(machine, 'displayName') !== '--' ? metadataValue(machine, 'displayName') : formatMachineId(machine.id)}</Text>
          <Text type="secondary">
            {metadataValue(machine, 'host')} / {metadataValue(machine, 'platform')}
          </Text>
        </Space>
      ),
    },
    {
      title: '所属用户',
      dataIndex: 'accountId',
      key: 'accountId',
      render: (value: string) => {
        const user = userMap.get(value);
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{user?.username || '未命名用户'}</Text>
            <Text type="secondary">{value}</Text>
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'active',
      key: 'active',
      render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{formatMachineStatus(value)}</Tag>,
    },
    {
      title: 'CLI / Daemon',
      key: 'runtime',
      render: (_, machine) => (
        <Space direction="vertical" size={0}>
          <Text>{metadataValue(machine, 'happyCliVersion')}</Text>
          <Text type="secondary">PID {daemonValue(machine, 'pid')}</Text>
        </Space>
      ),
    },
    {
      title: '最后活跃时间',
      dataIndex: 'lastActiveAt',
      key: 'lastActiveAt',
      render: (value: string | null) => formatDateTime(value),
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
      render: (_, machine) => (
        <Button type="link" onClick={() => setSelectedMachine(machine)}>
          查看详情
        </Button>
      ),
    },
  ];

  const isLoading = machinesQuery.isLoading || usersQuery.isLoading || sessionsQuery.isLoading || auditQuery.isLoading;
  const hasError = machinesQuery.isError || usersQuery.isError || sessionsQuery.isError || auditQuery.isError;
  const errorMessage =
    (machinesQuery.error instanceof Error && machinesQuery.error.message) ||
    (usersQuery.error instanceof Error && usersQuery.error.message) ||
    (sessionsQuery.error instanceof Error && sessionsQuery.error.message) ||
    (auditQuery.error instanceof Error && auditQuery.error.message) ||
    '未知错误';

  return (
    <Space direction="vertical" size={24} style={{ display: 'flex' }}>
      <Card className="hero-card">
        <Row gutter={[16, 16]} align="middle">
          <Col span={14}>
            <Space direction="vertical" size={8}>
              <Tag color="blue">/operations/machines</Tag>
              <Title level={2} style={{ margin: 0 }}>
                设备管理
              </Title>
              <Text type="secondary">
                当前页面已接真实设备元数据、daemon 状态、关联会话和审计轨迹，优先服务设备健康排查与归属核对。
              </Text>
            </Space>
          </Col>
          <Col span={10}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="设备总数" value={machines.length} />
              </Col>
              <Col span={8}>
                <Statistic title="在线设备" value={activeCount} />
              </Col>
              <Col span={8}>
                <Statistic title="离线设备" value={offlineCount} />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Card>
        <Space className="toolbar" size={12} wrap>
          <Search
            allowClear
            placeholder="按设备 ID、展示名、主机、平台、用户名、状态搜索"
            onSearch={setKeyword}
            onChange={(event) => setKeyword(event.target.value)}
            value={keyword}
            style={{ width: 360 }}
          />
          <Button
            type={statusFilter === 'active' ? 'primary' : 'default'}
            onClick={() => setStatusFilter(statusFilter === 'active' ? undefined : 'active')}
          >
            仅看在线
          </Button>
          <Button
            type={statusFilter === 'inactive' ? 'primary' : 'default'}
            onClick={() => setStatusFilter(statusFilter === 'inactive' ? undefined : 'inactive')}
          >
            仅看离线
          </Button>
          <Button onClick={() => void Promise.all([machinesQuery.refetch(), usersQuery.refetch(), sessionsQuery.refetch(), auditQuery.refetch()])}>刷新页面</Button>
        </Space>

        {isLoading ? (
          <div className="state-block">
            <Spin />
          </div>
        ) : null}

        {hasError ? (
          <Alert type="error" showIcon message="设备列表加载失败" description={errorMessage} />
        ) : null}

        {!isLoading && !hasError && filteredMachines.length === 0 ? (
          <div className="state-block">
            <Empty description="当前没有匹配的设备" />
          </div>
        ) : null}

        {!isLoading && !hasError && filteredMachines.length > 0 ? (
          <Table
            rowKey="id"
            className="users-table"
            dataSource={filteredMachines}
            columns={columns}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
          />
        ) : null}
      </Card>

      <Drawer
        title={selectedMachine ? formatMachineId(selectedMachine.id) : '设备详情'}
        width={560}
        open={Boolean(selectedMachine)}
        onClose={() => setSelectedMachine(null)}
        destroyOnClose
      >
        {selectedMachine ? (
          <Space direction="vertical" size={16} style={{ display: 'flex' }}>
            <MachineDetail machine={selectedMachine} user={selectedUser} />
            <Card title="Daemon 信息">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="PID">{daemonValue(selectedMachine, 'pid')}</Descriptions.Item>
                <Descriptions.Item label="HTTP Port">{daemonValue(selectedMachine, 'httpPort')}</Descriptions.Item>
                <Descriptions.Item label="启动时间">{daemonValue(selectedMachine, 'startTime')}</Descriptions.Item>
                <Descriptions.Item label="启动 CLI">{daemonValue(selectedMachine, 'startedWithCliVersion')}</Descriptions.Item>
                <Descriptions.Item label="Metadata 版本">{String(selectedMachine.metadataVersion)}</Descriptions.Item>
                <Descriptions.Item label="Daemon 版本">{String(selectedMachine.daemonStateVersion)}</Descriptions.Item>
              </Descriptions>
            </Card>
            <Card title="最近目录">
              {selectedDirectories.length > 0 ? (
                <List
                  dataSource={selectedDirectories}
                  renderItem={(path) => (
                    <List.Item>
                      <Text>{path}</Text>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前设备没有可见目录" />
              )}
            </Card>
            <Card title="最近会话">
              {selectedMachineSessions.length > 0 ? (
                <List
                  dataSource={selectedMachineSessions}
                  renderItem={(session) => (
                    <List.Item>
                      <Space direction="vertical" size={4}>
                        <Space size={8} wrap>
                          <Text strong>{session.tag || session.path || session.id}</Text>
                          <Tag color={session.active ? 'green' : 'default'}>{session.active ? '在线' : '离线'}</Tag>
                        </Space>
                        <Text>{[session.model, session.flavor, session.host].filter(Boolean).join(' / ') || '--'}</Text>
                        <Text type="secondary">路径 {session.path || '--'}</Text>
                        <Text type="secondary">最后活跃 {formatDateTime(session.lastActiveAt)}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前设备没有关联会话" />
              )}
            </Card>
            <Card title="关联用户">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="用户名">{selectedUser?.username || '未命名用户'}</Descriptions.Item>
                <Descriptions.Item label="用户 ID">{selectedUser?.id || selectedMachine.accountId}</Descriptions.Item>
                <Descriptions.Item label="套餐">
                  {selectedUser ? <Tag color="purple">{selectedUser.subscription.tier.toUpperCase()}</Tag> : '--'}
                </Descriptions.Item>
                <Descriptions.Item label="订阅状态">
                  {selectedUser ? (
                    <Tag color={selectedUser.subscription.status === 'active' ? 'green' : 'default'}>
                      {selectedUser.subscription.status}
                    </Tag>
                  ) : (
                    '--'
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>
            <Card title="审计轨迹">
              {selectedMachineAudits.length > 0 ? (
                <List
                  dataSource={selectedMachineAudits}
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
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前设备没有命中的审计记录" />
              )}
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
