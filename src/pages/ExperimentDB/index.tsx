import { useState } from 'react'
import { Tabs, Card } from 'antd'
import {
  BarChartOutlined,
  ClockCircleOutlined,
  LineChartOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import SupplierStats from './SupplierStats'
import TimelinessStats from './TimelinessStats'
import VolumeStats from './VolumeStats'
import HistoryQuery from './HistoryQuery'

export default function ExperimentDB() {
  const [activeTab, setActiveTab] = useState('supplier')

  const tabItems = [
    {
      key: 'supplier',
      label: <span><BarChartOutlined /> 供应商检测数据统计</span>,
      children: <SupplierStats />,
    },
    {
      key: 'timeliness',
      label: <span><ClockCircleOutlined /> 检测时效性统计</span>,
      children: <TimelinessStats />,
    },
    {
      key: 'volume',
      label: <span><LineChartOutlined /> 样品检测量统计</span>,
      children: <VolumeStats />,
    },
    {
      key: 'history',
      label: <span><SearchOutlined /> 历史数据查询</span>,
      children: <HistoryQuery />,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>实验数据库</h2>
        <p>检测数据统计分析与历史查询</p>
      </div>
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />
      </Card>
    </div>
  )
}
