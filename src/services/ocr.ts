// OCR 服务 - 调用本地 Express 后端
// 后端负责转发请求到 PaddleOCR API，Token 存在后端 .env 中

const OCR_API = '/api/ocr'

export interface OCRResultPage {
  pageNumber: number
  text: string
  images: Record<string, string>
}

export interface OCRJobResult {
  success: boolean
  pages: OCRResultPage[]
  error?: string
  rawText: string
}

/**
 * 上传照片到后端进行 OCR 识别
 * 后端会调用 PaddleOCR API 并返回结构化结果
 */
export async function recognizeImage(
  file: File,
  onProgress?: (status: string, progress?: number) => void,
): Promise<OCRJobResult> {
  try {
    onProgress?.('正在上传并识别...')

    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${OCR_API}/recognize`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const text = await response.text()
      return { success: false, pages: [], rawText: '', error: `请求失败: ${response.status} ${text}` }
    }

    const data = await response.json()

    if (!data.success) {
      return { success: false, pages: [], rawText: '', error: data.error || '识别失败' }
    }

    onProgress?.('识别完成', 100)

    return {
      success: true,
      pages: data.pages || [],
      rawText: data.rawText || '',
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
 * 判定检测结果是否合格
 */
export function judgeResult(
  value: string,
  requirement: string,
): '合格' | '不合格' | '待判定' {
  if (!value || !requirement) return '待判定'

  const numValue = parseFloat(value)
  if (isNaN(numValue)) {
    // 定性判定
    if (requirement.includes('无裂纹') && value.includes('无裂纹')) return '合格'
    if (requirement.includes('无裂纹') && value.includes('有裂纹')) return '不合格'
    if (requirement.includes('不裂') && value.includes('不裂')) return '合格'
    return '待判定'
  }

  // 解析标准要求
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
