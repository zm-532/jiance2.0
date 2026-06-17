function batchKey(record) {
  const entrustNo = String(record.entrustNo || '').trim()
  if (entrustNo) {
    const withoutInstanceId = entrustNo.split('[')[0].trim()
    const leadingCode = withoutInstanceId.match(/^[A-Za-z]+\d+/)
    return leadingCode ? leadingCode[0] : withoutInstanceId
  }
  return [
    record.manufacturer || '',
    record.sampleName || '',
    record.specModel || '',
    record.receiveDate || '',
  ].join('||')
}

function isCompletedStatus(status) {
  return status === '已完成' || status === '检测完成'
}

function isPendingStatus(status) {
  return status === '检测中' || status === '待检测' || status === '待登记'
}

function buildSupplierStats(regRecords, experimentRecords) {
  const batches = new Map()

  for (const record of regRecords) {
    if (!record.manufacturer || !record.sampleName) continue
    const key = [
      record.manufacturer,
      record.sampleName,
      batchKey(record),
    ].join('||')
    if (!batches.has(key)) {
      batches.set(key, {
        manufacturer: record.manufacturer,
        sampleName: record.sampleName,
        status: record.testStatus || '',
        hasCompleted: false,
        hasPending: false,
        hasUnqualified: false,
      })
    }
    const batch = batches.get(key)
    if (isCompletedStatus(record.testStatus)) batch.hasCompleted = true
    if (isPendingStatus(record.testStatus)) batch.hasPending = true
  }

  for (const record of experimentRecords) {
    if (!record.manufacturer || !record.sampleName) continue
    const key = [
      record.manufacturer,
      record.sampleName,
      batchKey(record),
    ].join('||')
    if (!batches.has(key)) {
      batches.set(key, {
        manufacturer: record.manufacturer,
        sampleName: record.sampleName,
        status: '',
        hasCompleted: Boolean(record.testDate),
        hasPending: false,
        hasUnqualified: false,
      })
    }
    const batch = batches.get(key)
    if (record.judgment && String(record.judgment).includes('不合格')) {
      batch.hasUnqualified = true
      batch.hasCompleted = true
    } else if (record.judgment) {
      batch.hasCompleted = true
    }
  }

  const supplierMap = new Map()
  for (const batch of batches.values()) {
    const key = `${batch.manufacturer}||${batch.sampleName}`
    if (!supplierMap.has(key)) {
      supplierMap.set(key, {
        manufacturer: batch.manufacturer,
        sampleName: batch.sampleName,
        totalBatches: 0,
        inspectedBatches: 0,
        qualifiedBatches: 0,
        unqualifiedBatches: 0,
        pendingBatches: 0,
        qualifyRate: null,
      })
    }
    const stat = supplierMap.get(key)
    stat.totalBatches += 1

    if (batch.hasUnqualified) {
      stat.inspectedBatches += 1
      stat.unqualifiedBatches += 1
    } else if (batch.hasCompleted) {
      stat.inspectedBatches += 1
      stat.qualifiedBatches += 1
    } else {
      stat.pendingBatches += 1
    }
  }

  return Array.from(supplierMap.values())
    .map(stat => ({
      ...stat,
      qualifyRate: stat.inspectedBatches > 0
        ? +((stat.qualifiedBatches / stat.inspectedBatches) * 100).toFixed(1)
        : null,
    }))
    .sort((a, b) => b.totalBatches - a.totalBatches)
}

function buildMaterialStats(supplierStats) {
  const materialMap = new Map()
  for (const stat of supplierStats) {
    if (!stat.sampleName) continue
    if (!materialMap.has(stat.sampleName)) {
      materialMap.set(stat.sampleName, {
        material: stat.sampleName,
        supplierCount: 0,
        totalBatches: 0,
        inspectedBatches: 0,
        qualifiedBatches: 0,
        avgQualifyRate: null,
      })
    }
    const material = materialMap.get(stat.sampleName)
    material.supplierCount += 1
    material.totalBatches += stat.totalBatches
    material.inspectedBatches += stat.inspectedBatches || 0
    material.qualifiedBatches += stat.qualifiedBatches
  }

  return Array.from(materialMap.values())
    .map(material => ({
      ...material,
      avgQualifyRate: material.inspectedBatches > 0
        ? +((material.qualifiedBatches / material.inspectedBatches) * 100).toFixed(1)
        : null,
    }))
    .sort((a, b) => b.totalBatches - a.totalBatches)
}

function parseDate(value) {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }
  const text = String(value).trim()
  const match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return null
  return date
}

function dayKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function normalizeHolidayCalendar(calendarOrHolidays) {
  if (!calendarOrHolidays) return null
  if (calendarOrHolidays instanceof Set) {
    return {
      years: {},
      legacyOffDays: calendarOrHolidays,
    }
  }
  return calendarOrHolidays
}

