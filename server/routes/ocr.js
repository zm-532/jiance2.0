import { Router } from 'express'
import multer from 'multer'
import { promises as fs } from 'fs'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const router = Router()

const PADDLEOCR_JOB_URL = 'https://paddleocr.aistudio-app.com/api/v2/ocr/jobs'

function getToken() { return process.env.PADDLEOCR_TOKEN }
function getModel() { return process.env.PADDLEOCR_MODEL || 'PaddleOCR-VL-1.6' }

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'uploads')
const META_FILE = path.join(UPLOAD_DIR, 'photos.json')

// 同步初始化：避免 ESM 顶层 await 兼容问题，并减少启动延迟
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })
if (!existsSync(META_FILE)) {
  try {
    writeFileSync(META_FILE, '[]', 'utf-8')
  } catch (err) {
    console.warn('[OCR] 初始化 photos.json 失败:', err.message)
  }
}

async function readMeta() {
  try {
    const text = await fs.readFile(META_FILE, 'utf-8')
    return JSON.parse(text || '[]')
  } catch {
    return []
  }
}

async function writeMeta(list) {
  // 先写临时文件再原子 rename，避免写到一半被其他进程读到残缺数据
  const tmpFile = META_FILE + '.tmp'
  await fs.writeFile(tmpFile, JSON.stringify(list, null, 2), 'utf-8')
  await fs.rename(tmpFile, META_FILE)
}

// ---------- 简易 Promise 互斥锁：序列化所有 readMeta→修改→writeMeta 操作 ----------
let _metaLock = Promise.resolve()

/**
 * 在锁保护下执行 meta 读写操作，保证并发安全。
 * @param {function} fn  async (currentList) => newList | void
 *   返回新数组时自动写回；返回 void 表示只读。
 */
function withMetaLock(fn) {
  const next = _metaLock.then(async () => {
    const list = await readMeta()
    const result = await fn(list)
    if (result !== undefined && result !== list) {
      await writeMeta(result)
    }
    return result
  })
  // 不管成败都继续链，防止后续调用被卡死
  _metaLock = next.catch(() => {})
  return next
}

function safeExt(originalName) {
  const ext = path.extname(originalName || '').toLowerCase()
  const allowed = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif'])
  return allowed.has(ext) ? ext : '.jpg'
}

