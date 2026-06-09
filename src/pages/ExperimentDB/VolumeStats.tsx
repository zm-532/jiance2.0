import { useState, useMemo } from 'react'
import { Row, Col, Select, DatePicker, Statistic } from 'antd'
import ReactECharts from 'echarts-for-react'
import { monthlyTestVolume, manufacturers } from '../../mock/data'
import dayjs, { Dayjs } from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select

type TimeDimension = 'year' | 'quarter' | 'month' | 'week' | 'custom'

export default function VolumeStats() {
  const [dimension, setDimension] = useState<TimeDimension>('month')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])

  // 按维度聚合数据
  const getChartData = () => {
    let data = [...monthlyTestVolume]

    // 自定义时间段筛选
    if (dimension === 'custom' && dateRange[0] && dateRange[1]) {
      data = data.filter(d => {
        const m = dayjs(d.month + '-01')
        return m.isAfter(dateRange[0]!.startOf('month').subtract(1, 'day')) &&
               m.isBefore(dateRange[1]!.endOf('month').add(1, 'day'))
      })
    }

    if (dimension === 'quarter') {
      const quarters: Record<string, { total: number; qualified: number; unqualified: number }> = {}
      data.forEach(d => {
        const month = parseInt(d.month.split('-')[1])
        const q = Math.ceil(month / 3)
        const key = `${d.month.split('-')[0]}Q${q}`
        if (!quarters[key]) quarters[key] = { total: 0, qualified: 0, unqualified: 0 }
        quarters[key].total += d.total
        quarters[key].qualified += d.qualified
        quarters[key].unqualified += d.unqualified
      })
      return Object.entries(quarters).map(([k, v]) => ({ label: k, ...v }))
    }

    if (dimension === 'year') {
      const years: Record<string, { total: number; qualified: number; unqualified: number }> = {}
      data.forEach(d => {
        const year = d.month.split('-')[0]
        if (!years[year]) years[year] = { total: 0, qualified: 0, unqualified: 0 }
        years[year].total += d.total
        years[year].qualified += d.qualified
        years[year].unqualified += d.unqualified
      })
      return Object.entries(years).map(([k, v]) => ({ label: k, ...v }))
    }

    return data.map(d => ({ label: d.month, total: d.total, qualified: d.qualified, unqualified: d.unqualified }))
  }

  const chartData = getChartData()

  const barOption = {
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e6f0ff', textStyle: { color: '#333' } },
    legend: { data: ['总检测量', '合格', '不合格'], bottom: 0, icon: 'circle', itemWidth: 10, itemHeight: 10 },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: chartData.map(d => d.label),
      axisLabel: { rotate: chartData.length > 6 ? 30 : 0, color: '#666' },
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
        type: 'bar',
        data: chartData.map(d => d.total),
        itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] },
        barWidth: chartData.length > 6 ? 20 : 40,
      },
      {
        name: '合格',
        type: 'bar',
        data: chartData.map(d => d.qualified),
        itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] },
        barWidth: chartData.length > 6 ? 20 : 40,
      },
      {
        name: '不合格',
        type: 'bar',
        data: chartData.map(d => d.unqualified),
        itemStyle: { color: '#ff4d4f', borderRadius: [4, 4, 0, 0] },
        barWidth: chartData.length > 6 ? 20 : 40,
      },
    ],
  }

  const trendOption = {
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e6f0ff', textStyle: { color: '#333' } },
    legend: { data: ['检测量', '合格率'], bottom: 0, icon: 'circle', itemWidth: 10, itemHeight: 10 },
    grid: { left: '3%', right: '5%', bottom: '10%', top: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: monthlyTestVolume.map(d => d.month),
      axisLabel: { rotate: 30, color: '#666' },
      axisLine: { lineStyle: { color: '#e8e8e8' } },
    },
    yAxis: [
      { 
        type: 'value', name: '检测量', nameTextStyle: { color: '#888' },
        axisLabel: { color: '#666' },
        splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } }
      },
      { 
        type: 'value', name: '合格率(%)', max: 100, 
        nameTextStyle: { color: '#888' },
        axisLabel: { formatter: '{value}%', color: '#666' },
        splitLine: { show: false }
      },
    ],
    series: [
      {
        name: '检测量',
        type: 'bar',
        data: monthlyTestVolume.map(d => d.total),
        itemStyle: { 
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#4096ff' }, { offset: 1, color: '#0958d9' }]
          }, 
          borderRadius: [4, 4, 0, 0] 
        },
        barWidth: 20,
      },
      {
        name: '合格率',
        type: 'line',
        yAxisIndex: 1,
        data: monthlyTestVolume.map(d => +((d.qualified / d.total) * 100).toFixed(1)),
        itemStyle: { color: '#52c41a', borderWidth: 2 },
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3 },
      },
    ],
  }

  const totalTests = chartData.reduce((s, d) => s + d.total, 0)
  const totalQualified = chartData.reduce((s, d) => s + d.qualified, 0)

  return (
    <div>
      {/* 筛选器 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={5}>
          <div style={{ marginBottom: 8, color: '#666' }}>时间维度</div>
          <Select value={dimension} onChange={setDimension} style={{ width: '100%' }}>
            <Option value="year">年度</Option>
            <Option value="quarter">季度</Option>
            <Option value="month">月度</Option>
            <Option value="week">周度</Option>
            <Option value="custom">自定义时间段</Option>
          </Select>
        </Col>
        {dimension === 'custom' && (
          <Col span={6}>
            <div style={{ marginBottom: 8, color: '#666' }}>选择时间范围</div>
            <RangePicker
              picker="month"
              style={{ width: '100%' }}
              onChange={(dates) => setDateRange(dates || [null, null])}
            />
          </Col>
        )}
        <Col span={5}>
          <div style={{ marginBottom: 8, color: '#666' }}>供应商筛选</div>
          <Select value={supplierFilter} onChange={setSupplierFilter} style={{ width: '100%' }}>
            <Option value="all">全部供应商</Option>
            {manufacturers.map(m => <Option key={m} value={m}>{m}</Option>)}
          </Select>
        </Col>
        <Col span={4}>
          <Statistic title="检测量" value={totalTests} suffix="批次" />
        </Col>
        <Col span={4}>
          <Statistic title="合格率" value={totalTests > 0 ? +((totalQualified / totalTests) * 100).toFixed(1) : 0} suffix="%" valueStyle={{ color: '#52c41a' }} />
        </Col>
      </Row>

      {/* 检测量柱状图 */}
      <div className="dashboard-section" style={{ marginBottom: 20 }}>
        <h3>{dimension === 'year' ? '年度' : dimension === 'quarter' ? '季度' : dimension === 'custom' ? '自定义时间段' : '月度'}检测量统计</h3>
        <ReactECharts option={barOption} style={{ height: 320 }} />
      </div>

      {/* 趋势图 */}
      <div className="dashboard-section">
        <h3>检测趋势与合格率</h3>
        <ReactECharts option={trendOption} style={{ height: 320 }} />
      </div>
    </div>
  )
}
