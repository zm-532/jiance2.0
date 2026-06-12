import { useState, useCallback } from "react";
import {
  Upload, Eye, Trash2, Camera, CheckCircle, Edit, RefreshCw, X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ocrRules, type OCRRule } from "@/mock/data";
import { recognizeImage, judgeResult, type OCRJobResult } from "@/services/ocr";

interface OCRResultItem {
  id: string;
  fileName: string;
  file: File;
  ocrRawText: string;
  matchedRule: OCRRule | null;
  testItem: string;
  subItem: string;
  recognizedValue: string;
  standardRequirement: string;
  judgment: "合格" | "不合格" | "待判定";
  status: "已识别" | "待确认" | "识别失败" | "识别中";
  includeInReport: boolean;
  progress: number;
  error?: string;
}

export default function PhotoOCR() {
  const [results, setResults] = useState<OCRResultItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewItem, setPreviewItem] = useState<OCRResultItem | null>(null);

  const matchRule = useCallback((rawText: string, fileName: string): OCRRule | null => {
    const text = rawText.toLowerCase();
    const fn = fileName.toLowerCase();
    for (const rule of ocrRules) {
      if (!rule.hasImage) continue;
      const item = rule.testItem.toLowerCase();
      const sub = rule.subItem.toLowerCase();
      if (fn.includes(item.substring(0, 4)) || (sub && fn.includes(sub.substring(0, 3)))) return rule;
    }
    for (const rule of ocrRules) {
      if (!rule.hasImage) continue;
      const req = rule.standardRequirement.replace(/[≥≤<>]/g, "").toLowerCase();
      if (req && text.includes(req)) return rule;
    }
    return null;
  }, []);

  const extractValuesFromText = (text: string, rule: OCRRule): string[] => {
    const values: string[] = [];
    const numberPattern = /[-+]?\d+\.?\d*/g;
    if (rule.recognitionContent) {
      const allNumbers: string[] = [];
      for (const line of text.split("\n")) {
        const matches = line.match(numberPattern);
        if (matches) allNumbers.push(...matches);
      }
      if (rule.preConditions) {
        const condNumbers = rule.preConditions.match(/\d+#?/g);
        if (condNumbers && condNumbers.length > 0) return allNumbers.slice(0, condNumbers.length);
      }
      return allNumbers.slice(0, 5);
    }
    const matches = text.match(numberPattern);
    if (matches) values.push(...matches.slice(0, 5));
    return values;
  };

  const handleUpload = useCallback(async (file: File) => {
    const id = `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const preMatchedRule = ocrRules.find((r) => {
      if (!r.hasImage) return false;
      return file.name.toLowerCase().includes(r.testItem.toLowerCase().substring(0, 4));
    });

    const newItem: OCRResultItem = {
      id, fileName: file.name, file, ocrRawText: "", matchedRule: preMatchedRule || null,
      testItem: preMatchedRule?.testItem || "待识别", subItem: preMatchedRule?.subItem || "",
      recognizedValue: "", standardRequirement: preMatchedRule?.standardRequirement || "",
      judgment: "待判定", status: "识别中", includeInReport: false, progress: 0,
    };

    setResults((prev) => [newItem, ...prev]);

    const ocrResult = await recognizeImage(file, (_status, progress) => {
      setResults((prev) => prev.map((r) => r.id === id ? { ...r, progress: progress || 0 } : r));
    });

    if (!ocrResult.success) {
      setResults((prev) => prev.map((r) => r.id === id ? { ...r, status: "识别失败" as const, error: ocrResult.error, progress: 100 } : r));
      return;
    }

    const rawText = ocrResult.rawText;
    const matchedRule = matchRule(rawText, file.name) || preMatchedRule || null;
    let recognizedValue = "";
    let status: OCRResultItem["status"] = "待确认";

    if (matchedRule) {
      const values = extractValuesFromText(rawText, matchedRule);
      if (values.length > 0) {
        if (matchedRule.calculationMethod === "average" && values.length > 1) {
          const nums = values.map(Number).filter((n) => !isNaN(n));
          if (nums.length > 0) { recognizedValue = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1); status = "已识别"; }
        } else { recognizedValue = values[0]; status = "已识别"; }
      }
    }

    if (matchedRule?.ruleType === "qualitative" || matchedRule?.ruleType === "process") {
      if (rawText.includes("无裂纹") || rawText.includes("不裂")) { recognizedValue = "无裂纹"; status = "已识别"; }
      else if (rawText.includes("有裂纹") || rawText.includes("裂")) { recognizedValue = "有裂纹"; status = "已识别"; }
    }

    const judgment = matchedRule ? judgeResult(recognizedValue, matchedRule.standardRequirement) : "待判定";

    setResults((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      return { ...r, ocrRawText: rawText, matchedRule, testItem: matchedRule?.testItem || "未匹配",
        subItem: matchedRule?.subItem || "", recognizedValue: recognizedValue || "未识别到数值",
        standardRequirement: matchedRule?.standardRequirement || "", judgment,
        status: recognizedValue ? status : "待确认", progress: 100 } as OCRResultItem;
    }));

    toast.success(`${file.name} 识别完成`);
  }, [matchRule]);

  const handleConfirm = (id: string) => {
    setResults((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const judgment = r.matchedRule ? judgeResult(r.recognizedValue, r.matchedRule.standardRequirement) : "待判定";
      return { ...r, status: "已识别", judgment, includeInReport: true };
    }));
    toast.success("已确认");
  };

  const handleEdit = (id: string) => {
    const item = results.find((r) => r.id === id);
    if (item) { setEditingId(id); setEditValue(item.recognizedValue); }
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    setResults((prev) => prev.map((r) => {
      if (r.id !== editingId) return r;
      const judgment = r.matchedRule ? judgeResult(editValue, r.matchedRule.standardRequirement) : "待判定";
      return { ...r, recognizedValue: editValue, judgment, status: "已识别" };
    }));
    setEditingId(null); setEditValue("");
    toast.success("已保存");
  };

  const handleDelete = (id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRetry = (item: OCRResultItem) => {
    handleDelete(item.id);
    handleUpload(item.file);
  };

  const totalItems = results.length;
  const recognizedItems = results.filter((r) => r.status === "已识别").length;
  const pendingItems = results.filter((r) => r.status === "待确认").length;
  const failedItems = results.filter((r) => r.status === "识别失败").length;

  return (
    <div>
      {/* Upload area */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">上传试验数据照片</h3>
          <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:border-primary transition-colors">
            <Upload className="size-10 text-muted-foreground mb-2" />
            <span className="text-sm font-medium">点击或拖拽照片到此区域上传</span>
            <span className="text-xs text-muted-foreground mt-1">支持 JPG、PNG、BMP 格式，系统将自动调用 PaddleOCR 识别</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
              Array.from(e.target.files || []).forEach(handleUpload);
              e.target.value = "";
            }} />
          </label>
        </CardContent>
      </Card>

      {/* Stats */}
      {totalItems > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "总识别数", value: totalItems, color: "#1677ff" },
            { label: "已识别", value: recognizedItems, color: "#52c41a" },
            { label: "待确认", value: pendingItems, color: "#faad14" },
            { label: "识别失败", value: failedItems, color: "#f5222d" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results table */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">OCR识别结果</h3>
          {results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">暂无识别结果，请上传试验数据照片</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">文件名</TableHead>
                  <TableHead className="w-[160px]">检测项目</TableHead>
                  <TableHead className="w-[100px]">标准要求</TableHead>
                  <TableHead className="w-[140px]">识别结果</TableHead>
                  <TableHead className="w-[80px] text-center">判定</TableHead>
                  <TableHead className="w-[90px] text-center">状态</TableHead>
                  <TableHead className="w-[80px] text-center">纳入报告</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="truncate max-w-[180px]">{r.fileName}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{r.testItem}</div>
                      {r.subItem && <div className="text-xs text-muted-foreground">{r.subItem}</div>}
                    </TableCell>
                    <TableCell className="text-center text-sm">{r.standardRequirement || "-"}</TableCell>
                    <TableCell>
                      {r.status === "识别中" ? (
                        <Progress value={r.progress} className="h-2" />
                      ) : editingId === r.id ? (
                        <div className="flex items-center gap-1">
                          <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-7 w-20 text-xs" />
                          <Button variant="link" size="sm" onClick={handleSaveEdit} className="h-7 px-1 text-xs">保存</Button>
                        </div>
                      ) : (
                        <span className="font-semibold text-sm" style={{
                          color: r.status === "已识别" ? "#52c41a" : r.status === "待确认" ? "#faad14" : "#f5222d",
                        }}>{r.recognizedValue || "-"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={r.judgment === "合格" ? "default" : r.judgment === "不合格" ? "destructive" : "secondary"}>
                        {r.judgment}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={r.status === "已识别" ? "default" : r.status === "待确认" ? "secondary" : r.status === "识别中" ? "outline" : "destructive"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={r.includeInReport}
                        onCheckedChange={(checked) => setResults((prev) => prev.map((x) => x.id === r.id ? { ...x, includeInReport: checked } : x))}
                        disabled={r.status === "识别失败" || r.status === "识别中"}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {r.status === "待确认" && (
                          <Button variant="link" size="sm" className="h-7 px-1 text-xs" onClick={() => handleConfirm(r.id)}>
                            <CheckCircle className="size-3" /> 确认
                          </Button>
                        )}
                        <Button variant="link" size="sm" className="h-7 px-1 text-xs" onClick={() => handleEdit(r.id)}>
                          <Edit className="size-3" /> 编辑
                        </Button>
                        <Button variant="link" size="sm" className="h-7 px-1 text-xs" onClick={() => { setPreviewItem(r); setPreviewVisible(true); }}>
                          <Eye className="size-3" /> 详情
                        </Button>
                        <Button variant="link" size="sm" className="h-7 px-1 text-xs" onClick={() => handleRetry(r)}>
                          <RefreshCw className="size-3" /> 重试
                        </Button>
                        <Button variant="link" size="sm" className="h-7 px-1 text-xs text-destructive" onClick={() => handleDelete(r.id)}>
                          <Trash2 className="size-3" /> 删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={previewVisible} onOpenChange={setPreviewVisible}>
        <DialogContent className="max-w-[700px]">
          <DialogHeader>
            <DialogTitle>OCR 识别详情</DialogTitle>
          </DialogHeader>
          {previewItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">文件名：</span>{previewItem.fileName}</div>
                <div><span className="text-muted-foreground">检测项目：</span>{previewItem.testItem}</div>
                <div><span className="text-muted-foreground">标准要求：</span>{previewItem.standardRequirement || "-"}</div>
                <div>
                  <span className="text-muted-foreground">识别结果：</span>
                  <span className="font-semibold" style={{
                    color: previewItem.judgment === "合格" ? "#52c41a" : previewItem.judgment === "不合格" ? "#f5222d" : "#faad14",
                  }}>{previewItem.recognizedValue}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">判定结果：</span>
                  <Badge variant={previewItem.judgment === "合格" ? "default" : previewItem.judgment === "不合格" ? "destructive" : "secondary"}>
                    {previewItem.judgment}
                  </Badge>
                </div>
              </div>
              {previewItem.matchedRule && (
                <div className="grid grid-cols-2 gap-2 text-sm border-t pt-3">
                  <div><span className="text-muted-foreground">检测设备：</span>{previewItem.matchedRule.equipment}</div>
                  <div><span className="text-muted-foreground">样品名称：</span>{previewItem.matchedRule.sampleName}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">判定标准：</span>{previewItem.matchedRule.judgmentStandard}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">检测标准：</span>{previewItem.matchedRule.testStandard}</div>
                </div>
              )}
              <div className="border-t pt-3">
                <h4 className="font-semibold text-sm mb-2">OCR 识别内容</h4>
                <div className="bg-muted p-3 rounded-md max-h-[400px] overflow-auto text-xs whitespace-pre-wrap">
                  {previewItem.ocrRawText || "无识别文本"}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
