import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export function serveStatic(app) {
  const distPath = join(__dirname, '..', 'dist')

  app.use(express.static(distPath))

  // SPA fallback: 所有非 /api 路由返回 index.html
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(join(distPath, 'index.html'))
  })
}