// 改为磁盘存储：文件落到 uploads/，元数据写到 photos.json
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const id = randomUUID()
    const ext = safeExt(file.originalname)
    cb(null, `${id}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('仅支持图片文件'))
    }
    cb(null, true)
  },
})

/**
 * POST /api/ocr/recognize
 * 接收前端上传的照片：
 *   1) 落盘到 uploads/<uuid>.<ext>
 *   2) 元数据写入 photos.json（status: '识别中'）
 *   3) 提交 PaddleOCR 任务，立即返回 photoId + ocrJobId
 *   4) 后台继续轮询，完成后更新元数据
 */
router.post('/recognize', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '未上传文件' })
  }

  const photoId = path.basename(req.file.filename, path.extname(req.file.filename))
  const photoUrl = `/uploads/${req.file.filename}`
  const uploadedAt = new Date().toISOString()

  const record = {
    id: photoId,
    originalName: req.file.originalname,
    filename: req.file.filename,
    photoUrl,
    size: req.file.size,
    mimetype: req.file.mimetype,
    uploadedAt,
    ocrStatus: 'pending',
    ocrRawText: '',
    pages: [],
    matchedRuleId: null,
    testItem: '',
    subItem: '',
    recognizedValue: '',
    standardRequirement: '',
    judgment: '待判定',
    status: '识别中',
    includeInReport: false,
    error: null,
    sampleName: '',
    entrustNo: '',
    ocrJobId: null,
  }

  // 先把元数据落库（即使 OCR 失败也保留照片归档）
  await withMetaLock(async (meta) => {
    meta.unshift(record)
    return meta
  })

  try {
    const fileBytes = await fs.readFile(req.file.path)

    const formData = new FormData()
    const blob = new Blob([fileBytes], { type: req.file.mimetype })
    formData.append('file', blob, req.file.originalname)
    formData.append('model', getModel())
    formData.append('optionalPayload', JSON.stringify({
      useDocOrientationClassify: false,
      useDocUnwarping: false,
      useChartRecognition: false,
    }))

    const jobResponse = await fetch(PADDLEOCR_JOB_URL, {
      method: 'POST',
      headers: { 'Authorization': `bearer ${getToken()}` },
      body: formData,
    })

    if (!jobResponse.ok) {
      const text = await jobResponse.text()
      await markFailed(photoId, `PaddleOCR 任务提交失败: ${jobResponse.status}`)
      return res.status(502).json({ success: false, photoId, photoUrl, error: `PaddleOCR 任务提交失败: ${jobResponse.status} ${text}` })
    }

    const jobData = await jobResponse.json()
    const ocrJobId = jobData.data?.jobId

    if (!ocrJobId) {
      await markFailed(photoId, '未获取到 jobId')
      return res.status(502).json({ success: false, photoId, photoUrl, error: '未获取到 jobId' })
    }

    console.log(`[OCR] 任务已提交: ${ocrJobId}, 文件: ${req.file.originalname} → ${req.file.filename}`)

    // 保存 jobId 到元数据
    await withMetaLock(async (list) => {
      const idx = list.findIndex(p => p.id === photoId)
      if (idx >= 0) { list[idx].ocrJobId = ocrJobId; return list }
    })

    // 后台异步轮询，不阻塞当前请求
    pollOCRResult(photoId, ocrJobId, req.file.originalname)

    // 立即返回，前端通过 GET /api/ocr/jobs/:photoId 轮询结果
    return res.json({ success: true, photoId, photoUrl, ocrJobId })
  } catch (err) {
    console.error('[OCR] 服务错误:', err)
    await markFailed(photoId, err.message || '服务内部错误')
    return res.status(500).json({ success: false, photoId, photoUrl, error: err.message || '服务内部错误' })
  }
})

/**
 * GET /api/ocr/jobs/:photoId
 * 前端轮询接口：返回当前照片的 OCR 状态与结果
 */
router.get('/jobs/:photoId', async (req, res) => {
  try {
    const list = await readMeta()
    const item = list.find(p => p.id === req.params.photoId)
    if (!item) return res.status(404).json({ success: false, error: '任务不存在' })

    return res.json({
      success: true,
      photoId: item.id,
      photoUrl: item.photoUrl,
      ocrStatus: item.ocrStatus,
      status: item.status,
      pages: item.pages || [],
      rawText: item.ocrRawText || '',
      tables: item.tables || [],
      error: item.error,
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * 后台轮询 PaddleOCR 任务结果（不阻塞 HTTP 请求）
 */
async function pollOCRResult(photoId, ocrJobId, originalName) {
  const MAX_POLLS = 60
  const POLL_INTERVAL = 3000

  try {
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))

      const pollResponse = await fetch(`${PADDLEOCR_JOB_URL}/${ocrJobId}`, {
        headers: { 'Authorization': `bearer ${getToken()}` },
      })

      if (!pollResponse.ok) continue

      const pollData = await pollResponse.json()
      const state = pollData.data?.state

      if (state === 'done') {
        const jsonUrl = pollData.data?.resultUrl?.jsonUrl
        if (!jsonUrl) {
          await markFailed(photoId, '未获取到结果 URL')
          return
        }

        const resultResponse = await fetch(jsonUrl)
        if (!resultResponse.ok) {
          await markFailed(photoId, '获取识别结果失败')
          return
        }

        const resultText = await resultResponse.text()
        const parsed = parseOCRResult(resultText)

        await markDone(photoId, parsed)
        console.log(`[OCR] 识别完成: ${originalName}, 文本长度: ${parsed.rawText.length}, 表格数: ${(parsed.tables || []).length}`)
        return
      }

      if (state === 'failed') {
        const errorMsg = pollData.data?.errorMsg || '识别失败'
        await markFailed(photoId, errorMsg)
        return
      }
    }

    await markFailed(photoId, '识别超时')
  } catch (err) {
    console.error(`[OCR] 后台轮询异常 (${photoId}):`, err)
    await markFailed(photoId, err.message || '后台轮询异常')
  }
}

async function markFailed(photoId, errorMsg) {
  await withMetaLock(async (list) => {
    const idx = list.findIndex(p => p.id === photoId)
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        ocrStatus: 'failed',
        status: '识别失败',
        error: errorMsg,
      }
      return list
    }
  })
}

async function markDone(photoId, parsed) {
  await withMetaLock(async (list) => {
    const idx = list.findIndex(p => p.id === photoId)
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        ocrStatus: 'done',
        status: '待确认',
        pages: parsed.pages,
        ocrRawText: parsed.rawText,
        tables: parsed.tables || [],
        error: null,
      }
      return list
    }
  })
}

function parseOCRResult(jsonlText) {
  const lines = jsonlText.trim().split('\n').filter(Boolean)
  const pages = []
  let rawText = ''
  // 合并所有页 markdown 之后再解析表格，避免 PaddleOCR 把一个 <tr> 拆到多段
  let combinedMarkdown = ''

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line)
      const results = parsed.result?.layoutParsingResults || []
      for (const res of results) {
        const pageText = res.markdown?.text || ''
        rawText += pageText + '\n'
        combinedMarkdown += pageText + '\n'
        pages.push({
          pageNumber: pages.length + 1,
          text: pageText,
          images: res.markdown?.images || {},
        })
      }
    } catch {
      // skip malformed lines
    }
  }

  // 解析 markdown 里的 HTML 表格，产出结构化表格数据
  const tables = parseHtmlTables(combinedMarkdown)

  return {
    pages,
    rawText: rawText.trim(),
    tables, // [{ rows: [[cell, cell, ...], ...], headers?: [string] }]
  }
}

/**
 * 从 markdown 文本中解析 <table>...</table>。
 * 兼容 PaddleOCR 偶发的截断/拼接异常：
 *   - 同一行可能被切到两段 markdown 字符串里（>200.00</td> 这种残尾）
 *   - 单元格里有 <br> / &nbsp; / 前后空白
 * 返回：[{ rows: [[cell, cell, ...], ...] }]
 */
function parseHtmlTables(markdown) {
  const tables = []
  if (!markdown || typeof markdown !== 'string') return tables

  // 先把跨段被切断的 <td> 残尾粘回去：把 ">\d+(\.\d+)?</td>" 形式
  // 重新规范为 "<td>数字</td>"，避免解析器把同一格当成两段
  const normalized = markdown
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/>\s*(\d+(?:\.\d+)?)\s*<\/td>/g, '<td>$1</td>')
    .replace(/>\s*<\/td>/g, '></td>')

  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi
  let match
  while ((match = tableRegex.exec(normalized)) !== null) {
    const tableHtml = match[1]
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    const rows = []
    let rowMatch
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1]
      // 收集 <td> 和 <th>，保留 colspan
      const cellRegex = /<(td|th)\b[^>]*colspan\s*=\s*["']?(\d+)[^>]*>([\s\S]*?)<\/\1>|<(td|th)\b[^>]*>([\s\S]*?)<\/\4>/gi
      const cells = []
      let cellMatch
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        const span = cellMatch[2] ? parseInt(cellMatch[2], 10) : 1
        const raw = (cellMatch[3] ?? cellMatch[5] ?? '').toString()
        const text = stripHtml(raw).trim()
        for (let i = 0; i < span; i++) cells.push(text)
      }
      if (cells.length > 0) rows.push(cells)
    }
    if (rows.length > 0) tables.push({ rows })
  }
  return tables
}

function stripHtml(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/**
 * GET /api/ocr/photos
 * 查询归档照片列表。可选 query：
 *   sampleName, entrustNo, includeInReport (true/false), status
 */
router.get('/photos', async (req, res) => {
  try {
    const list = await readMeta()
    const { sampleName, entrustNo, includeInReport, status } = req.query

    let filtered = list
    if (sampleName) filtered = filtered.filter(p => p.sampleName === sampleName)
    if (entrustNo) filtered = filtered.filter(p => p.entrustNo === entrustNo)
    if (includeInReport === 'true') filtered = filtered.filter(p => p.includeInReport)
    if (status) filtered = filtered.filter(p => p.status === status)

    res.json({ success: true, total: filtered.length, items: filtered })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/ocr/photos/:id
 */
router.get('/photos/:id', async (req, res) => {
  const list = await readMeta()
  const item = list.find(p => p.id === req.params.id)
  if (!item) return res.status(404).json({ success: false, error: '照片不存在' })
  res.json({ success: true, item })
})

/**
 * PATCH /api/ocr/photos/:id
 * 更新元数据：testItem / subItem / recognizedValue / judgment / status /
 *   includeInReport / sampleName / entrustNo / matchedRuleId
 */
router.patch('/photos/:id', async (req, res) => {
  try {
    const result = await withMetaLock(async (list) => {
      const idx = list.findIndex(p => p.id === req.params.id)
      if (idx < 0) return null

      const editable = [
        'testItem', 'subItem', 'recognizedValue', 'standardRequirement',
        'judgment', 'status', 'includeInReport', 'sampleName', 'entrustNo',
        'matchedRuleId', 'matchedRuleName',
      ]
      const patch = {}
      for (const k of editable) {
        if (k in req.body) patch[k] = req.body[k]
      }
      patch.updatedAt = new Date().toISOString()
      list[idx] = { ...list[idx], ...patch }
      return list
    })

    if (result === null) {
      return res.status(404).json({ success: false, error: '照片不存在' })
    }
    const item = result.find(p => p.id === req.params.id)
    res.json({ success: true, item })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * DELETE /api/ocr/photos/:id
 * 删除归档（磁盘 + 元数据）
 */
router.delete('/photos/:id', async (req, res) => {
  try {
    let filePath = null
    const result = await withMetaLock(async (list) => {
      const idx = list.findIndex(p => p.id === req.params.id)
      if (idx < 0) return null
      const item = list[idx]
      filePath = path.join(UPLOAD_DIR, item.filename)
      list.splice(idx, 1)
      return list
    })

    if (result === null) {
      return res.status(404).json({ success: false, error: '照片不存在' })
    }

    if (filePath) {
      try {
        await fs.unlink(filePath)
      } catch (err) {
        console.warn(`[OCR] 删除文件失败: ${filePath}`, err.message)
      }
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /uploads/:filename  - 由 server/index.js 在路由层挂载，此处不重复挂载
 * 但保留一个下载端点以便前端触发下载（设置 Content-Disposition）
 */
router.get('/photos/:id/download', async (req, res) => {
  const list = await readMeta()
  const item = list.find(p => p.id === req.params.id)
  if (!item) return res.status(404).json({ success: false, error: '照片不存在' })

  const filePath = path.join(UPLOAD_DIR, item.filename)
  res.download(filePath, item.originalName)
})

export default router