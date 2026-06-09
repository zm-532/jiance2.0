import { useState } from 'react'
import { Row, Col, Card, Table, Tag, Statistic, Select, Space, Button, Tooltip, Badge } from 'antd'
import { ToolOutlined, CheckCircleOutlined, PauseCircleOutlined, WarningOutlined, HistoryOutlined, ExclamationCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { devices, Device } from '../../mock/data'

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

  // 校准状态分布饼图
  const calibPieOption = {
    tooltip: { trigger: 'item', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e6f0ff', textStyle: { color: '#333' } },
    legend: { bottom: 0, icon: 'circle', itemWidth: 10, itemHeight: 10 },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.15)' }
      },
      data: [
        { value: calibNormal, name: '校准正常', itemStyle: { color: '#52c41a' } },
        { value: calibSoon, name: '即将到期', itemStyle: { color: '#faad14' } },
        { value: calibExpired, name: '已过期', itemStyle: { color: '#ff4d4f' } },
      ].filter(d => d.value > 0),
    }],
  }

  // 检测次数排行（有检测数据的设备）
  const topTestDevices = [...mainDevices].filter(d => d.totalTests > 0).sort((a, b) => b.totalTests - a.totalTests).slice(0, 15)
  const testRankOption = {
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e6f0ff', textStyle: { color: '#333' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: topTestDevices.map(d => d.name),
      axisLabel: { rotate: 30, fontSize: 11, color: '#666' },
      axisLine: { lineStyle: { color: '#e8e8e8' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value', name: '检测次数',
      nameTextStyle: { color: '#888', padding: [0, 0, 0, 20] },
      axisLabel: { color: '#666' },
      splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } }
    },
    series: [{
      type: 'bar',
      data: topTestDevices.map(d => ({
        value: d.totalTests,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#73d13d' }, { offset: 1, color: '#389e0d' }]
          },
          borderRadius: [6, 6, 0, 0]
        },
      })),
      barWidth: 35,
      label: { show: true, position: 'top', color: '#666', fontWeight: 500 },
    }],
  }

  // 存放位置分布
  const locationMap: Record<string, number> = {}
  mainDevices.forEach(d => {
    const loc = d.location || '未标注'
    locationMap[loc] = (locationMap[loc] || 0) + 1
  })
  const locationData = Object.entries(locationMap).sort((a, b) => b[1] - a[1])
  const locationPieOption = {
    tooltip: { trigger: 'item', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e6f0ff', textStyle: { color: '#333' } },
    legend: { bottom: 0, icon: 'circle', itemWidth: 10, itemHeight: 10 },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
      label: { show: false },
      data: locationData.map(([name, value]) => ({ name, value })),
    }],
  }

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
        <p>实验室检测设备台账管理 — 数据来自《实验室检测设备台账2025》</p>
      </div>

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
            <ReactECharts option={calibPieOption} style={{ height: 320 }} />
          </div>
        </Col>
        <Col span={12}>
          <div className="dashboard-section">
            <h3>存放位置分布</h3>
            <ReactECharts option={locationPieOption} style={{ height: 320 }} />
          </div>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={24}>
          <div className="dashboard-section">
            <h3>检测次数排行</h3>
            <ReactECharts option={testRankOption} style={{ height: 320 }} />
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
