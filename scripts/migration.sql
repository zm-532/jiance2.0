SET NAMES utf8mb4;

-- 创建 test_item_configs 表（迁移 a1b2c3d4e5f6 的等价 SQL）
CREATE TABLE IF NOT EXISTS test_item_configs (
  id VARCHAR(50) NOT NULL,
  device_name VARCHAR(100) NOT NULL,
  device_key VARCHAR(50) NOT NULL,
  sample_name VARCHAR(100) NOT NULL,
  material_spec VARCHAR(200) NULL,
  judgment_standard VARCHAR(100) NULL,
  group_key VARCHAR(100) NOT NULL,
  group_item_count INT NOT NULL DEFAULT 1,
  test_item VARCHAR(200) NOT NULL,
  sub_item VARCHAR(200) NULL,
  judgment_indicator VARCHAR(200) NULL,
  test_standard VARCHAR(100) NULL,
  extraction_rule JSON NOT NULL,
  aggregation_method VARCHAR(20) NOT NULL DEFAULT 'average',
  sample_count INT NOT NULL DEFAULT 3,
  needs_subtable TINYINT(1) NOT NULL DEFAULT 0,
  report_section VARCHAR(100) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_test_item_configs_device_key ON test_item_configs(device_key);
CREATE INDEX ix_test_item_configs_group_key ON test_item_configs(group_key);
CREATE INDEX ix_test_item_configs_sample_name ON test_item_configs(sample_name);

-- photos 表增量字段（全部 nullable，向后兼容）
ALTER TABLE photos ADD COLUMN device_key VARCHAR(50) NULL;
ALTER TABLE photos ADD COLUMN group_id VARCHAR(50) NULL;
ALTER TABLE photos ADD COLUMN config_id VARCHAR(50) NULL;
ALTER TABLE photos ADD COLUMN result_values JSON NULL;
ALTER TABLE photos ADD COLUMN frequency_data JSON NULL;

CREATE INDEX ix_photos_device_key ON photos(device_key);
CREATE INDEX ix_photos_group_id ON photos(group_id);

-- 更新 alembic 版本号
UPDATE alembic_version SET version_num = 'a1b2c3d4e5f6' WHERE version_num = '8595a3a51bd4';
