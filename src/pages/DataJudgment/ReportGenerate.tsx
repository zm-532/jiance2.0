import { useEffect, useState } from 'react'
import {
  Row, Col, Card, Table, Tag, Button, Select, Space, Modal,
  Descriptions, Divider, Empty, Image, Tooltip, message,
} from 'antd'
import {
  FileTextOutlined, DownloadOutlined, PrinterOutlined,
  CameraOutlined, LinkOutlined, BarChartOutlined,
} from '@ant-design/icons'
import { reportTemplates, experimentRecords, capabilityItems } from '../../mock/data'
import { listPhotos, type ArchivedPhoto } from '../../services/ocr'

const { Option } = Select

export default function ReportGenerate() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [previewVisible, setPreviewVisible] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<string>('')

  // 当前选中样品关联的 OCR 归档照片（仅 includeInReport=true 的进入报告）
  const [reportPhotos, setReportPhotos] = useState<ArchivedPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)

  const template = reportTemplates.find(t => t.id === selectedTemplate)

  // 关联实验数据:按模板真实 sampleKeyword 匹配(docx 中实际写的样品名)
  const relatedRecords = selectedTemplate && template
    ? experimentRecords.filter(r => r.sampleName.includes(template.sampleKeyword))
    : []

  // 检测能力表:按模板真实 sampleKeyword 匹配
  const relatedCapabilities = selectedTemplate && template
    ? capabilityItems.filter(c => c.sampleName.includes(template.sampleKeyword))
    : []

  const record = experimentRecords.find(r => r.id === selectedRecord)

  // 打开预览时拉取对应的 OCR 归档照片
  useEffect(() => {
    if (!previewVisible || !record) {
      setReportPhotos([])
      return
    }
    let cancelled = false
    setPhotosLoading(true)
    Promise.all([
      listPhotos({ entrustNo: record.entrustNo, includeInReport: true }).catch(() => []),
      listPhotos({ sampleName: record.sampleName, includeInReport: true }).catch(() => []),
    ])
      .then(([byEntrust, bySample]) => {
        const map = new Map<string, ArchivedPhoto>()
        for (const item of [...byEntrust, ...bySample]) map.set(item.id, item)
        if (!cancelled) setReportPhotos(Array.from(map.values()))
      })
      .catch(err => {
        console.error('[Report] 加载 OCR 归档失败:', err)
        if (!cancelled) message.warning(`未加载到 OCR 照片：${err.message}`)
      })
      .finally(() => {
        if (!cancelled) setPhotosLoading(false)
      })
    return () => { cancelled = true }
  }, [previewVisible, record])

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
    { title: '模板文件', dataIndex: 'file', key: 'file', width: 200, ellipsis: true },
    { title: '总页数', dataIndex: 'pageCount', key: 'pageCount', width: 80, align: 'center' as const,
      render: (v: number | null) => v == null ? <span style={{ color: '#ccc' }}>-</span> : <Tag>{v} 页</Tag>,
    },
    { title: '含图谱', dataIndex: 'hasChart', key: 'hasChart', width: 80, align: 'center' as const,
      render: (v: boolean) => v
        ? <Tag color="green" icon={<BarChartOutlined />}>是</Tag>
        : <Tag color="default">否</Tag>,
    },
    { title: '试验前后对比', dataIndex: 'hasPrePostTest', key: 'hasPrePostTest', width: 110, align: 'center' as const,
      render: (v: boolean) => v
        ? <Tag color="purple">含</Tag>
        : <Tag color="default">无</Tag>,
    },
    { title: '版本', dataIndex: 'version', key: 'version', width: 70, align: 'center' as const },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <Button
          type="primary"
          size="small"
          onClick={() => setSelectedTemplate(record.id)}
        >
          使用此模板
        </Button>
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
        width={900}
        footer={
          <Space>
            <Button icon={<PrinterOutlined />} disabled>打印</Button>
            <Tooltip title="缺少 Word 模板字段映射和后端导出服务，当前不能生成最终报告文件">
              <Button icon={<DownloadOutlined />} type="primary" disabled>导出Word（缺数据）</Button>
            </Tooltip>
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

            {/* 试验数据照片附件区：来自 OCR 归档，includeInReport=true */}
            <Divider orientation="left" plain>
              <Space>
                <CameraOutlined />
                检测照片附件
                <Tag color="purple">{reportPhotos.length}</Tag>
              </Space>
            </Divider>

            {photosLoading ? (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>加载归档照片...</div>
            ) : reportPhotos.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: '#999' }}>
                    当前样品暂无纳入报告的 OCR 归档照片
                    <br />
                    请到「OCR识别」页面上传照片，并将「纳入报告」开关打开
                  </span>
                }
                style={{ padding: '12px 0' }}
              />
            ) : (
              <Row gutter={[12, 12]}>
                {reportPhotos.map(p => (
                  <Col span={8} key={p.id}>
                    <Card
                      size="small"
                      hoverable
                      cover={
                        <div style={{
                          height: 140, background: '#f0f2f5',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden',
                        }}>
                          <Image
                            src={p.photoUrl}
                            width="100%"
                            height={140}
                            style={{ objectFit: 'cover' }}
                            preview={{ mask: '点击查看大图' }}
                          />
                        </div>
                      }
                    >
                      <Card.Meta
                        title={
                          <Tooltip title={p.originalName}>
                            <span style={{ fontSize: 12 }}>{p.originalName}</span>
                          </Tooltip>
                        }
                        description={
                          <Space direction="vertical" size={2} style={{ width: '100%' }}>
                            <Space size={4} wrap>
                              <Tag color="blue" style={{ fontSize: 11 }}>{p.testItem || '未匹配'}</Tag>
                              <Tag color={p.judgment === '合格' ? 'green' : p.judgment === '不合格' ? 'red' : 'default'} style={{ fontSize: 11 }}>
                                {p.recognizedValue || '-'} · {p.judgment}
                              </Tag>
                            </Space>
                            <Space size={4} style={{ marginTop: 4 }}>
                              <Button
                                size="small"
                                type="link"
                                icon={<LinkOutlined />}
                                onClick={() => window.open(p.photoUrl, '_blank')}
                                style={{ padding: 0 }}
                              >
                                原图
                              </Button>
                              <Button
                                size="small"
                                type="link"
                                icon={<DownloadOutlined />}
                                onClick={() => window.open(`/api/ocr/photos/${p.id}/download`, '_blank')}
                                style={{ padding: 0 }}
                              >
                                下载
                              </Button>
                            </Space>
                          </Space>
                        }
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            )}

            <Divider />
            <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
              此报告由系统自动生成 | 宜塔报告模板 {template?.version}
              <br />
              <span style={{ fontSize: 11 }}>
                说明：当前缺少 Word 模板字段映射和后端导出服务，暂不生成最终报告文件；已纳入报告的照片提供原图访问与下载链接。
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
