import { useState, useMemo } from 'react'
import { Row, Col, Select, Table, Tag, Input, Button, Space } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { experimentRecords, sampleCategories } from '../../mock/data'

const { Option } = Select

export default function HistoryQuery() {
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchText, setSearchText] = useState('')

  // 获取所有生产厂家
  const manufacturers = useMemo(() => {
    return [...new Set(experimentRecords.map(r => r.manufacturer))]
  }, [])

  // 联动筛选：选择厂家后，只显示该厂家送检过的样品类别
  const availableCategories = useMemo(() => {
    if (manufacturerFilter === 'all') return sampleCategories
    const cats = new Set(
      experimentRecords
        .filter(r => r.manufacturer === manufacturerFilter)
        .map(r => r.sampleName)
    )
    return sampleCategories.filter(c => cats.has(c))
  }, [manufacturerFilter])

  // 筛选数据
  const filteredData = useMemo(() => {
    return experimentRecords.filter(r => {
      if (manufacturerFilter !== 'all' && r.manufacturer !== manufacturerFilter) return false
      if (categoryFilter !== 'all' && r.sampleName !== categoryFilter) return false
      if (searchText && !r.entrustNo.includes(searchText) && !r.sampleName.includes(searchText) && !r.project.includes(searchText)) return false
      return true
    })
  }, [manufacturerFilter, categoryFilter, searchText])

  const handleReset = () => {
    setManufacturerFilter('all')
    setCategoryFilter('all')
    setSearchText('')
  }

  const columns = [
    { title: '委托单号', dataIndex: 'entrustNo', key: 'entrustNo', width: 150 },
    { title: '样品名称', dataIndex: 'sampleName', key: 'sampleName', width: 120 },
    { title: '规格型号', dataIndex: 'specModel', key: 'specModel', width: 180 },
    { title: '生产厂家', dataIndex: 'manufacturer', key: 'manufacturer', width: 220, ellipsis: true },
    { title: '检测日期', dataIndex: 'date', key: 'date', width: 120 },
    { title: '检测项目', dataIndex: 'testItem', key: 'testItem', width: 160 },
    {
      title: '判定结果',
      dataIndex: 'judgment',
      key: 'judgment',
      width: 100,
      align: 'center' as const,
      render: (val: string) => (
        <Tag color={val === '合格' ? 'green' : val === '不合格' ? 'red' : 'orange'}>{val}</Tag>
      ),
    },
    { title: '标准要求', dataIndex: 'requirement', key: 'requirement', width: 120 },
    { title: '检测结果', dataIndex: 'result', key: 'result', width: 100 },
    { title: '所属项目', dataIndex: 'project', key: 'project', ellipsis: true },
  ]

  return (
    <div>
      {/* 筛选条件 */}
      <div className="dashboard-section" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <div style={{ marginBottom: 4, color: '#666', fontSize: 13 }}>生产厂家</div>
            <Select
              value={manufacturerFilter}
              onChange={(v) => { setManufacturerFilter(v); setCategoryFilter('all') }}
              style={{ width: '100%' }}
              showSearch
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              <Option value="all">全部厂家</Option>
              {manufacturers.map(m => <Option key={m} value={m}>{m}</Option>)}
            </Select>
          </Col>
          <Col span={5}>
            <div style={{ marginBottom: 4, color: '#666', fontSize: 13 }}>样品类别</div>
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              style={{ width: '100%' }}
            >
              <Option value="all">全部类别</Option>
              {availableCategories.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </Col>
          <Col span={6}>
            <div style={{ marginBottom: 4, color: '#666', fontSize: 13 }}>关键字搜索</div>
            <Input
              placeholder="委托单号/样品名称/项目"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col span={4}>
            <Space style={{ marginTop: 18 }}>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 数据表格 */}
      <div className="dashboard-section">
        <div style={{ marginBottom: 12, color: '#666' }}>
          共 <span style={{ color: '#1677ff', fontWeight: 600 }}>{filteredData.length}</span> 条记录
        </div>
        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="id"
          size="small"
          scroll={{ x: 1400 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        />
      </div>
    </div>
  )
}
