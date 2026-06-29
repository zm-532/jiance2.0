/** 统计 API 调用函数 — 替代 @/mock/data 的直接导入 */

const API = "/api/v1/inspection";

// ---- 实验记录 ----

export interface ExperimentRecord {
  id: string;
  entrustNo: string;
  entrustPerson: string;
  sampleName: string;
  specModel: string;
  manufacturer: string;
  date: string;
  testItem: string;
  judgment: string;
  requirement: string;
  result: string;
  results: string[];
  project: string;
  equipment: string;
  testStandard: string;
  receiveDate: string;
  photos: string[];
}

export interface ExperimentRecordsResponse {
  records: ExperimentRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchExperimentRecords(params?: {
  manufacturer?: string;
  sample_name?: string;
  entrust_no?: string;
  test_item?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}): Promise<ExperimentRecordsResponse> {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== "") query.set(k, String(v));
    });
  }
  const resp = await fetch(`${API}/stats/experiment-records?${query}`);
  if (!resp.ok) throw new Error(`获取实验记录失败: ${resp.status}`);
  return resp.json();
}

// ---- 厂家与样品类别 ----

export async function fetchManufacturers(): Promise<string[]> {
  const resp = await fetch(`${API}/stats/manufacturers`);
  if (!resp.ok) throw new Error(`获取厂家列表失败: ${resp.status}`);
  return resp.json();
}

export async function fetchSampleCategories(manufacturer?: string): Promise<string[]> {
  const query = new URLSearchParams();
  if (manufacturer) query.set("manufacturer", manufacturer);
  const resp = await fetch(`${API}/stats/sample-categories?${query}`);
  if (!resp.ok) throw new Error(`获取样品类别失败: ${resp.status}`);
  return resp.json();
}

// ---- 供应商统计 ----

export interface SupplierStat {
  manufacturer: string;
  sampleName: string;
  totalBatches: number;
  inspectedBatches: number;
  qualifiedBatches: number;
  unqualifiedBatches: number;
  pendingBatches: number;
  qualifyRate: number | null;
}

export interface MaterialStat {
  material: string;
  supplierCount: number;
  totalBatches: number;
  inspectedBatches: number;
  qualifiedBatches: number;
  avgQualifyRate: number | null;
}

export async function fetchSupplierStats(sampleName?: string): Promise<SupplierStat[]> {
  const query = new URLSearchParams();
  if (sampleName) query.set("sample_name", sampleName);
  const resp = await fetch(`${API}/stats/suppliers?${query}`);
  if (!resp.ok) throw new Error(`获取供应商统计失败: ${resp.status}`);
  return resp.json();
}

export async function fetchMaterialStats(): Promise<MaterialStat[]> {
  const resp = await fetch(`${API}/stats/materials`);
  if (!resp.ok) throw new Error(`获取材料统计失败: ${resp.status}`);
  return resp.json();
}

// ---- 检测量统计 ----

export interface VolumeData {
  label: string;
  total: number;
  qualified: number;
  unqualified: number;
}

export interface MonthlyVolume {
  month: string;
  total: number;
  qualified: number;
  unqualified: number;
  pending?: number;
}

export async function fetchVolumeStats(params: {
  dimension?: string;
  start_month?: string;
  end_month?: string;
}): Promise<VolumeData[]> {
  const query = new URLSearchParams();
  if (params.dimension) query.set("dimension", params.dimension);
  if (params.start_month) query.set("start_month", params.start_month);
  if (params.end_month) query.set("end_month", params.end_month);
  const resp = await fetch(`${API}/stats/volume?${query}`);
  if (!resp.ok) throw new Error(`获取检测量统计失败: ${resp.status}`);
  return resp.json();
}

export async function fetchVolumeTrend(): Promise<MonthlyVolume[]> {
  const resp = await fetch(`${API}/stats/volume/trend`);
  if (!resp.ok) throw new Error(`获取检测趋势失败: ${resp.status}`);
  return resp.json();
}

export interface VolumeBySupplierData {
  periods: string[];
  grouped: Record<string, Record<string, { total: number; qualified: number; unqualified: number }>>;
  suppliers: string[];
}

