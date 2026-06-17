// ============================================================
// 真实数据 - 声屏障检测管理平台
// 数据来源: 台账.xlsx, 样品检测登记.xlsx, 委托申请单.xlsx,
//           供应商信息.xlsx, 实验室检测设备台账2025(9).xlsx,
//           报告智能判定原始数据0608.xlsx
// ============================================================
import realDataJson from './realData.json'
import realDevicesJson from './realDevices.json'
import equipmentReferenceData from './equipmentReference.json'

// ---- 类型定义 ----

export interface ExperimentRecord {
  id: string
  entrustNo: string
  entrustPerson: string
  sampleName: string
  specModel: string
  manufacturer: string
  date: string
  testItem: string
  judgment: string
  requirement: string
  result: string
  results: string[]
  project: string
  equipment: string
  testStandard: string
  receiveDate: string
  testDate: string
  photos: string[]
}

export interface SupplierStat {
  manufacturer: string
  sampleName: string
  totalBatches: number
  inspectedBatches: number
  qualifiedBatches: number
  unqualifiedBatches: number
  pendingBatches: number
  qualifyRate: number | null
}

export interface MaterialStat {
  material: string
  supplierCount: number
  totalBatches: number
  inspectedBatches: number
  avgQualifyRate: number | null
}

export interface TimelinessRecord {
  category: string
  testCategory: string
  testItem: string
  avgDays: number | null
  sampleCount: number
  validSampleCount: number
  missingReason: string
}

export interface CapabilityItem {
  id: string
  sampleName: string
  specModel: string
  judgmentStandard: string
  testItem: string
  materialSpec: string
  standardRequirement: string
  testStandard: string
  equipment: string
  remark: string
}

export interface SampleRequirement {
  sampleName: string
  judgmentStandard: string
  testItem: string
  sampleSize: string
}

export interface StripSpec {
  category: string
  model: string
  commonNames: string[]
}

export interface OCRRule {
  id: string
  equipment: string
  sampleName: string
  judgmentStandard: string
  testItem: string
  subItem: string
  standardRequirement: string
  testStandard: string
  hasImage: boolean
  imageDescription: string
  ruleType: 'quantitative' | 'qualitative' | 'process' | 'unknown' | 'other'
  preConditions: string
  recognitionContent: string
  calculationMethod: 'average' | 'direct'
}

export interface Device {
  id: string
  name: string
  manufacturer: string | null
  model: string | null
  serialNo: string | null
  status: string | null
  location: string | null
  functionDesc: string | null
  measurementRange: string | null
  accuracy: string | null
  acceptanceDate: string | null
  calibrationCycle: string | null
  calibrationUnit: string | null
  calibrationCertNo: string | null
  calibrationDate: string | null
  nextCalibrationDate: string | null
  contact: string | null
  totalTests: number
  calibrationStatus: '正常' | '即将到期' | '已过期' | '未到货' | '无校准数据'
}

// ---- 从 JSON 加载数据 ----

const raw = realDataJson as any

// 实验记录（前500条用于前端展示，完整数据有3189条）
export const experimentRecords: ExperimentRecord[] = raw.records.map((r: any) => ({
  id: r.id,
  entrustNo: r.entrustNo,
  entrustPerson: r.entrustPerson,
  sampleName: r.sampleName,
  specModel: r.specModel,
  manufacturer: r.manufacturer,
  date: r.testDate,
  testDate: r.testDate,
  testItem: r.testItem,
  judgment: r.judgment,
  requirement: r.requirement,
  result: r.result,
  results: r.results,
  project: r.project,
  equipment: r.equipment,
  testStandard: r.testStandard,
  receiveDate: r.receiveDate,
  photos: r.photos || [],
}))

export const allRecordsCount: number = raw.allRecordsCount

// ---- 样品检测登记数据（上游数据，含检测中/待检测） ----

export interface RegRecord {
  id: string
  entrustNo: string
  sampleName: string
  specModel: string
  manufacturer: string
  receiveDate: string
  testType: string
  testItem: string
  testStandard: string
  equipment: string
  entrustUnit: string
  project: string
  testStatus: string
  batchDate: string
  productionDate: string
  entrustPerson: string
  requirement: string
  sampleStatus: string
  submitter: string
  createTime: string
}

export const regRecords: RegRecord[] = (raw.regRecords || []).map((r: any) => ({
  id: r.id,
  entrustNo: r.entrustNo,
  sampleName: r.sampleName,
  specModel: r.specModel,
  manufacturer: r.manufacturer,
  receiveDate: r.receiveDate,
  testType: r.testType,
  testItem: r.testItem,
  testStandard: r.testStandard,
  equipment: r.equipment,
  entrustUnit: r.entrustUnit,
  project: r.project,
  testStatus: r.testStatus || '已完成',
  batchDate: r.batchDate || '',
  productionDate: r.productionDate || '',
  entrustPerson: r.entrustPerson || '',
  requirement: r.requirement || '',
  sampleStatus: r.sampleStatus || '',
  submitter: r.submitter || '',
  createTime: r.createTime || '',
}))

