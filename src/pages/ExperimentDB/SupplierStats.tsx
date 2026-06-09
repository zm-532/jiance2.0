import { useState } from 'react'
import { Row, Col, Card, Table, Progress, Statistic } from 'antd'
import ReactECharts from 'echarts-for-react'
import { supplierStats, sampleCategories, materialStats } from '../../mock/data'

export default function SupplierStats() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredSuppliers = selectedCategory
    ? supplierStats.filter(s => s.sampleName === selectedCategory)
    : []

  // 柱状图 - 各类别合格率
  const barOption = {
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e6f0ff', textStyle: { color: '#333' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: materialStats.map(c => c.material),
      axisLabel: { rotate: 25, fontSize: 12, color: '#666' },
      axisLine: { lineStyle: { color: '#e8e8e8' } },
    },
    yAxis: { 
      type: 'value', max: 100, name: '合格率(%)',
      nameTextStyle: { color: '#888' },
      axisLabel: { color: '#666' },
      splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } }
    },
    series: [{
      type: 'bar',
      data: materialStats.map(c => ({
        value: c.avgQualifyRate,
        itemStyle: { 
          color: c.avgQualifyRate >= 95 ? {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#73d13d' }, { offset: 1, color: '#389e0d' }]
          } : c.avgQualifyRate >= 90 ? {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#4096ff' }, { offset: 1, color: '#0958d9' }]
          } : {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#ffc53d' }, { offset: 1, color: '#d48806' }]
          },
          borderRadius: [4, 4, 0, 0] 
        },
      })),
      barWidth: 30,
      label: { show: true, position: 'top', formatter: '{c}%', fontSize: 11, color: '#666' },
    }],
  }

  const supplierColumns = [
    { title: '供应商名称', dataIndex: 'manufacturer', key: 'manufacturer', width: 280, ellipsis: true },
    { title: '送检批次数', dataIndex: 'totalBatches', key: 'totalBatches', align: 'center' as const, sorter: (a: any, b: any) => a.totalBatches - b.totalBatches },
    { title: '合格批次', dataIndex: 'qualifiedBatches', key: 'qualifiedBatches', align: 'center' as const,
      render: (val: number) => <span style={{ color: '#52c41a' }}>{val}</span>,
    },
    { title: '不合格批次', dataIndex: 'unqualifiedBatches', key: 'unqualifiedBatches', align: 'center' as const,
      render: (val: number) => <span style={{ color: '#f5222d' }}>{val}</span>,
    },
    { title: '待定批次', dataIndex: 'pendingBatches', key: 'pendingBatches', align: 'center' as const },
    {
      title: '合格率',
      dataIndex: 'qualifyRate',
      key: 'qualifyRate',
      align: 'center' as const,
      sorter: (a: any, b: any) => a.qualifyRate - b.qualifyRate,
      render: (val: number) => (
        <Progress
          percent={val}
          size="small"
          status={val >= 95 ? 'success' : val >= 90 ? 'normal' : 'exception'}
          format={v => `${v}%`}
          style={{ width: 120 }}
        />
      ),
    },
  ]

  return (
    <div>
      {/* 样品类别卡片 */}
      <Row gutter={[10, 10]} style={{ marginBottom: 20 }}>
        {materialStats.map(cat => (
          <Col span={Math.floor(24 / Math.min(materialStats.length, 8))} key={cat.material}>
            <Card
              size="small"
              className="stat-card"
              hoverable
              onClick={() => setSelectedCategory(cat.material === selectedCategory ? null : cat.material)}
              style={{
                borderColor: cat.material === selectedCategory ? '#1677ff' : undefined,
                background: cat.material === selectedCategory ? '#e6f4ff' : undefined,
                textAlign: 'center',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>{cat.material}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{cat.supplierCount} 家供应商</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{cat.totalBatches} 批次</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 合格率柱状图 */}
      <div className="dashboard-section" style={{ marginBottom: 20 }}>
        <h3>各类别平均合格率</h3>
        <ReactECharts option={barOption} style={{ height: 280 }} />
      </div>

      {/* 选中类别的供应商详情 */}
      {selectedCategory && (
        <div className="dashboard-section">
          <h3>{selectedCategory} - 供应商检测数据明细</h3>
          {filteredSuppliers.length > 0 ? (
            <>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Statistic title="供应商数量" value={filteredSuppliers.length} suffix="家" />
                </Col>
                <Col span={6}>
                  <Statistic title="总送检批次" value={filteredSuppliers.reduce((s, sp) => s + sp.totalBatches, 0)} suffix="批" />
                </Col>
                <Col span={6}>
                  <Statistic title="合格批次" value={filteredSuppliers.reduce((s, sp) => s + sp.qualifiedBatches, 0)} suffix="批" valueStyle={{ color: '#52c41a' }} />
                </Col>
                <Col span={6}>
                  <Statistic title="不合格批次" value={filteredSuppliers.reduce((s, sp) => s + sp.unqualifiedBatches, 0)} suffix="批" valueStyle={{ color: '#f5222d' }} />
                </Col>
              </Row>
              <Table
                dataSource={filteredSuppliers}
                columns={supplierColumns}
                rowKey={(_, idx) => idx!.toString()}
                pagination={false}
                size="small"
              />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>该类别暂无供应商数据</div>
          )}
        </div>
      )}

      {!selectedCategory && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999', background: '#fff', borderRadius: 8 }}>
          请点击上方样品类别卡片查看对应供应商检测数据
        </div>
      )}
    </div>
  )
}
