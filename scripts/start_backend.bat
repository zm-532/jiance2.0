@echo off
set PYTHONPATH=d:\中驰股份\声学检测\检测2.0\backend;d:\中驰股份\声学检测\检测2.0\backend\.venv\Lib\site-packages
cd /d "d:\中驰股份\声学检测\检测2.0\backend"
"C:\Users\zm\AppData\Roaming\uv\python\cpython-3.12.13-windows-x86_64-none\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
