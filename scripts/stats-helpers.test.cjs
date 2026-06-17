const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildSupplierStats,
  buildMaterialStats,
  businessDaysBetween,
  buildTimelinessData,
  isWorkday,
} = require('./stats-helpers.cjs')

test('supplier stats count one entrust batch once even when multiple test items exist', () => {
  const regRecords = [
    {
      entrustNo: 'E001',
      manufacturer: 'A厂家',
      sampleName: '橡胶条',
      testStatus: '已完成',
    },
  ]
  const experimentRecords = [
    {
      entrustNo: 'E001-硬度[1]',
      manufacturer: 'A厂家',
      sampleName: '橡胶条',
      judgment: '合格',
      testDate: '2026-06-01',
    },
    {
      entrustNo: 'E001-拉伸[2]',
      manufacturer: 'A厂家',
      sampleName: '橡胶条',
      judgment: '不合格',
      testDate: '2026-06-01',
    },
  ]

  const [stat] = buildSupplierStats(regRecords, experimentRecords)

  assert.equal(stat.totalBatches, 1)
  assert.equal(stat.inspectedBatches, 1)
  assert.equal(stat.qualifiedBatches, 0)
  assert.equal(stat.unqualifiedBatches, 1)
  assert.equal(stat.pendingBatches, 0)
  assert.equal(stat.qualifyRate, 0)
})

test('material stats calculate qualify rate from inspected batches only', () => {
  const materialStats = buildMaterialStats([
    {
      manufacturer: 'A厂家',
      sampleName: '橡胶条',
      totalBatches: 2,
      inspectedBatches: 1,
      qualifiedBatches: 1,
      unqualifiedBatches: 0,
      pendingBatches: 1,
      qualifyRate: 100,
    },
  ])

  assert.equal(materialStats[0].avgQualifyRate, 100)
  assert.equal(materialStats[0].totalBatches, 2)
  assert.equal(materialStats[0].inspectedBatches, 1)
})

test('business day timeliness counts same-day completion as half day', () => {
  assert.equal(businessDaysBetween('2026-06-05', '2026-06-05'), 0.5)
})

test('business day timeliness excludes weekends and supplied holidays', () => {
  const holidays = new Set(['2026-06-08'])

  assert.equal(businessDaysBetween('2026-06-05', '2026-06-09', holidays), 1)
})

test('holiday calendar handles adjusted working weekends and weekday holidays', () => {
  const calendar = {
    years: {
      2026: {
        offDays: ['2026-06-08'],
        workDays: ['2026-06-07'],
      },
    },
  }

  assert.equal(isWorkday('2026-06-07', calendar), true)
  assert.equal(isWorkday('2026-06-08', calendar), false)
  assert.equal(businessDaysBetween('2026-06-05', '2026-06-09', calendar), 2)
})

test('timeliness data marks aging and missing holiday-calendar limitations instead of inventing values', () => {
  const rows = buildTimelinessData([
    {
      sampleName: '橡胶条',
      testItem: '热空气老化（100℃x96h）-硬度变化',
      receiveDate: '2026-06-01',
      testDate: '2026-06-07',
    },
    {
      sampleName: '橡胶条',
      testItem: '硬度（邵尔A）/度',
      receiveDate: '2026-06-05',
      testDate: '2026-06-05',
    },
  ])

  const aging = rows.find(row => row.testItem.includes('热空气老化'))
  const hardness = rows.find(row => row.testItem.includes('硬度（邵尔A）'))

  assert.equal(aging.avgDays, null)
  assert.match(aging.missingReason, /缺老化时间规则/)
  assert.equal(hardness.avgDays, null)
  assert.match(hardness.missingReason, /缺法定节假日数据/)
})

test('timeliness data uses complete holiday calendar without marking holiday data missing', () => {
  const rows = buildTimelinessData([
    {
      sampleName: '橡胶条',
      testItem: '硬度（邵尔A）/度',
      receiveDate: '2026-06-05',
      testDate: '2026-06-09',
    },
  ], {
    holidayCalendar: {
      years: {
        2026: {
          offDays: ['2026-06-08'],
          workDays: ['2026-06-07'],
        },
      },
    },
  })

  assert.equal(rows[0].avgDays, 2)
  assert.equal(rows[0].missingReason, '')
})

test('empty holiday year is treated as missing data', () => {
  const rows = buildTimelinessData([
    {
      sampleName: '橡胶条',
      testItem: '硬度（邵尔A）/度',
      receiveDate: '2027-06-05',
      testDate: '2027-06-09',
    },
  ], {
    holidayCalendar: {
      years: {
        2027: {
          offDays: [],
          workDays: [],
        },
      },
    },
  })

  assert.equal(rows[0].avgDays, null)
  assert.match(rows[0].missingReason, /缺法定节假日数据/)
})
