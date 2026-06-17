import { describe, it, expect } from 'vitest'
import { judgeResult } from './ocr'

describe('judgeResult', () => {
  // ---------- 数值比较 ----------

  it('≥ 阈值: 大于等于时合格', () => {
    expect(judgeResult('50', '≥45')).toBe('合格')
    expect(judgeResult('45', '≥45')).toBe('合格')
    expect(judgeResult('44', '≥45')).toBe('不合格')
  })

  it('≤ 阈值: 小于等于时合格', () => {
    expect(judgeResult('3', '≤5')).toBe('合格')
    expect(judgeResult('5', '≤5')).toBe('合格')
    expect(judgeResult('6', '≤5')).toBe('不合格')
  })

  it('范围区间: 在范围内合格', () => {
    expect(judgeResult('50', '45-55')).toBe('合格')
    expect(judgeResult('45', '45-55')).toBe('合格')
    expect(judgeResult('55', '45-55')).toBe('合格')
    expect(judgeResult('44', '45-55')).toBe('不合格')
    expect(judgeResult('56', '45-55')).toBe('不合格')
  })

  it('~ 分隔的范围区间', () => {
    expect(judgeResult('50', '40~60')).toBe('合格')
    expect(judgeResult('39', '40~60')).toBe('不合格')
  })

  // ---------- 定性判断 ----------

  it('无裂纹定性判断', () => {
    expect(judgeResult('无裂纹', '无裂纹')).toBe('合格')
    expect(judgeResult('有裂纹', '无裂纹')).toBe('不合格')
  })

  it('不裂定性判断', () => {
    expect(judgeResult('不裂', '不裂')).toBe('合格')
  })

  // ---------- 边界情况 ----------

  it('空值返回待判定', () => {
    expect(judgeResult('', '≥45')).toBe('待判定')
    expect(judgeResult('50', '')).toBe('待判定')
    expect(judgeResult('', '')).toBe('待判定')
  })

  it('无法解析时返回待判定', () => {
    expect(judgeResult('abc', '≥45')).toBe('待判定')
    expect(judgeResult('50', '无标准')).toBe('待判定')
  })

  it('小数比较', () => {
    expect(judgeResult('3.5', '≥3.0')).toBe('合格')
    expect(judgeResult('2.9', '≥3.0')).toBe('不合格')
  })

  it('Unicode ≥ ≤ 符号', () => {
    expect(judgeResult('50', '≥45')).toBe('合格')
    expect(judgeResult('50', '≤55')).toBe('合格')
  })
})