export async function fetchVolumeBySupplier(
  manufacturers: string[],
  dimension: string = "month"
): Promise<VolumeBySupplierData> {
  const query = new URLSearchParams();
  query.set("manufacturers", manufacturers.join(","));
  query.set("dimension", dimension);
  const resp = await fetch(`${API}/stats/volume/by-supplier?${query}`);
  if (!resp.ok) throw new Error(`获取供应商对比失败: ${resp.status}`);
  return resp.json();
}

// ---- 检测时效性 ----

export interface TimelinessRecord {
  category: string;
  testCategory: string;
  testItem: string;
  avgDays: number | null;
  sampleCount: number;
  validSampleCount: number;
  missingReason: string;
}

export async function fetchTimelinessStats(): Promise<TimelinessRecord[]> {
  const resp = await fetch(`${API}/stats/timeliness`);
  if (!resp.ok) throw new Error(`获取时效性统计失败: ${resp.status}`);
  return resp.json();
}

// ---- 总览工作台 ----

export interface DashboardData {
  totalDevices: number;
  calibNormal: number;
  calibSoon: number;
  calibExpired: number;
  activeDevices: number;
  idleDevices: number;
  notArrivedDevices: number;
  devicesWithTests: number;
  noCalibData: number;
  uniqueLocations: number;
  materialStats: MaterialStat[];
  testItemDistribution: { name: string; value: number; color: string }[];
  monthlyVolume: MonthlyVolume[];
  pipeline: {
    totalApplications: number;
    registered: number;
    completed: number;
    pendingRegistration: number;
    inProgress: number;
  };
  photoCount: number;
  allRecordsCount: number;
  allRegRecordsCount: number;
  inProgressCount: number;
  pendingCount: number;
  supplierInfoCount: number;
}

export async function fetchDashboardStats(): Promise<DashboardData> {
  const resp = await fetch(`${API}/stats/dashboard`);
  if (!resp.ok) throw new Error(`获取总览数据失败: ${resp.status}`);
  return resp.json();
}

// ---- 设备管理 ----

export interface Device {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serialNo: string | null;
  status: string | null;
  location: string | null;
  functionDesc: string | null;
  measurementRange: string | null;
  accuracy: string | null;
  acceptanceDate: string | null;
  calibrationCycle: string | null;
  calibrationUnit: string | null;
  calibrationCertNo: string | null;
  calibrationDate: string | null;
  nextCalibrationDate: string | null;
  contact: string | null;
  totalTests: number;
  calibrationStatus: "正常" | "即将到期" | "已过期" | "未到货" | "无校准数据";
}

export async function fetchDevices(): Promise<Device[]> {
  const resp = await fetch(`${API}/stats/devices`);
  if (!resp.ok) throw new Error(`获取设备列表失败: ${resp.status}`);
  return resp.json();
}

// ---- 能力表 ----

export interface CapabilityItem {
  id: string;
  sampleName: string;
  specModel: string;
  judgmentStandard: string;
  testItem: string;
  materialSpec: string;
  standardRequirement: string;
  testStandard: string;
  equipment: string;
  remark: string;
}

export async function fetchCapabilityItems(): Promise<CapabilityItem[]> {
  const resp = await fetch(`${API}/stats/capability-items`);
  if (!resp.ok) throw new Error(`获取能力表失败: ${resp.status}`);
  return resp.json();
}

// ---- OCR规则 ----

export interface OCRRule {
  id: string;
  equipment: string;
  sampleName: string;
  judgmentStandard: string;
  testItem: string;
  subItem: string;
  standardRequirement: string;
  testStandard: string;
  hasImage: boolean;
  imageDescription: string;
  ruleType: string;
  preConditions: string;
  recognitionContent: string;
  calculationMethod: string;
}

export async function fetchOcrRules(): Promise<OCRRule[]> {
  const resp = await fetch(`${API}/stats/ocr-rules`);
  if (!resp.ok) throw new Error(`获取OCR规则失败: ${resp.status}`);
  return resp.json();
}

// ---- 报告模板 ----

export interface ReportTemplate {
  id: string;
  name: string;
  file: string;
  category: string;
}

export async function fetchReportTemplates(): Promise<ReportTemplate[]> {
  const resp = await fetch(`${API}/reports/templates`);
  if (!resp.ok) throw new Error(`获取报告模板失败: ${resp.status}`);
  return resp.json();
}
