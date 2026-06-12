// 全量数据提取脚本 - 从 Excel 源文件生成 realData.json
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');
const outPath = path.join(__dirname, '..', 'src', 'mock', 'realData.json');

function readSheet(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, range: 0, raw: false });
}

// ========== 1. 台账.xlsx → records ==========
console.log('读取台账.xlsx ...');
const rawRecords = readSheet(path.join(docsDir, '台账.xlsx'));
const recHeaders = rawRecords[0]; // header row
console.log('  表头:', recHeaders.length, '列');
console.log('  数据行:', rawRecords.length - 1);

const records = [];
for (let i = 1; i < rawRecords.length; i++) {
  const r = rawRecords[i];
  if (!r || !r[0]) continue; // skip empty rows
  const photos = r[3] ? String(r[3]).split(',').map(s => s.trim()).filter(Boolean) : [];
  const results = [r[7], r[8], r[9], r[10], r[11]].filter(v => v != null && v !== '').map(String);
  records.push({
    id: 'R' + String(i).padStart(4, '0'),
    sampleName: r[0] || '',
    specModel: r[1] || '',
    manufacturer: r[2] || '',
    photos: photos,
    testItem: r[4] || '',
    judgment: r[5] || '',
    result: r[6] || '',
    results: results,
    entrustNo: r[12] || '',
    entrustUnit: r[13] || '',
    project: r[14] || '',
    equipment: r[15] || '',
    testStandard: r[16] || '',
    receiveDate: r[17] || '',
    testDate: r[18] || '',
    requirement: r[19] || '',
    entrustPerson: r[20] || '',
  });
}
console.log('  提取记录:', records.length);

// ========== 2. 样品检测登记.xlsx → regRecords ==========
console.log('读取样品检测登记.xlsx ...');
const rawReg = readSheet(path.join(docsDir, '样品检测登记.xlsx'));
console.log('  数据行:', rawReg.length - 1);

const regRecords = [];
for (let i = 1; i < rawReg.length; i++) {
  const r = rawReg[i];
  if (!r || !r[0]) continue;
  regRecords.push({
    id: 'REG' + String(i).padStart(4, '0'),
    entrustNo: r[1] || '',
    sampleName: r[2] || '',
    specModel: r[3] || '',
    manufacturer: r[4] || '',
    receiveDate: r[5] || '',
    testType: r[6] || '',
    testItem: r[7] || '',
    testStandard: r[8] || '',
    equipment: r[9] || '',
    entrustUnit: r[10] || '',
    project: r[11] || '',
    testStatus: r[12] || '已完成',
    batchDate: r[13] || '',
    productionDate: r[14] || '',
    entrustPerson: r[15] || '',
    requirement: r[16] || '',
    sampleStatus: r[17] || '',
    submitter: r[18] || '',
    createTime: r[20] || '',
  });
}
console.log('  提取记录:', regRecords.length);

// ========== 3. 委托申请单.xlsx → appRecords ==========
console.log('读取委托申请单.xlsx ...');
const rawApp = readSheet(path.join(docsDir, '委托申请单.xlsx'));
console.log('  数据行:', rawApp.length - 1);

// Group by 委托编号 (col 0), each row is one test item
const appMap = new Map();
for (let i = 2; i < rawApp.length; i++) { // skip 2 header rows
  const r = rawApp[i];
  if (!r || !r[0]) continue;
  const entrustNo = String(r[0]).trim();
  if (!entrustNo) continue;

  if (!appMap.has(entrustNo)) {
    const photos = r[11] ? String(r[11]).split(',').map(s => s.trim()).filter(Boolean) : [];
    appMap.set(entrustNo, {
      entrustNo: entrustNo,
      receiveDate: r[1] || '',
      projectName: r[2] || '',
      sampleName: r[3] || '',
      specModel: r[4] || '',
      manufacturer: r[5] || '',
      productionDate: r[9] || '',
      batchDate: r[10] || '',
      photos: photos,
      description: r[12] || '',
      currentApprovalNode: r[13] || '',
      approvalResult: r[14] || '待审批',
      testItems: [],
    });
  }
  const item = appMap.get(entrustNo);
  item.testItems.push({
    testStandard: r[6] || '',
    testItem: r[7] || '',
    equipment: r[8] || '',
  });
}
const appRecords = Array.from(appMap.values());
console.log('  提取委托:', appRecords.length);

