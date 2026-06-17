import React from 'react'
import {
  Row, Col, Upload, Table, Tag, Button, Card, Space, Switch,
  Progress, Select, Input, Image, Empty, Collapse, Tooltip,
} from 'antd'
import {
  InboxOutlined, EyeOutlined, DeleteOutlined,
  CheckCircleOutlined, EditOutlined, ReloadOutlined,
  DownloadOutlined, FilterOutlined, ExportOutlined,
  FolderOpenOutlined, FileSearchOutlined, CheckSquareOutlined,
  MinusSquareOutlined,
} from '@ant-design/icons'
import { ocrRules } from '../../mock/data'
import { usePhotoOCR, type OCRResultItem } from './hooks/usePhotoOCR'
import DetailModal from './components/DetailModal'

const { Dragger } = Upload
const { Option } = Select

export default function PhotoOCR() {
  const {
    results, selectedRowKeys, setSelectedRowKeys,
    editingId, editValue, setEditValue,
    editSampleName, setEditSampleName, editEntrustNo, setEditEntrustNo,
    previewVisible, setPreviewVisible, previewItem, setPreviewItem,
    loading, archiveSelectedKeys, setArchiveSelectedKeys,
    resultSelectedKeys, setResultSelectedKeys,
    archiveFilter, setArchiveFilter, resultFilter, setResultFilter,
    filteredArchive, filteredResults, stats,
    refreshList, handleUpload, handleConfirm, handleEdit, handleSaveEdit,
    handleToggleReport, handleDelete, handlePreview, handleRetry,
    handleDownload, handleBatchDelete, handleBatchInclude, handleExport,
  } = usePhotoOCR()

  const [ruleFilter, setRuleFilter] = React.useState('')

  const uploadProps = {
    name: 'file', multiple: true, accept: 'image/*', showUploadList: false,
    customRequest: ({ file }: any) => { handleUpload(file as File) },
  }

  const columns: any[] = [
    { title: '缩略图', key: 'thumb', width: 70, render: (_: any, r: OCRResultItem) => (
      <div style={{ width: 48, height: 48, borderRadius: 4, overflow: 'hidden', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e8e8e8' }}>
        <Image src={r.photoUrl} width={48} height={48} style={{ objectFit: 'cover' }} preview={false} />
      </div>
    )},
    { title: '文件名', dataIndex: 'fileName', key: 'fileName', width: 180, ellipsis: true },
    { title: '报告关联', key: 'reportRelation', width: 180, render: (_: any, r: OCRResultItem) => (
      editingId === r.id ? (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Input size="small" placeholder="样品名称" value={editSampleName} onChange={e => setEditSampleName(e.target.value)} />
          <Input size="small" placeholder="委托单号" value={editEntrustNo} onChange={e => setEditEntrustNo(e.target.value)} />
        </Space>
      ) : (
        <div style={{ fontSize: 12 }}>
          <div>{r.sampleName || <span style={{ color: '#999' }}>缺样品关联</span>}</div>
          <div style={{ color: '#999' }}>{r.entrustNo || '缺委托单号'}</div>
        </div>
      )
    )},
    { title: '检测项目', key: 'testItem', width: 160, render: (_: any, r: OCRResultItem) => (
      <div>
        <div style={{ fontWeight: 500 }}>{r.testItem}</div>
        {r.subItem && <div style={{ fontSize: 11, color: '#999' }}>{r.subItem}</div>}
      </div>
    )},
    { title: '标准要求', dataIndex: 'standardRequirement', key: 'standardRequirement', width: 100, align: 'center' as const },
    { title: '识别结果', key: 'recognizedValue', width: 140, render: (_: any, r: OCRResultItem) => (
      r.status === '识别中' ? <Progress percent={r.progress} size="small" />
      : editingId === r.id ? (
        <Space>
          <Input size="small" value={editValue} onChange={e => setEditValue(e.target.value)} style={{ width: 80 }} />
          <Button type="link" size="small" onClick={handleSaveEdit}>保存</Button>
        </Space>
      ) : (
        <span style={{ color: r.status === '已识别' ? '#52c41a' : r.status === '待确认' ? '#faad14' : '#f5222d', fontWeight: 600 }}>
          {r.recognizedValue || '-'}
        </span>
      )
    )},
    { title: '判定', dataIndex: 'judgment', key: 'judgment', width: 80, align: 'center' as const, render: (val: string) => (
      <Tag color={val === '合格' ? 'green' : val === '不合格' ? 'red' : 'default'}>{val}</Tag>
    )},
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, align: 'center' as const, render: (val: string) => (
      <Tag color={val === '已识别' ? 'green' : val === '待确认' ? 'orange' : val === '识别中' ? 'blue' : 'red'}>{val}</Tag>
    )},
    { title: '纳入报告', key: 'includeInReport', width: 80, align: 'center' as const, render: (_: any, r: OCRResultItem) => (
      <Tooltip title={r.includeInReport ? '将在最终报告中展示' : '不会出现在报告中'}>
        <Switch checked={r.includeInReport} onChange={c => handleToggleReport(r.id, c)}
          disabled={r.status === '识别失败' || r.status === '识别中'} size="small" />
      </Tooltip>
    )},
    { title: '操作', key: 'action', width: 260, render: (_: any, r: OCRResultItem) => (
      <Space size={4}>
        {r.status === '待确认' && <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleConfirm(r.id)}>确认</Button>}
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r.id)}>编辑</Button>
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(r)}>详情</Button>
        <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(r)}>下载</Button>
        <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleRetry(r)}>重试</Button>
        <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)}>删除</Button>
      </Space>
    )},
  ]

  return (
    <div>
      {/* 上传区域 */}
      <div className="dashboard-section" style={{ marginBottom: 20 }}>
        <h3>上传试验数据照片</h3>
        <Dragger {...uploadProps} style={{ padding: '20px 0' }}>
          <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: '#1677ff' }} /></p>
          <p className="ant-upload-text">点击或拖拽照片到此区域上传</p>
          <p className="ant-upload-hint">支持 JPG、PNG、BMP 格式，照片将自动归档并调用 PaddleOCR 识别</p>
        </Dragger>
      </div>

      {/* 统计概览 */}
      {stats.total > 0 && (
        <div className="dashboard-section" style={{ marginBottom: 20 }}>
          <Row gutter={16}>
            {[
              { label: '总归档数', value: stats.total, color: '#1677ff' },
              { label: '已识别', value: stats.recognized, color: '#52c41a' },
              { label: '待确认', value: stats.pending, color: '#faad14' },
              { label: '已纳入报告', value: stats.archived, color: '#722ed1' },
              { label: '识别失败', value: stats.failed, color: '#f5222d' },
            ].map(s => (
              <Col span={s.label === '识别失败' ? 4 : 5} key={s.label}>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ color: '#999' }}>{s.label}</div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* 照片归档预览 */}
      {results.length > 0 && (
        <div className="dashboard-section" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ marginBottom: 0 }}>试验照片归档</h3>
            <span style={{ color: '#999', fontSize: 13 }}>点击缩略图查看大图</span>
          </div>
          <Row gutter={[12, 12]}>
            {results.filter(r => r.status !== '识别失败').map(r => (
              <Col span={4} key={r.id}>
                <Card size="small" hoverable onClick={() => handlePreview(r)}
                  cover={<div style={{ height: 120, background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <Image src={r.photoUrl} width="100%" height={120} style={{ objectFit: 'cover' }} preview={false} />
                  </div>}>
                  <Card.Meta
                    title={<Tooltip title={r.fileName}><span style={{ fontSize: 12 }}>{r.fileName}</span></Tooltip>}
                    description={<Space size={4} wrap>
                      <Tag color="blue" style={{ fontSize: 11 }}>{r.testItem || '未匹配'}</Tag>
                      {r.includeInReport && <Tag color="purple" style={{ fontSize: 11 }}>已纳入报告</Tag>}
                    </Space>}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {!loading && stats.total === 0 && (
        <div className="dashboard-section" style={{ marginBottom: 20 }}>
          <Empty description="暂无归档照片，请上传试验数据照片" />
        </div>
      )}

      {/* OCR 识别结果 */}
      <div className="dashboard-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ marginBottom: 0 }}>OCR 识别结果</h3>
          <Space>
            {selectedRowKeys.length > 0 && <span style={{ color: '#999', fontSize: 13 }}>已选择 {selectedRowKeys.length} 项</span>}
            <Select placeholder="按样品/项目筛选" allowClear style={{ width: 200 }} size="small" onChange={v => setRuleFilter(v || '')}>
              {[...new Set(ocrRules.filter(r => r.hasImage).map(r => r.sampleName))].map(name => (
                <Option key={name} value={name}>{name}</Option>
              ))}
            </Select>
            <Button size="small" onClick={refreshList}>刷新列表</Button>
          </Space>
        </div>
        <Table dataSource={results} columns={columns} rowKey="id" size="small"
          pagination={{ pageSize: 10 }} loading={loading}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          locale={{ emptyText: '暂无识别结果，请上传试验数据照片' }} />
      </div>

      {/* 归档管理 + 识别结果管理 */}
      <div className="dashboard-section" style={{ marginTop: 20 }}>
        <Collapse ghost defaultActiveKey={['archive', 'result']} items={[
          { key: 'archive', label: <Space><FolderOpenOutlined /><span style={{ fontWeight: 600 }}>归档照片管理</span><Tag color="blue">{filteredArchive.length}</Tag></Space>,
            children: <ArchiveTable />,
          },
          { key: 'result', label: <Space><FileSearchOutlined /><span style={{ fontWeight: 600 }}>OCR 识别结果管理</span><Tag color="purple">{filteredResults.length}</Tag></Space>,
            children: <ResultManagementTable />,
          },
        ]} />
      </div>

      {/* 详情弹窗 */}
      <DetailModal visible={previewVisible} item={previewItem} onClose={() => setPreviewVisible(false)} onDownload={handleDownload} />
    </div>
  )

  // ---- 内部子表格渲染函数 ----

  function ArchiveTable() {
    return (
      <div>
        <Row gutter={8} style={{ marginBottom: 12 }}>
          <Col span={6}><Input size="small" placeholder="按文件名筛选" allowClear value={archiveFilter.fileName} onChange={e => setArchiveFilter(s => ({ ...s, fileName: e.target.value }))} /></Col>
          <Col span={6}><Input size="small" placeholder="按检测项目筛选" allowClear value={archiveFilter.testItem} onChange={e => setArchiveFilter(s => ({ ...s, testItem: e.target.value }))} /></Col>
          <Col span={4}>
            <Select size="small" placeholder="状态" allowClear style={{ width: '100%' }} value={archiveFilter.status || undefined} onChange={v => setArchiveFilter(s => ({ ...s, status: v || '' }))}>
              <Option value="已识别">已识别</Option><Option value="待确认">待确认</Option><Option value="识别失败">识别失败</Option><Option value="识别中">识别中</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select size="small" placeholder="纳入报告" allowClear style={{ width: '100%' }} value={archiveFilter.includeInReport || undefined} onChange={v => setArchiveFilter(s => ({ ...s, includeInReport: v || '' }))}>
              <Option value="yes">已纳入</Option><Option value="no">未纳入</Option>
            </Select>
          </Col>
          <Col span={4} style={{ textAlign: 'right' }}>
            <Button size="small" icon={<FilterOutlined />} onClick={() => setArchiveFilter({ fileName: '', testItem: '', status: '', includeInReport: '' })}>重置</Button>
          </Col>
        </Row>
        <Space wrap style={{ marginBottom: 8 }}>
          <Button size="small" icon={<CheckSquareOutlined />} onClick={() => setArchiveSelectedKeys(filteredArchive.map(r => r.id))}>全选当前</Button>
          <Button size="small" icon={<MinusSquareOutlined />} onClick={() => setArchiveSelectedKeys([])}>清空</Button>
          <Button size="small" type="primary" disabled={archiveSelectedKeys.length === 0} onClick={() => handleBatchInclude(archiveSelectedKeys as string[], true)}>批量纳入报告 ({archiveSelectedKeys.length})</Button>
          <Button size="small" disabled={archiveSelectedKeys.length === 0} onClick={() => handleBatchInclude(archiveSelectedKeys as string[], false)}>取消纳入</Button>
          <Button size="small" danger icon={<DeleteOutlined />} disabled={archiveSelectedKeys.length === 0} onClick={() => handleBatchDelete(archiveSelectedKeys as string[], 'archive')}>批量删除 ({archiveSelectedKeys.length})</Button>
        </Space>
        <Table size="small" dataSource={filteredArchive} rowKey="id" pagination={{ pageSize: 8 }}
          rowSelection={{ selectedRowKeys: archiveSelectedKeys, onChange: setArchiveSelectedKeys }}
          columns={[
            { title: '缩略图', key: 'thumb', width: 60, render: (_: any, r: OCRResultItem) => <Image src={r.photoUrl} width={36} height={36} style={{ objectFit: 'cover' }} preview={false} /> },
            { title: '文件名', dataIndex: 'fileName', width: 200, ellipsis: true },
            { title: '检测项目', dataIndex: 'testItem', width: 140, ellipsis: true },
            { title: '识别结果', dataIndex: 'recognizedValue', width: 100 },
            { title: '判定', dataIndex: 'judgment', width: 70, render: (v: string) => <Tag color={v === '合格' ? 'green' : v === '不合格' ? 'red' : 'default'}>{v}</Tag> },
            { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <Tag color={v === '已识别' ? 'green' : v === '待确认' ? 'orange' : v === '识别中' ? 'blue' : 'red'}>{v}</Tag> },
            { title: '纳入报告', dataIndex: 'includeInReport', width: 90, render: (v: boolean, r: OCRResultItem) => <Switch size="small" checked={v} disabled={r.status === '识别失败' || r.status === '识别中'} onChange={c => handleToggleReport(r.id, c)} /> },
            { title: '操作', key: 'act', width: 180, render: (_: any, r: OCRResultItem) => (
              <Space size={4}>
                <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(r)}>详情</Button>
                <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(r)}>下载</Button>
                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)}>删除</Button>
              </Space>
            )},
          ]} />
      </div>
    )
  }

  function ResultManagementTable() {
    return (
      <div>
        <Row gutter={8} style={{ marginBottom: 12 }}>
          <Col span={6}><Input size="small" placeholder="按文件名筛选" allowClear value={resultFilter.fileName} onChange={e => setResultFilter(s => ({ ...s, fileName: e.target.value }))} /></Col>
          <Col span={6}><Input size="small" placeholder="按检测项目筛选" allowClear value={resultFilter.testItem} onChange={e => setResultFilter(s => ({ ...s, testItem: e.target.value }))} /></Col>
          <Col span={4}>
            <Select size="small" placeholder="判定" allowClear style={{ width: '100%' }} value={resultFilter.judgment || undefined} onChange={v => setResultFilter(s => ({ ...s, judgment: v || '' }))}>
              <Option value="合格">合格</Option><Option value="不合格">不合格</Option><Option value="待判定">待判定</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select size="small" placeholder="状态" allowClear style={{ width: '100%' }} value={resultFilter.status || undefined} onChange={v => setResultFilter(s => ({ ...s, status: v || '' }))}>
              <Option value="已识别">已识别</Option><Option value="待确认">待确认</Option><Option value="识别失败">识别失败</Option><Option value="识别中">识别中</Option>
            </Select>
          </Col>
          <Col span={4} style={{ textAlign: 'right' }}>
            <Button size="small" icon={<FilterOutlined />} onClick={() => setResultFilter({ fileName: '', testItem: '', judgment: '', status: '' })}>重置</Button>
          </Col>
        </Row>
        <Space wrap style={{ marginBottom: 8 }}>
          <Button size="small" icon={<CheckSquareOutlined />} onClick={() => setResultSelectedKeys(filteredResults.map(r => r.id))}>全选当前</Button>
          <Button size="small" icon={<MinusSquareOutlined />} onClick={() => setResultSelectedKeys([])}>清空</Button>
          <Button size="small" type="primary" icon={<ExportOutlined />} disabled={resultSelectedKeys.length === 0} onClick={() => handleExport(resultSelectedKeys as string[], 'csv')}>导出 CSV ({resultSelectedKeys.length})</Button>
          <Button size="small" icon={<ExportOutlined />} disabled={resultSelectedKeys.length === 0} onClick={() => handleExport(resultSelectedKeys as string[], 'json')}>导出 JSON</Button>
          <Button size="small" icon={<CheckSquareOutlined />} disabled={resultSelectedKeys.length === 0} onClick={() => handleBatchInclude(resultSelectedKeys as string[], true)}>批量纳入报告</Button>
          <Button size="small" danger icon={<DeleteOutlined />} disabled={resultSelectedKeys.length === 0} onClick={() => handleBatchDelete(resultSelectedKeys as string[], 'result')}>批量删除 ({resultSelectedKeys.length})</Button>
        </Space>
        <Table size="small" dataSource={filteredResults} rowKey="id" pagination={{ pageSize: 8 }}
          rowSelection={{ selectedRowKeys: resultSelectedKeys, onChange: setResultSelectedKeys }}
          columns={[
            { title: '检测项目', dataIndex: 'testItem', width: 140, ellipsis: true },
            { title: '判定指标', dataIndex: 'subItem', width: 120, ellipsis: true },
            { title: '标准要求', dataIndex: 'standardRequirement', width: 80, align: 'center' as const },
            { title: '识别结果', dataIndex: 'recognizedValue', width: 100 },
            { title: '判定', dataIndex: 'judgment', width: 70, render: (v: string) => <Tag color={v === '合格' ? 'green' : v === '不合格' ? 'red' : 'default'}>{v}</Tag> },
            { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <Tag color={v === '已识别' ? 'green' : v === '待确认' ? 'orange' : v === '识别中' ? 'blue' : 'red'}>{v}</Tag> },
            { title: '纳入报告', dataIndex: 'includeInReport', width: 90, render: (v: boolean, r: OCRResultItem) => <Switch size="small" checked={v} disabled={r.status === '识别失败' || r.status === '识别中'} onChange={c => handleToggleReport(r.id, c)} /> },
            { title: '对应照片', dataIndex: 'fileName', width: 140, ellipsis: true, render: (n: string) => <Tooltip title={n}><span style={{ fontSize: 12 }}>{n}</span></Tooltip> },
            { title: '操作', key: 'act', width: 120, render: (_: any, r: OCRResultItem) => (
              <Space size={4}>
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r.id)}>编辑</Button>
                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)}>删除</Button>
              </Space>
            )},
          ]} />
      </div>
    )
  }
}
