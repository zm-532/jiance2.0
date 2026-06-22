# OCR 功能规划 —— 配置驱动的设备维度 OCR 识别与报告生成

## 一、现状分析

### 1.1 当前 OCR 流程（通用模式）

```
上传照片 → PaddleOCR 识别 → 提取表格 → 存入 recognized_value（单字段）
```

**问题**：
- 不知道照片来自哪个设备
- 不知道应该按什么规则提取数值
- 不知道一次测试产生几个检测项
- 不知道最终要存哪些字段（平均值/中值/最大值/单值）
- 无法支撑后续的报告生成（报告需要按样品聚合多个检测项）

### 1.2 Excel 数据揭示的核心事实

来源：`检测项表单-实际图片-0618.xlsx`，Sheet 名：**一次测试有多个检测项目**

#### Sheet 名的含义

Sheet 名 "一次测试有多个检测项目" 揭示了关键业务规则：**同一个样品的同一次测试，会同时产生多个检测项目的结果**。这些结果必须归属到同一次测试（同一个委托单/样品），最终一起出现在同一份检测报告中。

#### 涉及 8 类设备，每类的 OCR 规则完全不同

| 设备 | 编号 | 一次测试出的检测项数 | 聚合方式 | 特殊需求 |
|------|------|---------------------|---------|---------|
| 低温回缩仪 | ZC-40 | 4个（TR10/TR30/TR50/TR70） | 平均值 | 3个试样 |
| 电液伺服万能试验机 | ZC-29 | 2~3个（抗拉强度/规定非比例延伸强度/断后伸长率） | 平均值 | 5个试样 |
| 光电直读光谱仪 | ZC-16 | 多个化学元素（C/Si/Mn/P/S/Cu/Cr/Ni/Zn/Ti/V/Fe/Mg） | AVG列直取 | 5个试样，按需选元素 |
| 抗风压检测试验机 | ZC-36 | 2个（挠度 + 残余变形） | 绝对值最大值 | 1#/2#/3# 三个测点 |
| 扭矩系数测定仪 | ZC-56 | 2个（紧固轴力 + 标准偏差 / 扭矩系数平均值 + 变异系数） | 直取/X行/б行/CV行 | 8个试样 |
| 热空气老化箱 + 万能试验机 | ZC-43+ZC-09 | 2个（拉伸强度 + 拉断伸长率） | **中值**（非平均值） | 5个试样 |
| 声学实验室设备 | ZC-49 | 1~2个（计权隔声量 Rw / 降噪系数 NRC / 吸声系数） | 单值直取 | **需子表**记录1/3倍频程频率数据+折线图 |
| 万能试验机 | ZC-09 | 2~3个（拉伸强度/断裂伸长率/弹性模量/弯曲强度/弯曲模量） | 平均值 | 5个试样 |

---

## 二、核心设计思路

### 2.1 整体流程重构

```
┌─────────────────────────────────────────────────────────┐
│                    前端上传流程                           │
│                                                         │
│  ① 选择设备 → ② 选择样品名称 → ③ 选择检测项目组        │
│  → ④ 填写委托编号 → ⑤ 上传照片（1张或多张）             │
│  → ⑥ 系统按配置规则自动提取 → ⑦ 用户确认/修正          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 "检测项配置组"概念

Sheet 名 "一次测试有多个检测项目" 对应的核心概念是 **"检测项配置组"**：

- 一次测试 = 一个配置组
- 一个配置组 = 多个检测项（共享同一张设备截图）
- 一张照片上传后 → 系统按配置组批量提取所有检测项 → 生成多条 Photo 记录

**举例**：低温回缩仪 ZC-40 + 板柱间胶条
- 用户选择设备：低温回缩仪 ZC-40
- 用户选择样品：板柱间胶条
- 系统自动关联配置组（4个检测项）：TR10, TR30, TR50, TR70
- 用户上传1张设备截图
- 系统自动提取4个检测项的值，生成4条记录
- 这4条记录共享同一个 `group_id`，归属同一份报告

### 2.3 报告关联逻辑

```
报告模板（如"检测报告模版-1"）
  └── 关联样品类别（如"金属屏体"）
       └── 关联委托单/样品
            └── 关联检测项配置组（可能有多个组）
                 └── 每个组关联一张照片 + N条检测项记录
