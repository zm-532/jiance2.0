import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, theme, Avatar, Dropdown, Space } from 'antd'
import {
  DashboardOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  ToolOutlined,
  UserOutlined,
  BellOutlined,
} from '@ant-design/icons'

const { Header, Sider, Content } = Layout

const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '总览工作台',
  },
  {
    key: '/experiment-db',
    icon: <DatabaseOutlined />,
    label: '实验数据库',
  },
  {
    key: '/data-judgment',
    icon: <FileSearchOutlined />,
    label: '数据源判定',
  },
  {
    key: '/device-manage',
    icon: <ToolOutlined />,
    label: '设备管理',
  },
]

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken()

  const userMenu = {
    items: [
      { key: 'profile', label: '个人中心' },
      { key: 'settings', label: '系统设置' },
      { key: 'logout', label: '退出登录' },
    ],
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10,
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: collapsed ? 16 : 18,
          fontWeight: 700,
          letterSpacing: 2,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          {collapsed ? '声屏' : '声屏障检测管理平台'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        <Header style={{
          padding: '0 24px',
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 9,
        }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#333' }}>
            {menuItems.find(m => m.key === location.pathname)?.label || '声屏障检测管理平台'}
          </div>
          <Space size={20}>
            <BellOutlined style={{ fontSize: 18, cursor: 'pointer', color: '#666' }} />
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
                <span style={{ color: '#333' }}>管理员</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{
          margin: 24,
          padding: 24,
          background: '#f0f2f5',
          borderRadius: borderRadiusLG,
          minHeight: 280,
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