// ========== 4. 供应商信息.xlsx → supplierInfo ==========
console.log('读取供应商信息.xlsx ...');
const rawSupplier = readSheet(path.join(docsDir, '供应商信息.xlsx'));
console.log('  数据行:', rawSupplier.length - 1);

const supplierInfo = [];
for (let i = 1; i < rawSupplier.length; i++) {
  const r = rawSupplier[i];
  if (!r || !r[0]) continue;
  const productTypes = r[2] ? String(r[2]).split(/[,，、]/).map(s => s.trim()).filter(Boolean) : [];
  supplierInfo.push({
    id: 'SUP' + String(i).padStart(4, '0'),
    name: r[1] || '',
    productTypes: productTypes,
    description: r[3] || '',
    submitter: r[4] || '',
    createTime: r[6] || '',
  });
}
console.log('  提取供应商:', supplierInfo.length);

// ========== 5. 报告智能判定原始数据0608.xlsx → capabilityData ==========
console.log('读取报告智能判定原始数据0608.xlsx ...');
const capWb = XLSX.readFile(path.join(docsDir, '报告智能判定原始数据0608.xlsx'));

// 5a. 创新与检测中心检测能力表
const capWs = capWb.Sheets['创新与检测中心检测能力表'];
const rawCap = XLSX.utils.sheet_to_json(capWs, { header: 1, defval: '' });

const capabilityItems = [];
let currentSample = '';
let currentSpec = '';
for (let i = 2; i < rawCap.length; i++) {
  const r = rawCap[i];
  if (!r || r.every(v => v === '')) continue;
  // Column C (index 2) = 样品名称, Column D (index 3) = 材料规格 (only set when present)
  if (r[2]) currentSample = String(r[2]).trim();
  if (r[3]) currentSpec = String(r[3]).trim();
  const testItem = String(r[5] || '').trim();
  if (!testItem) continue;

  capabilityItems.push({
    id: 'CAP' + String(capabilityItems.length + 1).padStart(3, '0'),
    sampleName: currentSample,
    specModel: currentSpec || '',
    judgmentStandard: String(r[4] || '').trim(),
    testItem: testItem,
    materialSpec: String(r[6] || '').trim(),
    standardRequirement: String(r[7] || '').trim(),
    testStandard: String(r[8] || '').trim(),
    equipment: String(r[9] || '').trim(),
    remark: String(r[10] || '').trim(),
  });
}
console.log('  能力表条目:', capabilityItems.length);

// 5b. 检测样品要求
const reqWs = capWb.Sheets['检测样品要求'];
const rawReq = XLSX.utils.sheet_to_json(reqWs, { header: 1, defval: '' });

const sampleRequirements = [];
let reqSample = '';
let reqStandard = '';
for (let i = 1; i < rawReq.length; i++) {
  const r = rawReq[i];
  if (!r || r.every(v => v === '')) continue;
  if (r[1]) reqSample = String(r[1]).trim();
  if (r[2]) reqStandard = String(r[2]).trim();
  const testItem = String(r[3] || '').trim();
  if (!testItem) continue;

  sampleRequirements.push({
    sampleName: reqSample,
    judgmentStandard: reqStandard,
    testItem: testItem,
    sampleSize: String(r[5] || '').trim(),
  });
}
console.log('  样品要求条目:', sampleRequirements.length);

// 5c. 胶条规格表 (Sheet1)
const stripWs = capWb.Sheets['Sheet1'];
const rawStrip = XLSX.utils.sheet_to_json(stripWs, { header: 1, defval: '' });

