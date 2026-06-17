// 抽取 检测报告模版-1/2/3.docx 的关键特征,输出 JSON
// 抽取规则:解析 word/document.xml 的 <w:t> 文本
//  - 总页数:匹配 共\|(\d+)\|页
//  - 含图谱:文本包含 "吸声系数" 或 "隔声量"
//  - 含试验前/后对比:文本同时包含 "试验前" 和 "试验后"
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const docsDir = path.join(__dirname, '..', 'docs', '检测报告模板');

const files = ['检测报告模版-1.docx', '检测报告模版-2.docx', '检测报告模版-3.docx'];

const results = [];
for (const f of files) {
  const fullPath = path.join(docsDir, f);
  if (!fs.existsSync(fullPath)) {
    console.error('缺失:', fullPath);
    process.exit(1);
  }
  const zip = new AdmZip(fullPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) {
    console.error('未找到 word/document.xml in', f);
    process.exit(1);
  }
  const xml = entry.getData().toString('utf-8');

  // 抽 <w:t>...</w:t>
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  const texts = [];
  let m;
  while ((m = re.exec(xml))) if (m[1].trim()) texts.push(m[1]);
  const joined = texts.join('|');

  // 总页数
  const pageMatch = joined.match(/共\|(\d+)\|页/);
  const pageCount = pageMatch ? Number(pageMatch[1]) : null;

  // 含图谱:检测数据|检测图谱|频率 标题(吸声系数/隔声量图谱均以该标题开头)
  const chartTitleMatches = joined.match(/检测数据\|检测图谱\|频率/g);
  const hasChart = !!chartTitleMatches && chartTitleMatches.length > 0;

  // 含试验前/后对比
  const hasPrePostTest = joined.includes('试验前') && joined.includes('试验后');

  results.push({ file: f, pageCount, hasChart, hasPrePostTest });
}

console.log('=== 抽取结果 ===');
console.log(JSON.stringify(results, null, 2));
