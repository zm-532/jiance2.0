import ReactECharts from 'echarts-for-react'

interface DataItem {
  name: string
  value: number
  color?: string
}

interface Props {
  data: DataItem[]
  height?: number
  /** 是否可滚动图例（数据项多时使用） */
  scrollLegend?: boolean
}

/**
 * 通用环形饼图组件 —— 统一了 Dashboard / DeviceManage 中 7+ 处重复的饼图配置
 */
export default function DonutPieChart({ data, height = 280, scrollLegend = false }: Props) {
  const option = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#e6f0ff',
      textStyle: { color: '#333' },
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      ...(scrollLegend ? { type: 'scroll' as const } : {}),
    },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold' as const, color: '#1a1a1a' },
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.15)' },
      },
      data: data
        .filter(d => d.value > 0)
        .map(d => ({
          name: d.name,
          value: d.value,
          itemStyle: d.color ? { color: d.color } : undefined,
        })),
    }],
  }

  return <ReactECharts option={option} style={{ height }} />
}
