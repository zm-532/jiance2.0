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
  updated_at: string;
}

export interface PhotoListParams {
  sample_name?: string;
  entrust_no?: string;
  include_in_report?: boolean;
  status?: string;
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

// ---- Judgment (pure client-side) ----

export function judgeResult(value: string, requirement: string): "合格" | "不合格" | "待判定" {
  if (!value || !requirement) return "待判定";

  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    if (requirement.includes("无裂纹") && value.includes("无裂纹")) return "合格";
    if (requirement.includes("无裂纹") && value.includes("有裂纹")) return "不合格";
    if (requirement.includes("不裂") && value.includes("不裂")) return "合格";
    return "待判定";
  }

  const geMatch = requirement.match(/[≥>]=?\s*(\d+\.?\d*)/);
  const leMatch = requirement.match(/[≤<]=?\s*(\d+\.?\d*)/);
  const rangeMatch = requirement.match(/(\d+\.?\d*)\s*[-~]\s*(\d+\.?\d*)/);

  if (geMatch) {
    const threshold = parseFloat(geMatch[1]);
    return numValue >= threshold ? "合格" : "不合格";
  }

  if (leMatch) {
    const threshold = parseFloat(leMatch[1]);
    return numValue <= threshold ? "合格" : "不合格";
  }

  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return numValue >= min && numValue <= max ? "合格" : "不合格";
  }

  return "待判定";
}
