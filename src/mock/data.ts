// ============================================================
// 真实数据 - 声屏障检测管理平台 (基于台账.xlsx)
// ============================================================
import realDataJson from './realData.json'
import realDevicesJson from './realDevices.json'

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
  photos: string[]
}

export interface SupplierStat {
  manufacturer: string
  sampleName: string
  totalBatches: number
  qualifiedBatches: number
  unqualifiedBatches: number
  pendingBatches: number
  qualifyRate: number
}

export interface MaterialStat {
  material: string
  supplierCount: number
  totalBatches: number
  avgQualifyRate: number
}

export interface TimelinessRecord {
  category: string
  testItem: string
  avgDays: number
  sampleCount: number
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

// 报告模板（基于docs/报告模板文件夹）
export const reportTemplates = [
  { id: 'R001', name: '检测报告-金属屏体', category: '金属屏体', version: 'v9.9' },
  { id: 'R002', name: '检测报告-透明屏体（亚克力）', category: '亚克力', version: 'v9.9' },
  { id: 'R003', name: '检测报告-PC板', category: 'PC板', version: 'v9.9' },
  { id: 'R004', name: '检测报告-胶条', category: '橡胶条', version: 'v1.0' },
  { id: 'R005', name: '检测报告-非金属屏体', category: '非金属屏体', version: 'v1.0' },
  { id: 'R006', name: '检测报告-岩棉', category: '岩棉', version: 'v1.0' },
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
