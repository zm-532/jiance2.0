// 抽取"实验室检测设备统计（1.9）.xlsx" → src/mock/equipmentReference.json
// 注意：本脚本不覆盖 realDevices.json,只追加新文件,不修改现有 mock 数据。
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');
const outDir = path.join(__dirname, '..', 'src', 'mock');
const srcFile = path.join(docsDir, '实验室检测设备统计（1.9）.xlsx');

if (!fs.existsSync(srcFile)) {
  throw new Error('源文件不存在: ' + srcFile);
}

const wb = XLSX.readFile(srcFile);
console.log('Workbook sheets:', wb.SheetNames);

// ---------- 工具函数 ----------
// Excel 序列号(>= 40000) -> ISO 'YYYY-MM-DD'
function excelSerialToISO(serial) {
  if (serial == null || serial === '') return null;
  if (typeof serial === 'string') {
    const t = serial.trim();
    if (!t || t === '/' || t === '-') return null;
    // 形如 '2022.11.24' / '2022-11-24' / '2022/11/24' / '2022年11月24日'
    const m1 = t.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (m1) {
      const [, y, mo, d] = m1;
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return t; // 保留原样
  }
  if (typeof serial === 'number' && serial >= 40000 && serial < 80000) {
    // Excel epoch: 1899-12-30(考虑 1900 闰年 bug)
    const epoch = Date.UTC(1899, 11, 30);
    const ms = serial * 24 * 60 * 60 * 1000;
    const d = new Date(epoch + ms);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  }
  return null;
}

function norm(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === '/' || s === '-' || s === '//') return null;
  return s;
}

function readSheetRows(sheetName, headerRow = 1) {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('Sheet 不存在: ' + sheetName);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', range: headerRow });
}

// ---------- 1. 测量仪器 2025/2024/2023 ----------
// headerRow=1: 跳过 R0 表格标题
const instrumentSheets = [
  { name: '测量仪器2025', year: 2025 },
  { name: '测量仪器2024', year: 2024 },
  { name: '测量仪器2023', year: 2023 },
];

const instruments = [];
for (const { name, year } of instrumentSheets) {
  if (!wb.Sheets[name]) {
    console.warn(`  ! 缺失 sheet: ${name}, 跳过`);
    continue;
  }
  // 2024/2023 表头列数不同,先看表头决定列索引
  const rows = readSheetRows(name, 1);
  const header = rows[0] || [];
  console.log(`  [${name}] header 列数: ${header.length}, 数据行: ${rows.length - 1}`);
  // 推断列索引
  const colIdx = (key) => header.findIndex((h) => String(h).replace(/\s+/g, '').includes(key));
  const c = {
    id: colIdx('仪器编号'),
    name: colIdx('仪器名称'),
    dataStorage: colIdx('检测数据存储方式'),
    manufacturer: colIdx('生产厂家'),
    model: colIdx('仪器型号'),
    serialNo: colIdx('出厂编号'),
    productionDate: colIdx('出厂日期'),
    measurementRange: colIdx('测量范围'),
    status: colIdx('设备状态') >= 0 ? colIdx('设备状态') : colIdx('接收时状态'),
    functionDesc: colIdx('功能'),
    location: colIdx('当前位置'),
    acceptanceDate: colIdx('验收日期'),
    validUntil: colIdx('有效日期'),
    specCategory: header.findIndex((h) => String(h).includes('规格种类')),
    calibrationUnit: colIdx('检定/校准单位'),
    calibrationCertNo: colIdx('检定/校准证书号'),
    calibrationDate: header.findIndex((h) => String(h).includes('检定/校准') && String(h).includes('日期')),
    nextCalibrationDate: header.findIndex((h) => String(h).includes('下次')),
    contact: colIdx('售后联系方式'),
    remark: colIdx('备注'),
    dbType: colIdx('数据库类型'),
  };
  console.log(`    colIdx:`, c);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[c.id]) continue; // 跳过空行 / 无编号行
    const obj = {
      id: norm(r[c.id]),
      name: norm(r[c.name]),
      dataStorage: norm(r[c.dataStorage]) || null,
      manufacturer: norm(r[c.manufacturer]) || null,
      model: norm(r[c.model]) || null,
      serialNo: norm(r[c.serialNo]) || null,
      productionDate: norm(r[c.productionDate]) || null,
      measurementRange: norm(r[c.measurementRange]) || null,
      status: norm(r[c.status]) || null,
      functionDesc: norm(r[c.functionDesc]) || null,
      location: norm(r[c.location]) || null,
      acceptanceDate: norm(r[c.acceptanceDate]) || null,
      validUntil: norm(r[c.validUntil]) || null, // 周期描述, 如"一年"
      specCategory: c.specCategory >= 0 ? norm(r[c.specCategory]) : null,
      calibrationUnit: norm(r[c.calibrationUnit]) || null,
      calibrationCertNo: norm(r[c.calibrationCertNo]) || null,
      calibrationDate: c.calibrationDate >= 0 ? excelSerialToISO(r[c.calibrationDate]) : null,
      nextCalibrationDate: c.nextCalibrationDate >= 0 ? excelSerialToISO(r[c.nextCalibrationDate]) : null,
      contact: c.contact >= 0 ? norm(r[c.contact]) : null,
      remark: c.remark >= 0 ? norm(r[c.remark]) : null,
      dbType: c.dbType >= 0 ? norm(r[c.dbType]) : null,
      sourceYear: year,
      sourceSheet: name,
    };
    instruments.push(obj);
  }
}
console.log(`  测量仪器合计: ${instruments.length}`);

