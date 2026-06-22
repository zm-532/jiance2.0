const OCR_API = "/api/v1/inspection";

// ---- Interfaces ----

export interface OCRResultPage {
  pageNumber: number;
  text: string;
  images: Record<string, string>;
}

export interface OCRTable {
  rows: string[][];
}

export interface OCRJobResult {
  success: boolean;
  photoId: string | null;
  pages: OCRResultPage[];
  tables: OCRTable[];
  rawText: string;
  error?: string;
}

export interface ArchivedPhoto {
  id: string;
  original_name: string;
  filename: string;
  photo_url: string;
  size: number;
  mimetype: string;
  uploaded_at: string;
  ocr_status: string;
  ocr_job_id: string | null;
  ocr_raw_text: string | null;
  pages: OCRResultPage[] | null;
  tables: OCRTable[] | null;
  error: string | null;
  matched_rule_id: string | null;
  matched_rule_name: string | null;
  test_item: string | null;
  sub_item: string | null;
  recognized_value: string | null;
  standard_requirement: string | null;
  judgment: string;
  status: string;
  include_in_report: boolean;
  sample_name: string | null;
  entrust_no: string | null;
  // 配置驱动 OCR 增量字段
  device_key: string | null;
  group_id: string | null;
  config_id: string | null;
  material_spec: string | null;
  sample_count: number | null;
  aggregation_method: string | null;
  result_values: number[] | null;
  frequency_data: Array<{ frequency: string; coefficient: number }> | null;
  updated_at: string;
}

export interface PhotoListParams {
  sample_name?: string;
  entrust_no?: string;
  include_in_report?: boolean;
  status?: string;
  group_id?: string;
  device_key?: string;
}

export interface PhotoUpdate {
  test_item?: string | null;
  sub_item?: string | null;
  recognized_value?: string | null;
  standard_requirement?: string | null;
  judgment?: string | null;
  status?: string | null;
  include_in_report?: boolean | null;
  sample_name?: string | null;
  entrust_no?: string | null;
  matched_rule_id?: string | null;
  matched_rule_name?: string | null;
  error?: string | null;
  // 配置驱动增量字段
  device_key?: string | null;
  group_id?: string | null;
  config_id?: string | null;
  material_spec?: string | null;
  sample_count?: number | null;
  aggregation_method?: string | null;
  result_values?: number[] | null;
  frequency_data?: Array<{ frequency: string; coefficient: number }> | null;
}

// ---- OCR Recognition (upload + poll) ----

const POLL_INTERVAL = 2000;
const MAX_POLL_COUNT = 90;

