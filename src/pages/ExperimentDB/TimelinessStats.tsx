import { Row, Col, Table, Select, Statistic, Alert, Tag } from 'antd'
import ReactECharts from 'echarts-for-react'
import { useState } from 'react'
import { timelinessData } from '../../mock/data'

const { Option } = Select

export default function TimelinessStats() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [testItemFilter, setTestItemFilter] = useState<string>('all')

  const categories = [...new Set(timelinessData.map(d => d.category))]

  // 按材料类型筛选后，联动可用的检测项目
  const baseFiltered = categoryFilter === 'all'
    ? timelinessData
    : timelinessData.filter(d => d.category === categoryFilter)

  const availableTestItems = [...new Set(baseFiltered.map(d => d.testItem))]

  const filtered = testItemFilter === 'all'
    ? baseFiltered
    : baseFiltered.filter(d => d.testItem === testItemFilter)

  const computable = filtered.filter(d => d.avgDays != null && d.validSampleCount > 0)
  const overallAvg = computable.length > 0
    ? +(computable.reduce((s, d) => s + (d.avgDays || 0) * d.validSampleCount, 0) /
      computable.reduce((s, d) => s + d.validSampleCount, 0)).toFixed(1)
    : null

  // 柱状图
  const barOption = {
    tooltip: { trigger: 'axis', formatter: (params: any) => `${params[0].name}<br/>平均检测时效: ${params[0].value} 天`, backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e6f0ff', textStyle: { color: '#333' } },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: filtered.map(d => `${d.category}-${d.testItem}`),
      axisLabel: { rotate: 35, fontSize: 11, color: '#666' },
      axisLine: { lineStyle: { color: '#e8e8e8' } },
    },
    yAxis: { 
      type: 'value', name: '天数',
      nameTextStyle: { color: '#888' },
      axisLabel: { color: '#666' },
      splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } }
    },
    series: [{
      type: 'bar',
      data: filtered.map(d => ({
        value: d.avgDays,
        itemStyle: {
          color: d.avgDays == null ? '#d9d9d9' : d.avgDays <= 2 ? {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#73d13d' }, { offset: 1, color: '#389e0d' }]
          } : d.avgDays <= 4 ? {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#4096ff' }, { offset: 1, color: '#0958d9' }]
          } : {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#ffc53d' }, { offset: 1, color: '#d48806' }]
          },
          borderRadius: [4, 4, 0, 0]
        },
      })),
      barWidth: 30,
      label: {
        show: true,
        position: 'top',
        formatter: (params: any) => params.value == null ? '缺数据' : `${params.value}天`,
        color: '#666'
      },
    }],
  }

  const columns = [
    { title: '材料类型', dataIndex: 'category', key: 'category', width: 120 },
    { title: '检测项目', dataIndex: 'testItem', key: 'testItem', width: 220 },
    {
      title: '平均检测时效（天）',
      dataIndex: 'avgDays',
      key: 'avgDays',
      align: 'center' as const,
      sorter: (a: any, b: any) => (a.avgDays ?? 9999) - (b.avgDays ?? 9999),
      render: (val: number | null, record: any) => val == null
        ? <Tag color="default">{record.missingReason || '缺数据'}</Tag>
        : (
          <span style={{ color: val <= 2 ? '#52c41a' : val <= 4 ? '#1677ff' : '#faad14', fontWeight: 600 }}>
            {val} 天
          </span>
        ),
    },
    { title: '有效样本', dataIndex: 'validSampleCount', key: 'validSampleCount', align: 'center' as const },
    { title: '总样本数量', dataIndex: 'sampleCount', key: 'sampleCount', align: 'center' as const },
    {
      title: '数据状态',
      dataIndex: 'missingReason',
      key: 'missingReason',
      ellipsis: true,
      render: (val: string) => val ? <Tag>{val}</Tag> : <Tag color="green">可计算</Tag>,
    },
  ]

  return (
    <div>
      <Alert
        message="时效性说明"
        description="检测时效性 = 实际检测日期 - 收样日期。当前只对具备收样/检测日期且不涉及老化扣除规则的记录计算工作日时效；周六/周日已剔除，当天收样当天完成计为0.5天。法定节假日表和老化时长规则缺失时，系统显示“缺数据”而不生成估算值。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        closable
      />

      {/* 筛选和统计 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={5}>
          <div style={{ marginBottom: 8, color: '#666' }}>材料类型</div>
          <Select
            value={categoryFilter}
            onChange={(v) => { setCategoryFilter(v); setTestItemFilter('all') }}
            style={{ width: '100%' }}
          >
            <Option value="all">全部类型</Option>
            {categories.map(c => <Option key={c} value={c}>{c}</Option>)}
          </Select>
        </Col>
        <Col span={5}>
          <div style={{ marginBottom: 8, color: '#666' }}>检测项目</div>
          <Select
            value={testItemFilter}
            onChange={setTestItemFilter}
            style={{ width: '100%' }}
          >
            <Option value="all">全部项目</Option>
            {availableTestItems.map(t => <Option key={t} value={t}>{t}</Option>)}
          </Select>
        </Col>
        <Col span={4}>
          <Statistic title="平均检测时效" value={overallAvg == null ? '缺数据' : overallAvg} suffix={overallAvg == null ? '' : '天'} />
        </Col>
        <Col span={5}>
          <Statistic title="检测项目数" value={filtered.length} suffix="项" />
        </Col>
        <Col span={5}>
          <Statistic title="有效样本数" value={filtered.reduce((s, d) => s + d.validSampleCount, 0)} suffix="个" />
        </Col>
      </Row>

      {/* 图表 */}
      <div className="dashboard-section" style={{ marginBottom: 20 }}>
        <h3>检测时效性分布</h3>
        <ReactECharts option={barOption} style={{ height: 320 }} />
      </div>

      {/* 表格 */}
      <div className="dashboard-section">
        <h3>检测时效性明细</h3>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey={(_, idx) => idx!.toString()}
          pagination={false}
          size="small"
        />
      </div>
    </div>
  )
}
