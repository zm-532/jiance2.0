import { useState } from "react";
import { FileText, Eye, Download, Printer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { reportTemplates, experimentRecords, capabilityItems } from "@/mock/data";

export default function ReportGenerate() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<string>("");

  const template = reportTemplates.find((t) => t.id === selectedTemplate);

  const relatedRecords = selectedTemplate && template
    ? experimentRecords.filter((r) => {
        const cat = template.category;
        if (cat === "金属屏体") return r.sampleName.includes("屏体") || r.sampleName.includes("金属");
        if (cat === "亚克力") return r.sampleName.includes("亚克力") || r.sampleName.includes("透明");
        return r.sampleName.includes(cat);
      })
    : [];

  const relatedCapabilities = selectedTemplate && template
    ? capabilityItems.filter((c) => {
        const cat = template.category;
        if (cat === "金属屏体") return c.sampleName.includes("金属屏体");
        if (cat === "亚克力") return c.sampleName === "亚克力" || c.sampleName.includes("透明屏体");
        return c.sampleName.includes(cat);
      })
    : [];

  const record = experimentRecords.find((r) => r.id === selectedRecord);

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
                <TableHead className="w-[120px]">适用类别</TableHead>
                <TableHead className="w-[180px]">模板文件</TableHead>
                <TableHead className="w-[80px] text-center">版本</TableHead>
                <TableHead className="w-[200px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportTemplates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium"><FileText className="size-4 inline mr-2 text-primary" />{t.name}</TableCell>
                  <TableCell>{t.category}</TableCell>
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
                <div><span className="text-muted-foreground">判定标准：</span>{template?.category}</div>
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
              <div className="text-center text-xs text-muted-foreground mt-4">
                此报告由系统自动生成 | 宜塔报告模板 {template?.version}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline"><Printer className="size-4 mr-1" /> 打印</Button>
            <Button><Download className="size-4 mr-1" /> 导出Word</Button>
            <Button variant="secondary" onClick={() => setPreviewVisible(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