const stripSpecs = [];
let currentType = '';
for (let i = 1; i < rawStrip.length; i++) {
  const r = rawStrip[i];
  if (!r || r.every(v => v === '')) continue;
  if (r[0]) currentType = String(r[0]).trim();
  const model = String(r[1] || '').trim();
  if (!model) continue;
  const names = [r[2], r[3]].filter(v => v).map(v => String(v).trim());
  stripSpecs.push({
    category: currentType,
    model: model,
    commonNames: names,
  });
}
console.log('  胶条规格:', stripSpecs.length);

// ========== 5d. 检测项表单-实际图片-0608.xlsx → ocrRules ==========
console.log('读取检测项表单-实际图片-0608.xlsx ...');
const ocrWb = XLSX.readFile(path.join(docsDir, '检测项表单-实际图片-0608.xlsx'));
const ocrWs = ocrWb.Sheets['Sheet1'];
const rawOcr = XLSX.utils.sheet_to_json(ocrWs, { header: 1, defval: '' });

const ocrRules = [];
let ocrSample = '';
for (let i = 1; i < rawOcr.length; i++) {
  const r = rawOcr[i];
  if (!r || r.every(v => v === '')) continue;
  if (r[2]) ocrSample = String(r[2]).trim();

  const desc = String(r[9] || '').trim();
  const hasImage = String(r[8] || '').includes('DISPIMG');

  // Parse 图片说明 into structured rules
  let ruleType = 'unknown';
  let preConditions = '';
  let recognitionContent = '';
  let calculationMethod = '';

  if (desc === '过程试验') {
    ruleType = 'process';
  } else if (desc === '定性试验无具体值' || desc === '定性试验无量值') {
    ruleType = 'qualitative';
  } else if (desc.includes('前置条件') || desc.includes('识别内容')) {
    ruleType = 'quantitative';
    const parts = desc.split(/\n/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith('前置条件')) {
        preConditions = trimmed.replace(/^前置条件[：:]\s*/, '');
      } else if (trimmed.startsWith('识别内容')) {
        recognitionContent = trimmed.replace(/^识别内容[：:]\s*/, '');
      }
    }
    // Detect calculation method
    if (desc.includes('自动计算平均值')) {
      calculationMethod = 'average';
    } else if (desc.includes('计算') && desc.includes('平均')) {
      calculationMethod = 'average';
    } else {
      calculationMethod = 'direct';
    }
  } else if (desc) {
    ruleType = 'other';
    recognitionContent = desc;
  }

  ocrRules.push({
    id: 'OCR' + String(ocrRules.length + 1).padStart(3, '0'),
    equipment: String(r[1] || '').trim(),
    sampleName: ocrSample,
    judgmentStandard: String(r[3] || '').trim(),
    testItem: String(r[4] || '').trim(),
    subItem: String(r[5] || '').trim(),
    standardRequirement: String(r[6] || '').trim(),
    testStandard: String(r[7] || '').trim(),
    hasImage: hasImage,
    imageDescription: desc,
    ruleType: ruleType,
    preConditions: preConditions,
    recognitionContent: recognitionContent,
    calculationMethod: calculationMethod,
  });
}
console.log('  OCR规则条目:', ocrRules.length);

// OCR rule stats
const ocrWithImage = ocrRules.filter(r => r.hasImage).length;
const ocrQuantitative = ocrRules.filter(r => r.ruleType === 'quantitative').length;
const ocrQualitative = ocrRules.filter(r => r.ruleType === 'qualitative').length;
const ocrProcess = ocrRules.filter(r => r.ruleType === 'process').length;
console.log('  含图片:', ocrWithImage, '| 定量:', ocrQuantitative, '| 定性:', ocrQualitative, '| 过程:', ocrProcess);

// ========== 6. 统计计算 ==========
console.log('计算统计数据 ...');

