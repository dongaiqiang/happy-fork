import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Typography, Tag, Space } from 'antd';
import {
  AuditOutlined,
  DeploymentUnitOutlined,
  SettingOutlined,
  TeamOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  CloudServerOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/operations', icon: <AppstoreOutlined />, label: '经营驾驶舱' },
  { key: '/operations/users', icon: <TeamOutlined />, label: '用户管理' },
  { key: '/operations/machines', icon: <CloudServerOutlined />, label: '设备管理' },
  { key: '/operations/quota', icon: <DashboardOutlined />, label: '配额与套餐' },
  { key: '/operations/orders', icon: <CreditCardOutlined />, label: '订单与计费' },
  { key: '/operations/audit', icon: <AuditOutlined />, label: '审计日志' },
  { key: '/operations/providers', icon: <DeploymentUnitOutlined />, label: 'Agent 管理' },
  { key: '/operations/payment-channels', icon: <DeploymentUnitOutlined />, label: '支付通道' },
  { key: '/operations/settings', icon: <SettingOutlined />, label: '系统配置' },
];

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/operations': {
    title: '经营驾驶舱',
    subtitle: '先回答平台是否健康、今天先处理什么、以及从哪里进入具体工作台。',
  },
  '/operations/users': {
    title: '用户管理',
    subtitle: '先看全用户对象与套餐状态，直接接真实管理员 JSON 数据。',
  },
  '/operations/machines': {
    title: '设备管理',
    subtitle: '聚焦设备状态、归属用户和最后活跃时间，保持真实链路可核对。',
  },
  '/operations/quota': {
    title: '配额与套餐',
    subtitle: '围绕账户额度、套餐状态和剩余量做真实核对，不做假数据说明页。',
  },
  '/operations/orders': {
    title: '订单与计费',
    subtitle: '围绕真实订单、支付状态和关联权益做核对，先把支付处置台看清楚。',
  },
  '/operations/audit': {
    title: '审计日志',
    subtitle: '围绕后台动作、目标对象和结果做复核，先把真实审计链路看清楚。',
  },
  '/operations/providers': {
    title: 'Agent 管理',
    subtitle: '围绕编程 Agent、真实会话使用和已接入服务做核对，先把真实 Agent 管理视图搭起来。',
  },
  '/operations/payment-channels': {
    title: '支付通道',
    subtitle: '围绕默认通道、配置状态和最近支付链路做核对，先把真实支付通道状态看清楚。',
  },
  '/operations/settings': {
    title: '系统配置',
    subtitle: '围绕真实运行信息与首批可写项做配置治理，不做空壳设置页。',
  },
};

export function OperationsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentMeta = pageMeta[location.pathname] ?? {
    title: 'HelloVibe Operations',
    subtitle: '正式后台，统一接真实管理员 JSON 数据。',
  };

  return (
    <Layout className="app-layout">
      <Sider width={244} className="app-sider">
        <div className="brand-block">
          <Space align="center">
            <AppstoreOutlined className="brand-icon" />
            <div>
              <Title level={4} className="brand-title">
                HelloVibe Operations
              </Title>
              <Text className="brand-subtitle">正式后台</Text>
            </div>
          </Space>
          <Tag color="purple">/operations</Tag>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div>
            <Title level={3} className="header-title">
              {currentMeta.title}
            </Title>
            <Text className="header-subtitle">{currentMeta.subtitle}</Text>
          </div>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