function getHolidayYear(calendar, year) {
  if (!calendar || !calendar.years) return null
  return calendar.years[String(year)] || calendar.years[year] || null
}

function hasHolidayYear(calendar, year) {
  if (!calendar) return false
  if (calendar.legacyOffDays) return true
  const yearData = getHolidayYear(calendar, year)
  return Boolean(yearData && ((yearData.offDays || []).length > 0 || (yearData.workDays || []).length > 0))
}

function isWorkday(value, calendarOrHolidays) {
  const date = parseDate(value)
  if (!date) return false
  const key = dayKey(date)
  const calendar = normalizeHolidayCalendar(calendarOrHolidays)
  if (calendar?.legacyOffDays?.has(key)) return false

  const yearData = getHolidayYear(calendar, date.getFullYear())
  const offDays = new Set(yearData?.offDays || [])
  const workDays = new Set(yearData?.workDays || [])

  if (workDays.has(key)) return true
  if (offDays.has(key)) return false
  return date.getDay() !== 0 && date.getDay() !== 6
}

function yearsInRange(start, end) {
  const years = new Set()
  for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
    years.add(year)
  }
  return years
}

function businessDaysBetween(receiveDate, testDate, calendarOrHolidays = null) {
  const start = parseDate(receiveDate)
  const end = parseDate(testDate)
  if (!start || !end || end < start) return null
  if (dayKey(start) === dayKey(end)) return 0.5

  const calendar = normalizeHolidayCalendar(calendarOrHolidays)
  let count = 0
  const cursor = new Date(start)
  cursor.setDate(cursor.getDate() + 1)
  while (cursor <= end) {
    if (isWorkday(cursor, calendar)) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

function requiresAgingDeduction(testItem) {
  return /老化|盐雾|氙灯|紫外|耐候|汞灯|加热失重/.test(String(testItem || ''))
}

function categorizeTestItem(testItem) {
  const item = String(testItem || '')
  if (/硬度|拉伸|撕裂|冲击|弯曲|压缩|伸长|强度|力值|载荷|断裂/.test(item)) return '力学性能'
  if (/老化|臭氧|盐雾|氙灯|紫外|耐候|汞灯/.test(item)) return '耐候性能'
  if (/透光|雾度|光泽|颜色|色差|黄色/.test(item)) return '光学性能'
  if (/吸声|隔声|声学/.test(item)) return '声学性能'
  if (/燃烧|热值|不燃|可燃|防火/.test(item)) return '防火性能'
  if (/密度|厚度|尺寸|重量|质量|憎水|含水/.test(item)) return '物理性能'
  if (/化学|成分|光谱/.test(item)) return '化学分析'
  return '其他'
}

function buildTimelinessData(records, options = {}) {
  const holidayCalendar = normalizeHolidayCalendar(options.holidayCalendar || (options.holidays ? new Set(options.holidays) : null))
  const groups = new Map()

  for (const record of records) {
    if (!record.testItem) continue
    const key = `${record.sampleName || '未知材料'}||${record.testItem}`
    if (!groups.has(key)) {
      groups.set(key, {
        category: record.sampleName || '未知材料',
        testItem: record.testItem,
        days: [],
        missingReasons: new Set(),
        sampleCount: 0,
      })
    }
    const group = groups.get(key)
    group.sampleCount += 1

    if (!record.receiveDate || !record.testDate) {
      group.missingReasons.add('缺收样或检测日期')
      continue
    }
    const start = parseDate(record.receiveDate)
    const end = parseDate(record.testDate)
    const hasAllHolidayYears = start && end && Array.from(yearsInRange(start, end)).every(year => hasHolidayYear(holidayCalendar, year))
    if (requiresAgingDeduction(record.testItem)) {
      group.missingReasons.add('缺老化时间规则')
      continue
    }
    if (!hasAllHolidayYears) {
      group.missingReasons.add('缺法定节假日数据')
      continue
    }

    const days = businessDaysBetween(record.receiveDate, record.testDate, holidayCalendar)
    if (days == null) {
      group.missingReasons.add('日期格式异常')
      continue
    }
    group.days.push(days)
  }

  return Array.from(groups.values())
    .map(group => ({
      category: group.category,
      testItem: group.testItem,
      testCategory: categorizeTestItem(group.testItem),
      avgDays: group.days.length > 0
        ? +(group.days.reduce((sum, value) => sum + value, 0) / group.days.length).toFixed(1)
        : null,
      sampleCount: group.sampleCount,
      validSampleCount: group.days.length,
      missingReason: group.missingReasons.size > 0
        ? Array.from(group.missingReasons).join('、')
        : '',
    }))
    .sort((a, b) => b.sampleCount - a.sampleCount)
}

module.exports = {
  batchKey,
  buildSupplierStats,
  buildMaterialStats,
  businessDaysBetween,
  isWorkday,
  buildTimelinessData,
  categorizeTestItem,
}
