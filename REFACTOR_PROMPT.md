# 检测系统改造任务（仅在原项目内重构，不融合到平台）

## 第一步：读取项目规则

在开始任何操作前，请先读取 `D:\中驰股份\barrier-platform\AGENTS.md`，了解目标平台的架构规范。本次改造的目标是对齐这些规范，但**文件仍在原项目夹内操作**。

## 项目背景

检测系统（soundbarrier_platform_v1）需要从 Node.js 技术栈改造为 Python FastAPI 技术栈，并将前端 UI 从 Ant Design 迁移到 shadcn/ui，为后续融合到 barrier-platform 做准备。

- **项目位置**：`D:\中驰股份\声学检测\soundbarrier_platform_v1 - mimo`
- **注意**：本次只在原项目夹内改造，不移动文件到 barrier-platform

## 现有项目分析

### 后端（Node.js → 需重写为 Python FastAPI）
- 位置：`server/`
- 技术：Express.js
- 功能：OCR 图片识别（调用 PaddleOCR API）
- 核心文件：
  - `server/index.js` - Express 服务入口
  - `server/routes/ocr.js` - OCR 识别接口

### 前端（Ant Design → 需重写为 shadcn/ui）
- 位置：`src/`
- 技术：React 18 + TypeScript + Ant Design + ECharts
- 页面：
  - `src/pages/Dashboard/` - 仪表盘
  - `src/pages/DataJudgment/` - 数据判定
  - `src/pages/DeviceManage/` - 设备管理
  - `src/pages/ExperimentDB/` - 实验数据库

### 环境变量
- `PADDLEOCR_TOKEN` - PaddleOCR API 令牌
- `PADDLEOCR_MODEL` - OCR 模型（默认 PaddleOCR-VL-1.6）
- `PORT` - 后端端口（默认 3001）

## 改造要求

### 1. 后端改造：Node.js → Python FastAPI

在项目根目录创建 `backend/` 文件夹（注意：这是原项目内的 backend，不是 barrier-platform 的）：

```
backend/
├── Dockerfile
├── alembic.ini
├── alembic/
│   ├── env.py
│   └── versions/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 入口
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       └── inspection.py  # OCR 接口
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py        # 配置管理
│   ├── db/
│   │   ├── __init__.py
│   │   └── base.py          # 数据库连接
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── inspection.py    # 数据模型
│   └── services/
│       ├── __init__.py
│       └── ocr.py           # OCR 服务逻辑
├── docs/                    # 放 Excel 等数据文件
├── pyproject.toml
└── .env
```

#### 后端改造要点

**main.py** - FastAPI 入口：
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import api_router
from app.core.config import settings

