# 声学检测系统 2.0

## 本机开发启动

### 后端
```powershell
cd D:\中驰股份\声学检测\检测2.0\backend
$env:PYTHONPATH = "D:\中驰股份\声学检测\检测2.0\backend"
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 前端
```powershell
cd D:\中驰股份\声学检测\检测2.0\frontend
npm run dev
```

---

## 虚拟机部署（Windows Server 2025 / PowerShell）

> 前提：已安装 Docker、Node.js、uv

### 第一步：拉取代码

```powershell
# 克隆仓库（首次）
git clone <仓库地址> C:\zc\jiance2.0
Set-Location C:\zc\jiance2.0
```

### 第二步：创建 .env 文件

`.env` 不在仓库中，需手动创建。注意虚拟机上必须用 `127.0.0.1` 而不是 `localhost`（Windows Server IPv6 优先会导致连接失败）。

```powershell
@"
PADDLEOCR_TOKEN=5ff535161c9a3d634cd522ceeb29869af167c481
PADDLEOCR_MODEL=PaddleOCR-VL-1.6
DATABASE_URL=mysql+asyncmy://inspection:inspection123@127.0.0.1:3307/inspection_db
"@ | Set-Content C:\zc\jiance2.0\backend\.env -Encoding UTF8
```

### 第三步：启动 MySQL 容器

```powershell
docker run -d --name inspection-mysql `
  -e MYSQL_ROOT_PASSWORD=rootpass `
  -e MYSQL_DATABASE=inspection_db `
  -e MYSQL_USER=inspection `
  -e MYSQL_PASSWORD=inspection123 `
  -p 3307:3306 `
  --restart unless-stopped `
  mysql:8.0 `
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci

# 等待 MySQL 完全启动（约 30~60 秒）
Start-Sleep -Seconds 60

# 确认容器正常运行
docker ps | Select-String "inspection-mysql"
```

### 第四步：安装后端依赖并执行数据库迁移

```powershell
Set-Location C:\zc\jiance2.0\backend
$env:PYTHONPATH = "C:\zc\jiance2.0\backend"

# 安装依赖
uv sync

# 执行数据库建表迁移
uv run alembic upgrade head
```

### 第五步：启动后端（新开一个 PowerShell 窗口）

```powershell
Set-Location C:\zc\jiance2.0\backend
$env:PYTHONPATH = "C:\zc\jiance2.0\backend"
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 第六步：安装前端依赖并启动（新开一个 PowerShell 窗口）

```powershell
Set-Location C:\zc\jiance2.0\frontend
npm install
npm run dev
```

### 访问地址

| 服务     | 地址                          |
|----------|-------------------------------|
| 前端     | http://虚拟机IP:5173          |
| 后端 API | http://虚拟机IP:8000          |
| API 文档 | http://虚拟机IP:8000/docs     |

---

## 本机更新代码后，虚拟机如何同步更新

### 拉取最新代码

```powershell
Set-Location C:\zc\jiance2.0
git pull
```

### 判断需要更新哪些部分

#### 情况一：只改了前端代码（src/ 下的文件）
前端使用 `npm run dev` 开发模式运行时**自动热更新，无需任何操作**。

#### 情况二：改了后端代码（app/ 下的 .py 文件）
需要重启后端进程（Ctrl+C 停止后重新运行）：
```powershell
# 在运行后端的 PowerShell 窗口按 Ctrl+C 停止，然后重新启动
Set-Location C:\zc\jiance2.0\backend
$env:PYTHONPATH = "C:\zc\jiance2.0\backend"
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### 情况三：新增了 Python 依赖（pyproject.toml 有变化）
```powershell
Set-Location C:\zc\jiance2.0\backend
uv sync
# 然后重启后端（同情况二）
```

#### 情况四：新增了数据库迁移文件（alembic/versions/ 下有新文件）
```powershell
Set-Location C:\zc\jiance2.0\backend
$env:PYTHONPATH = "C:\zc\jiance2.0\backend"
uv run alembic upgrade head
# 然后重启后端（同情况二）
```

#### 情况五：改了前端依赖（package.json 有变化）
```powershell
Set-Location C:\zc\jiance2.0\frontend
npm install
# 前端 dev 模式会自动重启，无需手动重启
```

### Docker / MySQL 什么时候需要重新操作？

| 场景                             | 是否需要操作 Docker         |
|----------------------------------|-----------------------------|
| 只改了业务代码（前/后端）        | ❌ 不需要                   |
| 改了数据库表结构（新增迁移文件） | ❌ 只需跑 `alembic upgrade head`，不需要重建容器 |
| MySQL 容器被手动删除了           | ✅ 重新执行第三步创建容器    |
| docker-compose.yml 配置有变化   | ✅ 需重建容器                |
| **数据库数据不会因为代码更新丢失**，数据持久化在 Docker volume 中 | — |