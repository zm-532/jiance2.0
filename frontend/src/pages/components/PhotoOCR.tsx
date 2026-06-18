import { useState, useCallback, useEffect } from "react";
import {
  Upload, Eye, Trash2, CheckCircle, Edit, RefreshCw, Download,
  Search, CheckSquare, Square, X, FileDown,
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
import {
  recognizeImage, listPhotos, updatePhotoMeta, deletePhoto, deletePhotosBatch,
  getPhotoDownloadUrl, judgeResult,
  type ArchivedPhoto, type PhotoUpdate,
} from "@/services/ocr";

type UploadingItem = {
  id: string;
  fileName: string;
  progress: number;
  status: "上传中" | "识别中" | "完成" | "失败";
  error?: string;
};

export default function PhotoOCR() {
  // Archived photos from backend
  const [photos, setPhotos] = useState<ArchivedPhoto[]>([]);
  const [loading, setLoading] = useState(false);

  // Upload tracking
  const [uploading, setUploading] = useState<UploadingItem[]>([]);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [judgmentFilter, setJudgmentFilter] = useState<string>("all");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<"sample_name" | "entrust_no" | "recognized_value">("sample_name");
  const [editValue, setEditValue] = useState("");

  // Detail dialog
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewItem, setPreviewItem] = useState<ArchivedPhoto | null>(null);

  // Load photos from backend
  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPhotos();
      setPhotos(data);
    } catch {
      toast.error("加载照片列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  // Upload handler
  const handleUpload = useCallback(async (file: File) => {
    const uploadId = `up_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const item: UploadingItem = { id: uploadId, fileName: file.name, progress: 0, status: "上传中" };
    setUploading((prev) => [item, ...prev]);

    const result = await recognizeImage(file, (status, progress) => {
      setUploading((prev) =>
        prev.map((u) => u.id === uploadId ? { ...u, progress: progress || 0, status: progress && progress >= 100 ? "完成" : "识别中" } : u)
      );
    });

    if (result.success) {
      setUploading((prev) => prev.map((u) => u.id === uploadId ? { ...u, progress: 100, status: "完成" } : u));
      toast.success(`${file.name} 识别完成`);
      fetchPhotos();
    } else {
      setUploading((prev) => prev.map((u) => u.id === uploadId ? { ...u, progress: 100, status: "失败", error: result.error } : u));
      toast.error(`${file.name} 识别失败: ${result.error}`);
    }
  }, [fetchPhotos]);

  // Clear completed uploads
  const clearUploads = () => {
    setUploading((prev) => prev.filter((u) => u.status !== "完成" && u.status !== "失败"));
  };

  // Filtering
  const filteredPhotos = photos.filter((p) => {
    if (searchText) {
      const s = searchText.toLowerCase();
      if (
        !p.original_name.toLowerCase().includes(s) &&
        !(p.sample_name || "").toLowerCase().includes(s) &&
        !(p.entrust_no || "").toLowerCase().includes(s) &&
        !(p.test_item || "").toLowerCase().includes(s)
      ) return false;
    }
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (judgmentFilter !== "all" && p.judgment !== judgmentFilter) return false;
    return true;
  });

  // Selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPhotos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPhotos.map((p) => p.id)));
    }
  };

  // Inline edit
  const startEdit = (photo: ArchivedPhoto, field: "sample_name" | "entrust_no" | "recognized_value") => {
    setEditingId(photo.id);
    setEditField(field);
    setEditValue((photo as any)[field] || "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const patch: PhotoUpdate = { [editField]: editValue || null };
    try {
      await updatePhotoMeta(editingId, patch);
      toast.success("已保存");
      fetchPhotos();
    } catch {
      toast.error("保存失败");
    }
    setEditingId(null);
    setEditValue("");
  };

  // Toggle include in report
  const toggleInclude = async (photo: ArchivedPhoto) => {
    try {
      await updatePhotoMeta(photo.id, { include_in_report: !photo.include_in_report });
      fetchPhotos();
    } catch {
      toast.error("操作失败");
    }
  };

  // Confirm (set status to 已识别)
  const handleConfirm = async (photo: ArchivedPhoto) => {
    const judgment = photo.standard_requirement
      ? judgeResult(photo.recognized_value || "", photo.standard_requirement)
      : "待判定";
    try {
      await updatePhotoMeta(photo.id, { status: "已识别", judgment, include_in_report: true });
      toast.success("已确认");
      fetchPhotos();
    } catch {
      toast.error("操作失败");
    }
  };

  // Delete single
  const handleDelete = async (id: string) => {
    try {
      await deletePhoto(id);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      toast.success("已删除");
      fetchPhotos();
    } catch {
      toast.error("删除失败");
    }
  };

  // Batch delete
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedIds.size} 张照片？`)) return;
    try {
      const res = await deletePhotosBatch(Array.from(selectedIds));
      toast.success(`成功删除 ${res.success} 张${res.failed > 0 ? `，${res.failed} 张失败` : ""}`);
      setSelectedIds(new Set());
      fetchPhotos();
    } catch {
      toast.error("批量删除失败");
    }
  };

  // Batch include in report
  const handleBatchInclude = async (include: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map((id) => updatePhotoMeta(id, { include_in_report: include })));
      toast.success(`已${include ? "纳入" : "移出"}报告`);
      setSelectedIds(new Set());
      fetchPhotos();
    } catch {
      toast.error("批量操作失败");
    }
  };

  // Retry
  const handleRetry = async (photo: ArchivedPhoto) => {
    // Re-upload the original file — need to fetch it first
    try {
      const res = await fetch(getPhotoDownloadUrl(photo.id));
      if (!res.ok) throw new Error("下载失败");
      const blob = await res.blob();
      const file = new File([blob], photo.original_name, { type: photo.mimetype });
      await handleDelete(photo.id);
      handleUpload(file);
    } catch {
      toast.error("重试失败");
    }
  };

  // Stats
  const stats = {
    total: photos.length,
    recognized: photos.filter((p) => p.status === "已识别").length,
    pending: photos.filter((p) => p.status === "待确认").length,
    failed: photos.filter((p) => p.status === "识别失败").length,
    inReport: photos.filter((p) => p.include_in_report).length,
  };

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

      {/* Uploading progress */}
      {uploading.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">上传进度</h3>
              <Button variant="ghost" size="sm" onClick={clearUploads} className="text-xs">
                <X className="size-3 mr-1" /> 清除已完成
              </Button>
            </div>
            <div className="space-y-2">
              {uploading.map((u) => (
                <div key={u.id} className="flex items-center gap-3 text-sm">
                  <span className="truncate w-[200px]">{u.fileName}</span>
                  <Progress value={u.progress} className="flex-1 h-2" />
                  <Badge variant={u.status === "完成" ? "default" : u.status === "失败" ? "destructive" : "secondary"} className="w-[60px] justify-center">
                    {u.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats cards */}
      {stats.total > 0 && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            { label: "总数", value: stats.total, color: "#1677ff" },
            { label: "已识别", value: stats.recognized, color: "#52c41a" },
            { label: "待确认", value: stats.pending, color: "#faad14" },
            { label: "识别失败", value: stats.failed, color: "#f5222d" },
            { label: "纳入报告", value: stats.inReport, color: "#722ed1" },
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

      {/* Filters + Batch actions */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="搜索文件名/样品/委托编号..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-8 w-[280px] h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] h-9"><SelectValue placeholder="状态" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="已识别">已识别</SelectItem>
                  <SelectItem value="待确认">待确认</SelectItem>
                  <SelectItem value="识别中">识别中</SelectItem>
                  <SelectItem value="识别失败">识别失败</SelectItem>
                </SelectContent>
              </Select>
              <Select value={judgmentFilter} onValueChange={setJudgmentFilter}>
                <SelectTrigger className="w-[120px] h-9"><SelectValue placeholder="判定" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部判定</SelectItem>
                  <SelectItem value="合格">合格</SelectItem>
                  <SelectItem value="不合格">不合格</SelectItem>
                  <SelectItem value="待判定">待判定</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchPhotos} disabled={loading}>
                <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> 刷新
              </Button>
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">已选 {selectedIds.size} 项</span>
                <Button variant="outline" size="sm" onClick={() => handleBatchInclude(true)}>
                  <FileDown className="size-3 mr-1" /> 纳入报告
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBatchInclude(false)}>
                  移出报告
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                  <Trash2 className="size-3 mr-1" /> 批量删除
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results table */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">OCR识别结果</h3>
          {filteredPhotos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {photos.length === 0 ? "暂无识别结果，请上传试验数据照片" : "没有匹配的记录"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <button onClick={toggleSelectAll} className="p-1">
                      {selectedIds.size === filteredPhotos.length && filteredPhotos.length > 0
                        ? <CheckSquare className="size-4" />
                        : <Square className="size-4 text-muted-foreground" />}
                    </button>
                  </TableHead>
                  <TableHead className="w-[160px]">文件名</TableHead>
                  <TableHead className="w-[120px]">样品名称</TableHead>
                  <TableHead className="w-[120px]">委托编号</TableHead>
                  <TableHead className="w-[140px]">检测项目</TableHead>
                  <TableHead className="w-[100px]">标准要求</TableHead>
                  <TableHead className="w-[120px]">识别结果</TableHead>
                  <TableHead className="w-[70px] text-center">判定</TableHead>
                  <TableHead className="w-[80px] text-center">状态</TableHead>
                  <TableHead className="w-[70px] text-center">报告</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPhotos.map((p) => (
                  <TableRow key={p.id} className={selectedIds.has(p.id) ? "bg-muted/50" : ""}>
                    <TableCell>
                      <button onClick={() => toggleSelect(p.id)} className="p-1">
                        {selectedIds.has(p.id)
                          ? <CheckSquare className="size-4 text-primary" />
                          : <Square className="size-4 text-muted-foreground" />}
                      </button>
                    </TableCell>
                    <TableCell className="truncate max-w-[160px] text-sm">{p.original_name}</TableCell>
                    <TableCell>
                      {editingId === p.id && editField === "sample_name" ? (
                        <div className="flex items-center gap-1">
                          <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-7 w-24 text-xs" />
                          <Button variant="link" size="sm" onClick={saveEdit} className="h-7 px-1 text-xs">保存</Button>
                        </div>
                      ) : (
                        <span className="text-sm cursor-pointer hover:text-primary" onDoubleClick={() => startEdit(p, "sample_name")}>
                          {p.sample_name || <span className="text-muted-foreground">-</span>}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === p.id && editField === "entrust_no" ? (
                        <div className="flex items-center gap-1">
                          <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-7 w-24 text-xs" />
                          <Button variant="link" size="sm" onClick={saveEdit} className="h-7 px-1 text-xs">保存</Button>
                        </div>
                      ) : (
                        <span className="text-sm cursor-pointer hover:text-primary" onDoubleClick={() => startEdit(p, "entrust_no")}>
                          {p.entrust_no || <span className="text-muted-foreground">-</span>}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{p.test_item || "-"}</div>
                      {p.sub_item && <div className="text-xs text-muted-foreground">{p.sub_item}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-center">{p.standard_requirement || "-"}</TableCell>
                    <TableCell>
                      {editingId === p.id && editField === "recognized_value" ? (
                        <div className="flex items-center gap-1">
                          <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-7 w-20 text-xs" />
                          <Button variant="link" size="sm" onClick={saveEdit} className="h-7 px-1 text-xs">保存</Button>
                        </div>
                      ) : (
                        <span
                          className="font-semibold text-sm cursor-pointer hover:underline"
                          style={{
                            color: p.status === "已识别" ? "#52c41a" : p.status === "待确认" ? "#faad14" : "#f5222d",
                          }}
                          onDoubleClick={() => startEdit(p, "recognized_value")}
                        >
                          {p.recognized_value || "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.judgment === "合格" ? "default" : p.judgment === "不合格" ? "destructive" : "secondary"}>
                        {p.judgment}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.status === "已识别" ? "default" : p.status === "待确认" ? "secondary" : p.status === "识别中" ? "outline" : "destructive"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={p.include_in_report}
                        onCheckedChange={() => toggleInclude(p)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {p.status === "待确认" && (
                          <Button variant="link" size="sm" className="h-7 px-1 text-xs" onClick={() => handleConfirm(p)}>
                            <CheckCircle className="size-3" /> 确认
                          </Button>
                        )}
                        <Button variant="link" size="sm" className="h-7 px-1 text-xs" onClick={() => startEdit(p, "recognized_value")}>
                          <Edit className="size-3" /> 编辑
                        </Button>
                        <Button variant="link" size="sm" className="h-7 px-1 text-xs" onClick={() => { setPreviewItem(p); setPreviewVisible(true); }}>
                          <Eye className="size-3" /> 详情
                        </Button>
                        <Button variant="link" size="sm" className="h-7 px-1 text-xs" onClick={() => handleRetry(p)}>
                          <RefreshCw className="size-3" /> 重试
                        </Button>
                        <a href={getPhotoDownloadUrl(p.id)} download={p.original_name}>
                          <Button variant="link" size="sm" className="h-7 px-1 text-xs">
                            <Download className="size-3" /> 下载
                          </Button>
                        </a>
                        <Button variant="link" size="sm" className="h-7 px-1 text-xs text-destructive" onClick={() => handleDelete(p.id)}>
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
                <div><span className="text-muted-foreground">文件名：</span>{previewItem.original_name}</div>
                <div><span className="text-muted-foreground">样品名称：</span>{previewItem.sample_name || "-"}</div>
                <div><span className="text-muted-foreground">委托编号：</span>{previewItem.entrust_no || "-"}</div>
                <div><span className="text-muted-foreground">检测项目：</span>{previewItem.test_item || "-"}</div>
                <div><span className="text-muted-foreground">标准要求：</span>{previewItem.standard_requirement || "-"}</div>
                <div>
                  <span className="text-muted-foreground">识别结果：</span>
                  <span className="font-semibold" style={{
                    color: previewItem.judgment === "合格" ? "#52c41a" : previewItem.judgment === "不合格" ? "#f5222d" : "#faad14",
                  }}>{previewItem.recognized_value || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">判定结果：</span>
                  <Badge variant={previewItem.judgment === "合格" ? "default" : previewItem.judgment === "不合格" ? "destructive" : "secondary"}>
                    {previewItem.judgment}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground">上传时间：</span>{new Date(previewItem.uploaded_at).toLocaleString()}</div>
              </div>

              {/* OCR tables */}
              {previewItem.tables && previewItem.tables.length > 0 && (
                <div className="border-t pt-3">
                  <h4 className="font-semibold text-sm mb-2">识别到的表格数据</h4>
                  {previewItem.tables.map((table, ti) => (
                    <div key={ti} className="mb-3 overflow-auto">
                      <table className="w-full border-collapse text-xs">
                        <tbody>
                          {table.rows.map((row, ri) => (
                            <tr key={ri} className={ri === 0 ? "bg-muted font-semibold" : ""}>
                              {row.map((cell, ci) => (
                                <td key={ci} className="border px-2 py-1">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}

              {/* Raw OCR text */}
              <div className="border-t pt-3">
                <h4 className="font-semibold text-sm mb-2">OCR 原始文本</h4>
                <div className="bg-muted p-3 rounded-md max-h-[300px] overflow-auto text-xs whitespace-pre-wrap">
                  {previewItem.ocr_raw_text || "无识别文本"}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t pt-3">
                <a href={getPhotoDownloadUrl(previewItem.id)} download={previewItem.original_name}>
                  <Button variant="outline" size="sm">
                    <Download className="size-3.5 mr-1" /> 下载原图
                  </Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
