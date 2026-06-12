import { Router } from 'express'
import multer from 'multer'
import { promises as fs } from 'fs'
import { existsSync, mkdirSync } from 'fs'
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

// 启动时确保归档目录与元数据文件存在（docker 部署同样生效）
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })
if (!existsSync(META_FILE)) {
  await fs.writeFile(META_FILE, '[]', 'utf-8').catch(() => {})
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
  await fs.writeFile(META_FILE, JSON.stringify(list, null, 2), 'utf-8')
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
 *   2) 元数据写入 photos.json
 *   3) 调用 PaddleOCR 返回识别结果
 */
router.post('/recognize', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '未上传文件' })
  }

  const photoId = path.basename(req.file.filename, path.extname(req.file.filename))
  const photoUrl = `/uploads/${req.file.filename}`
  const uploadedAt = new Date().toISOString()

  // 先把元数据落库（即使 OCR 失败也保留照片归档）
  const meta = await readMeta()
  const record = {
    id: photoId,
    originalName: req.file.originalname,
    filename: req.file.filename,
    photoUrl,
    size: req.file.size,
    mimetype: req.file.mimetype,
    uploadedAt,
    // OCR 字段，识别完成后回填
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
    // 关联字段：可由后续录入或自动按样品名匹配
    sampleName: '',
    entrustNo: '',
  }
  meta.unshift(record)
  await writeMeta(meta)

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
    const jobId = jobData.data?.jobId

    if (!jobId) {
      await markFailed(photoId, '未获取到 jobId')
      return res.status(502).json({ success: false, photoId, photoUrl, error: '未获取到 jobId' })
    }

    console.log(`[OCR] 任务已提交: ${jobId}, 文件: ${req.file.originalname} → ${req.file.filename}`)

    const MAX_POLLS = 60
    const POLL_INTERVAL = 3000

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))

      const pollResponse = await fetch(`${PADDLEOCR_JOB_URL}/${jobId}`, {
        headers: { 'Authorization': `bearer ${getToken()}` },
      })

      if (!pollResponse.ok) continue

      const pollData = await pollResponse.json()
      const state = pollData.data?.state

      if (state === 'done') {
        const jsonUrl = pollData.data?.resultUrl?.jsonUrl
        if (!jsonUrl) {
          await markFailed(photoId, '未获取到结果 URL')
          return res.status(502).json({ success: false, photoId, photoUrl, error: '未获取到结果 URL' })
        }

        const resultResponse = await fetch(jsonUrl)
        if (!resultResponse.ok) {
          await markFailed(photoId, '获取识别结果失败')
          return res.status(502).json({ success: false, photoId, photoUrl, error: '获取识别结果失败' })
        }

        const resultText = await resultResponse.text()
        const parsed = parseOCRResult(resultText)

        await markDone(photoId, parsed)

        console.log(`[OCR] 识别完成: ${req.file.originalname}, 文本长度: ${parsed.rawText.length}`)
        return res.json({
          success: true,
          photoId,
          photoUrl,
          pages: parsed.pages,
          rawText: parsed.rawText,
        })
      }

      if (state === 'failed') {
        const errorMsg = pollData.data?.errorMsg || '识别失败'
        await markFailed(photoId, errorMsg)
        return res.json({ success: false, photoId, photoUrl, error: errorMsg })
      }
    }

    await markFailed(photoId, '识别超时')
    return res.status(504).json({ success: false, photoId, photoUrl, error: '识别超时' })
  } catch (err) {
    console.error('[OCR] 服务错误:', err)
    await markFailed(photoId, err.message || '服务内部错误')
    return res.status(500).json({ success: false, photoId, photoUrl, error: err.message || '服务内部错误' })
  }
})

async function markFailed(photoId, errorMsg) {
  const list = await readMeta()
  const idx = list.findIndex(p => p.id === photoId)
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      ocrStatus: 'failed',
      status: '识别失败',
      error: errorMsg,
    }
    await writeMeta(list)
  }
}

async function markDone(photoId, parsed) {
  const list = await readMeta()
  const idx = list.findIndex(p => p.id === photoId)
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      ocrStatus: 'done',
      status: '待确认',
      pages: parsed.pages,
      ocrRawText: parsed.rawText,
      error: null,
    }
    await writeMeta(list)
  }
}

function parseOCRResult(jsonlText) {
  const lines = jsonlText.trim().split('\n').filter(Boolean)
  const pages = []
  let rawText = ''

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line)
      const results = parsed.result?.layoutParsingResults || []
      for (const res of results) {
        const pageText = res.markdown?.text || ''
        rawText += pageText + '\n'
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

  return { pages, rawText: rawText.trim() }
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
  const list = await readMeta()
  const idx = list.findIndex(p => p.id === req.params.id)
  if (idx < 0) return res.status(404).json({ success: false, error: '照片不存在' })

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
  await writeMeta(list)

  res.json({ success: true, item: list[idx] })
})

/**
 * DELETE /api/ocr/photos/:id
 * 删除归档（磁盘 + 元数据）
 */
router.delete('/photos/:id', async (req, res) => {
  const list = await readMeta()
  const idx = list.findIndex(p => p.id === req.params.id)
  if (idx < 0) return res.status(404).json({ success: false, error: '照片不存在' })

  const item = list[idx]
  const filePath = path.join(UPLOAD_DIR, item.filename)
  try {
    await fs.unlink(filePath)
  } catch (err) {
    console.warn(`[OCR] 删除文件失败: ${filePath}`, err.message)
  }

  list.splice(idx, 1)
  await writeMeta(list)

  res.json({ success: true })
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