```

报告生成时：
- 按 `group_id` 聚合，确保同一次测试的所有检测项一起出现
- 每个检测项有独立的判定结果
- 整份报告的总判定 = 所有检测项都合格才合格

---

## 三、数据库设计

### 3.1 新增表：`test_item_configs`（检测项配置表）

将 Excel 数据结构化：

```sql
CREATE TABLE test_item_configs (
    id              VARCHAR(50) PRIMARY KEY,        -- 配置ID
    device_name     VARCHAR(100) NOT NULL,           -- 设备名称（如"低温回缩仪ZC-40"）
    device_key      VARCHAR(50) NOT NULL,            -- 设备标识（如"ZC-40"）
    sample_name     VARCHAR(100) NOT NULL,           -- 样品名称（如"板柱间胶条"）
    material_spec   VARCHAR(200),                    -- 材料规格（如"3003H24"）
    judgment_standard VARCHAR(100),                  -- 判定标准（如"GB/T30649-2014"）
    
    -- 配置组：同一次测试产生的所有检测项共享同一个 group_key
    group_key       VARCHAR(100) NOT NULL,           -- 组标识（如"ZC-40:板柱间胶条:低温回缩"）
    group_item_count INT DEFAULT 1,                  -- 该组包含的检测项数量
    
    -- 检测项信息
    test_item       VARCHAR(200) NOT NULL,           -- 检测项目名称（如"低温回缩温度-TR10"）
    sub_item        VARCHAR(200),                    -- 子项目
    judgment_indicator VARCHAR(200),                 -- 判定指标（如"≤-40℃"）
    test_standard   VARCHAR(100),                    -- 检测标准（如"GB/T 7758-2020"）
    
    -- OCR 提取规则（JSON 格式，描述如何从图片中提取数据）
    extraction_rule JSON NOT NULL,                   -- 提取规则详情
    
    -- 聚合方式
    aggregation_method VARCHAR(20) DEFAULT 'average', -- average/median/max/single/direct
    sample_count    INT DEFAULT 3,                   -- 试样数量（3或5）
    
    -- 特殊标记
    needs_subtable  BOOLEAN DEFAULT FALSE,           -- 是否需要子表（声学频率数据）
    report_section  VARCHAR(100),                    -- 报告中的章节归属
    
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_device_key ON test_item_configs(device_key);
CREATE INDEX idx_group_key ON test_item_configs(group_key);
CREATE INDEX idx_sample_name ON test_item_configs(sample_name);
```

### 3.2 修改表：`photos`（照片表）

```sql
ALTER TABLE photos ADD COLUMN device_key VARCHAR(50);           -- 设备标识
ALTER TABLE photos ADD COLUMN group_id VARCHAR(50);             -- 检测项配置组ID（同一次测试的照片共享）
ALTER TABLE photos ADD COLUMN config_id VARCHAR(50);            -- 关联的 test_item_configs.id
ALTER TABLE photos ADD COLUMN sample_name VARCHAR(255);         -- 已有，但需确保与配置一致
ALTER TABLE photos ADD COLUMN result_values JSON;               -- 多个试样的原始值（如[-45.1, -44.8, -44.8]）

-- 声学子表数据
ALTER TABLE photos ADD COLUMN frequency_data JSON;              -- 1/3倍频程频率数据（仅声学设备使用）
```

### 3.3 `extraction_rule` JSON 结构

每种设备的提取规则不同，用 JSON 描述：

#### 低温回缩仪 ZC-40
```json
{
  "type": "table_row_column",
  "description": "识别表格中1#/2#/3#行对应TR列的值",
  "row_headers": ["1#", "2#", "3#"],
  "column_key": "TR10",
  "column_alternatives": ["TR10", "TR10列"],
  "value_pattern": "(-?\\d+\\.?\\d*)",
  "unit": "℃"
}
```

#### 电液伺服万能试验机 ZC-29
```json
{
  "type": "table_column_row",
  "description": "识别表格中试样1~5列对应某行的值",
  "column_headers": ["试样1", "试样2", "试样3", "试样4", "试样5"],
  "row_key": "抗拉强度",
  "row_alternatives": ["抗拉强度", "抗拉强度MPa"],
  "value_pattern": "(\\d+\\.?\\d*)"
}
```

#### 光电直读光谱仪 ZC-16
```json
{
  "type": "table_column_row_with_avg",
  "description": "识别试样1~5列对应元素行，取AVG列作为最终值",
  "column_headers": ["试样1", "试样2", "试样3", "试样4", "试样5"],
  "avg_column": "AVG",
  "row_key": "Si",
  "value_pattern": "(\\d+\\.?\\d*)"
}
```

#### 扭矩系数测定仪 ZC-56
```json
{
  "type": "table_id_rows",
  "description": "识别ID 1~8行的轴力/扭矩系数，取/X行或б行或CV行",
  "id_rows": ["1", "2", "3", "4", "5", "6", "7", "8"],
  "result_row_key": "/X",
  "result_row_alternatives": ["б", "CV"],
  "value_pattern": "(\\d+\\.?\\d*)"
}
```

#### 热空气老化箱 ZC-43
```json
{
  "type": "table_column_row",
  "description": "识别001~005列对应行的值，取中值",
  "column_headers": ["001", "002", "003", "004", "005"],
  "row_key": "拉伸强度",
  "aggregation": "median"
}
```

#### 抗风压检测试验机 ZC-36
```json
{
  "type": "table_pressure_row",
  "description": "识别指定压力行的正压/负压变形B(mm)，取绝对值最大值",
  "pressure_key": "5000Pa",
  "positive_label": "正压变形",
  "negative_label": "负压变形",
  "column_key": "B（mm）",
  "sample_points": ["1#", "2#", "3#"],
  "aggregation": "abs_max"
}
```

#### 声学实验室 ZC-49
```json
{
  "type": "single_value_or_frequency_table",
  "description": "识别Rw行或NRC行的单值，部分需子表记录频率数据",
  "value_key": "Rw",
  "value_alternatives": ["NRC"],
  "needs_frequency_subtable": true,
  "frequency_columns": ["1/3倍频程中心频率", "吸声系数"]
}
```

#### 万能试验机 ZC-09
```json
{
  "type": "table_column_row",
  "description": "识别001~005列对应行的值，取平均值",
  "column_headers": ["001", "002", "003", "004", "005"],
  "row_key": "拉伸强度",
  "row_alternatives": ["拉伸强度MPa", "拉伸强度"],
  "aggregation": "average"
}
```

---

## 四、前端改造

### 4.1 上传区域重构

当前上传区域是简单的拖拽上传，需要改为分步流程：

```
┌──────────────────────────────────────────────────────┐
│  步骤 1：选择设备（下拉框）                            │
│  ┌──────────────────────────────────┐                 │
│  │ 请选择检测设备 ▼                 │                 │
│  │  - 低温回缩仪 ZC-40             │                 │
│  │  - 电液伺服万能试验机 ZC-29     │                 │
│  │  - 光电直读光谱仪 ZC-16         │                 │
│  │  - 抗风压检测试验机 ZC-36       │                 │
│  │  - 扭矩系数测定仪 ZC-56         │                 │
│  │  - 热空气老化箱 ZC-43           │                 │
│  │  - 声学实验室设备 ZC-49         │                 │
│  │  - 万能试验机 ZC-09             │                 │
│  └──────────────────────────────────┘                 │
│                                                       │
│  步骤 2：选择样品名称（联动下拉框）                    │
│  ┌──────────────────────────────────┐                 │
│  │ 请选择样品名称 ▼                 │                 │
│  │  - 板柱间胶条                   │                 │
│  │  - 板间胶条                     │                 │
│  │  - 解耦胶条                     │                 │
│  │  - U型胶条                      │                 │
│  │  - 平板胶条                     │                 │
│  │  - 橡胶块                       │                 │
│  └──────────────────────────────────┘                 │
│                                                       │
│  步骤 3：检测项目预览（自动显示）                      │
│  ┌──────────────────────────────────┐                 │
│  │ 本次测试将提取以下 4 个检测项：  │                 │
│  │  ☑ 低温回缩温度-TR10 (≤-40℃)   │                 │
│  │  ☑ 低温回缩温度-TR30 (≤-30℃)   │                 │
│  │  ☑ 低温回缩温度-TR50 (≤-20℃)   │                 │
│  │  ☑ 低温回缩温度-TR70 (≤-10℃)   │                 │
│  └──────────────────────────────────┘                 │
│                                                       │
│  步骤 4：填写委托编号（可选）                          │
│  ┌──────────────────────────────────┐                 │
│  │ 委托编号（选填）                 │                 │
│  └──────────────────────────────────┘                 │
│                                                       │
│  步骤 5：上传照片                                      │
│  ┌──────────────────────────────────┐                 │
│  │     📷 点击或拖拽照片上传        │                 │
│  │     支持 JPG/PNG/BMP            │                 │
│  └──────────────────────────────────┘                 │
└──────────────────────────────────────────────────────┘
```

### 4.2 检测结果展示改造

当前结果表只展示单条记录，需改为**按组展示**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│  组：板柱间胶条 / 低温回缩 / 委托号: WT-2025-001                        │
│  设备：低温回缩仪 ZC-40 | 照片：xxx.jpg | 状态：待确认                  │
├─────────────────────────────────────────────────────────────────────────┤
│  检测项          │ 标准要求  │ 试样1  │ 试样2  │ 试样3  │ 结果值  │ 判定 │
│  低温回缩-TR10   │ ≤-40℃    │ -45.1  │ -44.8  │ -44.8  │ -44.9   │ 合格 │
│  低温回缩-TR30   │ ≤-30℃    │ -45.1  │ -44.8  │ -44.8  │ -44.9   │ 合格 │
│  低温回缩-TR50   │ ≤-20℃    │ -45.1  │ -44.8  │ -44.8  │ -44.9   │ 合格 │
│  低温回缩-TR70   │ ≤-10℃    │ -45.1  │ -44.8  │ -44.8  │ -44.9   │ 合格 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 声学设备的特殊 UI

声学实验室 ZC-49 部分检测项（吸声系数/降噪系数）需要额外的子表 UI：

```
┌──────────────────────────────────────────────────────────┐
│  1/3 倍频程频率数据                                       │
│  ┌──────────┬──────────┐                                 │
│  │ 频率(Hz) │ 吸声系数 │                                 │
│  │ 100      │ 0.05     │                                 │
│  │ 125      │ 0.08     │                                 │
│  │ 160      │ 0.12     │                                 │
│  │ ...      │ ...      │                                 │
│  │ 5000     │ 0.85     │                                 │
│  └──────────┴──────────┘                                 │
│  [📊 生成折线图]                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 五、后端改造

### 5.1 新增 API 端点

```
GET  /api/v1/inspection/configs/devices
     → 返回所有设备列表（设备名 + 设备编号）

GET  /api/v1/inspection/configs/devices/{device_key}/samples
     → 返回该设备支持的样品名称列表

GET  /api/v1/inspection/configs/groups?device_key=ZC-40&sample_name=板柱间胶条
     → 返回该设备+样品组合的检测项配置组（所有检测项）

POST /api/v1/inspection/ocr/recognize_with_config
     Body: { file, device_key, sample_name, entrust_no? }
     → 上传照片 + 按配置规则批量提取所有检测项
     → 返回 { group_id, photos: [{ config_id, test_item, recognized_value, result_values, ... }] }
```

### 5.2 提取器架构（策略模式）

```python
# app/services/extractors/__init__.py

class BaseExtractor:
    """提取器基类"""
    def extract(self, tables: list[dict], raw_text: str, config: dict) -> dict:
        """
        返回:
        {
            "values": [原始值列表],
            "result": 聚合后的结果值,
            "frequency_data": 频率子表数据（仅声学设备）
        }
        """
        raise NotImplementedError

class TableRowColumnExtractor(BaseExtractor):
    """低温回缩仪等：行→列取值"""
    
class TableColumnRowExtractor(BaseExtractor):
    """万能试验机等：列→行取值"""

class TableColumnRowWithAvgExtractor(BaseExtractor):
    """光谱仪：列→行取值 + AVG列"""

class TableIdRowsExtractor(BaseExtractor):
    """扭矩系数仪：ID行→特殊行取值"""

class TablePressureRowExtractor(BaseExtractor):
    """抗风压试验机：压力行→正负压取值"""

class SingleValueExtractor(BaseExtractor):
    """声学实验室：单值直取 + 可选频率子表"""

# 设备→提取器映射
EXTRACTOR_MAP = {
    "ZC-40": TableRowColumnExtractor,
    "ZC-29": TableColumnRowExtractor,
    "ZC-16": TableColumnRowWithAvgExtractor,
    "ZC-36": TablePressureRowExtractor,
    "ZC-56": TableIdRowsExtractor,
    "ZC-43": TableColumnRowExtractor,  # 但聚合用 median
    "ZC-49": SingleValueExtractor,
    "ZC-09": TableColumnRowExtractor,
}
```

### 5.3 聚合方式实现

```python
from statistics import median

def aggregate(values: list[float], method: str) -> float:
    if not values:
        return None
    if method == "average":
        return round(sum(values) / len(values), 2)
    elif method == "median":
        return round(median(values), 2)
    elif method == "max":
        return round(max(values), 2)
    elif method == "abs_max":
        return round(max(abs(v) for v in values), 2)
    elif method == "single" or method == "direct":
        return values[0]
    return None
```

---

## 六、报告生成关联

### 6.1 报告生成时需要处理的数据结构

```
报告
├── 样品信息（样品名称、规格、厂家、委托号等）
├── 检测项目组 1（如：低温回缩）
│   ├── 检测项 1: TR10 → 值: -44.9℃ → 判定: 合格
│   ├── 检测项 2: TR30 → 值: -44.9℃ → 判定: 合格
│   ├── 检测项 3: TR50 → 值: -44.9℃ → 判定: 合格
│   └── 检测项 4: TR70 → 值: -44.9℃ → 判定: 合格
├── 检测项目组 2（如：热空气老化）
│   ├── 检测项 1: 拉伸强度 → 值: 9.5MPa → 判定: 合格
│   └── 检测项 2: 拉断伸长率 → 值: 280% → 判定: 合格
├── 检测项目组 3（如：声学性能）
│   ├── 检测项 1: 计权隔声量 → 值: 32dB → 判定: 合格
│   └── 附件: 1/3倍频程频率数据表 + 折线图
├── 总判定：全部合格 → 合格
└── 附件照片（原始设备截图）
```

### 6.2 报告模板与检测项配置组的对应关系

| 报告模板 | 适用样品 | 可能包含的检测项配置组 |
|---------|---------|---------------------|
| 检测报告模版-1 | 金属屏体 | ZC-36抗风压 + ZC-49隔声/吸声 + ZC-29力学(如有) + ZC-16化学成分(如有) |
| 检测报告模版-2 | 亚克力 | ZC-09拉伸/弯曲 + ZC-49隔声 + ZC-29力学(如有) |
| 检测报告模版-3 | PC板 | ZC-09拉伸/弯曲 + ZC-49隔声(如有) |

### 6.3 报告 API 改造

```
GET /api/v1/inspection/reports/{report_id}/test_groups
    → 返回该报告关联的所有检测项配置组及其结果
    → 每个组包含：组信息 + 照片 + 所有检测项记录

POST /api/v1/inspection/reports/{report_id}/generate
    → 生成报告时：
    → 1. 聚合所有 group_id 下的照片记录
    → 2. 按检测项配置组排列数据
    → 3. 填充 Word 模板（需要模板字段映射）
    → 4. 声学数据附带频率表 + 折线图
```

---

## 七、Excel 数据中需注意的特殊情况

### 7.1 同一设备 + 同一样品，不同判定标准

例：光电直读光谱仪 ZC-16 + 钢板 Q235B
- 判定标准可能是 `GB/T 700-2006`
- 也可能是 `GB/T1591-2018`（Q355 系列）
- 不同标准下，同一元素的判定指标不同
- → 配置表需要按 `judgment_standard` 区分

### 7.2 部分检测项无设备图片

- 大六角头螺栓连接副的"断后伸长率"标注为"无测试条件"
- 部分化学元素（Mg、Cr、Ti、V）在铝板 3003H24 中判定指标为 `/`（不要求）
- → 仍需录入配置，但可以不要求上传图片，仅记录为"参考值"

### 7.3 抗风压的复杂判定

- 判定标准形如 `挠度≤19.6（100/L）` 或 `残余变形≤3.92（500/L）`
- 其中 L 是样品长度，需要从材料规格中提取
- 不同样品尺寸的判定阈值不同（1960mm → 19.6，2960mm → 29.6，3960mm → 39.6）
- → 判定逻辑需要动态计算

### 7.4 设备组合使用

- 热空气老化测试需要两台设备配合：热空气老化箱 ZC-43 + 万能试验机 ZC-09
- → 配置组中 `device_name` 记录为 "热空气老化箱ZC-43、万能试验机ZC-09"
- → 上传的照片来自 ZC-09 的测试结果（老化后的拉伸测试）

### 7.5 公路 vs 铁路标准的差异

- 铁路屏体（TB/T 3122-2019）：明确指定风压值（3000Pa/5000Pa）
- 公路屏体（JT/T 646.2-2025）：判定标准是 L/300 和 L/600，需要根据样品尺寸计算
- → 提取器需要根据 `judgment_standard` 切换不同的判定逻辑

---

## 八、实施任务分解

### Task 1：检测项配置数据准备

1.1 编写脚本将 Excel 数据解析为 JSON
1.2 设计 `test_item_configs` 表结构和 `extraction_rule` JSON schema
1.3 编写数据导入脚本，将所有配置导入数据库
1.4 编写 API：获取设备列表、样品列表、检测项组配置

### Task 2：后端提取器框架

2.1 创建 `app/services/extractors/` 目录
2.2 实现 `BaseExtractor` 基类和各种提取器子类
2.3 实现聚合函数（average/median/max/abs_max/single）
2.4 编写单元测试，用模拟 OCR 表格数据验证每个提取器

### Task 3：后端 API 改造

3.1 新增 `POST /ocr/recognize_with_config` 端点
3.2 修改 `Photo` 模型，增加 `device_key`, `group_id`, `config_id`, `result_values` 字段
3.3 实现按配置组批量提取和批量入库逻辑
3.4 数据库迁移（alembic）

### Task 4：前端上传流程改造

4.1 重构上传区域为分步选择流程（设备→样品→预览→上传）
4.2 新增检测项配置 API 调用（获取设备/样品/配置组）
4.3 上传时传递 `device_key` 和 `sample_name`
4.4 结果展示改为按组展示，显示试样值和聚合值

### Task 5：声学设备特殊处理

5.1 实现频率子表数据提取（ZC-49）
5.2 前端增加频率数据表格展示 UI
5.3 实现折线图生成（用于报告附件）

### Task 6：报告生成关联

6.1 报告生成页面改为按 `group_id` 聚合展示检测数据
6.2 报告模板字段映射：将检测项配置组数据映射到 Word 模板占位符
6.3 实现报告导出时附带频率表/折线图（声学设备）
6.4 实现复杂判定逻辑（抗风压的动态阈值计算等）

### Task 7：判定逻辑增强

7.1 增强 `judgeResult` 支持：范围判定（`370-500MPa`）、动态阈值（`L/300`）
7.2 支持多条件判定（如公路屏体：挠度 + 残余变形都需合格）
7.3 单条记录判定 + 组级别判定 + 报告级别总判定

---

## 九、技术选型建议

| 层面 | 当前 | 建议 |
|------|------|------|
| 配置存储 | 无 | 数据库表 `test_item_configs`（方便增删改查 + API 查询） |
| 提取器 | 无（仅通用 OCR） | Python 策略模式，每种设备一个提取器类 |
| 前端选择 | 无 | 级联选择组件（设备→样品→配置组预览） |
| 数据展示 | 单条记录 | 按组折叠/展开，显示试样明细 |
| 子表数据 | 无 | JSON 字段 + 前端表格 + 折线图（recharts/chart.js） |
| 报告生成 | 简单照片附件 | 按组聚合 + Word 模板填充 + 图表嵌入 |

---

## 十、预期效果

1. **上传前**：用户明确选择设备和样品，系统预知将要提取的检测项
2. **上传后**：系统自动按规则提取所有检测项，一次上传生成多条记录
3. **确认时**：用户看到完整的试样数据和聚合结果，可逐项修正
4. **生成报告时**：按检测项配置组聚合数据，自动填充模板，支持图表附件
5. **可维护性**：新增设备/检测项只需添加配置记录，无需修改代码
