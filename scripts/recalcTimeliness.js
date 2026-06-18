/**
 * Recalculate timelinessData.avgDays in realData.json
 * Rule: same-day completion = 1 working day (was 0.5), weekends & holidays excluded
 */
const fs = require('fs')
const path = require('path')

const realDataPath = path.join(__dirname, '..', 'frontend', 'src', 'mock', 'realData.json')
const holidaysPath = path.join(__dirname, '..', 'frontend', 'src', 'mock', 'holidays.json')

const realData = JSON.parse(fs.readFileSync(realDataPath, 'utf-8'))
const holidays = JSON.parse(fs.readFileSync(holidaysPath, 'utf-8'))

// Build holiday set
const holidaySet = new Set()
for (const year of Object.values(holidays.years || {})) {
  for (const d of (year.offDays || [])) holidaySet.add(d)
}

function isWeekend(dateStr) {
  const day = new Date(dateStr).getDay()
  return day === 0 || day === 6
}

function isWorkday(dateStr) {
  return !isWeekend(dateStr) && !holidaySet.has(dateStr)
}

/**
 * Count workdays between receiveDate and testDate (inclusive).
 * Same-day = 1.
 */
function countWorkdays(receiveDate, testDate) {
  if (receiveDate === testDate) return isWorkday(receiveDate) ? 1 : null

  let count = 0
  const start = new Date(receiveDate)
  const end = new Date(testDate)
  const cursor = new Date(start)

  while (cursor <= end) {
    const ds = cursor.toISOString().slice(0, 10)
    if (isWorkday(ds)) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count > 0 ? count : null
}

// Group records by (sampleName, testItem) and calculate avgDays
const records = realData.records || []
const groups = {}

for (const r of records) {
  if (!r.receiveDate || !r.testDate) continue
  if (!r.sampleName || !r.testItem) continue

  const days = countWorkdays(r.receiveDate, r.testDate)
  if (days === null) continue

  const key = `${r.sampleName}|||${r.testItem}`
  if (!groups[key]) groups[key] = { sum: 0, count: 0 }
  groups[key].sum += days
  groups[key].count++
}

// Update timelinessData — only touch entries that had avgDays != null
let updated = 0
let unchanged = 0
for (const entry of realData.timelinessData) {
  const key = `${entry.category}|||${entry.testItem}`
  const g = groups[key]

  if (entry.avgDays === null) {
    // Keep null (aging rule missing, etc.)
    unchanged++
    continue
  }

  if (g && g.count > 0) {
    const newAvg = +(g.sum / g.count).toFixed(1)
    if (newAvg !== entry.avgDays) {
      console.log(`  ${entry.category} / ${entry.testItem}: ${entry.avgDays} -> ${newAvg} (${g.count} samples)`)
    }
    entry.avgDays = newAvg
    entry.validSampleCount = g.count
    updated++
  } else {
    unchanged++
  }
}

// Backup original
fs.writeFileSync(realDataPath + '.bak', JSON.stringify(realData, null, 0))
console.log(`\nDone. Updated: ${updated}, Unchanged: ${unchanged}`)
console.log(`Backup saved to realData.json.bak`)

// Write updated file (compact format to match original)
fs.writeFileSync(realDataPath, JSON.stringify(realData, null, 0))
console.log('Updated realData.json written.')
