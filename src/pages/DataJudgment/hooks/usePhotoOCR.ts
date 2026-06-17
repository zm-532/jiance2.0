import { useState, useCallback, useEffect, useMemo } from 'react'
import { message, Modal } from 'antd'
import { ocrRules, type OCRRule } from '../../../mock/data'
import {
  recognizeImage, judgeResult,
  listPhotos, getPhoto, updatePhotoMeta, deletePhoto, deletePhotosBatch,
  type ArchivedPhoto, type OCRTable,
} from '../../../services/ocr'

export interface OCRResultItem {
  id: string
  fileName: string
  photoUrl: string
  ocrRawText: string
  tables?: OCRTable[]
  matchedRule: OCRRule | null
  testItem: string
  subItem: string
  recognizedValue: string
  standardRequirement: string
  judgment: '合格' | '不合格' | '待判定'
  status: '已识别' | '待确认' | '识别失败' | '识别中'
  includeInReport: boolean
  sampleName: string
  entrustNo: string
  progress: number
  error?: string
}

export function archivedToItem(p: ArchivedPhoto): OCRResultItem {
  return {
    id: p.id,
    fileName: p.originalName,
    photoUrl: p.photoUrl,
    ocrRawText: p.ocrRawText,
    tables: p.tables,
    matchedRule: ocrRules.find(r => r.id === p.matchedRuleId) || null,
    testItem: p.testItem,
    subItem: p.subItem,
    recognizedValue: p.recognizedValue,
    standardRequirement: p.standardRequirement,
    judgment: p.judgment,
    status: p.status,
    includeInReport: p.includeInReport,
    sampleName: p.sampleName || '',
    entrustNo: p.entrustNo || '',
    progress: p.status === '识别中' ? 50 : 100,
    error: p.error || undefined,
  }
}

function normalizeForMatch(s: string): string {
  return (s || '')
    .replace(/[\s\[\]【】()（）/、，,。.\-_：:]/g, '')
    .toLowerCase()
}

function matchRule(rawText: string, fileName: string): OCRRule | null {
  const text = rawText.toLowerCase()
  const fn = fileName.toLowerCase()

  for (const rule of ocrRules) {
    if (!rule.hasImage) continue
    const item = rule.testItem.toLowerCase()
    const sub = rule.subItem.toLowerCase()
    if (fn.includes(item.substring(0, 4)) || (sub && fn.includes(sub.substring(0, 3)))) {
      return rule
    }
  }

  for (const rule of ocrRules) {
    if (!rule.hasImage) continue
    const req = rule.standardRequirement.replace(/[≥≤<>]/g, '').toLowerCase()
    if (req && text.includes(req)) {
      return rule
    }
  }

  return null
}

