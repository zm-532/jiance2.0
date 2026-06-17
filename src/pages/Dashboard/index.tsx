import { Row, Col, Card, Statistic, Table, Tag, Progress, Button, Alert, Empty } from 'antd'
import React, { useState, useMemo } from 'react'
import {
  ToolOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  RiseOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  EnvironmentOutlined,
  BarChartOutlined,
  InfoCircleOutlined,
  DatabaseOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import {
  devices,
  materialStats,
  testItemDistribution,
  monthlyTestVolume,
  allRecordsCount,
  allRegRecordsCount,
  inProgressCount,
  pendingCount,
  pipeline,
  allAppRecordsCount,
  photoCount,
  // 来自 实验室检测设备统计（1.9）.xlsx(只追加,不覆盖原有数据)
  currentInstruments,
  equipmentLocationStats,
  equipmentCalibrationStats,
  equipmentInstrumentsCurrentCount,
  // 来自 台账.xlsx 的设备使用频次(真实数据)
  equipmentStats,
} from '../../mock/data'

interface TestItemDist { name: string; value: number; color: string }
interface MonthlyVol { month: string; total: number; qualified: number; unqualified: number }

export default function Dashboard() {
  const [isExpanded, setIsExpanded] = useState(false)

  // ---------- 派生数据（缓存避免每次渲染重复计算） ----------
  const mainDevices = useMemo(() => devices.filter(d => d.status !== '未到'), [])
  const totalDevices = mainDevices.length
  const calibNormal = useMemo(() => mainDevices.filter(d => d.calibrationStatus === '正常').length, [mainDevices])
  const calibSoon = useMemo(() => mainDevices.filter(d => d.calibrationStatus === '即将到期').length, [mainDevices])
  const calibExpired = useMemo(() => mainDevices.filter(d => d.calibrationStatus === '已过期').length, [mainDevices])

  // 设备校准状态饼图
  const devicePieOption = useMemo(() => ({
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
      ].filter((d: any) => d.value > 0),
    }],
  }), [calibNormal, calibSoon, calibExpired])

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
      data: testItemDistribution.map((item: TestItemDist) => ({
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
      data: monthlyTestVolume.map((d: MonthlyVol) => d.month),
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
        data: monthlyTestVolume.map((d: MonthlyVol) => d.total),
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
        data: monthlyTestVolume.map((d: MonthlyVol) => d.qualified),
        itemStyle: { color: '#52c41a', borderWidth: 2 },
      },
      {
        name: '不合格',
        type: 'line',
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 8,
        data: monthlyTestVolume.map((d: MonthlyVol) => d.unqualified),
        itemStyle: { color: '#ff4d4f', borderWidth: 2 },
      },
    ],
  }

  // 常用设备排行（有检测记录的设备）
  const topDevices = useMemo(
    () => [...mainDevices].filter(d => d.totalTests > 0).sort((a, b) => b.totalTests - a.totalTests).slice(0, 6),
    [mainDevices]
  )

  // ---- 以下数据来自 实验室检测设备统计（1.9）.xlsx 真实数据 ----
  // 设备位置分布饼图(基于 currentInstruments 真实位置)
  const locationPieOption = {
    tooltip: { trigger: 'item', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e6f0ff', textStyle: { color: '#333' } },
    legend: { bottom: 0, icon: 'circle', itemWidth: 10, itemHeight: 10, type: 'scroll' },
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
      data: equipmentLocationStats.map(d => ({ name: d.location, value: d.count })),
    }],
  }

  // 校准状态(基于真实 nextCalibrationDate 计算)
  const calibColorMap: Record<string, string> = {
    '正常': '#52c41a',
    '即将到期': '#faad14',
    '已过期': '#ff4d4f',
    '未到货': '#bfbfbf',
    '无校准数据': '#d9d9d9',
  }
  const realCalibPieOption = {
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
      data: equipmentCalibrationStats
        .map(d => ({ name: d.status, value: d.count, itemStyle: { color: calibColorMap[d.status] || '#1677ff' } }))
        .filter(d => d.value > 0),
    }],
  }

  // 设备使用频次 TOP10(来自台账.xlsx 真实统计)
  const top10Freq = useMemo(() => equipmentStats.slice(0, 10), [])
  const realTop10Option = useMemo(() => ({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e6f0ff', textStyle: { color: '#333' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: top10Freq.map(d => d.name),
      axisLabel: { rotate: 30, fontSize: 11, color: '#666' },
      axisLine: { lineStyle: { color: '#e8e8e8' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value', name: '使用次数',
      nameTextStyle: { color: '#888', padding: [0, 0, 0, 20] },
      axisLabel: { color: '#666' },
      splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } }
    },
    series: [{
      type: 'bar',
      data: top10Freq.map(d => d.totalTests),
      barWidth: 28,
      label: { show: true, position: 'top', color: '#666', fontWeight: 500 },
      itemStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: '#73d13d' }, { offset: 1, color: '#389e0d' }]
        },
        borderRadius: [6, 6, 0, 0]
      },
    }],
  }), [top10Freq])

  // 校准状态汇总(用于横幅)
  const expiredCount = equipmentCalibrationStats.find(s => s.status === '已过期')?.count || 0
  const expiredPct = equipmentInstrumentsCurrentCount > 0
    ? Math.round((expiredCount / equipmentInstrumentsCurrentCount) * 100)
    : 0

  // 供应商统计表格列
  const supplierColumns = [
    { title: '材料类型', dataIndex: 'material', key: 'material', width: 120 },
    { title: '供应商数', dataIndex: 'supplierCount', key: 'supplierCount', width: 100, align: 'center' as const },
    {
      title: '平均合格率',
      dataIndex: 'avgQualifyRate',
      key: 'avgQualifyRate',
      width: 150,
      render: (val: number | null) => (
        val == null
          ? <Tag>缺数据</Tag>
          : <Progress
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

      {/* ====== 以下为基于 实验室检测设备统计（1.9）.xlsx 的真实数据补强 ====== */}

      {/* 数据基准日说明 */}
      <Alert
        style={{ marginBottom: 20 }}
        type={expiredCount > 0 ? 'warning' : 'info'}
        showIcon
        icon={<InfoCircleOutlined />}
        message="设备台账数据基准日说明"
        description={
          <span>
            数据来源 <b>《实验室检测设备统计（1.9）》</b>(2025-11-09 导出);
            今日 {new Date().toISOString().slice(0, 10)},
            2025 在用设备 {equipmentInstrumentsCurrentCount} 台,
            其中 <b style={{ color: '#ff4d4f' }}>已过期 {expiredCount} 台({expiredPct}%)</b>。
            校准状态严格按"下次校准日期"真实计算。
          </span>
        }
      />

      {/* 设备校准状态(真实) + 设备位置分布 + 使用频次 TOP10 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <div className="dashboard-section">
            <h3><SafetyCertificateOutlined /> 设备校准状态(2025 台账)</h3>
            <ReactECharts option={realCalibPieOption} style={{ height: 300 }} />
          </div>
        </Col>
        <Col span={8}>
          <div className="dashboard-section">
            <h3><EnvironmentOutlined /> 设备位置分布</h3>
            <ReactECharts option={locationPieOption} style={{ height: 300 }} />
          </div>
        </Col>
        <Col span={8}>
          <div className="dashboard-section">
            <h3><BarChartOutlined /> 设备使用频次 TOP10</h3>
            {top10Freq.length > 0
              ? <ReactECharts option={realTop10Option} style={{ height: 300 }} />
              : <Empty description="数据暂未提供" />
            }
          </div>
        </Col>
      </Row>

      {/* 需求文档中"设备管理统计" / "检测业务统计" 暂无可用真实数据的项 —— 显式空态 */}
      <div className="dashboard-section">
        <h3><DatabaseOutlined /> 其他设备/业务统计指标</h3>
        <Row gutter={16}>
          <Col span={4}>
            <Card className="stat-card" hoverable>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span style={{ fontSize: 12, color: '#999' }}>使用中设备数<br />数据暂未提供</span>}
                style={{ padding: '8px 0' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card" hoverable>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span style={{ fontSize: 12, color: '#999' }}>闲置设备数<br />数据暂未提供</span>}
                style={{ padding: '8px 0' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card" hoverable>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span style={{ fontSize: 12, color: '#999' }}>设备利用率分析<br />需设备使用记录</span>}
                style={{ padding: '8px 0' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card" hoverable>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span style={{ fontSize: 12, color: '#999' }}>检测标准数量<br />数据暂未提供</span>}
                style={{ padding: '8px 0' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card" hoverable>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span style={{ fontSize: 12, color: '#999' }}>已完成实验项目数<br />数据暂未提供</span>}
                style={{ padding: '8px 0' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card" hoverable>
              <Statistic
                title="2025 在用设备数(台账)"
                value={equipmentInstrumentsCurrentCount}
                prefix={<ToolOutlined style={{ color: '#722ed1' }} />}
                suffix={<span style={{ fontSize: 13, color: '#999' }}>台</span>}
              />
              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>数据来源：实验室检测设备统计（1.9）</div>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  )
}