export async function recognizeImage(
  file: File,
  onProgress?: (status: string, progress?: number) => void
): Promise<OCRJobResult> {
  try {
    onProgress?.("正在上传...");

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${OCR_API}/ocr/recognize`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, photoId: null, pages: [], tables: [], rawText: "", error: `请求失败: ${response.status} ${text}` };
    }

    const data = await response.json();

    if (!data.success || !data.photo_id) {
      return { success: false, photoId: data.photo_id || null, pages: [], tables: [], rawText: "", error: data.error || "识别失败" };
    }

    const photoId = data.photo_id;
    onProgress?.("已提交，等待识别结果...", 10);

    // Poll for result
    for (let i = 0; i < MAX_POLL_COUNT; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));

      const progressPct = Math.min(10 + Math.floor((i / MAX_POLL_COUNT) * 85), 95);
      onProgress?.("正在识别中...", progressPct);

      const statusRes = await fetch(`${OCR_API}/ocr/jobs/${photoId}`);
      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();

      if (statusData.ocr_status === "completed") {
        onProgress?.("识别完成", 100);
        return {
          success: true,
          photoId,
          pages: statusData.pages || [],
          tables: statusData.tables || [],
          rawText: statusData.raw_text || "",
        };
      }

      if (statusData.ocr_status === "failed") {
        return {
          success: false,
          photoId,
          pages: [],
          tables: [],
          rawText: "",
          error: statusData.error || "OCR 识别失败",
        };
      }
    }

    return { success: false, photoId, pages: [], tables: [], rawText: "", error: "识别超时，请稍后重试" };
  } catch (err) {
    return {
      success: false,
      photoId: null,
      pages: [],
      tables: [],
      rawText: "",
      error: err instanceof Error ? err.message : "网络错误",
    };
  }
}

// ---- Photo CRUD ----

export async function listPhotos(params?: PhotoListParams): Promise<ArchivedPhoto[]> {
  const query = new URLSearchParams();
  if (params?.sample_name) query.set("sample_name", params.sample_name);
  if (params?.entrust_no) query.set("entrust_no", params.entrust_no);
  if (params?.include_in_report !== undefined) query.set("include_in_report", String(params.include_in_report));
  if (params?.status) query.set("status", params.status);
  if (params?.group_id) query.set("group_id", params.group_id);
  if (params?.device_key) query.set("device_key", params.device_key);

  const qs = query.toString();
  const res = await fetch(`${OCR_API}/ocr/photos${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`请求失败: ${res.status}`);
  return res.json();
}

export async function getPhoto(photoId: string): Promise<ArchivedPhoto> {
  const res = await fetch(`${OCR_API}/ocr/photos/${photoId}`);
  if (!res.ok) throw new Error(`请求失败: ${res.status}`);
  return res.json();
}

export async function updatePhotoMeta(photoId: string, patch: PhotoUpdate): Promise<ArchivedPhoto> {
  const res = await fetch(`${OCR_API}/ocr/photos/${photoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`请求失败: ${res.status}`);
  return res.json();
}

export async function deletePhoto(photoId: string): Promise<void> {
  const res = await fetch(`${OCR_API}/ocr/photos/${photoId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`请求失败: ${res.status}`);
}

export async function deletePhotosBatch(ids: string[]): Promise<{ success: number; failed: number }> {
  const res = await fetch(`${OCR_API}/ocr/photos/batch`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(`请求失败: ${res.status}`);
  return res.json();
}

export function getPhotoDownloadUrl(photoId: string): string {
  return `${OCR_API}/ocr/photos/${photoId}/download`;
}

// ---- Device idle warning ----

export interface ActiveRule {
  rule_id: string
  rule_name: string | null
  photo_count: number
  last_upload: string | null
}

export interface DeviceIdleWarningResponse {
  days: number
  since: string
  now: string
  total_photos: number
  active_rules: ActiveRule[]
}

export async function fetchDeviceIdleWarning(days = 7): Promise<DeviceIdleWarningResponse> {
  const res = await fetch(`${OCR_API}/device-idle-warning?days=${days}`)
  if (!res.ok) throw new Error(`请求失败: ${res.status}`)
  return res.json()
}

// ---- 配置驱动 OCR：设备/样品/配置组查询 ----

export interface DeviceItem {
  device_key: string;
  device_name: string;
}

export interface SampleItem {
  sample_name: string;
  material_spec: string | null;
}

export interface ConfigGroupItem {
  id: string;
  device_name: string;
  device_key: string;
  sample_name: string;
  material_spec: string | null;
  judgment_standard: string | null;
  group_key: string;
  group_item_count: number;
  test_item: string;
  sub_item: string | null;
  judgment_indicator: string | null;
  test_standard: string | null;
  extraction_rule: Record<string, unknown>;
  aggregation_method: string;
  sample_count: number;
  needs_subtable: boolean;
  report_section: string | null;
}

export interface ConfigGroup {
  group_key: string;
  device_key: string;
  device_name: string;
  sample_name: string;
  group_item_count: number;
  items: ConfigGroupItem[];
  image_description?: string | null;
}

export interface RecognizeWithConfigResult {
  success: boolean;
  group_id: string | null;
  photo_ids: string[];
  error?: string;
}

export async function fetchDevices(): Promise<DeviceItem[]> {
  const res = await fetch(`${OCR_API}/configs/devices`);
  if (!res.ok) throw new Error(`请求失败: ${res.status}`);
  return res.json();
}

export async function fetchSamples(deviceKey: string): Promise<SampleItem[]> {
  const res = await fetch(`${OCR_API}/configs/devices/${encodeURIComponent(deviceKey)}/samples`);
  if (!res.ok) throw new Error(`请求失败: ${res.status}`);
  return res.json();
}

export async function fetchConfigGroups(deviceKey: string, sampleName: string): Promise<ConfigGroup[]> {
  const qs = new URLSearchParams({ device_key: deviceKey, sample_name: sampleName });
  const res = await fetch(`${OCR_API}/configs/groups?${qs}`);
  if (!res.ok) throw new Error(`请求失败: ${res.status}`);
  return res.json();
}

// ---- 配置驱动 OCR：带配置的识别 ----

const MAX_POLL_COUNT_CONFIG = 120; // 配置驱动识别耗时更长，提升到 120 次（4分钟）

export async function recognizeWithConfig(
  file: File,
  deviceKey: string,
  sampleName: string,
  entrustNo: string | undefined,
  onProgress?: (status: string, progress?: number) => void
): Promise<RecognizeWithConfigResult> {
  try {
    onProgress?.("正在上传...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("device_key", deviceKey);
    formData.append("sample_name", sampleName);
    if (entrustNo) formData.append("entrust_no", entrustNo);

    const response = await fetch(`${OCR_API}/ocr/recognize_with_config`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, group_id: null, photo_ids: [], error: `请求失败: ${response.status} ${text}` };
    }

    const data = await response.json();

    if (!data.success || !data.group_id) {
      return { success: false, group_id: data.group_id || null, photo_ids: [], error: data.error || "识别失败" };
    }

    const groupId = data.group_id;
    const photoIds: string[] = data.photo_ids || [];
    onProgress?.("已提交，等待识别结果...", 10);

    // 轮询主照片状态
    for (let i = 0; i < MAX_POLL_COUNT_CONFIG; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));

      const progressPct = Math.min(10 + Math.floor((i / MAX_POLL_COUNT_CONFIG) * 85), 95);
      onProgress?.("正在识别中...", progressPct);

      if (photoIds.length === 0) continue;
      const statusRes = await fetch(`${OCR_API}/ocr/jobs/${photoIds[0]}`);
      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();

      if (statusData.ocr_status === "completed") {
        onProgress?.("识别完成", 100);
        return { success: true, group_id: groupId, photo_ids: photoIds };
      }

      if (statusData.ocr_status === "failed") {
        return { success: false, group_id: groupId, photo_ids: photoIds, error: statusData.error || "OCR 识别失败" };
      }
    }

    return { success: false, group_id: groupId, photo_ids: photoIds, error: "识别超时，请稍后重试" };
  } catch (err) {
    return {
      success: false,
      group_id: null,
      photo_ids: [],
      error: err instanceof Error ? err.message : "网络错误",
    };
  }
}

// ---- Judgment (pure client-side) ----

/**
 * 动态阈值解析：从材料规格中提取 L 值并计算阈值。
 * 例：judgment_indicator = "挠度≤19.6（100/L）"，materialSpec = "1960"
 *   → 100/1960*1000 ≈ 51? 不对，实际是 100/L 中的 L 单位为 mm，
 *   规格为 1960mm 时 100/L 不直接算，而是查表 1960→19.6。
 *   实际逻辑：L=1960 → 100/L = 0.0510... 不对。
 *   正确理解：挠度≤19.6（100/L）表示当 L=1000 时阈值为 19.6，
 *   即阈值 = 19.6 * L / 1000。1960mm → 19.6*1960/1000 = 38.4。
 *   但文档示例说 1960→19.6, 2960→29.6, 3960→39.6，
 *   即阈值 = L / 100。所以 "100/L" 是公式标识，实际阈值按 L/100 计算。
 */
function resolveDynamicThreshold(
  requirement: string,
  materialSpec: string | undefined
): string {
  // 匹配 (100/L) 或 (500/L) 等动态公式标识
  const formulaMatch = requirement.match(/[（(](\d+)\/L[）)]/);
  if (!formulaMatch || !materialSpec) return requirement;

  // 从材料规格提取数字（如 "1960" from "1960mm"）
  const specMatch = materialSpec.match(/(\d+)/);
  if (!specMatch) return requirement;

  const L = parseInt(specMatch[1], 10);
  const baseValue = parseFloat(formulaMatch[1]); // 100 或 500

  // 文档规则：1960→19.6, 2960→29.6, 3960→39.6
  // 即阈值 = L / (1000 / baseValue) = L * baseValue / 1000
  const threshold = (L * baseValue / 1000).toFixed(2);

  // 替换原始公式部分为计算后的阈值
  return requirement.replace(
    /([≤<>=≥>]?\s*)(\d+\.?\d*)\s*[（(]\d+\/L[）)]/,
    `$1${threshold}`
  );
}

/**
 * 多条件判定：requirement 含 "&&" 或 "且" 分隔多个条件，全部合格才合格。
 */
function judgeMultiCondition(
  value: string,
  requirement: string
): "合格" | "不合格" | "待判定" {
  // 按且 / && 分割
  const conditions = requirement.split(/且|&&/).map((s) => s.trim()).filter(Boolean);
  if (conditions.length <= 1) return "待判定";

  const results = conditions.map((cond) => judgeSingle(value, cond));
  if (results.every((r) => r === "合格")) return "合格";
  if (results.some((r) => r === "不合格")) return "不合格";
  return "待判定";
}

/**
 * 单条件判定（核心逻辑，不含多条件）。
 */
function judgeSingle(
  value: string,
  requirement: string
): "合格" | "不合格" | "待判定" {
  if (!value || !requirement) return "待判定";

  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    // 非数值判定：关键字匹配
    if (requirement.includes("无裂纹") && value.includes("无裂纹")) return "合格";
    if (requirement.includes("无裂纹") && value.includes("有裂纹")) return "不合格";
    if (requirement.includes("不裂") && value.includes("不裂")) return "合格";
    return "待判定";
  }

  // 范围判定：370-500MPa 或 370~500
  const rangeMatch = requirement.match(/(\d+\.?\d*)\s*[-~]\s*(\d+\.?\d*)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return numValue >= min && numValue <= max ? "合格" : "不合格";
  }

  // ≥ 或 >= 判定
  const geMatch = requirement.match(/[≥>]=?\s*(\d+\.?\d*)/);
  if (geMatch) {
    const threshold = parseFloat(geMatch[1]);
    return numValue >= threshold ? "合格" : "不合格";
  }

  // ≤ 或 <= 判定
  const leMatch = requirement.match(/[≤<]=?\s*(\d+\.?\d*)/);
  if (leMatch) {
    const threshold = parseFloat(leMatch[1]);
    return numValue <= threshold ? "合格" : "不合格";
  }

  return "待判定";
}

