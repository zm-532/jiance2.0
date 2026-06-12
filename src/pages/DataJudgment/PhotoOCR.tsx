import { useState, useCallback } from 'react'
import {
  Row, Col, Upload, Table, Tag, Button, Card, Space, Switch,
  message, Progress, Select, Input, Modal, Descriptions, Divider, Tooltip,
} from 'antd'
import {
  InboxOutlined, EyeOutlined, DeleteOutlined, CameraOutlined,
  CheckCircleOutlined, EditOutlined, ReloadOutlined,
} from '@ant-design/icons'
import { ocrRules, type OCRRule } from '../../mock/data'
import { recognizeImage, judgeResult, type OCRJobResult } from '../../services/ocr'

const { Dragger } = Upload
const { Option } = Select

interface OCRResultItem {
  id: string
  fileName: string
  file: File
  ocrRawText: string
  matchedRule: OCRRule | null
  testItem: string
  subItem: string
  recognizedValue: string
  standardRequirement: string
  judgment: '合格' | '不合格' | '待判定'
  status: '已识别' | '待确认' | '识别失败' | '识别中'
  includeInReport: boolean
  progress: number
  error?: string
}

export default function PhotoOCR() {
  const [results, setResults] = useState<OCRResultItem[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [ruleFilter, setRuleFilter] = useState<string>('')
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewItem, setPreviewItem] = useState<OCRResultItem | null>(null)

  // 根据 OCR 文本匹配规则
  const matchRule = useCallback((rawText: string, fileName: string): OCRRule | null => {
    const text = rawText.toLowerCase()
    const fn = fileName.toLowerCase()

    // 按文件名中的关键词匹配
    for (const rule of ocrRules) {
      if (!rule.hasImage) continue
      const item = rule.testItem.toLowerCase()
      const sub = rule.subItem.toLowerCase()
      // 文件名中包含检测项目关键词
      if (fn.includes(item.substring(0, 4)) || (sub && fn.includes(sub.substring(0, 3)))) {
        return rule
      }
    }

    // 按 OCR 文本中的关键词匹配
    for (const rule of ocrRules) {
      if (!rule.hasImage) continue
      const req = rule.standardRequirement.replace(/[≥≤<>]/g, '').toLowerCase()
      if (req && text.includes(req)) {
        return rule
      }
    }

    return null
  }, [])

  // 处理文件上传
  const handleUpload = useCallback(async (file: File) => {
    const id = `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // 先用文件名尝试匹配规则
    const preMatchedRule = ocrRules.find(r => {
      if (!r.hasImage) return false
      const item = r.testItem.toLowerCase()
      return file.name.toLowerCase().includes(item.substring(0, 4))
    })

    const newItem: OCRResultItem = {
      id,
      fileName: file.name,
      file,
      ocrRawText: '',
      matchedRule: preMatchedRule || null,
      testItem: preMatchedRule?.testItem || '待识别',
      subItem: preMatchedRule?.subItem || '',
      recognizedValue: '',
      standardRequirement: preMatchedRule?.standardRequirement || '',
      judgment: '待判定',
      status: '识别中',
      includeInReport: false,
      progress: 0,
    }

    setResults(prev => [newItem, ...prev])

    // 调用 OCR 服务
    const ocrResult = await recognizeImage(file, (statusText, progress) => {
      setResults(prev => prev.map(r =>
        r.id === id ? { ...r, progress: progress || 0 } : r
      ))
    })

    if (!ocrResult.success) {
      setResults(prev => prev.map(r =>
        r.id === id ? { ...r, status: '识别失败' as const, error: ocrResult.error, progress: 100 } : r
      ))
      return
    }

    const rawText = ocrResult.rawText
    const matchedRule = matchRule(rawText, file.name) || preMatchedRule || null

    let recognizedValue = ''
    let status: OCRResultItem['status'] = '待确认'

    if (matchedRule) {
      // 尝试从 OCR 文本中提取匹配的数值
      const values = extractValuesFromText(rawText, matchedRule)
      if (values.length > 0) {
        if (matchedRule.calculationMethod === 'average' && values.length > 1) {
          const nums = values.map(Number).filter(n => !isNaN(n))
          if (nums.length > 0) {
            const avg = nums.reduce((a, b) => a + b, 0) / nums.length
            recognizedValue = avg.toFixed(1)
            status = '已识别'
          }
        } else {
          recognizedValue = values[0]
          status = '已识别'
        }
      }
    }

    // 定性判定
    if (matchedRule?.ruleType === 'qualitative' || matchedRule?.ruleType === 'process') {
      if (rawText.includes('无裂纹') || rawText.includes('不裂')) {
        recognizedValue = '无裂纹'
        status = '已识别'
      } else if (rawText.includes('有裂纹') || rawText.includes('裂')) {
        recognizedValue = '有裂纹'
        status = '已识别'
      }
    }

    const judgment = matchedRule
      ? judgeResult(recognizedValue, matchedRule.standardRequirement)
      : '待判定'

    setResults(prev => prev.map(r => {
      if (r.id !== id) return r
      return {
        ...r,
        ocrRawText: rawText,
        matchedRule,
        testItem: matchedRule?.testItem || '未匹配',
        subItem: matchedRule?.subItem || '',
        recognizedValue: recognizedValue || '未识别到数值',
        standardRequirement: matchedRule?.standardRequirement || '',
        judgment,
        status: recognizedValue ? status : '待确认',
        progress: 100,
      } as OCRResultItem
    }))

    message.success(`${file.name} 识别完成`)
  }, [matchRule])

  // 从 OCR 文本中提取数值
  const extractValuesFromText = (text: string, rule: OCRRule): string[] => {
    const values: string[] = []
    const lines = text.split('\n')

    // 根据规则中的识别内容定位
    if (rule.recognitionContent) {
      // 尝试提取所有数字
      const numberPattern = /[-+]?\d+\.?\d*/g
      const allNumbers: string[] = []
      for (const line of lines) {
        const matches = line.match(numberPattern)
        if (matches) allNumbers.push(...matches)
      }

      // 根据前置条件过滤
      if (rule.preConditions) {
        const condNumbers = rule.preConditions.match(/\d+#?/g)
        if (condNumbers && condNumbers.length > 0) {
          // 取前N个数值
          const count = condNumbers.length
          return allNumbers.slice(0, count)
        }
      }

      return allNumbers.slice(0, 5)
    }

    // 通用提取
    const numberPattern = /[-+]?\d+\.?\d*/g
    const matches = text.match(numberPattern)
    if (matches) values.push(...matches.slice(0, 5))

    return values
  }

  // 人工确认
  const handleConfirm = (id: string) => {
    setResults(prev => prev.map(r => {
      if (r.id !== id) return r
      const judgment = r.matchedRule
        ? judgeResult(r.recognizedValue, r.matchedRule.standardRequirement)
        : '待判定'
      return { ...r, status: '已识别', judgment, includeInReport: true }
    }))
    message.success('已确认')
  }

  // 编辑识别值
  const handleEdit = (id: string) => {
    const item = results.find(r => r.id === id)
    if (item) {
      setEditingId(id)
      setEditValue(item.recognizedValue)
    }
  }

  const handleSaveEdit = () => {
    if (!editingId) return
    setResults(prev => prev.map(r => {
      if (r.id !== editingId) return r
      const judgment = r.matchedRule
        ? judgeResult(editValue, r.matchedRule.standardRequirement)
        : '待判定'
      return { ...r, recognizedValue: editValue, judgment, status: '已识别' }
    }))
    setEditingId(null)
    setEditValue('')
    message.success('已保存')
  }

  // 切换纳入报告
  const handleToggleReport = (id: string, checked: boolean) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, includeInReport: checked } : r))
  }

  // 删除结果
  const handleDelete = (id: string) => {
    setResults(prev => prev.filter(r => r.id !== id))
    setSelectedRowKeys(prev => prev.filter(k => k !== id))
  }

  // 查看详情
  const handlePreview = (item: OCRResultItem) => {
    setPreviewItem(item)
    setPreviewVisible(true)
  }

  // 重新识别
  const handleRetry = (item: OCRResultItem) => {
    handleDelete(item.id)
    handleUpload(item.file)
  }

  // 上传配置
  const uploadProps = {
    name: 'file',
    multiple: true,
    accept: 'image/*',
    showUploadList: false,
    customRequest: ({ file }: any) => {
      handleUpload(file as File)
    },
  }

  // 筛选后的规则列表（用于手动匹配）
  const filteredRules = ruleFilter
    ? ocrRules.filter(r =>
        r.hasImage && (
          r.sampleName.includes(ruleFilter) ||
          r.testItem.includes(ruleFilter) ||
          r.equipment.includes(ruleFilter)
        )
      )
    : []

  // 统计
  const totalItems = results.length
  const recognizedItems = results.filter(r => r.status === '已识别').length
  const pendingItems = results.filter(r => r.status === '待确认').length
  const failedItems = results.filter(r => r.status === '识别失败').length

  const columns = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      width: 180,
      ellipsis: true,
    },
    {
      title: '检测项目',
      key: 'testItem',
      width: 160,
      render: (_: any, record: OCRResultItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.testItem}</div>
          {record.subItem && <div style={{ fontSize: 11, color: '#999' }}>{record.subItem}</div>}
        </div>
      ),
    },
    {
      title: '标准要求',
      dataIndex: 'standardRequirement',
      key: 'standardRequirement',
      width: 100,
      align: 'center' as const,
    },
    {
      title: '识别结果',
      key: 'recognizedValue',
      width: 140,
      render: (_: any, record: OCRResultItem) => {
        if (record.status === '识别中') {
          return <Progress percent={record.progress} size="small" />
        }
        if (editingId === record.id) {
          return (
            <Space>
              <Input
                size="small"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                style={{ width: 80 }}
              />
              <Button type="link" size="small" onClick={handleSaveEdit}>保存</Button>
            </Space>
          )
        }
        return (
          <span style={{
            color: record.status === '已识别' ? '#52c41a' : record.status === '待确认' ? '#faad14' : '#f5222d',
            fontWeight: 600,
          }}>
            {record.recognizedValue || '-'}
          </span>
        )
      },
    },
    {
      title: '判定',
      dataIndex: 'judgment',
      key: 'judgment',
      width: 80,
      align: 'center' as const,
      render: (val: string) => {
        const color = val === '合格' ? 'green' : val === '不合格' ? 'red' : 'default'
        return <Tag color={color}>{val}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      align: 'center' as const,
      render: (val: string) => (
        <Tag color={val === '已识别' ? 'green' : val === '待确认' ? 'orange' : val === '识别中' ? 'blue' : 'red'}>
          {val}
        </Tag>
      ),
    },
    {
      title: '纳入报告',
      key: 'includeInReport',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: OCRResultItem) => (
        <Switch
          checked={record.includeInReport}
          onChange={(checked) => handleToggleReport(record.id, checked)}
          disabled={record.status === '识别失败' || record.status === '识别中'}
          size="small"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: OCRResultItem) => (
        <Space size={4}>
          {record.status === '待确认' && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(record.id)}>
              确认
            </Button>
          )}
          <Button type="link" size="small" icon={<EditOutlined />}
            onClick={() => handleEdit(record.id)}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<EyeOutlined />}
            onClick={() => handlePreview(record)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<ReloadOutlined />}
            onClick={() => handleRetry(record)}>
            重试
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}>
            删除
          </Button>
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
            支持 JPG、PNG、BMP 格式，系统将自动调用 PaddleOCR 识别照片中的检测数据
          </p>
        </Dragger>
      </div>

      {/* 统计概览 */}
      {totalItems > 0 && (
        <div className="dashboard-section" style={{ marginBottom: 20 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#1677ff' }}>{totalItems}</div>
                  <div style={{ color: '#999' }}>总识别数</div>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>{recognizedItems}</div>
                  <div style={{ color: '#999' }}>已识别</div>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#faad14' }}>{pendingItems}</div>
                  <div style={{ color: '#999' }}>待确认</div>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#f5222d' }}>{failedItems}</div>
                  <div style={{ color: '#999' }}>识别失败</div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )}

      {/* 照片归档预览 */}
      {results.length > 0 && (
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
      )}

      {/* OCR识别结果 */}
      <div className="dashboard-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ marginBottom: 0 }}>OCR识别结果</h3>
          <Space>
            {selectedRowKeys.length > 0 && (
              <span style={{ color: '#999', fontSize: 13 }}>
                已选择 {selectedRowKeys.length} 项
              </span>
            )}
            <Select
              placeholder="按样品/项目筛选规则"
              allowClear
              style={{ width: 200 }}
              size="small"
              onChange={v => setRuleFilter(v || '')}
            >
              {[...new Set(ocrRules.filter(r => r.hasImage).map(r => r.sampleName))].map(name => (
                <Option key={name} value={name}>{name}</Option>
              ))}
            </Select>
          </Space>
        </div>
        <Table
          dataSource={results}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          locale={{ emptyText: '暂无识别结果，请上传试验数据照片' }}
        />
      </div>

      {/* 详情弹窗 */}
      <Modal
        title="OCR 识别详情"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        width={700}
        footer={null}
      >
        {previewItem && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="文件名" span={2}>{previewItem.fileName}</Descriptions.Item>
              <Descriptions.Item label="检测项目">{previewItem.testItem}</Descriptions.Item>
              <Descriptions.Item label="判定指标">{previewItem.subItem || '-'}</Descriptions.Item>
              <Descriptions.Item label="标准要求">{previewItem.standardRequirement || '-'}</Descriptions.Item>
              <Descriptions.Item label="识别结果">
                <span style={{
                  color: previewItem.judgment === '合格' ? '#52c41a' : previewItem.judgment === '不合格' ? '#f5222d' : '#faad14',
                  fontWeight: 600,
                }}>
                  {previewItem.recognizedValue}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="判定结果" span={2}>
                <Tag color={previewItem.judgment === '合格' ? 'green' : previewItem.judgment === '不合格' ? 'red' : 'default'}>
                  {previewItem.judgment}
                </Tag>
              </Descriptions.Item>
              {previewItem.matchedRule && (
                <>
                  <Descriptions.Item label="检测设备">{previewItem.matchedRule.equipment}</Descriptions.Item>
                  <Descriptions.Item label="样品名称">{previewItem.matchedRule.sampleName}</Descriptions.Item>
                  <Descriptions.Item label="判定标准" span={2}>{previewItem.matchedRule.judgmentStandard}</Descriptions.Item>
                  <Descriptions.Item label="检测标准" span={2}>{previewItem.matchedRule.testStandard}</Descriptions.Item>
                </>
              )}
            </Descriptions>
            <Divider />
            <h4>OCR 识别内容</h4>
            <div
              className="ocr-content"
              style={{
                background: '#f5f5f5',
                padding: 12,
                borderRadius: 6,
                maxHeight: 400,
                overflow: 'auto',
                fontSize: 13,
              }}
              dangerouslySetInnerHTML={{ __html: previewItem.ocrRawText || '<span style="color:#999">无识别文本</span>' }}
            />
            {previewItem.matchedRule?.recognitionContent && (
              <>
                <Divider />
                <h4>识别规则</h4>
                <p><strong>前置条件：</strong>{previewItem.matchedRule.preConditions || '无'}</p>
                <p><strong>识别内容：</strong>{previewItem.matchedRule.recognitionContent}</p>
                <p><strong>计算方式：</strong>{previewItem.matchedRule.calculationMethod === 'average' ? '自动计算平均值' : '直接取值'}</p>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
