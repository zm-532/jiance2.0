import { useState, useMemo } from 'react'
import { Row, Col, Select, DatePicker, Statistic } from 'antd'
import ReactECharts from 'echarts-for-react'
import { experimentRecords, manufacturers } from '../../mock/data'
import dayjs, { Dayjs } from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(isoWeek)

const { RangePicker } = DatePicker
const { Option } = Select

type TimeDimension = 'year' | 'quarter' | 'month' | 'week' | 'custom'

export default function VolumeStats() {
  const [dimension, setDimension] = useState<TimeDimension>('month')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])

  // 按供应商和时间维度从原始记录聚合
  const chartData = useMemo(() => {
    // 1) 按供应商筛选
    let records = experimentRecords
    if (supplierFilter !== 'all') {
      records = records.filter(r => r.manufacturer === supplierFilter)
    }

    // 2) 按时间段筛选
    if (dimension === 'custom' && dateRange[0] && dateRange[1]) {
      records = records.filter(r => {
        const d = dayjs(r.testDate || r.receiveDate)
        return d.isValid() &&
          d.isAfter(dateRange[0]!.startOf('month').subtract(1, 'day')) &&
          d.isBefore(dateRange[1]!.endOf('month').add(1, 'day'))
      })
    }

    // 3) 按时间维度聚合
    const buckets: Record<string, { total: number; qualified: number; unqualified: number; pending: number }> = {}

    for (const r of records) {
      const date = dayjs(r.testDate || r.receiveDate)
      if (!date.isValid()) continue

      let label: string
      if (dimension === 'year') {
        label = date.format('YYYY')
      } else if (dimension === 'quarter') {
        const quarter = Math.floor(date.month() / 3) + 1
        label = `${date.format('YYYY')}Q${quarter}`
      } else if (dimension === 'week') {
        label = `${date.format('YYYY')}W${String(date.isoWeek()).padStart(2, '0')}`
      } else if (dimension === 'custom') {
        label = date.format('YYYY-MM')
      } else {
        label = date.format('YYYY-MM')
      }

      if (!buckets[label]) {
        buckets[label] = { total: 0, qualified: 0, unqualified: 0, pending: 0 }
      }
      buckets[label].total++
      if (r.judgment === '合格') buckets[label].qualified++
      else if (r.judgment === '不合格') buckets[label].unqualified++
      else buckets[label].pending++
    }

    // 按时间排序
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, v]) => ({ label, ...v }))
  }, [dimension, supplierFilter, dateRange])

  // 趋势图始终显示全部供应商的月度数据（不受筛选影响）
  const trendData = useMemo(() => {
    const buckets: Record<string, { total: number; qualified: number }> = {}
    for (const r of experimentRecords) {
      const date = dayjs(r.testDate || r.receiveDate)
      if (!date.isValid()) continue
      const label = date.format('YYYY-MM')
      if (!buckets[label]) buckets[label] = { total: 0, qualified: 0 }
      buckets[label].total++
      if (r.judgment === '合格') buckets[label].qualified++
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, v]) => ({ label, ...v }))
  }, [])

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
      data: trendData.map(d => d.label),
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
        data: trendData.map(d => d.total),
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
        data: trendData.map(d => d.total > 0 ? +((d.qualified / d.total) * 100).toFixed(1) : 0),
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
        <h3>
          {supplierFilter !== 'all' ? `${supplierFilter} - ` : ''}
          {dimension === 'year' ? '年度' : dimension === 'quarter' ? '季度' : dimension === 'week' ? '周度' : dimension === 'custom' ? '自定义时间段' : '月度'}检测量统计
        </h3>
        {chartData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>当前筛选条件下暂无数据</div>
        ) : (
          <ReactECharts option={barOption} style={{ height: 320 }} />
        )}
      </div>

      {/* 趋势图 - 始终显示全部供应商的月度趋势 */}
      <div className="dashboard-section">
        <h3>检测趋势与合格率（全部供应商）</h3>
        <ReactECharts option={trendOption} style={{ height: 320 }} />
      </div>
    </div>
  )
}