app = FastAPI(title="检测系统 API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(api_router, prefix="/api/v1")
```

**inspection.py** - OCR 接口（参考原 `server/routes/ocr.js`）：
```python
from fastapi import APIRouter, UploadFile, File
import httpx

router = APIRouter(tags=["inspection"])

@router.post("/ocr/recognize")
async def ocr_recognize(file: UploadFile = File(...)):
    # 用 httpx 调用 PaddleOCR API
    # 逻辑参考原 ocr.js
    pass
```

**config.py** - 配置管理：
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    paddleocr_token: str = ""
    paddleocr_model: str = "PaddleOCR-VL-1.6"
    database_url: str = "mysql+asyncmy://user:pass@localhost/db"
    
    class Config:
        env_file = ".env"
```

**pyproject.toml**：
```toml
[project]
name = "inspection-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi[standard]==0.115.0",
    "uvicorn[standard]==0.32.0",
    "httpx==0.27.2",
    "python-multipart==0.0.12",
    "pydantic-settings==2.6.0",
    "sqlalchemy[asyncio]==2.0.36",
    "asyncmy==0.2.10",
    "alembic==1.13.3",
]
```

### 2. 前端改造：Ant Design → shadcn/ui

在项目根目录创建 `frontend/` 文件夹：

```
frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── components/
    │   └── ui/           # shadcn/ui 组件
    └── pages/
        ├── Dashboard.tsx
        ├── DataJudgment.tsx
        ├── DeviceManage.tsx
        └── ExperimentDB.tsx
```

#### 前端改造要点

**package.json**（参考 barrier-platform 的 frontend/package.json）：
```json
{
  "dependencies": {
    "react": "^19.2.1",
    "react-dom": "^19.2.1",
    "react-router-dom": "^6.28.0",
    "axios": "^1.12.0",
    "echarts": "^5.5.1",
    "echarts-for-react": "^3.0.2",
    "lucide-react": "^0.453.0",
    "tailwind-merge": "^3.3.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "tailwindcss": "^4.1.14",
    "@tailwindcss/vite": "^4.1.3",
    "typescript": "~5.6.3",
    "vite": "^7.1.7"
  }
}
```

**组件替换对照**：
| Ant Design | shadcn/ui |
|------------|-----------|
| `<Card>` | `<Card>` from `@/components/ui/card` |
| `<Table>` | `<Table>` from `@/components/ui/table` |
| `<Button>` | `<Button>` from `@/components/ui/button` |
| `<Form>` + `<Input>` | `<Input>` from `@/components/ui/input` |
| `<Select>` | `<Select>` from `@/components/ui/select` |
| `<Modal>` | `<Dialog>` from `@/components/ui/dialog` |
| `<Tabs>` | `<Tabs>` from `@/components/ui/tabs` |
| `<Badge>` | `<Badge>` from `@/components/ui/badge` |
| `<Progress>` | `<Progress>` from `@/components/ui/progress` |
| `<message>` | `toast` from `sonner` |

**vite.config.ts**：
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true }
    }
  }
})
```

### 3. 数据库设计（可选，根据实际需求）

如果需要持久化数据，设计以下表：

```sql
-- 设备表
CREATE TABLE devices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    model VARCHAR(100),
    status VARCHAR(20),
    calibration_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 测试记录表
CREATE TABLE test_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    device_id INT,
    test_type VARCHAR(50),
    result JSON,
    ocr_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 改造顺序

### 阶段一：后端改造
1. 创建 `backend/` 文件夹结构
2. 编写 `pyproject.toml` 和依赖
3. 实现 `config.py` 配置管理
4. 实现 `main.py` FastAPI 入口
5. 实现 `inspection.py` OCR 接口
6. 实现 `services/ocr.py` 业务逻辑
7. 测试后端启动：`cd backend && uvicorn app.main:app --reload`

### 阶段二：前端改造
1. 创建 `frontend/` 文件夹结构
2. 配置 `package.json` 和依赖
3. 配置 `vite.config.ts` 和 TailwindCSS
4. 安装 shadcn/ui 组件
5. 迁移页面（替换 Ant Design 组件）
6. 测试前端启动：`cd frontend && npm run dev`

### 阶段三：联调测试
1. 后端启动在 8000 端口
2. 前端代理到后端
3. 测试 OCR 识别功能
4. 测试各页面功能

## 重要提醒

1. **本次只在原项目夹内改造**，不移动文件到 barrier-platform
2. 后端代码放在 `D:\中驰股份\声学检测\soundbarrier_platform_v1 - mimo\backend\`
3. 前端代码放在 `D:\中驰股份\声学检测\soundbarrier_platform_v1 - mimo\frontend\`
4. 保留原有的 `server/` 和 `src/` 作为备份参考
5. 改造完成后，后续再用 xcopy 或手动方式融合到 barrier-platform

## 验证

改造完成后请验证：
1. 后端可以独立启动：`cd backend && uvicorn app.main:app --reload`
2. 前端可以独立启动：`cd frontend && npm run dev`
3. OCR 识别功能正常
4. 各页面可以正常访问
5. 前后端可以联调
