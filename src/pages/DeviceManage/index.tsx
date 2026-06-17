import { useState } from 'react'
import { Row, Col, Card, Table, Tag, Statistic, Select, Space, Button, Tooltip, Alert } from 'antd'
import { ToolOutlined, CheckCircleOutlined, PauseCircleOutlined, WarningOutlined, HistoryOutlined, ExclamationCircleOutlined, ClockCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { devices, Device, currentInstruments, equipmentInstrumentsCurrentCount } from '../../mock/data'
import DonutPieChart from '../../components/charts/DonutPieChart'
import BarRankChart from '../../components/charts/BarRankChart'

const { Option } = Select

const statusColorMap: Record<string, string> = {
  '正常': 'green', '未到': 'default',
}
const calibStatusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  '正常': { color: 'green', icon: <CheckCircleOutlined /> },
  '即将到期': { color: 'orange', icon: <ClockCircleOutlined /> },
  '已过期': { color: 'red', icon: <ExclamationCircleOutlined /> },
  '未到货': { color: 'default', icon: <PauseCircleOutlined /> },
  '无校准数据': { color: 'default', icon: null },
}

export default function DeviceManage() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [calibFilter, setCalibFilter] = useState<string>('all')

  // 来自 实验室检测设备统计（1.9）.xlsx 真实数据,按 id 建索引
  const specCategoryMap: Record<string, string> = {}
  for (const ins of currentInstruments) {
    if (ins.id && ins.specCategory) specCategoryMap[ins.id] = ins.specCategory
  }

  const mainDevices = devices.filter(d => d.status !== '未到')
  const filteredDevices = mainDevices.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (calibFilter !== 'all' && d.calibrationStatus !== calibFilter) return false
    return true
  })

  const totalDevices = mainDevices.length
  const normalDevices = mainDevices.filter(d => d.status === '正常').length
  const calibExpired = mainDevices.filter(d => d.calibrationStatus === '已过期').length
  const calibSoon = mainDevices.filter(d => d.calibrationStatus === '即将到期').length
  const calibNormal = mainDevices.filter(d => d.calibrationStatus === '正常').length
  const withTestCount = mainDevices.filter(d => d.totalTests > 0).length

  // 校准状态分布饼图数据
  const calibPieData = [
    { name: '校准正常', value: calibNormal, color: '#52c41a' },
    { name: '即将到期', value: calibSoon, color: '#faad14' },
    { name: '已过期', value: calibExpired, color: '#ff4d4f' },
  ]

  // 检测次数排行数据
  const topTestDevices = [...mainDevices].filter(d => d.totalTests > 0).sort((a, b) => b.totalTests - a.totalTests).slice(0, 15)
  const testRankData = topTestDevices.map(d => ({ name: d.name, value: d.totalTests }))

  // 存放位置分布数据
  const locationMap: Record<string, number> = {}
  mainDevices.forEach(d => { const loc = d.location || '未标注'; locationMap[loc] = (locationMap[loc] || 0) + 1 })
  const locationData = Object.entries(locationMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

  const columns = [
    {
      title: '设备编号',
      dataIndex: 'id',
      key: 'id',
      width: 85,
      fixed: 'left' as const,
    },
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
      width: 170,
      fixed: 'left' as const,
      render: (val: string) => <span style={{ fontWeight: 500 }}>{val}</span>,
    },
    { title: '型号', dataIndex: 'model', key: 'model', width: 130, ellipsis: true },
    { title: '生产厂家', dataIndex: 'manufacturer', key: 'manufacturer', width: 180, ellipsis: true },
    {
      title: '设备状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      align: 'center' as const,
      render: (val: string) => {
        if (!val) return '-'
        const color = statusColorMap[val] || 'default'
        return <Tag color={color}>{val}</Tag>
      },
    },
    {
      title: '校准状态',
      dataIndex: 'calibrationStatus',
      key: 'calibrationStatus',
      width: 100,
      align: 'center' as const,
      render: (val: string) => {
        const cfg = calibStatusConfig[val] || calibStatusConfig['无校准数据']
        return <Tag icon={cfg.icon} color={cfg.color}>{val}</Tag>
      },
    },
    { title: '存放位置', dataIndex: 'location', key: 'location', width: 110, ellipsis: true },
    { title: '功能', dataIndex: 'functionDesc', key: 'functionDesc', width: 200, ellipsis: true },
    { title: '测量范围', dataIndex: 'measurementRange', key: 'measurementRange', width: 180, ellipsis: true },
    {
      title: '下次校准',
      dataIndex: 'nextCalibrationDate',
      key: 'nextCalibrationDate',
      width: 110,
      sorter: (a: Device, b: Device) => {
        const da = a.nextCalibrationDate || '9999'
        const db = b.nextCalibrationDate || '9999'
        return da.localeCompare(db)
      },
    },
    { title: '校准单位', dataIndex: 'calibrationUnit', key: 'calibrationUnit', width: 120, ellipsis: true },
    { title: '证书编号', dataIndex: 'calibrationCertNo', key: 'calibrationCertNo', width: 160, ellipsis: true },
    { title: '联系人', dataIndex: 'contact', key: 'contact', width: 140, ellipsis: true },
    {
      title: '检测次数',
      dataIndex: 'totalTests',
      key: 'totalTests',
      width: 90,
      align: 'center' as const,
      sorter: (a: Device, b: Device) => a.totalTests - b.totalTests,
      render: (val: number) => val > 0 ? val : <span style={{ color: '#ccc' }}>-</span>,
    },
    {
      title: '规格种类',
      dataIndex: 'id',
      key: 'specCategory',
      width: 220,
      ellipsis: true,
      render: (id: string) => {
        const v = specCategoryMap[id]
        if (!v) return <span style={{ color: '#ccc' }}>-</span>
        return <Tooltip title={v}><span>{v}</span></Tooltip>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: Device) => (
        <Space>
          <Tooltip title="使用记录">
            <Button type="link" size="small" icon={<HistoryOutlined />} />
          </Tooltip>
          <Button type="link" size="small">详情</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>设备管理</h2>
        <p>实验室检测设备台账管理 — 数据来自《实验室检测设备台账2025》及《实验室检测设备统计（1.9）》</p>
      </div>

      {/* 数据基准日说明 — 来自真实 Excel,只读不假造 */}
      {calibExpired > 0 && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          icon={<InfoCircleOutlined />}
          message="数据基准日说明"
          description={
            <span>
              数据来源 <b>《实验室检测设备统计（1.9）》</b>;
              今日 {new Date().toISOString().slice(0, 10)},
              2025 在用设备 <b>{equipmentInstrumentsCurrentCount}</b> 台,
              其中 <b style={{ color: '#ff4d4f' }}>已过期 {calibExpired} 台</b>。
              "规格种类"列从该 Excel 抽取,匹配不到显示 "-"。
            </span>
          }
        />
      )}

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={4}>
          <Card className="stat-card" hoverable>
            <Statistic
              title="设备总数"
              value={totalDevices}
              prefix={<ToolOutlined style={{ color: '#1677ff' }} />}
              suffix="台"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" hoverable>
            <Statistic
              title="正常运行"
              value={normalDevices}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              suffix="台"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" hoverable>
            <Statistic
              title="校准正常"
              value={calibNormal}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              suffix="台"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" hoverable>
            <Statistic
              title="即将到期"
              value={calibSoon}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              suffix="台"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" hoverable>
            <Statistic
              title="校准过期"
              value={calibExpired}
              prefix={<WarningOutlined style={{ color: '#f5222d' }} />}
              suffix="台"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" hoverable>
            <Statistic
              title="有检测记录"
              value={withTestCount}
              prefix={<HistoryOutlined style={{ color: '#722ed1' }} />}
              suffix="台"
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={12}>
          <div className="dashboard-section">
            <h3>校准状态分布</h3>
            <DonutPieChart data={calibPieData} height={320} />
          </div>
        </Col>
        <Col span={12}>
          <div className="dashboard-section">
            <h3>存放位置分布</h3>
            <DonutPieChart data={locationData} height={320} />
          </div>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={24}>
          <div className="dashboard-section">
            <h3>检测次数排行</h3>
            <BarRankChart data={testRankData} height={320} yAxisName="检测次数" barWidth={35} />
          </div>
        </Col>
      </Row>

      {/* 设备列表 */}
      <div className="dashboard-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ marginBottom: 0 }}>设备台账（{filteredDevices.length} 台）</h3>
          <Space>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 120 }} size="small">
              <Option value="all">全部状态</Option>
              <Option value="正常">正常</Option>
            </Select>
            <Select value={calibFilter} onChange={setCalibFilter} style={{ width: 130 }} size="small">
              <Option value="all">全部校准状态</Option>
              <Option value="正常">校准正常</Option>
              <Option value="即将到期">即将到期</Option>
              <Option value="已过期">已过期</Option>
              <Option value="无校准数据">无校准数据</Option>
            </Select>
          </Space>
        </div>
        <Table
          dataSource={filteredDevices}
          columns={columns}
          rowKey="id"
          size="small"
          scroll={{ x: 1800 }}
          pagination={{ pageSize: 15, showTotal: (total) => `共 ${total} 台设备` }}
        />
      </div>
    </div>
  )
}