// 样品类别
const sampleCategorySet = new Set();
records.forEach(r => { if (r.sampleName) sampleCategorySet.add(r.sampleName); });
const sampleCategories = Array.from(sampleCategorySet).sort();

// 生产厂家
const manufacturerSet = new Set();
records.forEach(r => { if (r.manufacturer) manufacturerSet.add(r.manufacturer); });
const manufacturers = Array.from(manufacturerSet).sort();

// 供应商统计
const supplierMap = new Map();
regRecords.forEach(r => {
  if (!r.manufacturer || !r.sampleName) return;
  const key = r.manufacturer + '||' + r.sampleName;
  if (!supplierMap.has(key)) {
    supplierMap.set(key, {
      manufacturer: r.manufacturer,
      sampleName: r.sampleName,
      totalBatches: 0,
      qualifiedBatches: 0,
      unqualifiedBatches: 0,
      pendingBatches: 0,
    });
  }
  const s = supplierMap.get(key);
  s.totalBatches++;
  if (r.testStatus === '已完成' || r.testStatus === '检测完成') {
    // Check judgment from records
    s.qualifiedBatches++; // default to qualified if completed
  } else if (r.testStatus === '检测中') {
    s.pendingBatches++;
  }
});

// Refine qualification from experiment records
records.forEach(r => {
  if (!r.manufacturer || !r.sampleName) return;
  const key = r.manufacturer + '||' + r.sampleName;
  if (!supplierMap.has(key)) return;
  // Don't double count, just use regRecords for batch counts
});

// For unqualified, check experiment records judgment
const unqualBySupplier = new Map();
records.forEach(r => {
  if (r.judgment && r.judgment.includes('不合格')) {
    const key = r.manufacturer + '||' + r.sampleName;
    unqualBySupplier.set(key, (unqualBySupplier.get(key) || 0) + 1);
  }
});

const supplierStats = Array.from(supplierMap.values()).map(s => {
  const key = s.manufacturer + '||' + s.sampleName;
  const unqual = unqualBySupplier.get(key) || 0;
  s.unqualifiedBatches = unqual;
  s.qualifiedBatches = s.totalBatches - s.pendingBatches - unqual;
  if (s.qualifiedBatches < 0) s.qualifiedBatches = 0;
  s.qualifyRate = s.totalBatches > 0 ? +((s.qualifiedBatches / (s.totalBatches - s.pendingBatches)) * 100).toFixed(1) : 0;
  if (isNaN(s.qualifyRate) || !isFinite(s.qualifyRate)) s.qualifyRate = 0;
  return s;
}).sort((a, b) => b.totalBatches - a.totalBatches);

// 材料统计
const materialMap = new Map();
supplierStats.forEach(s => {
  if (!s.sampleName) return;
  if (!materialMap.has(s.sampleName)) {
    materialMap.set(s.sampleName, { material: s.sampleName, supplierCount: 0, totalBatches: 0, qualifiedBatches: 0 });
  }
  const m = materialMap.get(s.sampleName);
  m.supplierCount++;
  m.totalBatches += s.totalBatches;
  m.qualifiedBatches += s.qualifiedBatches;
});
const materialStats = Array.from(materialMap.values()).map(m => ({
  material: m.material,
  supplierCount: m.supplierCount,
  totalBatches: m.totalBatches,
  avgQualifyRate: m.totalBatches > 0 ? +((m.qualifiedBatches / m.totalBatches) * 100).toFixed(1) : 0,
})).sort((a, b) => b.totalBatches - a.totalBatches);

// 设备统计
const equipmentMap = new Map();
records.forEach(r => {
  if (!r.equipment) return;
  const eq = r.equipment.trim();
  if (!eq) return;
  equipmentMap.set(eq, (equipmentMap.get(eq) || 0) + 1);
});
const equipmentStats = Array.from(equipmentMap.entries()).map(([name, totalTests]) => ({
  name, totalTests
})).sort((a, b) => b.totalTests - a.totalTests);

