import ReactECharts from 'echarts-for-react'

interface DataItem {
  name: string
  value: number
}

interface Props {
  data: DataItem[]
  height?: number
  yAxisName?: string
  barWidth?: number
  /** 渐变色起始/结束 */
  gradientFrom?: string
  gradientTo?: string
  labelRotate?: number
}

/**
 * 通用柱状排行图组件 —— 统一了 Dashboard / DeviceManage 中的柱图配置
 */
export default function BarRankChart({
  data,
  height = 300,
  yAxisName = '',
  barWidth = 28,
  gradientFrom = '#73d13d',
  gradientTo = '#389e0d',
  labelRotate = 30,
}: Props) {
  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#e6f0ff',
      textStyle: { color: '#333' },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: data.map(d => d.name),
      axisLabel: { rotate: labelRotate, fontSize: 11, color: '#666' },
      axisLine: { lineStyle: { color: '#e8e8e8' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      name: yAxisName,
      nameTextStyle: { color: '#888', padding: [0, 0, 0, 20] },
      axisLabel: { color: '#666' },
      splitLine: { lineStyle: { type: 'dashed' as const, color: '#f0f0f0' } },
    },
    series: [{
      type: 'bar',
      data: data.map(d => d.value),
      barWidth,
      label: { show: true, position: 'top' as const, color: '#666', fontWeight: 500 },
      itemStyle: {
        color: {
          type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: gradientFrom }, { offset: 1, color: gradientTo }],
        },
        borderRadius: [6, 6, 0, 0],
      },
    }],
  }

  return <ReactECharts option={option} style={{ height }} />
}