/**
 * 增强版判定函数：支持范围、动态阈值（L/300）、多条件（且/&&）。
 *
 * @param value 检测结果值
 * @param requirement 标准要求（可含动态公式 100/L、多条件 且/&&）
 * @param materialSpec 材料规格（动态阈值计算用，如 "1960mm"）
 */
export function judgeResult(
  value: string,
  requirement: string,
  materialSpec?: string
): "合格" | "不合格" | "待判定" {
  if (!value || !requirement) return "待判定";

  // 1. 多条件判定（且 / &&）
  if (requirement.includes("&&") || requirement.includes("且")) {
    return judgeMultiCondition(value, requirement);
  }

  // 2. 动态阈值解析（100/L、500/L）
  const resolvedRequirement = resolveDynamicThreshold(requirement, materialSpec);

  // 3. 单条件判定
  return judgeSingle(value, resolvedRequirement);
}

/**
 * 组级别判定：同一次测试的所有检测项都合格，组才合格。
 */
export function judgeGroup(photos: Array<{ judgment: string }>): "合格" | "不合格" | "待判定" {
  if (photos.length === 0) return "待判定";
  if (photos.every((p) => p.judgment === "合格")) return "合格";
  if (photos.some((p) => p.judgment === "不合格")) return "不合格";
  return "待判定";
}

/**
 * 报告级别总判定：报告中所有检测项都合格，报告才合格。
 */
export function judgeReport(
  groups: Array<{ judgment: string }>
): "合格" | "不合格" | "待判定" {
  return judgeGroup(groups);
}

// ---- 报告生成 ----

export interface ReportTemplate {
  id: string;
  name: string;
  file: string;
  category: string;
}

export async function fetchReportTemplates(): Promise<ReportTemplate[]> {
  const res = await fetch(`${OCR_API}/reports/templates`);
  if (!res.ok) throw new Error(`请求失败: ${res.status}`);
  return res.json();
}

export async function generateReport(
  templateId: string,
  entrustNo?: string,
  sampleName?: string
): Promise<Blob> {
  const formData = new FormData();
  formData.append("template_id", templateId);
  if (entrustNo) formData.append("entrust_no", entrustNo);
  if (sampleName) formData.append("sample_name", sampleName);

  const res = await fetch(`${OCR_API}/reports/generate`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`报告生成失败: ${res.status} ${text}`);
  }
  return res.blob();
}