// 检测项目分布
const testCategoryMap = new Map();
records.forEach(r => {
  if (!r.testItem) return;
  const item = r.testItem;
  let cat = '其他';
  if (/硬度|拉伸|撕裂|冲击|弯曲|压缩|伸长|强度|力值|载荷|断裂/.test(item)) cat = '力学性能';
  else if (/老化|臭氧|盐雾|氙灯|紫外|耐候|汞灯/.test(item)) cat = '耐候性能';
  else if (/透光|雾度|光泽|颜色|色差|黄色/.test(item)) cat = '光学性能';
  else if (/吸声|隔声|声学/.test(item)) cat = '声学性能';
  else if (/燃烧|热值|不燃|可燃|防火/.test(item)) cat = '防火性能';
  else if (/密度|厚度|尺寸|重量|质量|憎水|含水/.test(item)) cat = '物理性能';
  else if (/化学|成分|光谱/.test(item)) cat = '化学分析';
  testCategoryMap.set(cat, (testCategoryMap.get(cat) || 0) + 1);
});
const testItemDistributionColors = ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
const testItemDistribution = Array.from(testCategoryMap.entries())
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => b.value - a.value)
  .map((item, i) => ({ ...item, color: testItemDistributionColors[i % testItemDistributionColors.length] }));

// 月度检测量 (from records testDate)
function getMonth(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/(\d{4})[-.\/](\d{1,2})/);
  if (m) return m[1] + '-' + m[2].padStart(2, '0');
  return null;
}

const monthlyMap = new Map();
records.forEach(r => {
  const m = getMonth(r.testDate);
  if (!m) return;
  if (!monthlyMap.has(m)) monthlyMap.set(m, { month: m, total: 0, qualified: 0, unqualified: 0, pending: 0 });
  const d = monthlyMap.get(m);
  d.total++;
  if (r.judgment === '合格') d.qualified++;
  else if (r.judgment === '不合格') d.unqualified++;
  else d.pending++;
});
const monthlyVolume = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

// 月度登记量
const monthlyRegMap = new Map();
regRecords.forEach(r => {
  const m = getMonth(r.receiveDate || r.createTime);
  if (!m) return;
  if (!monthlyRegMap.has(m)) monthlyRegMap.set(m, { month: m, total: 0, completed: 0, inProgress: 0, pending: 0 });
  const d = monthlyRegMap.get(m);
  d.total++;
  if (r.testStatus === '已完成' || r.testStatus === '检测完成') d.completed++;
  else if (r.testStatus === '检测中') d.inProgress++;
  else d.pending++;
});
const monthlyRegVolume = Array.from(monthlyRegMap.values()).sort((a, b) => a.month.localeCompare(b.month));

// 月度委托量
const monthlyAppMap = new Map();
appRecords.forEach(r => {
  const m = getMonth(r.receiveDate);
  if (!m) return;
  monthlyAppMap.set(m, (monthlyAppMap.get(m) || 0) + 1);
});
const monthlyAppVolume = Array.from(monthlyAppMap.entries())
  .map(([month, applications]) => ({ month, applications }))
  .sort((a, b) => a.month.localeCompare(b.month));

// 检测时效性
const timelinessMap = new Map();
regRecords.forEach(r => {
  if (!r.testItem || !r.receiveDate) return;
  // Find matching completed records
  const key = r.testItem;
  if (!timelinessMap.has(key)) timelinessMap.set(key, { testItem: key, days: [], count: 0, category: '' });
  const t = timelinessMap.get(key);
  t.count++;
  // Categorize
  if (/硬度|拉伸|撕裂|冲击|弯曲|压缩|伸长|强度/.test(key)) t.category = '力学性能';
  else if (/老化|臭氧|盐雾|氙灯|紫外|耐候/.test(key)) t.category = '耐候性能';
  else if (/透光|雾度|光泽/.test(key)) t.category = '光学性能';
  else if (/吸声|隔声/.test(key)) t.category = '声学性能';
  else t.category = '其他';
});
const timelinessData = Array.from(timelinessMap.values()).map(t => ({
  category: t.category,
  testItem: t.testItem,
  avgDays: 3, // default estimate
  sampleCount: t.count,
})).sort((a, b) => b.sampleCount - a.sampleCount);

