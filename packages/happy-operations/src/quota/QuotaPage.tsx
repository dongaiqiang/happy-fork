import React from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  List,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import { fetchAdminQuota, fetchAdminUsers, type AdminQuotaResponse, type AdminUser } from '../api/admin';

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

function calcPercent(used: number, limit: number) {
  if (limit <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((used / limit) * 100));
}

function riskLabel(quota: AdminQuotaResponse['quota'] | null) {
  if (!quota) {
    return '待加载';
  }

  const maxPercent = Math.max(calcPercent(quota.dailyUsed, quota.dailyLimit), calcPercent(quota.monthlyUsed, quota.monthlyLimit));
  if (maxPercent >= 90) {
    return '临界';
  }

  if (maxPercent >= 70) {
    return '关注';
  }

  return '正常';
}

type QuotaAccount = {
  user: AdminUser;
  quota: AdminQuotaResponse | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
};

function QuotaDetail({ account }: { account: QuotaAccount }) {
  if (account.isLoading) {
    return (
      <div className="state-block">
        <Spin />
      </div>
    );
  }

  if (account.isError || !account.quota) {
    return (
      <Alert
        type="error"
        showIcon
        message="配额详情加载失败"
        description={account.errorMessage || '未知错误'}
      />
    );
  }

  const { quota, subscription } = account.quota;
  const dailyPercent = calcPercent(quota.dailyUsed, quota.dailyLimit);
  const monthlyPercent = calcPercent(quota.monthlyUsed, quota.monthlyLimit);

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Card title="基础权益">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="当前套餐">
            <Tag color="purple">{formatTier(subscription.tier)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="订阅状态">
            <Tag color={statusColor(subscription.status)}>{subscription.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="开始时间">{formatDateTime(subscription.startDate)}</Descriptions.Item>
          <Descriptions.Item label="到期时间">{formatDateTime(subscription.endDate)}</Descriptions.Item>
          <Descriptions.Item label="风险等级">{riskLabel(quota)}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="额度使用">
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          <div>
            <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <Text strong>日额度</Text>
              <Text>
                {quota.dailyUsed} / {quota.dailyLimit}
              </Text>
            </Space>
            <Progress percent={dailyPercent} status={dailyPercent >= 90 ? 'exception' : 'active'} />
            <Text type="secondary">剩余 {quota.dailyRemaining}</Text>
          </div>
          <div>
            <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <Text strong>月额度</Text>
              <Text>
                {quota.monthlyUsed} / {quota.monthlyLimit}
              </Text>
            </Space>
            <Progress percent={monthlyPercent} status={monthlyPercent >= 90 ? 'exception' : 'active'} />
            <Text type="secondary">剩余 {quota.monthlyRemaining}</Text>
          </div>
        </Space>
      </Card>

      <Card title="能力上限">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="速率限制">{quota.rateLimit}</Descriptions.Item>
          <Descriptions.Item label="存储上限">{quota.storageLimit}</Descriptions.Item>
          <Descriptions.Item label="套餐日上限">{subscription.features.dailyLimit}</Descriptions.Item>
          <Descriptions.Item label="套餐月上限">{subscription.features.monthlyLimit}</Descriptions.Item>
          <Descriptions.Item label="套餐速率上限">{subscription.features.rateLimit}</Descriptions.Item>
          <Descriptions.Item label="套餐存储上限">{subscription.features.storageLimit}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Alert
        type="info"
        showIcon
        message="当前阶段说明"
        description="本页当前先承接真实只读数据核对，升级、重置、关联订单和最近变更记录后续再补写动作。"
      />
    </Space>
  );
}

export function QuotaPage() {
  const [keyword, setKeyword] = React.useState('');
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['admin-users', 'quota-page'],
    queryFn: fetchAdminUsers,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const users = usersQuery.data?.users ?? [];

  React.useEffect(() => {
    if (!selectedAccountId && users.length > 0) {
      setSelectedAccountId(users[0].id);
    }
  }, [selectedAccountId, users]);

  const quotaQueries = useQueries({
    queries: users.map((user) => ({
      queryKey: ['admin-account-quota', user.id],
      queryFn: () => fetchAdminQuota(user.id),
      enabled: users.length > 0,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    })),
  });

  const accounts = React.useMemo<QuotaAccount[]>(() => {
    return users.map((user, index) => {
      const query = quotaQueries[index];
      return {
        user,
        quota: query?.data ?? null,
        isLoading: query?.isLoading ?? false,
        isError: query?.isError ?? false,
        errorMessage: query?.error instanceof Error ? query.error.message : null,
      };
    });
  }, [quotaQueries, users]);

  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredAccounts = normalizedKeyword
    ? accounts.filter((account) =>
        [
          account.user.id,
          account.user.username ?? '',
          account.quota?.subscription.tier ?? account.user.subscription.tier,
          account.quota?.subscription.status ?? account.user.subscription.status,
          riskLabel(account.quota?.quota ?? null),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedKeyword),
      )
    : accounts;

  const selectedAccount =
    filteredAccounts.find((account) => account.user.id === selectedAccountId) ??
    accounts.find((account) => account.user.id === selectedAccountId) ??
    filteredAccounts[0] ??
    null;

  const criticalCount = accounts.filter((account) => riskLabel(account.quota?.quota ?? null) === '临界').length;
  const proCount = accounts.filter(
    (account) => (account.quota?.subscription.tier ?? account.user.subscription.tier).toLowerCase() === 'pro',
  ).length;
  const loadingCount = accounts.filter((account) => account.isLoading).length;

  const listLoading = usersQuery.isLoading;
  const listError = usersQuery.isError;
  const listErrorMessage = usersQuery.error instanceof Error ? usersQuery.error.message : '未知错误';

  return (
    <Space direction="vertical" size={24} style={{ display: 'flex' }}>
      <Card className="hero-card">
        <Row gutter={[16, 16]} align="middle">
          <Col span={14}>
            <Space direction="vertical" size={8}>
              <Tag color="gold">/operations/quota</Tag>
              <Title level={2} style={{ margin: 0 }}>
                配额与套餐
              </Title>
              <Text type="secondary">
                当前页面以账户配额核对为中心，左侧拉全真实账户列表，右侧联动 `GET /admin/account-quota` 查看套餐、额度、剩余量和能力上限。
              </Text>
            </Space>
          </Col>
          <Col span={10}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="账户总数" value={accounts.length} />
              </Col>
              <Col span={8}>
                <Statistic title="临界账号" value={criticalCount} />
              </Col>
              <Col span={8}>
                <Statistic title="Pro 套餐" value={proCount} />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Card>
        <Space className="toolbar" size={12} wrap>
          <Search
            allowClear
            placeholder="按账户 ID、用户名、套餐、状态、风险搜索"
            onSearch={setKeyword}
            onChange={(event) => setKeyword(event.target.value)}
            value={keyword}
            style={{ width: 420 }}
          />
          <Space>
            <Tag color="blue">配额详情加载中 {loadingCount}</Tag>
            <Button
              onClick={() => {
                void usersQuery.refetch();
                void Promise.all(quotaQueries.map((query) => query.refetch()));
              }}
            >
              刷新页面
            </Button>
          </Space>
        </Space>

        {listLoading ? (
          <div className="state-block">
            <Spin />
          </div>
        ) : null}

        {listError ? <Alert type="error" showIcon message="账户列表加载失败" description={listErrorMessage} /> : null}

        {!listLoading && !listError && filteredAccounts.length === 0 ? (
          <div className="state-block">
            <Empty description="当前没有匹配的账户" />
          </div>
        ) : null}

        {!listLoading && !listError && filteredAccounts.length > 0 ? (
          <Row gutter={24}>
            <Col span={9}>
              <Card title="账户列表" size="small">
                <List
                  dataSource={filteredAccounts}
                  renderItem={(account) => {
                    const quota = account.quota?.quota ?? null;
                    const percent = quota ? Math.max(calcPercent(quota.dailyUsed, quota.dailyLimit), calcPercent(quota.monthlyUsed, quota.monthlyLimit)) : 0;
                    const selected = selectedAccount?.user.id === account.user.id;
                    return (
                      <List.Item
                        className={selected ? 'quota-account-item quota-account-item-active' : 'quota-account-item'}
                        onClick={() => setSelectedAccountId(account.user.id)}
                      >
                        <Space direction="vertical" size={6} style={{ display: 'flex', width: '100%' }}>
                          <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                            <Text strong>{account.user.username || '未命名用户'}</Text>
                            <Tag color="purple">
                              {formatTier(account.quota?.subscription.tier ?? account.user.subscription.tier)}
                            </Tag>
                          </Space>
                          <Text type="secondary">{account.user.id}</Text>
                          <Space size={8} wrap>
                            <Tag color={statusColor(account.quota?.subscription.status ?? account.user.subscription.status)}>
                              {account.quota?.subscription.status ?? account.user.subscription.status}
                            </Tag>
                            <Tag color={riskLabel(quota) === '临界' ? 'red' : riskLabel(quota) === '关注' ? 'gold' : 'green'}>
                              {riskLabel(quota)}
                            </Tag>
                          </Space>
                          {account.isLoading ? <Spin size="small" /> : <Progress percent={percent} size="small" />}
                        </Space>
                      </List.Item>
                    );
                  }}
                />
              </Card>
            </Col>
            <Col span={15}>
              <Card
                title={selectedAccount ? `${selectedAccount.user.username || '未命名用户'} / 配额详情` : '配额详情'}
                size="small"
              >
                {selectedAccount ? (
                  <QuotaDetail account={selectedAccount} />
                ) : (
                  <div className="state-block">
                    <Empty description="请选择账户查看详情" />
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        ) : null}
      </Card>
    </Space>
  );
}
