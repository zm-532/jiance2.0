import { useState, useEffect, useMemo } from "react";
import { FileText, Eye, Download, Printer, Camera, Layers, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { reportTemplates, experimentRecords, capabilityItems } from "@/mock/data";
import { listPhotos, getPhotoDownloadUrl, judgeGroup, generateReport as generateReportApi, type ArchivedPhoto } from "@/services/ocr";
import { toast } from "sonner";

export default function ReportGenerate() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<string>("");
  const [reportPhotos, setReportPhotos] = useState<ArchivedPhoto[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (selectedTemplate) {
      listPhotos({ include_in_report: true })
        .then(setReportPhotos)
        .catch(() => setReportPhotos([]));
    }
  }, [selectedTemplate]);

  // 按 group_id 聚合纳入报告的照片
  const groupedReportPhotos = useMemo(() => {
    const groups: Record<string, ArchivedPhoto[]> = {};
    const ungrouped: ArchivedPhoto[] = [];
    reportPhotos.forEach((p) => {
      if (p.group_id) {
        groups[p.group_id] = groups[p.group_id] || [];
        groups[p.group_id].push(p);
      } else {
        ungrouped.push(p);
      }
    });
    return { groups, ungrouped };
  }, [reportPhotos]);

  const template = reportTemplates.find((t) => t.id === selectedTemplate);

  const relatedRecords = selectedTemplate
    ? experimentRecords
    : [];

  const relatedCapabilities = selectedTemplate
    ? capabilityItems
    : [];

  const record = experimentRecords.find((r) => r.id === selectedRecord);

  const handleGenerateWord = async () => {
    if (!selectedTemplate) return;
    setGenerating(true);
    try {
      const blob = await generateReportApi(selectedTemplate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.download = `检测报告_${selectedTemplate}_${timestamp}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("报告已生成并下载");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "报告生成失败");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      {/* Template selection */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">选择报告模板</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>模板名称</TableHead>
                <TableHead className="w-[200px]">报告类型</TableHead>
                <TableHead className="w-[180px]">模板文件</TableHead>
                <TableHead className="w-[80px] text-center">版本</TableHead>
                <TableHead className="w-[200px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportTemplates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium"><FileText className="size-4 inline mr-2 text-primary" />{t.name}</TableCell>
                  <TableCell>{t.reportType}</TableCell>
                  <TableCell className="truncate max-w-[180px]">{t.file}</TableCell>
                  <TableCell className="text-center">{t.version}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setSelectedTemplate(t.id)}>使用此模板</Button>
                      <Button size="sm" variant="outline"><Eye className="size-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Capability table */}
      {selectedTemplate && relatedCapabilities.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold">检测能力表</h3>
              <Badge>{template?.name}</Badge>
              <span className="text-xs text-muted-foreground">共 {relatedCapabilities.length} 项检测能力</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>样品名称</TableHead>
                  <TableHead>检测项目</TableHead>
                  <TableHead>判定标准</TableHead>
                  <TableHead className="text-center">标准要求</TableHead>
                  <TableHead>检测标准</TableHead>
                  <TableHead>检测设备</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatedCapabilities.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="truncate max-w-[120px]">{c.sampleName}</TableCell>
                    <TableCell>{c.testItem}</TableCell>
                    <TableCell className="truncate max-w-[180px]">{c.judgmentStandard}</TableCell>
                    <TableCell className="text-center">{c.standardRequirement}</TableCell>
                    <TableCell className="truncate max-w-[160px]">{c.testStandard}</TableCell>
                    <TableCell className="truncate max-w-[160px]">{c.equipment}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Related records */}
      {selectedTemplate && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold">关联实验数据</h3>
              <Badge>{template?.name}</Badge>
            </div>
            {relatedRecords.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>委托单号</TableHead>
                    <TableHead>样品名称</TableHead>
                    <TableHead>生产厂家</TableHead>
                    <TableHead>检测项目</TableHead>
                    <TableHead className="text-center">判定结果</TableHead>
                    <TableHead>检测结果</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatedRecords.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.entrustNo}</TableCell>
                      <TableCell>{r.sampleName}</TableCell>
                      <TableCell className="truncate max-w-[200px]">{r.manufacturer}</TableCell>
                      <TableCell>{r.testItem}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={r.judgment === "合格" ? "default" : "destructive"}>{r.judgment}</Badge>
                      </TableCell>
                      <TableCell>{r.result}</TableCell>
                      <TableCell>
                        <Button variant="link" size="sm" onClick={() => { setSelectedRecord(r.id); setPreviewVisible(true); }}>
                          生成报告
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">暂无匹配的实验数据，请先在实验数据库中录入数据</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 按组聚合的检测数据 */}
      {selectedTemplate && reportPhotos.length > 0 && Object.keys(groupedReportPhotos.groups).length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="size-4 text-primary" />
              <h3 className="font-semibold">检测项配置组数据（按组聚合）</h3>
              <Badge variant="secondary">{Object.keys(groupedReportPhotos.groups).length} 组</Badge>
            </div>
            {Object.entries(groupedReportPhotos.groups).map(([groupId, groupPhotos]) => {
              const first = groupPhotos[0];
              const groupJudgment = judgeGroup(groupPhotos);
              const maxSampleCount = Math.max(...groupPhotos.map((p) => p.result_values?.length || 0), 0);
              return (
                <div key={groupId} className="border rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{first.sample_name || "未命名"}</span>
                      <Badge variant="outline" className="text-xs">{first.device_key || "未知设备"}</Badge>
                      {first.entrust_no && <span className="text-xs text-muted-foreground">委托号: {first.entrust_no}</span>}
                      <span className="text-xs text-muted-foreground">{groupPhotos.length} 项</span>
                    </div>
                    <Badge variant={groupJudgment === "合格" ? "default" : groupJudgment === "不合格" ? "destructive" : "secondary"}>
                      组判定: {groupJudgment}
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[160px]">检测项</TableHead>
                        <TableHead className="w-[120px]">标准要求</TableHead>
                        {Array.from({ length: maxSampleCount }).map((_, i) => (
                          <TableHead key={i} className="w-[60px] text-center">试样{i + 1}</TableHead>
                        ))}
                        <TableHead className="w-[80px] text-center">结果值</TableHead>
                        <TableHead className="w-[60px] text-center">判定</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupPhotos.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs font-medium">{p.test_item || "-"}</TableCell>
                          <TableCell className="text-xs">{p.standard_requirement || "-"}</TableCell>
                          {Array.from({ length: maxSampleCount }).map((_, i) => (
                            <TableCell key={i} className="text-xs text-center">
                              {p.result_values && p.result_values[i] !== undefined ? p.result_values[i] : "-"}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-semibold text-xs" style={{ color: p.judgment === "合格" ? "#52c41a" : p.judgment === "不合格" ? "#f5222d" : "#faad14" }}>
                            {p.recognized_value || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={p.judgment === "合格" ? "default" : p.judgment === "不合格" ? "destructive" : "secondary"} className="text-[10px]">
                              {p.judgment}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 导出 Word 报告 */}
      {selectedTemplate && reportPhotos.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">导出检测报告</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  将已纳入报告的 {reportPhotos.length} 条检测数据填充到模板并导出为 Word 文件
                </p>
              </div>
              <Button
                onClick={handleGenerateWord}
                disabled={generating}
              >
                {generating ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Download className="size-4 mr-1" />}
                {generating ? "生成中..." : "导出 Word 报告"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OCR photo attachments for report */}
      {selectedTemplate && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="size-4 text-primary" />
              <h3 className="font-semibold">OCR 照片附件</h3>
              <Badge variant="secondary">{reportPhotos.length} 张</Badge>
              <span className="text-xs text-muted-foreground">在「照片OCR」中勾选「纳入报告」的照片将附在此处</span>
            </div>
            {reportPhotos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {reportPhotos.map((p) => (
                  <div key={p.id} className="border rounded-lg overflow-hidden">
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      <img
                        src={p.photo_url}
                        alt={p.original_name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                    <div className="p-2 text-xs space-y-1">
                      <div className="truncate font-medium">{p.original_name}</div>
                      <div className="text-muted-foreground truncate">{p.test_item || "未匹配"} {p.sub_item ? `/ ${p.sub_item}` : ""}</div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold" style={{
                          color: p.judgment === "合格" ? "#52c41a" : p.judgment === "不合格" ? "#f5222d" : "#faad14",
                        }}>{p.recognized_value || "-"}</span>
                        <Badge variant={p.judgment === "合格" ? "default" : p.judgment === "不合格" ? "destructive" : "secondary"} className="text-[10px]">
                          {p.judgment}
                        </Badge>
                      </div>
                      <a href={getPhotoDownloadUrl(p.id)} download={p.original_name} className="text-primary hover:underline inline-flex items-center gap-1">
                        <Download className="size-3" /> 下载原图
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                暂无纳入报告的照片，请前往「照片OCR」页面上传照片并勾选「纳入报告」
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Report preview dialog */}
      <Dialog open={previewVisible} onOpenChange={setPreviewVisible}>
        <DialogContent className="max-w-[800px]">
          <DialogHeader>
            <DialogTitle>检测报告预览</DialogTitle>
          </DialogHeader>
          {record && (
            <div className="bg-muted p-6 rounded-lg">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold">检测报告</h2>
                <div className="text-sm text-muted-foreground">{template?.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm border rounded-lg p-4 bg-white">
                <div><span className="text-muted-foreground">报告编号：</span>RPT-{record.entrustNo}-{Date.now().toString().slice(-6)}</div>
                <div><span className="text-muted-foreground">委托单号：</span>{record.entrustNo}</div>
                <div><span className="text-muted-foreground">样品名称：</span>{record.sampleName}</div>
                <div><span className="text-muted-foreground">规格型号：</span>{record.specModel}</div>
                <div className="col-span-2"><span className="text-muted-foreground">生产厂家：</span>{record.manufacturer}</div>
                <div><span className="text-muted-foreground">检测项目：</span>{record.testItem}</div>
                <div><span className="text-muted-foreground">判定标准：</span>{relatedCapabilities.find(c => c.testItem === record.testItem)?.judgmentStandard || '-'}</div>
                <div><span className="text-muted-foreground">标准要求：</span>{record.requirement}</div>
                <div>
                  <span className="text-muted-foreground">检测结果：</span>
                  <span className="font-semibold" style={{ color: record.judgment === "合格" ? "#52c41a" : "#f5222d" }}>{record.result}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">单项判定：</span>
                  <Badge variant={record.judgment === "合格" ? "default" : "destructive"} className="text-sm">{record.judgment}</Badge>
                </div>
                <div><span className="text-muted-foreground">检测日期：</span>{record.date}</div>
                <div><span className="text-muted-foreground">所属项目：</span>{record.project}</div>
              </div>
              {reportPhotos.length > 0 && (
                <div className="mt-4 border rounded-lg p-4 bg-white">
                  <h4 className="font-semibold text-sm mb-2">附件：OCR 检测照片 ({reportPhotos.length} 张)</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {reportPhotos.map((p) => (
                      <div key={p.id} className="text-xs border rounded p-1.5">
                        <div className="aspect-video bg-muted rounded mb-1 overflow-hidden">
                          <img src={p.photo_url} alt={p.original_name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </div>
                        <div className="truncate">{p.test_item || p.original_name}</div>
                        <div className="flex justify-between">
                          <span>{p.recognized_value || "-"}</span>
                          <Badge variant={p.judgment === "合格" ? "default" : p.judgment === "不合格" ? "destructive" : "secondary"} className="text-[10px]">{p.judgment}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-center text-xs text-muted-foreground mt-4">
                此报告由系统自动生成 | 宜塔报告模板 {template?.version}
                <br />
                当前缺少 Word 模板字段映射和后端导出服务，暂不生成最终报告文件。
              </div>
            </div>
          )}
          <DialogFooter>
            <Tooltip>
              <TooltipTrigger asChild>
                <span><Button variant="outline" disabled><Printer className="size-4 mr-1" /> 打印</Button></span>
              </TooltipTrigger>
              <TooltipContent>打印功能暂未开放</TooltipContent>
            </Tooltip>
            <Button
              onClick={handleGenerateWord}
              disabled={generating || reportPhotos.length === 0}
            >
              {generating ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Download className="size-4 mr-1" />}
              {generating ? "生成中..." : "导出Word"}
            </Button>
            <Button variant="secondary" onClick={() => setPreviewVisible(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
