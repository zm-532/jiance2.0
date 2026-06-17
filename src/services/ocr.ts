// OCR 服务 - 调用本地 Express 后端
// 后端负责转发请求到 PaddleOCR API，并对上传的照片做磁盘归档 + 元数据持久化

const OCR_API = '/api/ocr'

export interface OCRResultPage {
  pageNumber: number
  text: string
  images: Record<string, string>
}

export interface OCRTable {
  rows: string[][]
}

export interface OCRJobResult {
  success: boolean
  photoId?: string
  photoUrl?: string
  pages: OCRResultPage[]
  tables?: OCRTable[]
  error?: string
  rawText: string
}

export interface OCRJobStatus {
  ocrStatus: 'pending' | 'done' | 'failed'
  status: string
  pages?: OCRResultPage[]
  rawText?: string
  tables?: OCRTable[]
  error?: string | null
}

export interface ArchivedPhoto {
  id: string
  originalName: string
  filename: string
  photoUrl: string
  size: number
  mimetype: string
  uploadedAt: string
  ocrStatus: 'pending' | 'done' | 'failed'
  ocrRawText: string
  pages: OCRResultPage[]
  tables?: OCRTable[]
  matchedRuleId: string | null
  matchedRuleName?: string
  testItem: string
  subItem: string
  recognizedValue: string
  standardRequirement: string
  judgment: '合格' | '不合格' | '待判定'
  status: '已识别' | '待确认' | '识别失败' | '识别中'
  includeInReport: boolean
  error: string | null
  sampleName: string
  entrustNo: string
  updatedAt?: string
}

/**
 * 上传照片到后端：先落盘归档，提交 PaddleOCR 任务后立即返回，
 * 然后前端轮询等待识别结果。
 */
