import { Tabs, Card } from 'antd'
import { CameraOutlined, FileTextOutlined } from '@ant-design/icons'
import PhotoOCR from './PhotoOCR'
import ReportGenerate from './ReportGenerate'

export default function DataJudgment() {
  const tabItems = [
    {
      key: 'photo-ocr',
      label: <span><CameraOutlined /> 试验数据照片识别</span>,
      children: <PhotoOCR />,
    },
    {
      key: 'report-gen',
      label: <span><FileTextOutlined /> 检测报告自动生成</span>,
      children: <ReportGenerate />,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>数据源判定</h2>
        <p>试验数据照片OCR识别与检测报告自动生成</p>
      </div>
      <Card>
        <Tabs items={tabItems} size="large" />
      </Card>
    </div>
  )
}
