const fs = require('fs')
const path = require('path')

const RAW_BASE_URL = 'https://raw.githubusercontent.com/NateScarlet/holiday-cn/master'
const outPath = path.join(__dirname, '..', 'src', 'mock', 'holidays.json')
const frontendOutPath = path.join(__dirname, '..', 'frontend', 'src', 'mock', 'holidays.json')

function parseYears(argv) {
  const yearsArg = argv.find(arg => arg.startsWith('--years='))
  if (yearsArg) {
    return yearsArg
      .slice('--years='.length)
      .split(',')
      .map(year => Number(year.trim()))
      .filter(Number.isInteger)
  }

  const currentYear = new Date().getFullYear()
  return [currentYear - 1, currentYear, currentYear + 1]
}

async function fetchYear(year) {
  const url = `${RAW_BASE_URL}/${year}.json`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`下载 ${year}.json 失败: ${response.status}`)
  }
  const data = await response.json()
  const days = Array.isArray(data.days) ? data.days : []
  const offDays = []
  const workDays = []

  for (const item of days) {
    if (!item.date) continue
    if (item.isOffDay === true) offDays.push(item.date)
    if (item.isOffDay === false) workDays.push(item.date)
  }

  return {
    offDays: [...new Set(offDays)].sort(),
    workDays: [...new Set(workDays)].sort(),
  }
}

async function main() {
  const years = parseYears(process.argv.slice(2))
  if (years.length === 0) {
    throw new Error('未指定有效年份')
  }

  const output = {
    source: 'https://github.com/NateScarlet/holiday-cn',
    updatedAt: new Date().toISOString(),
    years: {},
  }

  for (const year of years) {
    console.log(`下载 ${year} 节假日数据...`)
    const yearData = await fetchYear(year)
    if (yearData.offDays.length === 0 && yearData.workDays.length === 0) {
      console.warn(`${year} 节假日数据为空，已跳过。国务院放假通知发布后可重新运行脚本。`)
      continue
    }
    output.years[String(year)] = yearData
  }

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`已写入: ${outPath}`)

  const frontendDir = path.dirname(frontendOutPath)
  if (fs.existsSync(frontendDir)) {
    fs.writeFileSync(frontendOutPath, JSON.stringify(output, null, 2), 'utf-8')
    console.log(`已同步: ${frontendOutPath}`)
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err.message)
    process.exit(1)
  })
}

module.exports = {
  parseYears,
  fetchYear,
}