export const allRegRecordsCount: number = raw.allRegRecordsCount || 0
export const inProgressCount: number = raw.inProgressCount || 0
export const pendingCount: number = raw.pendingCount || 0
export const statusStats: Record<string, number> = raw.statusStats || {}
export const testTypeStats: Record<string, number> = raw.testTypeStats || {}
export const personStats: Record<string, number> = raw.personStats || {}
export const monthlyRegVolume = raw.monthlyRegVolume || []

// ---- 委托申请单数据（最上游，含审批流程和送样图片） ----

export interface AppRecord {
  entrustNo: string
  receiveDate: string
  projectName: string
  sampleName: string
  specModel: string
  manufacturer: string
  productionDate: string
  batchDate: string
  photos: string[]
  description: string
  currentApprovalNode: string
  approvalResult: string
  testItems: { testStandard: string; testItem: string; equipment: string }[]
}

export const appRecords: AppRecord[] = (raw.appRecords || []).map((r: any) => ({
  entrustNo: r.entrustNo,
  receiveDate: r.receiveDate,
  projectName: r.projectName,
  sampleName: r.sampleName,
  specModel: r.specModel,
  manufacturer: r.manufacturer,
  productionDate: r.productionDate || '',
  batchDate: r.batchDate || '',
  photos: r.photos || [],
  description: r.description || '',
  currentApprovalNode: r.currentApprovalNode || '',
  approvalResult: r.approvalResult || '待审批',
  testItems: r.testItems || [],
}))

export const allAppRecordsCount: number = raw.allAppRecordsCount || 0
export const allAppRowsCount: number = raw.allAppRowsCount || 0
export const photoCount: number = raw.photoCount || 0

export interface Pipeline {
  totalApplications: number
  registered: number
  completed: number
  pendingRegistration: number
  inProgress: number
}
export const pipeline: Pipeline = raw.pipeline || { totalApplications: 0, registered: 0, completed: 0, pendingRegistration: 0, inProgress: 0 }
export const approvalStats: Record<string, number> = raw.approvalStats || {}

// 供应商统计（68条）
export const supplierStats: SupplierStat[] = raw.supplierStats

// 材料统计（21类）
export const materialStats: MaterialStat[] = raw.materialStats

// 样品类别列表
export const sampleCategories: string[] = raw.sampleCategories

// 生产厂家列表
export const manufacturers: string[] = raw.manufacturers

// 检测时效性数据（109条）
export const timelinessData: TimelinessRecord[] = raw.timelinessData

// 月度检测量
export const monthlyTestVolume = raw.monthlyVolume

// 检测项目分布
export const testItemDistribution = raw.testItemDistribution

// 设备数据（来自实验室检测设备台账2025，完全真实数据）
function getCalibrationStatus(d: any): Device['calibrationStatus'] {
  if (d.status === '未到') return '未到货'
  if (!d.nextCalibrationDate) return '无校准数据'
  const now = new Date()
  const next = new Date(d.nextCalibrationDate)
  if (next < now) return '已过期'
  const diffDays = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays <= 30) return '即将到期'
  return '正常'
}

export const devices: Device[] = (realDevicesJson as any[]).map(d => ({
  id: d.id,
  name: d.name,
  manufacturer: d.manufacturer || null,
  model: d.model || null,
  serialNo: d.serialNo || null,
  status: d.status || null,
  location: d.location || null,
  functionDesc: d.functionDesc || null,
  measurementRange: d.measurementRange || null,
  accuracy: d.accuracy || null,
  acceptanceDate: d.acceptanceDate || null,
  calibrationCycle: d.calibrationCycle || null,
  calibrationUnit: d.calibrationUnit || null,
  calibrationCertNo: d.calibrationCertNo || null,
  calibrationDate: d.calibrationDate || null,
  nextCalibrationDate: d.nextCalibrationDate || null,
  contact: d.contact || null,
  totalTests: d.totalTests || 0,
  calibrationStatus: getCalibrationStatus(d),
}))

// 能力表数据（来自报告智能判定原始数据0608.xlsx）
export const capabilityItems: CapabilityItem[] = (raw.capabilityItems || []).map((c: any) => ({
  id: c.id,
  sampleName: c.sampleName,
  specModel: c.specModel || '',
  judgmentStandard: c.judgmentStandard || '',
  testItem: c.testItem,
  materialSpec: c.materialSpec || '',
  standardRequirement: c.standardRequirement || '',
  testStandard: c.testStandard || '',
  equipment: c.equipment || '',
  remark: c.remark || '',
}))