export async function recognizeImage(
  file: File,
  onProgress?: (status: string, progress?: number) => void,
): Promise<OCRJobResult> {
  try {
    onProgress?.('正在上传...')

    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${OCR_API}/recognize`, {
      method: 'POST',
      body: formData,
    })

    const data = await response.json().catch(() => ({} as any))

    if (!response.ok || !data.success) {
      return {
        success: false,
        photoId: data?.photoId,
        photoUrl: data?.photoUrl,
        pages: [],
        rawText: '',
        error: data?.error || `请求失败: ${response.status}`,
      }
    }

    const { photoId, photoUrl } = data
    onProgress?.('已提交，等待识别...', 10)

    // 轮询等待识别结果
    const MAX_POLLS = 90   // 最多等 90 次
    const POLL_INTERVAL = 2000  // 2秒轮询一次

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))

      const progress = Math.min(90, 10 + Math.floor((i / MAX_POLLS) * 80))
      onProgress?.(`识别中...`, progress)

      const statusResp = await fetch(`${OCR_API}/jobs/${encodeURIComponent(photoId)}`)
      if (!statusResp.ok) continue

      const jobStatus: OCRJobStatus & { success: boolean } = await statusResp.json().catch(() => ({} as any))
      if (!jobStatus.success) continue

      if (jobStatus.ocrStatus === 'done') {
        onProgress?.('识别完成', 100)
        return {
          success: true,
          photoId,
          photoUrl,
          pages: jobStatus.pages || [],
          tables: jobStatus.tables || [],
          rawText: jobStatus.rawText || '',
        }
      }

      if (jobStatus.ocrStatus === 'failed') {
        return {
          success: false,
          photoId,
          photoUrl,
          pages: [],
          rawText: '',
          error: jobStatus.error || '识别失败',
        }
      }
    }

    return {
      success: false,
      photoId,
      photoUrl,
      pages: [],
      rawText: '',
      error: '识别超时，请稍后在归档列表中查看',
    }
  } catch (err) {
    return {
      success: false,
      pages: [],
      rawText: '',
      error: err instanceof Error ? err.message : '网络错误',
    }
  }
}

/**
 * 查询归档照片列表
 */
export async function listPhotos(params?: {
  sampleName?: string
  entrustNo?: string
  includeInReport?: boolean
  status?: string
}): Promise<ArchivedPhoto[]> {
  const search = new URLSearchParams()
  if (params?.sampleName) search.set('sampleName', params.sampleName)
  if (params?.entrustNo) search.set('entrustNo', params.entrustNo)
  if (params?.includeInReport) search.set('includeInReport', 'true')
  if (params?.status) search.set('status', params.status)

  const qs = search.toString()
  const response = await fetch(`${OCR_API}/photos${qs ? `?${qs}` : ''}`)
  const data = await response.json().catch(() => ({} as any))
  if (!response.ok || !data.success) {
    throw new Error(data?.error || '查询归档照片失败')
  }
  return data.items as ArchivedPhoto[]
}

/**
 * 查询单个归档照片
 */
export async function getPhoto(id: string): Promise<ArchivedPhoto> {
  const response = await fetch(`${OCR_API}/photos/${encodeURIComponent(id)}`)
  const data = await response.json().catch(() => ({} as any))
  if (!response.ok || !data.success) {
    throw new Error(data?.error || '查询照片失败')
  }
  return data.item as ArchivedPhoto
}

/**
 * 更新归档照片元数据
 */
export async function updatePhotoMeta(
  id: string,
  patch: Partial<Pick<ArchivedPhoto,
    'testItem' | 'subItem' | 'recognizedValue' | 'standardRequirement' |
    'judgment' | 'status' | 'includeInReport' | 'sampleName' | 'entrustNo' |
    'matchedRuleId' | 'matchedRuleName'
  >>,
): Promise<ArchivedPhoto> {
  const response = await fetch(`${OCR_API}/photos/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const data = await response.json().catch(() => ({} as any))
  if (!response.ok || !data.success) {
    throw new Error(data?.error || '更新照片失败')
  }
  return data.item as ArchivedPhoto
}

/**
 * 删除归档（磁盘 + 元数据）
 */
export async function deletePhoto(id: string): Promise<void> {
  const response = await fetch(`${OCR_API}/photos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  const data = await response.json().catch(() => ({} as any))
  if (!response.ok || !data.success) {
    throw new Error(data?.error || '删除失败')
  }
}

/**
 * 批量删除归档：后端尚未提供专属接口时，前端并发调用单条删除
 */
export async function deletePhotosBatch(ids: string[]): Promise<{ success: number; failed: string[] }> {
  const results = await Promise.allSettled(ids.map(id => deletePhoto(id)))
  const success = results.filter(r => r.status === 'fulfilled').length
  const failed = ids.filter((_, i) => results[i].status === 'rejected')
  return { success, failed }
}

/**
 * 判定检测结果是否合格
 */
export function judgeResult(
  value: string,
  requirement: string,
): '合格' | '不合格' | '待判定' {
  if (!value || !requirement) return '待判定'

  const numValue = parseFloat(value)
  if (isNaN(numValue)) {
    if (requirement.includes('无裂纹') && value.includes('无裂纹')) return '合格'
    if (requirement.includes('无裂纹') && value.includes('有裂纹')) return '不合格'
    if (requirement.includes('不裂') && value.includes('不裂')) return '合格'
    return '待判定'
  }

  const geMatch = requirement.match(/[≥>]=?\s*(\d+\.?\d*)/)
  const leMatch = requirement.match(/[≤<]=?\s*(\d+\.?\d*)/)
  const rangeMatch = requirement.match(/(\d+\.?\d*)\s*[-~]\s*(\d+\.?\d*)/)

  if (geMatch) {
    const threshold = parseFloat(geMatch[1])
    return numValue >= threshold ? '合格' : '不合格'
  }

  if (leMatch) {
    const threshold = parseFloat(leMatch[1])
    return numValue <= threshold ? '合格' : '不合格'
  }

  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1])
    const max = parseFloat(rangeMatch[2])
    return numValue >= min && numValue <= max ? '合格' : '不合格'
  }

  return '待判定'
}