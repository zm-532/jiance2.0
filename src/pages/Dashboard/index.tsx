import { Row, Col, Card, Statistic, Table, Tag, Progress, Button } from 'antd'
import React, { useState } from 'react'
import {
  ToolOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  RiseOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { devices, materialStats, testItemDistribution, monthlyTestVolume, allRecordsCount, allRegRecordsCount, inProgressCount, pendingCount, pipeline, allAppRecordsCount, photoCount } from '../../mock/data'

export default function Dashboard() {
  const [isExpanded, setIsExpanded] = useState(false)
  const mainDevices = devices.filter(d => d.status !== '未到')
  const totalDevices = mainDevices.length
  const calibNormal = mainDevices.filter(d => d.calibrationStatus === '正常').length
  const calibSoon = mainDevices.filter(d => d.calibrationStatus === '即将到期').length
  const calibExpired = mainDevices.filter(d => d.calibrationStatus === '已过期').length

  // 设备校准状态饼图
  const devicePieOption = {
    tooltip: { trigger: 'item', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e6f0ff', textStyle: { color: '#333' } },
    legend: { bottom: 0, icon: 'circle', itemWidth: 10, itemHeight: 10 },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.15)' }
      },
      data: [
        { value: calibNormal, name: '校准正常', itemStyle: { color: '#52c41a' } },
        { value: calibSoon, name: '即将到期', itemStyle: { color: '#faad14' } },
        { value: calibExpired, name: '已过期', itemStyle: { color: '#ff4d4f' } },
      ].filter(d => d.value > 0),
    }],
  }

  // 检测项目分布饼图
  const testItemPieOption = {
    tooltip: { trigger: 'item', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e6f0ff', textStyle: { color: '#333' } },
    legend: { bottom: 0, icon: 'circle', itemWidth: 10, itemHeight: 10 },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
      label: { show: false },
      emphasis: { 
        label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.15)' }
      },
      data: testItemDistribution.map(item => ({
        value: item.value,
        name: item.name,
        itemStyle: { color: item.color },
      })),
    }],
  }

  // 月度检测趋势折线图
  const trendLineOption = {
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e6f0ff', textStyle: { color: '#333' } },
    legend: { data: ['总检测量', '合格', '不合格'], bottom: 0, icon: 'circle', itemWidth: 10, itemHeight: 10 },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: monthlyTestVolume.map(d => d.month),
      axisLabel: { rotate: 30, color: '#666' },
      axisLine: { lineStyle: { color: '#e8e8e8' } },
    },
    yAxis: { 
      type: 'value',
      axisLabel: { color: '#666' },
      splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } }
    },
    series: [
      {
        name: '总检测量',
        type: 'line',
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 8,
        data: monthlyTestVolume.map(d => d.total),
        itemStyle: { color: '#1677ff', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(22,119,255,0.2)' }, { offset: 1, color: 'rgba(22,119,255,0.01)' }]
          }
        },
      },
      {
        name: '合格',
        type: 'line',
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 8,
        data: monthlyTestVolume.map(d => d.qualified),
        itemStyle: { color: '#52c41a', borderWidth: 2 },
      },
      {
        name: '不合格',
        type: 'line',
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 8,
        data: monthlyTestVolume.map(d => d.unqualified),
        itemStyle: { color: '#ff4d4f', borderWidth: 2 },
      },
    ],
  }

  // 常用设备排行（有检测记录的设备）
  const topDevices = [...mainDevices].filter(d => d.totalTests > 0).sort((a, b) => b.totalTests - a.totalTests).slice(0, 6)

  // 供应商统计表格列
  const supplierColumns = [
    { title: '材料类型', dataIndex: 'material', key: 'material', width: 120 },
    { title: '供应商数', dataIndex: 'supplierCount', key: 'supplierCount', width: 100, align: 'center' as const },
    {
      title: '平均合格率',
      dataIndex: 'avgQualifyRate',
      key: 'avgQualifyRate',
      width: 150,
      render: (val: number) => (
        <Progress
          percent={val}
          size="small"
          status={val >= 95 ? 'success' : val >= 90 ? 'normal' : 'exception'}
          format={v => `${v}%`}
        />
      ),
    },
    { title: '总送检批次', dataIndex: 'totalBatches', key: 'totalBatches', width: 120, align: 'center' as const },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>总览工作台</h2>
        <p>实验室设备及检测业务数据总览</p>
      </div>

      {/* 顶部统计卡片 - 检测全流程 */}
      <Row gutter={12} style={{ marginBottom: 20 }}>
        <Col span={4}>
          <Card className="stat-card" hoverable>
            <Statistic
              title="委托申请"
              value={pipeline.totalApplications}
              prefix={<ExperimentOutlined style={{ color: '#1677ff' }} />}
              suffix={<span style={{ fontSize: 13, color: '#999' }}>单</span>}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" hoverable>
            <Statistic
              title="待登记检测"
              value={pipeline.pendingRegistration}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              suffix={<span style={{ fontSize: 13, color: '#999' }}>单</span>}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" hoverable>
            <Statistic
              title="检测中"
              value={pipeline.inProgress}
              prefix={<SyncOutlined spin style={{ color: '#13c2c2' }} />}
              suffix={<span style={{ fontSize: 13, color: '#999' }}>单</span>}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" hoverable>
            <Statistic
              title="已完成检测"
              value={pipeline.completed}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              suffix={<span style={{ fontSize: 13, color: '#999' }}>单</span>}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" hoverable>
            <Statistic
              title="设备总数"
              value={totalDevices}
              prefix={<ToolOutlined style={{ color: '#722ed1' }} />}
              suffix={<span style={{ fontSize: 13, color: '#999' }}>台</span>}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" hoverable>
            <Statistic
              title="送样图片"
              value={photoCount}
              prefix={<RiseOutlined style={{ color: '#eb2f96' }} />}
              suffix={<span style={{ fontSize: 13, color: '#999' }}>张</span>}
            />
          </Card>
        </Col>
      </Row>

      {/* 供应商与材料统计 + 检测项目分布 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={14}>
          <div className="dashboard-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}><TeamOutlined /> 供应商与材料统计</h3>
              <Button type="link" size="small" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? '收起' : '展开'}
              </Button>
            </div>
            <Table
              dataSource={isExpanded ? materialStats : materialStats.slice(0, 6)}
              columns={supplierColumns}
              rowKey="material"
              pagination={false}
              size="small"
            />
          </div>
        </Col>
        <Col span={10}>
          <div className="dashboard-section">
            <h3><ExperimentOutlined /> 检测项目分布</h3>
            <ReactECharts option={testItemPieOption} style={{ height: 300 }} />
          </div>
        </Col>
      </Row>

      {/* 设备管理统计 + 月度趋势 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <div className="dashboard-section">
            <h3><ToolOutlined /> 设备校准状态</h3>
            <ReactECharts option={devicePieOption} style={{ height: 280 }} />
          </div>
        </Col>
        <Col span={16}>
          <div className="dashboard-section">
            <h3><RiseOutlined /> 月度检测趋势</h3>
            <ReactECharts option={trendLineOption} style={{ height: 280 }} />
          </div>
        </Col>
      </Row>

      {/* 常用设备排行 */}
      <div className="dashboard-section">
        <h3><SafetyCertificateOutlined /> 常用设备排行</h3>
        <Row gutter={16}>
          {topDevices.map((device, idx) => (
            <Col span={4} key={device.id}>
              <Card size="small" hoverable>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: idx < 3 ? '#1677ff' : '#999' }}>
                    #{idx + 1}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, margin: '8px 0 4px' }}>{device.name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{device.model || ''}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{device.totalTests} 次检测</div>
                  <Tag color={device.calibrationStatus === '正常' ? 'green' : device.calibrationStatus === '即将到期' ? 'orange' : device.calibrationStatus === '已过期' ? 'red' : 'default'} style={{ marginTop: 8 }}>
                    {device.calibrationStatus}
                  </Tag>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  )
}