// ---------- 2. 标准物质 2025/2024 ----------
const stdMaterialSheets = ['标准物质2025', '标准物质2024'];
const standardMaterials = [];
for (const sName of stdMaterialSheets) {
  if (!wb.Sheets[sName]) { console.warn(`  ! 缺失 sheet: ${sName}`); continue; }
  const rows = readSheetRows(sName, 0);
  const header = rows[0] || [];
  console.log(`  [${sName}] header:`, header.slice(0, 11));
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[1]) continue; // 编号为空则跳过
    standardMaterials.push({
      no: r[0] || null,
      id: norm(r[1]),
      name: norm(r[2]),
      spec: norm(r[3]) || null,
      serialNo: norm(r[4]) || null,
      measurementRange: norm(r[5]) || null,
      uncertainty: norm(r[6]) || null,
      calibrationUnit: norm(r[7]) || null,
      certNo: norm(r[8]) || null,
      calibrationDate: excelSerialToISO(r[9]),
      nextCalibrationDate: excelSerialToISO(r[10]),
      sourceYear: sName.includes('2025') ? 2025 : 2024,
    });
  }
}
console.log(`  标准物质合计: ${standardMaterials.length}`);

// ---------- 3. 价格 ----------
// 价格 sheet 结构: R0 空行, R1 表头, R2+ 数据
const devicePrices = [];
if (wb.Sheets['价格']) {
  const rows = readSheetRows('价格', 1); // 跳过 R0 空行
  console.log(`  [价格] 表头:`, rows[0] && rows[0].slice(0, 6), `数据行: ${rows.length - 1}`);
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const seq = r[1];
    const name = r[2];
    const qty = r[3];
    const price = r[4];
    if (!name && !price) continue;
    // 跳过表头行(seq === '序号' 字符串)
    if (seq === '序号' || name === '设备名称') continue;
    devicePrices.push({
      seq: typeof seq === 'number' ? seq : (norm(seq) ? Number(seq) || null : null),
      deviceName: norm(name),
      quantity: qty === '' || qty == null ? null : Number(qty) || null,
      unitPrice: price === '' || price == null ? null : Number(price) || null,
      sourceCategory: norm(r[0]) || null, // 已采购设备 / ...
      note: norm(r[7]) || null,
    });
  }
}
console.log(`  价格合计: ${devicePrices.length}`);

// ---------- 4. 校准方案 2025 + 校准方案 2025(2) ----------
const calibrationPlans = [];
const planSheets = ['校准方案2025', '校准方案2025 (2)'];
for (const sName of planSheets) {
  if (!wb.Sheets[sName]) { console.warn(`  ! 缺失 sheet: ${sName}`); continue; }
  const rows = readSheetRows(sName, 3); // 表名 + 编号 + 标题 + 表头
  console.log(`  [${sName}] 数据行: ${rows.length - 1}`);
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[2]) continue; // 设备名称为空
    calibrationPlans.push({
      seq: r[0] || null,
      deviceId: norm(r[1]),
      deviceName: norm(r[2]),
      manufacturer: norm(r[3]),
      model: norm(r[4]),
      serialNo: r[5] != null ? String(r[5]).trim() || null : null,
      itemAndRange: norm(r[6]),
      accuracy: norm(r[7]),
      cycle: norm(r[8]),
      plannedDate: excelSerialToISO(r[9]),
      nextDate: excelSerialToISO(r[10]),
      remark: norm(r[11]),
      planVersion: sName.includes('(2)') ? '执行版' : '计划版',
    });
  }
}
console.log(`  校准方案合计: ${calibrationPlans.length}`);

// ---------- 5. 校准计划 ----------
const calibrationExecutions = [];
if (wb.Sheets['校准计划']) {
  const rows = readSheetRows('校准计划', 0);
  console.log(`  [校准计划] 行数: ${rows.length}`);
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[2]) continue;
    calibrationExecutions.push({
      seq: r[0] || null,
      deviceName: norm(r[1]),
      deviceId: norm(r[2]),
      quantity: r[3] == null || r[3] === '' ? null : Number(r[3]) || null,
      validPeriod: norm(r[4]),
      lastCalibrationDate: excelSerialToISO(r[5]),
      nextCalibrationDate: excelSerialToISO(r[6]),
      remark: norm(r[7]),
    });
  }
}
console.log(`  校准计划合计: ${calibrationExecutions.length}`);

// ---------- 输出 ----------
const output = {
  _meta: {
    sourceFile: '实验室检测设备统计（1.9）.xlsx',
    extractedAt: new Date().toISOString(),
    sheets: wb.SheetNames,
  },
  instruments,
  standardMaterials,
  devicePrices,
  calibrationPlans,
  calibrationExecutions,
};

const outPath = path.join(outDir, 'equipmentReference.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
console.log(`\n✅ 写入: ${outPath}`);
console.log(`   文件大小: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);

// 数据基准日说明
const today = new Date();
let expired = 0, noDate = 0, hasDate = 0;
for (const ins of instruments) {
  if (!ins.nextCalibrationDate) noDate++;
  else {
    hasDate++;
    if (new Date(ins.nextCalibrationDate) < today) expired++;
  }
}
console.log(`\n[数据基准日: ${today.toISOString().slice(0, 10)}]`);
console.log(`  仪器总数: ${instruments.length}`);
console.log(`  有下次校准日期: ${hasDate}`);
console.log(`  其中已过期: ${expired}`);
console.log(`  无日期: ${noDate}`);