export const sampleRequirements: SampleRequirement[] = (raw.sampleRequirements || []).map((r: any) => ({
  sampleName: r.sampleName,
  judgmentStandard: r.judgmentStandard || '',
  testItem: r.testItem,
  sampleSize: r.sampleSize || '',
}))

export const stripSpecs: StripSpec[] = (raw.stripSpecs || []).map((s: any) => ({
  category: s.category,
  model: s.model,
  commonNames: s.commonNames || [],
}))

// OCR识别规则（来自检测项表单-实际图片-0608.xlsx）
export const ocrRules: OCRRule[] = (raw.ocrRules || []).map((r: any) => ({
  id: r.id,
  equipment: r.equipment,
  sampleName: r.sampleName,
  judgmentStandard: r.judgmentStandard || '',
  testItem: r.testItem,
  subItem: r.subItem || '',
  standardRequirement: r.standardRequirement || '',
  testStandard: r.testStandard || '',
  hasImage: r.hasImage || false,
  imageDescription: r.imageDescription || '',
  ruleType: r.ruleType || 'unknown',
  preConditions: r.preConditions || '',
  recognitionContent: r.recognitionContent || '',
  calculationMethod: r.calculationMethod || 'direct',
}))

// 从能力表提取的样品类别列表
export const capabilitySampleNames: string[] = [...new Set(capabilityItems.map(c => c.sampleName))].sort()

// 报告模板（基于能力表样品类别，匹配检测报告模板文件）
export const reportTemplates = [
  // sampleKeyword 来源: 解析 docs/检测报告模板/*.docx 中 word/document.xml 的"样品名称"字段
  // 实际三份 docx 写的样品名都是「金属吸隔声板」
  // pageCount/hasChart/hasPrePostTest 来源: scripts/extractReportTemplates.cjs(2026-06-12 抽取)
  { id: 'R001', name: '检测报告模版-1', sampleKeyword: '金属吸隔声板', category: '金属屏体', version: 'v1.0', file: '检测报告模版-1.docx', pageCount: 5, hasChart: true, hasPrePostTest: false },
  { id: 'R002', name: '检测报告模版-2', sampleKeyword: '金属吸隔声板', category: '亚克力', version: 'v1.0', file: '检测报告模版-2.docx', pageCount: 6, hasChart: true, hasPrePostTest: true },
  { id: 'R003', name: '检测报告模版-3', sampleKeyword: '金属吸隔声板', category: 'PC板', version: 'v1.0', file: '检测报告模版-3.docx', pageCount: 3, hasChart: false, hasPrePostTest: false },
]

// 供应商基础信息（144家，来自钉钉工作台）
export interface SupplierInfo {
  id: string
  name: string
  productTypes: string[]
  description: string
  submitter: string
  createTime: string
}

export const supplierInfo: SupplierInfo[] = (raw.supplierInfo || []).map((s: any) => ({
  id: s.id,
  name: s.name,
  productTypes: s.productTypes || [],
  description: s.description || '',
  submitter: s.submitter || '',
  createTime: s.createTime || '',
}))

export const supplierInfoCount: number = raw.supplierInfoCount || 0

// 供应商列表（用于筛选下拉框）
export const supplierList = supplierStats.map((s, i) => ({
  id: 'S' + String(i + 1).padStart(3, '0'),
  name: s.manufacturer,
  category: s.sampleName,
  totalBatches: s.totalBatches,
  inspectedBatches: s.totalBatches,
  qualifiedBatches: s.qualifiedBatches,
  unqualifiedBatches: s.unqualifiedBatches,
  pendingBatches: s.pendingBatches,
  qualifyRate: s.qualifyRate,
}))

// ============================================================
// 追加: 实验室检测设备统计（1.9）.xlsx 的真实数据
// 说明: 这些字段来源于独立的 Excel 源,与上面的 devices 数组(来自
//       实验室检测设备台账2025(9).xlsx 等)互不重叠,只追加,不覆盖。
// ============================================================

// --- 仪器台账(2025/2024/2023 三个 sheet 合并) ---
export interface EquipmentInstrument {
  id: string | null                      // 仪器编号 ZC-XX
  name: string | null
  dataStorage: string | null             // 检测数据存储方式
  manufacturer: string | null
  model: string | null
  serialNo: string | null                // 出厂编号
  productionDate: string | null
  measurementRange: string | null
  status: string | null                  // 正常 / 未到
  functionDesc: string | null
  location: string | null
  acceptanceDate: string | null
  validUntil: string | null              // 有效日期(可能为"一年"等周期描述)
  specCategory: string | null            // 规格种类①扩展不确定度②最大允差③准确度等级
  calibrationUnit: string | null
  calibrationCertNo: string | null
  calibrationDate: string | null         // ISO YYYY-MM-DD
  nextCalibrationDate: string | null
  contact: string | null
  remark: string | null
  dbType: string | null
  sourceYear: 2025 | 2024 | 2023
  sourceSheet: string
}

