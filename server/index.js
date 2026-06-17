import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync } from 'fs'
import ocrRouter from './routes/ocr.js'
import { serveStatic } from './serve-static.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads')

// 启动时确保归档目录存在
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true })
  console.log(`[Server] 已创建归档目录: ${UPLOAD_DIR}`)
}

const app = express()
const PORT = process.env.PORT || 3001

// ---------- CORS：仅允许前端开发域名/同源 ----------
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim())
app.use(cors({
  origin: (origin, cb) => {
    // 无 origin 表示同源请求（curl/服务端）
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error('CORS 不允许该来源'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}))

// ---------- 可选 API Key 鉴权：设置 API_KEY 环境变量后启用 ----------
const API_KEY = process.env.API_KEY || ''
if (API_KEY) {
  app.use('/api', (req, res, next) => {
    // 健康检查接口免鉴权
    if (req.path === '/health') return next()
    const key = req.headers['x-api-key'] || req.query.apiKey
    if (key !== API_KEY) {
      return res.status(401).json({ success: false, error: 'API Key 无效或缺失' })
    }
    next()
  })
  console.log('[Server] API Key 鉴权已启用')
}

app.use(express.json())

// OCR 路由
app.use('/api/ocr', ocrRouter)

// 归档照片静态访问：/uploads/<filename>
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '7d',
  etag: true,
}))

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ---------- 全局错误处理中间件 ----------
app.use((err, req, res, _next) => {
  console.error('[Server] 未捕获错误:', err)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: '文件超过大小限制（20MB）' })
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || '服务器内部错误',
  })
})

// 生产模式：同时 serve 前端静态文件
if (process.env.NODE_ENV === 'production') {
  serveStatic(app)
}

const server = app.listen(PORT, () => {
  console.log(`[Server] 后端服务已启动: http://localhost:${PORT}`)
  console.log(`[Server] OCR API: http://localhost:${PORT}/api/ocr`)
  console.log(`[Server] CORS 允许来源: ${ALLOWED_ORIGINS.join(', ')}`)
  console.log(`[Server] 归档目录: ${UPLOAD_DIR}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Server] 端口 ${PORT} 已被占用，请先关闭占用该端口的进程，或修改 .env 中的 PORT`)
  } else {
    console.error('[Server] 启动失败:', err.message)
  }
  process.exit(1)
})