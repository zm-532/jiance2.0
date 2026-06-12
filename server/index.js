import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import ocrRouter from './routes/ocr.js'
import { serveStatic } from './serve-static.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// OCR 路由
app.use('/api/ocr', ocrRouter)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 生产模式：同时 serve 前端静态文件
if (process.env.NODE_ENV === 'production') {
  serveStatic(app)
}

const server = app.listen(PORT, () => {
  console.log(`[Server] 后端服务已启动: http://localhost:${PORT}`)
  console.log(`[Server] OCR API: http://localhost:${PORT}/api/ocr`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Server] 端口 ${PORT} 已被占用，请先关闭占用该端口的进程，或修改 .env 中的 PORT`)
  } else {
    console.error('[Server] 启动失败:', err.message)
  }
  process.exit(1)
})
