import { Modal, Row, Col, Image, Tag, Descriptions, Divider, Table, Button, Space } from 'antd'
import { DownloadOutlined, LinkOutlined } from '@ant-design/icons'
import type { OCRResultItem } from '../hooks/usePhotoOCR'

interface Props {
  visible: boolean
  item: OCRResultItem | null
  onClose: () => void
  onDownload: (item: OCRResultItem) => void
}

export default function DetailModal({ visible, item, onClose, onDownload }: Props) {
  return (
    <Modal
      title="OCR 识别详情"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={
        item && (
          <Space>
            <Button icon={<DownloadOutlined />} onClick={() => onDownload(item)}>下载原始照片</Button>
            <Button icon={<LinkOutlined />} onClick={() => window.open(item.photoUrl, '_blank')}>查看原图</Button>
            <Button onClick={onClose}>关闭</Button>
          </Space>
        )
      }
    >
      {item && (
        <div>
          <Row gutter={16}>
            <Col span={10}>
              <div style={{ border: '1px solid #e8e8e8', borderRadius: 6, overflow: 'hidden', background: '#fafafa', textAlign: 'center' }}>
                <Image src={item.photoUrl} style={{ maxHeight: 320, objectFit: 'contain' }} />
              </div>
              <div style={{ marginTop: 8, textAlign: 'center' }}>
                <Tag color={item.includeInReport ? 'purple' : 'default'}>
                  {item.includeInReport ? '已纳入报告' : '未纳入报告'}
                </Tag>
              </div>
            </Col>
            <Col span={14}>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="文件名">{item.fileName}</Descriptions.Item>
                <Descriptions.Item label="检测项目">{item.testItem}</Descriptions.Item>
                <Descriptions.Item label="判定指标">{item.subItem || '-'}</Descriptions.Item>
                <Descriptions.Item label="标准要求">{item.standardRequirement || '-'}</Descriptions.Item>
                <Descriptions.Item label="识别结果">
                  <span style={{
                    color: item.judgment === '合格' ? '#52c41a' : item.judgment === '不合格' ? '#f5222d' : '#faad14',
                    fontWeight: 600,
                  }}>{item.recognizedValue}</span>
                </Descriptions.Item>
                <Descriptions.Item label="判定结果">
                  <Tag color={item.judgment === '合格' ? 'green' : item.judgment === '不合格' ? 'red' : 'default'}>
                    {item.judgment}
                  </Tag>
                </Descriptions.Item>
                {item.matchedRule && (
                  <>
                    <Descriptions.Item label="检测设备">{item.matchedRule.equipment}</Descriptions.Item>
                    <Descriptions.Item label="样品名称">{item.matchedRule.sampleName}</Descriptions.Item>
                    <Descriptions.Item label="判定标准">{item.matchedRule.judgmentStandard}</Descriptions.Item>
                    <Descriptions.Item label="检测标准">{item.matchedRule.testStandard}</Descriptions.Item>
                  </>
                )}
              </Descriptions>
            </Col>
          </Row>
          <Divider />
          <h4>OCR 识别内容</h4>
          {item.tables && item.tables.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              {item.tables.map((t, ti) => (
                <div key={ti} style={{ overflowX: 'auto', marginBottom: 12 }}>
                  <Table
                    size="small" bordered pagination={false}
                    dataSource={t.rows.map((row, ri) => ({ key: ri, cells: row }))}
                    columns={[
                      { title: '#', dataIndex: 'key', key: 'key', width: 50, render: (k: number) => <span style={{ color: '#999' }}>{k + 1}</span> },
                      ...(t.rows[0]?.length
                        ? Array.from({ length: t.rows[0].length }, (_, ci) => ({
                            title: ci === 0 ? '指标' : `值${ci}`,
                            dataIndex: 'cells', key: `c${ci}`,
                            render: (cells: string[]) => (
                              <span style={{ fontWeight: ci === 0 ? 500 : 400, color: /^[-+]?\d/.test(cells[ci] || '') ? '#1677ff' : undefined }}>
                                {cells[ci] ?? ''}
                              </span>
                            ),
                          }))
                        : []),
                    ]}
                  />
                </div>
              ))}
              <details style={{ marginTop: 4 }}>
                <summary style={{ cursor: 'pointer', color: '#999', fontSize: 12 }}>查看原始 markdown / HTML</summary>
                <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, maxHeight: 200, overflow: 'auto', fontSize: 12, whiteSpace: 'pre-wrap', marginTop: 8 }}>
                  {item.ocrRawText || <span style={{ color: '#999' }}>无识别文本</span>}
                </div>
              </details>
            </div>
          ) : (
            <div className="ocr-content" style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, maxHeight: 280, overflow: 'auto', fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {item.ocrRawText || <span style={{ color: '#999' }}>无识别文本</span>}
            </div>
          )}
          {item.matchedRule?.recognitionContent && (
            <>
              <Divider />
              <h4>识别规则</h4>
              <p><strong>前置条件：</strong>{item.matchedRule.preConditions || '无'}</p>
              <p><strong>识别内容：</strong>{item.matchedRule.recognitionContent}</p>
              <p><strong>计算方式：</strong>{item.matchedRule.calculationMethod === 'average' ? '自动计算平均值' : '直接取值'}</p>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
