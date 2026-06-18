# 后端
cd D:\中驰股份\声学检测\检测2.0\backend
set PYTHONPATH=D:\中驰股份\声学检测\检测2.0\backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

# 前端
cd D:\中驰股份\声学检测\检测2.0\frontend
npm run dev