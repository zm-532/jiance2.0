import { useState } from 'react'
import { Row, Col, Upload, Table, Tag, Button, Card, Space, Switch, message, Image } from 'antd'
import { UploadOutlined, InboxOutlined, EyeOutlined, DeleteOutlined, CameraOutlined } from '@ant-design/icons'

const { Dragger } = Upload

interface OCRResult {
  id: string
  fileName: string
  testItem: string
  recognizedValue: string
  confidence: number
  status: '已识别' | '待确认' | '识别失败'
  includeInReport: boolean
}

const mockOCRResults: OCRResult[] = [
  { id: '1', fileName: '拉伸强度_20260423.jpg', testItem: '拉伸强度MPa', recognizedValue: '157', confidence: 98.5, status: '已识别', includeInReport: true },
  { id: '2', fileName: '断裂伸长率_20260423.jpg', testItem: '断裂伸长率%', recognizedValue: '17', confidence: 97.2, status: '已识别', includeInReport: true },
  { id: '3', fileName: '保证载荷_20260423.jpg', testItem: '保证载荷', recognizedValue: '577207', confidence: 99.1, status: '已识别', includeInReport: true },
  { id: '4', fileName: '干附着力_20260423.jpg', testItem: '干附着力', recognizedValue: '0级', confidence: 85.3, status: '待确认', includeInReport: false },
  { id: '5', fileName: '透光率_20260418.jpg', testItem: '透光率%', recognizedValue: '无法识别', confidence: 0, status: '识别失败', includeInReport: false },
]

export default function PhotoOCR() {
  const [results, setResults] = useState<OCRResult[]>(mockOCRResults)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  const handleToggleReport = (id: string, checked: boolean) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, includeInReport: checked } : r))
  }

  const uploadProps = {
    name: 'file',
    multiple: true,
    action: '#',
    accept: 'image/*',
    beforeUpload: () => {
      message.info('演示模式：文件不会实际上传')
      return false
    },
  }

  const columns = [
    { title: '文件名', dataIndex: 'fileName', key: 'fileName', width: 200 },
    { title: '检测项目', dataIndex: 'testItem', key: 'testItem', width: 150 },
    {
      title: '识别结果',
      dataIndex: 'recognizedValue',
      key: 'recognizedValue',
      width: 120,
      render: (val: string, record: OCRResult) => (
        <span style={{
          color: record.status === '已识别' ? '#52c41a' : record.status === '待确认' ? '#faad14' : '#f5222d',
          fontWeight: 600,
        }}>
          {val}
        </span>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      align: 'center' as const,
      render: (val: number) => val > 0 ? `${val}%` : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as const,
      render: (val: string) => (
        <Tag color={val === '已识别' ? 'green' : val === '待确认' ? 'orange' : 'red'}>{val}</Tag>
      ),
    },
    {
      title: '纳入报告',
      key: 'includeInReport',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: OCRResult) => (
        <Switch
          checked={record.includeInReport}
          onChange={(checked) => handleToggleReport(record.id, checked)}
          disabled={record.status === '识别失败'}
          size="small"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: () => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 上传区域 */}
      <div className="dashboard-section" style={{ marginBottom: 20 }}>
        <h3>上传试验数据照片</h3>
        <Dragger {...uploadProps} style={{ padding: '20px 0' }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#1677ff' }} />
          </p>
          <p className="ant-upload-text">点击或拖拽照片到此区域上传</p>
          <p className="ant-upload-hint">
            支持 JPG、PNG、BMP 格式，系统将自动识别照片中的检测数据
          </p>
        </Dragger>
      </div>

      {/* 照片归档预览 */}
      <div className="dashboard-section" style={{ marginBottom: 20 }}>
        <h3>已上传照片归档</h3>
        <Row gutter={[12, 12]}>
          {results.filter(r => r.status !== '识别失败').map(r => (
            <Col span={4} key={r.id}>
              <Card
                size="small"
                hoverable
                cover={
                  <div style={{
                    height: 100,
                    background: '#f0f2f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999',
                  }}>
                    <CameraOutlined style={{ fontSize: 32 }} />
                  </div>
                }
              >
                <Card.Meta
                  title={<span style={{ fontSize: 12 }}>{r.fileName}</span>}
                  description={<Tag color="blue" style={{ fontSize: 11 }}>{r.testItem}</Tag>}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* OCR识别结果 */}
      <div className="dashboard-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ marginBottom: 0 }}>OCR识别结果</h3>
          <Space>
            <span style={{ color: '#999', fontSize: 13 }}>
              已选择 {selectedRowKeys.length} 项
            </span>
            <Button type="primary" size="small" disabled={selectedRowKeys.length === 0}>
              批量纳入报告
            </Button>
          </Space>
        </div>
        <Table
          dataSource={results}
          columns={columns}
          rowKey="id"
          size="small"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
        />
      </div>
    </div>
  )
}