function extractValuesFromText(text: string, rule: OCRRule): string[] {
  const values: string[] = []
  const lines = text.split('\n')

  if (rule.recognitionContent) {
    const numberPattern = /[-+]?\d+\.?\d*/g
    const allNumbers: string[] = []
    for (const line of lines) {
      const matches = line.match(numberPattern)
      if (matches) allNumbers.push(...matches)
    }
    if (rule.preConditions) {
      const condNumbers = rule.preConditions.match(/\d+#?/g)
      if (condNumbers && condNumbers.length > 0) {
        return allNumbers.slice(0, condNumbers.length)
      }
    }
    return allNumbers.slice(0, 5)
  }

  const numberPattern = /[-+]?\d+\.?\d*/g
  const matches = text.match(numberPattern)
  if (matches) values.push(...matches.slice(0, 5))
  return values
}

function extractValuesFromTables(tables: OCRTable[] | undefined, rule: OCRRule): string[] | null {
  if (!tables || tables.length === 0) return null

  const candidates = [
    rule.recognitionContent,
    rule.subItem,
    rule.testItem,
  ].filter(Boolean).map(normalizeForMatch)

  if (candidates.length === 0) return null

  for (const table of tables) {
    for (const row of table.rows) {
      if (row.length < 2) continue
      const label = normalizeForMatch(row[0])
      if (!label) continue
      if (!candidates.some(c => label.includes(c) || c.includes(label))) continue

      const values: string[] = []
      for (let i = 1; i < row.length; i++) {
        const cell = row[i]
        const numMatch = cell.match(/-?\d+(?:\.\d+)?/)
        if (numMatch) values.push(numMatch[0])
      }
      if (values.length === 0) continue

      if (rule.preConditions) {
        const condNumbers = rule.preConditions.match(/\d+#?/g)
        if (condNumbers && condNumbers.length > 0) {
          return values.slice(0, condNumbers.length)
        }
      }
      return values
    }
  }
  return null
}

// ---------- Hook ----------

export function usePhotoOCR() {
  const [results, setResults] = useState<OCRResultItem[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editSampleName, setEditSampleName] = useState('')
  const [editEntrustNo, setEditEntrustNo] = useState('')
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewItem, setPreviewItem] = useState<OCRResultItem | null>(null)
  const [loading, setLoading] = useState(false)

  const [archiveSelectedKeys, setArchiveSelectedKeys] = useState<React.Key[]>([])
  const [resultSelectedKeys, setResultSelectedKeys] = useState<React.Key[]>([])
  const [archiveFilter, setArchiveFilter] = useState({ fileName: '', testItem: '', status: '', includeInReport: '' })
  const [resultFilter, setResultFilter] = useState({ fileName: '', testItem: '', judgment: '', status: '' })

  const refreshList = useCallback(async () => {
    try {
      setLoading(true)
      const items = await listPhotos()
      setResults(items.map(archivedToItem))
    } catch (err) {
      console.error('[OCR] 加载归档失败:', err)
      message.error(`加载归档失败：${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refreshList() }, [refreshList])

  const handleUpload = useCallback(async (file: File) => {
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const preMatchedRule = ocrRules.find(r => {
      if (!r.hasImage) return false
      const item = r.testItem.toLowerCase()
      return file.name.toLowerCase().includes(item.substring(0, 4))
    })

    const placeholder: OCRResultItem = {
      id: tempId,
      fileName: file.name,
      photoUrl: URL.createObjectURL(file),
      ocrRawText: '',
      matchedRule: preMatchedRule || null,
      testItem: preMatchedRule?.testItem || '识别中...',
      subItem: preMatchedRule?.subItem || '',
      recognizedValue: '',
      standardRequirement: preMatchedRule?.standardRequirement || '',
      judgment: '待判定',
      status: '识别中',
      includeInReport: false,
      sampleName: preMatchedRule?.sampleName || '',
      entrustNo: '',
      progress: 0,
    }
    setResults(prev => [placeholder, ...prev])

    const ocrResult = await recognizeImage(file, (_status, progress) => {
      setResults(prev => prev.map(r =>
        r.id === tempId ? { ...r, progress: progress || r.progress + 10 } : r
      ))
    })

    if (!ocrResult.photoId) {
      setResults(prev => prev.map(r =>
        r.id === tempId ? { ...r, status: '识别失败' as const, error: ocrResult.error, progress: 100 } : r
      ))
      message.error(`${file.name} 归档失败：${ocrResult.error || '未知错误'}`)
      return
    }

    try {
      const archived = await getPhoto(ocrResult.photoId)
      const item = archivedToItem(archived)
      const rawText = archived.ocrRawText
      const matched = matchRule(rawText, archived.originalName) || preMatchedRule || null

      let recognizedValue = ''
      let status: OCRResultItem['status'] = '待确认'

      if (matched) {
        const values = extractValuesFromTables(archived.tables, matched)
          ?? extractValuesFromText(rawText, matched)
        if (values.length > 0) {
          if (matched.calculationMethod === 'average' && values.length > 1) {
            const nums = values.map(Number).filter(n => !isNaN(n))
            if (nums.length > 0) {
              const avg = nums.reduce((a, b) => a + b, 0) / nums.length
              recognizedValue = avg.toFixed(1)
              status = '已识别'
            }
          } else {
            recognizedValue = values[0]
            status = '已识别'
          }
        }
      }

      if (matched?.ruleType === 'qualitative' || matched?.ruleType === 'process') {
        if (rawText.includes('无裂纹') || rawText.includes('不裂')) {
          recognizedValue = '无裂纹'; status = '已识别'
        } else if (rawText.includes('有裂纹') || rawText.includes('裂')) {
          recognizedValue = '有裂纹'; status = '已识别'
        }
      }

      const judgment = matched
        ? judgeResult(recognizedValue, matched.standardRequirement)
        : '待判定'

      const updated = await updatePhotoMeta(archived.id, {
        testItem: matched?.testItem || '未匹配',
        subItem: matched?.subItem || '',
        recognizedValue: recognizedValue || '未识别到数值',
        standardRequirement: matched?.standardRequirement || '',
        judgment,
        status: recognizedValue ? status : '待确认',
        matchedRuleId: matched?.id || null,
        matchedRuleName: matched?.testItem || '',
      })

      if (placeholder.photoUrl.startsWith('blob:')) URL.revokeObjectURL(placeholder.photoUrl)
      setResults(prev => prev.map(r => r.id === tempId ? archivedToItem(updated) : r))
      message.success(`${file.name} 识别完成，已归档`)
    } catch (err) {
      console.error('[OCR] 同步归档失败:', err)
      message.warning(`照片已归档，但同步元数据失败：${err instanceof Error ? err.message : ''}`)
    }
  }, [])

  const handleConfirm = useCallback(async (id: string) => {
    const item = results.find(r => r.id === id)
    if (!item) return
    const judgment = item.matchedRule
      ? judgeResult(item.recognizedValue, item.matchedRule.standardRequirement)
      : '待判定'
    try {
      const updated = await updatePhotoMeta(id, { status: '已识别', judgment, includeInReport: true })
      setResults(prev => prev.map(r => r.id === id ? archivedToItem(updated) : r))
      message.success('已确认，已纳入报告')
    } catch (err) {
      message.error(`确认失败：${err instanceof Error ? err.message : ''}`)
    }
  }, [results])

  const handleEdit = useCallback((id: string) => {
    const item = results.find(r => r.id === id)
    if (item) {
      setEditingId(id)
      setEditValue(item.recognizedValue)
      setEditSampleName(item.sampleName || item.matchedRule?.sampleName || '')
      setEditEntrustNo(item.entrustNo || '')
    }
  }, [results])

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return
    const item = results.find(r => r.id === editingId)
    if (!item) return
    const judgment = item.matchedRule
      ? judgeResult(editValue, item.matchedRule.standardRequirement)
      : '待判定'
    try {
      const updated = await updatePhotoMeta(editingId, {
        recognizedValue: editValue, judgment, status: '已识别',
        sampleName: editSampleName.trim(), entrustNo: editEntrustNo.trim(),
      })
      setResults(prev => prev.map(r => r.id === editingId ? archivedToItem(updated) : r))
      setEditingId(null); setEditValue(''); setEditSampleName(''); setEditEntrustNo('')
      message.success('已保存')
    } catch (err) {
      message.error(`保存失败：${err instanceof Error ? err.message : ''}`)
    }
  }, [editingId, editValue, editSampleName, editEntrustNo, results])

  const handleToggleReport = useCallback(async (id: string, checked: boolean) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, includeInReport: checked } : r))
    try {
      await updatePhotoMeta(id, { includeInReport: checked })
    } catch (err) {
      setResults(prev => prev.map(r => r.id === id ? { ...r, includeInReport: !checked } : r))
      message.error(`更新失败：${err instanceof Error ? err.message : ''}`)
    }
  }, [])

  const handleDelete = useCallback((id: string) => {
    Modal.confirm({
      title: '确认删除该归档照片？',
      content: '照片文件与元数据将一并删除，无法恢复。',
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => {
        try {
          await deletePhoto(id)
          setResults(prev => prev.filter(r => r.id !== id))
          setSelectedRowKeys(prev => prev.filter(k => k !== id))
          message.success('已删除')
        } catch (err) {
          message.error(`删除失败：${err instanceof Error ? err.message : ''}`)
        }
      },
    })
  }, [])

  const handlePreview = useCallback((item: OCRResultItem) => {
    setPreviewItem(item); setPreviewVisible(true)
  }, [])

  const handleRetry = useCallback(async (item: OCRResultItem) => {
    try {
      const archived = await getPhoto(item.id)
      setResults(prev => prev.map(r => r.id === item.id ? archivedToItem(archived) : r))
      message.success('已刷新最新状态')
    } catch (err) {
      message.error(`刷新失败：${err instanceof Error ? err.message : ''}`)
    }
  }, [])

  const handleDownload = useCallback((item: OCRResultItem) => {
    window.open(`/api/ocr/photos/${item.id}/download`, '_blank')
  }, [])

  const handleBatchDelete = useCallback(async (ids: string[], scope: 'archive' | 'result') => {
    if (ids.length === 0) return
    Modal.confirm({
      title: `确认删除 ${ids.length} 项归档？`,
      content: '照片文件与元数据将一并删除，无法恢复。',
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => {
        const hide = message.loading(`正在删除 ${ids.length} 项...`, 0)
        try {
          const { success, failed } = await deletePhotosBatch(ids)
          hide()
          if (failed.length === 0) message.success(`已删除 ${success} 项`)
          else message.warning(`已删除 ${success} 项，失败 ${failed.length} 项`)
          setResults(prev => prev.filter(r => !ids.includes(r.id)))
          if (scope === 'archive') setArchiveSelectedKeys(prev => prev.filter(k => !ids.includes(k as string)))
          if (scope === 'result') setResultSelectedKeys(prev => prev.filter(k => !ids.includes(k as string)))
          setSelectedRowKeys(prev => prev.filter(k => !ids.includes(k as string)))
        } catch (err) {
          hide()
          message.error(`批量删除失败：${err instanceof Error ? err.message : ''}`)
        }
      },
    })
  }, [])

  const handleBatchInclude = useCallback(async (ids: string[], include: boolean) => {
    if (ids.length === 0) return
    const hide = message.loading(`${include ? '纳入' : '取消纳入'} ${ids.length} 项...`, 0)
    try {
      await Promise.allSettled(ids.map(id => updatePhotoMeta(id, { includeInReport: include })))
      hide()
      message.success(`已${include ? '纳入' : '取消纳入'} ${ids.length} 项`)
      setResults(prev => prev.map(r => ids.includes(r.id) ? { ...r, includeInReport: include } : r))
    } catch (err) {
      hide()
      message.error(`批量操作失败：${err instanceof Error ? err.message : ''}`)
    }
  }, [])

  const handleExport = useCallback((ids: string[], format: 'csv' | 'json') => {
    const items = results.filter(r => ids.includes(r.id))
    if (items.length === 0) { message.warning('没有可导出的项'); return }
    const exportedAt = new Date().toISOString()
    if (format === 'json') {
      const payload = { exportedAt, total: items.length, items: items.map(r => ({
        id: r.id, fileName: r.fileName, photoUrl: r.photoUrl, testItem: r.testItem,
        subItem: r.subItem, standardRequirement: r.standardRequirement,
        recognizedValue: r.recognizedValue, judgment: r.judgment,
        status: r.status, includeInReport: r.includeInReport, error: r.error,
      }))}
      downloadBlob(JSON.stringify(payload, null, 2), `ocr-results-${Date.now()}.json`, 'application/json')
      return
    }
    const headers = ['ID', '文件名', '检测项目', '判定指标', '标准要求', '识别结果', '判定', '状态', '纳入报告', '原图URL', '错误']
    const escape = (v: any) => { const s = (v ?? '').toString().replace(/"/g, '""'); return /[",\n]/.test(s) ? `"${s}"` : s }
    const rows = items.map(r => [r.id, r.fileName, r.testItem, r.subItem, r.standardRequirement,
      r.recognizedValue, r.judgment, r.status, r.includeInReport ? '是' : '否', r.photoUrl, r.error || '',
    ].map(escape).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    downloadBlob('\ufeff' + csv, `ocr-results-${Date.now()}.csv`, 'text/csv;charset=utf-8')
  }, [results])

  // 筛选列表
  const filteredArchive = useMemo(() => results.filter(r => {
    if (archiveFilter.fileName && !r.fileName.toLowerCase().includes(archiveFilter.fileName.toLowerCase())) return false
    if (archiveFilter.testItem && !r.testItem.includes(archiveFilter.testItem)) return false
    if (archiveFilter.status && r.status !== archiveFilter.status) return false
    if (archiveFilter.includeInReport === 'yes' && !r.includeInReport) return false
    if (archiveFilter.includeInReport === 'no' && r.includeInReport) return false
    return true
  }), [results, archiveFilter])

  const filteredResults = useMemo(() => results.filter(r => {
    if (resultFilter.fileName && !r.fileName.toLowerCase().includes(resultFilter.fileName.toLowerCase())) return false
    if (resultFilter.testItem && !r.testItem.includes(resultFilter.testItem)) return false
    if (resultFilter.judgment && r.judgment !== resultFilter.judgment) return false
    if (resultFilter.status && r.status !== resultFilter.status) return false
    return true
  }), [results, resultFilter])

  // 统计
  const stats = useMemo(() => ({
    total: results.length,
    recognized: results.filter(r => r.status === '已识别').length,
    pending: results.filter(r => r.status === '待确认').length,
    failed: results.filter(r => r.status === '识别失败').length,
    archived: results.filter(r => r.includeInReport).length,
  }), [results])

  return {
    results, selectedRowKeys, setSelectedRowKeys,
    editingId, editValue, setEditValue,
    editSampleName, setEditSampleName, editEntrustNo, setEditEntrustNo,
    previewVisible, setPreviewVisible, previewItem, setPreviewItem,
    loading, archiveSelectedKeys, setArchiveSelectedKeys,
    resultSelectedKeys, setResultSelectedKeys,
    archiveFilter, setArchiveFilter, resultFilter, setResultFilter,
    filteredArchive, filteredResults, stats,
    refreshList, handleUpload, handleConfirm, handleEdit, handleSaveEdit,
    handleToggleReport, handleDelete, handlePreview, handleRetry,
    handleDownload, handleBatchDelete, handleBatchInclude, handleExport,
  }
}

function downloadBlob(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}
