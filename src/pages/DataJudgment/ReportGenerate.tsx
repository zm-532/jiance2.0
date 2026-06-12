import { useState } from 'react'
import { Row, Col, Card, Table, Tag, Button, Select, Space, Modal, Descriptions, Divider } from 'antd'
import { FileTextOutlined, EyeOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons'
import { reportTemplates, experimentRecords, capabilityItems } from '../../mock/data'

const { Option } = Select

export default function ReportGenerate() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [previewVisible, setPreviewVisible] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<string>('')

  // 根据模板筛选相关实验数据
  const template = reportTemplates.find(t => t.id === selectedTemplate)

  const relatedRecords = selectedTemplate && template
    ? experimentRecords.filter(r => {
        // 匹配：金属屏体→含"金属屏体"或"屏体"，亚克力→含"亚克力"，PC板→含"PC"
        const cat = template.category
        if (cat === '金属屏体') return r.sampleName.includes('屏体') || r.sampleName.includes('金属')
        if (cat === '亚克力') return r.sampleName.includes('亚克力') || r.sampleName.includes('透明')
        return r.sampleName.includes(cat)
      })
    : []

  // 根据模板筛选能力表检测项
  const relatedCapabilities = selectedTemplate && template
    ? capabilityItems.filter(c => {
        const cat = template.category
        if (cat === '金属屏体') return c.sampleName.includes('金属屏体')
        if (cat === '亚克力') return c.sampleName === '亚克力' || c.sampleName.includes('透明屏体')
        return c.sampleName.includes(cat)
      })
    : []

  const templateColumns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (val: string) => (
        <Space>
          <FileTextOutlined style={{ color: '#1677ff' }} />
          <span style={{ fontWeight: 500 }}>{val}</span>
        </Space>
      ),
    },
    { title: '适用类别', dataIndex: 'category', key: 'category', width: 120 },
    { title: '模板文件', dataIndex: 'file', key: 'file', width: 180, ellipsis: true },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80, align: 'center' as const },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={() => setSelectedTemplate(record.id)}
          >
            使用此模板
          </Button>
          <Button size="small" icon={<EyeOutlined />}>预览</Button>
        </Space>
      ),
    },
  ]

  const recordColumns = [
    { title: '委托单号', dataIndex: 'entrustNo', key: 'entrustNo', width: 150 },
    { title: '样品名称', dataIndex: 'sampleName', key: 'sampleName', width: 120 },
    { title: '生产厂家', dataIndex: 'manufacturer', key: 'manufacturer', width: 200, ellipsis: true },
    { title: '检测项目', dataIndex: 'testItem', key: 'testItem', width: 150 },
    {
      title: '判定结果',
      dataIndex: 'judgment',
      key: 'judgment',
      width: 100,
      align: 'center' as const,
      render: (val: string) => <Tag color={val === '合格' ? 'green' : 'red'}>{val}</Tag>,
    },
    { title: '检测结果', dataIndex: 'result', key: 'result', width: 100 },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => (
        <Button
          type="link"
          size="small"
          onClick={() => {
            setSelectedRecord(record.id)
            setPreviewVisible(true)
          }}
        >
          生成报告
        </Button>
      ),
    },
  ]

  const capabilityColumns = [
    { title: '样品名称', dataIndex: 'sampleName', key: 'sampleName', width: 120, ellipsis: true },
    { title: '检测项目', dataIndex: 'testItem', key: 'testItem', width: 200 },
    { title: '判定标准', dataIndex: 'judgmentStandard', key: 'judgmentStandard', width: 180, ellipsis: true },
    { title: '标准要求', dataIndex: 'standardRequirement', key: 'standardRequirement', width: 100, align: 'center' as const },
    { title: '检测标准', dataIndex: 'testStandard', key: 'testStandard', width: 160, ellipsis: true },
    { title: '检测设备', dataIndex: 'equipment', key: 'equipment', width: 160, ellipsis: true },
  ]

  const record = experimentRecords.find(r => r.id === selectedRecord)

  return (
    <div>
      {/* 模板选择 */}
      <div className="dashboard-section" style={{ marginBottom: 20 }}>
        <h3>选择报告模板</h3>
        <Table
          dataSource={reportTemplates}
          columns={templateColumns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      </div>

      {/* 关联能力表检测项 */}
      {selectedTemplate && relatedCapabilities.length > 0 && (
        <div className="dashboard-section" style={{ marginBottom: 20 }}>
          <h3>
            检测能力表
            <Tag color="blue" style={{ marginLeft: 8 }}>{template?.name}</Tag>
            <span style={{ color: '#999', fontSize: 13, marginLeft: 8 }}>共 {relatedCapabilities.length} 项检测能力</span>
          </h3>
          <Table
            dataSource={relatedCapabilities}
            columns={capabilityColumns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
          />
        </div>
      )}

      {/* 关联实验数据 */}
      {selectedTemplate && (
        <div className="dashboard-section" style={{ marginBottom: 20 }}>
          <h3>
            关联实验数据
            <Tag color="blue" style={{ marginLeft: 8 }}>{template?.name}</Tag>
          </h3>
          {relatedRecords.length > 0 ? (
            <Table
              dataSource={relatedRecords}
              columns={recordColumns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无匹配的实验数据，请先在实验数据库中录入数据
            </div>
          )}
        </div>
      )}

      {/* 报告预览弹窗 */}
      <Modal
        title="检测报告预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        width={800}
        footer={
          <Space>
            <Button icon={<PrinterOutlined />}>打印</Button>
            <Button icon={<DownloadOutlined />} type="primary">导出Word</Button>
            <Button onClick={() => setPreviewVisible(false)}>关闭</Button>
          </Space>
        }
      >
        {record && (
          <div style={{ background: '#fafafa', padding: 24, borderRadius: 8 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h2 style={{ marginBottom: 4 }}>检测报告</h2>
              <div style={{ color: '#999' }}>{template?.name}</div>
            </div>
            <Divider />
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="报告编号">RPT-{record.entrustNo}-{new Date().getTime().toString().slice(-6)}</Descriptions.Item>
              <Descriptions.Item label="委托单号">{record.entrustNo}</Descriptions.Item>
              <Descriptions.Item label="样品名称">{record.sampleName}</Descriptions.Item>
              <Descriptions.Item label="规格型号">{record.specModel}</Descriptions.Item>
              <Descriptions.Item label="生产厂家" span={2}>{record.manufacturer}</Descriptions.Item>
              <Descriptions.Item label="检测项目">{record.testItem}</Descriptions.Item>
              <Descriptions.Item label="判定标准">{template?.category}</Descriptions.Item>
              <Descriptions.Item label="标准要求">{record.requirement}</Descriptions.Item>
              <Descriptions.Item label="检测结果">
                <span style={{ color: record.judgment === '合格' ? '#52c41a' : '#f5222d', fontWeight: 600 }}>
                  {record.result}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="单项判定" span={2}>
                <Tag color={record.judgment === '合格' ? 'green' : 'red'} style={{ fontSize: 14 }}>
                  {record.judgment}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="检测日期">{record.date}</Descriptions.Item>
              <Descriptions.Item label="所属项目" span={2}>{record.project}</Descriptions.Item>
            </Descriptions>
            <Divider />
            <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
              此报告由系统自动生成 | 宜塔报告模板 {template?.version}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