// --- 标准物质 ---
export interface StandardMaterial {
  no: number | null
  id: string | null                      // BZWZ-XX
  name: string | null
  spec: string | null
  serialNo: string | null
  measurementRange: string | null
  uncertainty: string | null
  calibrationUnit: string | null
  certNo: string | null
  calibrationDate: string | null
  nextCalibrationDate: string | null
  sourceYear: 2025 | 2024
}

// --- 设备价格 ---
export interface DevicePrice {
  seq: number | null
  deviceName: string | null
  quantity: number | null
  unitPrice: number | null
  sourceCategory: string | null
  note: string | null
}

// --- 校准方案(计划版/执行版) ---
export interface CalibrationPlan {
  seq: number | null
  deviceId: string | null
  deviceName: string | null
  manufacturer: string | null
  model: string | null
  serialNo: string | null
  itemAndRange: string | null
  accuracy: string | null
  cycle: string | null
  plannedDate: string | null
  nextDate: string | null
  remark: string | null
  planVersion: '计划版' | '执行版'
}

// --- 校准计划(实际执行情况) ---
export interface CalibrationExecution {
  seq: number | null
  deviceName: string | null
  deviceId: string | null
  quantity: number | null
  validPeriod: string | null
  lastCalibrationDate: string | null
  nextCalibrationDate: string | null
  remark: string | null
}

// 直接导出原始数组(纯数据,不参与上面的 getCalibrationStatus 计算)
export const equipmentInstruments: EquipmentInstrument[] =
  (equipmentReferenceData as any).instruments || []
export const standardMaterials: StandardMaterial[] =
  (equipmentReferenceData as any).standardMaterials || []
export const devicePrices: DevicePrice[] =
  (equipmentReferenceData as any).devicePrices || []
export const calibrationPlans: CalibrationPlan[] =
  (equipmentReferenceData as any).calibrationPlans || []
export const calibrationExecutions: CalibrationExecution[] =
  (equipmentReferenceData as any).calibrationExecutions || []

// --- 基于 equipmentInstruments 的派生统计(只读真实数据,不假造) ---

// 当年(2025)在用仪器(忽略 2024/2023 历史版本)
export const currentInstruments: EquipmentInstrument[] = equipmentInstruments.filter(
  (d) => d.sourceYear === 2025 && d.status !== '未到',
)

// 设备位置分布(从 2025 sheet)
export interface LocationCount { location: string; count: number }
export const equipmentLocationStats: LocationCount[] = (() => {
  const map: Record<string, number> = {}
  for (const d of currentInstruments) {
    const loc = d.location || '未标注'
    map[loc] = (map[loc] || 0) + 1
  }
  return Object.entries(map)
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
})()

// 数据来源年份分布
export interface YearCount { year: 2025 | 2024 | 2023; count: number }
export const equipmentSourceYearStats: YearCount[] = (() => {
  const map: Record<number, number> = {}
  for (const d of equipmentInstruments) {
    map[d.sourceYear] = (map[d.sourceYear] || 0) + 1
  }
  return ([2025, 2024, 2023] as const)
    .map((year) => ({ year, count: map[year] || 0 }))
})()

// 基于"下次校准日期"真实计算的校准状态分布
export interface CalibrationCount { status: string; count: number }
export const equipmentCalibrationStats: CalibrationCount[] = (() => {
  const map: Record<string, number> = {}
  for (const d of currentInstruments) {
    let status = '无校准数据'
    if (d.status === '未到') status = '未到货'
    else if (d.nextCalibrationDate) {
      const next = new Date(d.nextCalibrationDate)
      const now = new Date()
      if (next < now) status = '已过期'
      else {
        const diffDays = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        status = diffDays <= 30 ? '即将到期' : '正常'
      }
    }
    map[status] = (map[status] || 0) + 1
  }
  return Object.entries(map).map(([status, count]) => ({ status, count }))
})()

// 仪器总数(仅 2025 在用, 与原 devices 互不重叠)
export const equipmentInstrumentsCurrentCount = currentInstruments.length

// 设备使用频次统计(来自 台账.xlsx 真实数据,已经由 extractAllData.cjs 生成)
// 结构: { name: string, totalTests: number }
export interface EquipmentStat { name: string; totalTests: number }
export const equipmentStats: EquipmentStat[] = (realDataJson as any).equipmentStats || []