// 统计汇总
const statusStats = {};
regRecords.forEach(r => {
  const s = r.testStatus || '未知';
  statusStats[s] = (statusStats[s] || 0) + 1;
});

const testTypeStats = {};
regRecords.forEach(r => {
  const t = r.testType || '未知';
  testTypeStats[t] = (testTypeStats[t] || 0) + 1;
});

const personStats = {};
regRecords.forEach(r => {
  const p = r.entrustPerson || '未知';
  personStats[p] = (personStats[p] || 0) + 1;
});

const approvalStats = {};
appRecords.forEach(r => {
  const a = r.approvalResult || '未知';
  approvalStats[a] = (approvalStats[a] || 0) + 1;
});

// Pipeline
const uniqueRegByEntrust = new Set(regRecords.map(r => r.entrustNo));
const pipeline = {
  totalApplications: appRecords.length,
  registered: uniqueRegByEntrust.size,
  completed: (statusStats['已完成'] || 0) + (statusStats['检测完成'] || 0),
  pendingRegistration: appRecords.length - uniqueRegByEntrust.size > 0 ? appRecords.length - uniqueRegByEntrust.size : 0,
  inProgress: statusStats['检测中'] || 0,
};

const allRecordsCount = records.length;
const allRegRecordsCount = regRecords.length;
const allAppRecordsCount = appRecords.length;
const inProgressCount = statusStats['检测中'] || 0;
const pendingCount = pipeline.pendingRegistration;
// Count rows with photos in raw Excel (each row with a photo URL counts as 1)
let photoCount = 0;
for (let i = 2; i < rawApp.length; i++) {
  if (rawApp[i] && rawApp[i][11] && String(rawApp[i][11]).trim()) photoCount++;
}
const supplierInfoCount = supplierInfo.length;

// ========== 7. 输出 ==========
const output = {
  records,
  allRecordsCount,
  supplierStats,
  materialStats,
  timelinessData,
  equipmentStats,
  monthlyVolume,
  sampleCategories,
  manufacturers,
  testItemDistribution,
  supplierInfo,
  supplierInfoCount,
  regRecords,
  allRegRecordsCount,
  inProgressCount,
  pendingCount,
  statusStats,
  testTypeStats,
  personStats,
  monthlyRegVolume,
  appRecords,
  allAppRecordsCount,
  allAppRowsCount: rawApp.length - 2,
  pipeline,
  approvalStats,
  photoCount,
  monthlyAppVolume,
  capabilityItems,
  sampleRequirements,
  stripSpecs,
  ocrRules,
};

const jsonStr = JSON.stringify(output);
fs.writeFileSync(outPath, jsonStr, 'utf-8');
const sizeMB = (Buffer.byteLength(jsonStr, 'utf-8') / 1024 / 1024).toFixed(2);
console.log('\n========== 提取完成 ==========');
console.log('实验记录:', records.length, '/', allRecordsCount);
console.log('登记记录:', regRecords.length, '/', allRegRecordsCount);
console.log('委托申请:', appRecords.length, '/', allAppRecordsCount);
console.log('供应商信息:', supplierInfo.length, '/', supplierInfoCount);
console.log('供应商统计:', supplierStats.length);
console.log('材料统计:', materialStats.length);
console.log('设备统计:', equipmentStats.length);
console.log('检测时效:', timelinessData.length);
console.log('送样图片:', photoCount);
console.log('能力表条目:', capabilityItems.length);
console.log('样品要求:', sampleRequirements.length);
console.log('胶条规格:', stripSpecs.length);
console.log('OCR规则:', ocrRules.length);
console.log('输出文件:', outPath);
console.log('文件大小:', sizeMB, 'MB');
