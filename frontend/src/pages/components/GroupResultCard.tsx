import { useState } from "react";
import { ChevronDown, ChevronRight, Camera, Eye, Trash2, Download, AlertTriangle, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPhotoDownloadUrl, judgeResult, judgeGroup, type ArchivedPhoto, type PhotoUpdate } from "@/services/ocr";
import FrequencyChart from "./FrequencyChart";
import ManualEditDialog from "./ManualEditDialog";

interface GroupResultCardProps {
  groupId: string;
  photos: ArchivedPhoto[];
  onUpdate: (id: string, patch: PhotoUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPreview: (photo: ArchivedPhoto) => void;
}

/**
 * 检测项配置组结果卡片：按 group_id 聚合展示同一次测试的多个检测项。
 */
export default function GroupResultCard({ groupId, photos, onUpdate, onDelete, onPreview }: GroupResultCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [manualEditPhoto, setManualEditPhoto] = useState<ArchivedPhoto | null>(null);

  if (photos.length === 0) return null;

  // 组信息取第一条记录
  const first = photos[0];
  const groupLabel = first.sample_name || "未命名样品";
  const deviceName = first.device_key || "未知设备";
  const entrustNo = first.entrust_no || "";

  // 原始照片（有真实文件名的记录，排除 child_ 开头的子记录）
  const originalPhoto = photos.find((p) => p.filename && !p.filename.startsWith("child_"));

  // 组级别判定：使用 judgeGroup 函数
  const groupJudgment = judgeGroup(photos);

  // 计算最大试样数（用于动态表头）
  const maxSampleCount = Math.max(...photos.map((p) => p.result_values?.length || 0), 0);

  // 声学频率数据（取第一条有 frequency_data 的记录）
  const frequencyData = photos.find((p) => p.frequency_data && p.frequency_data.length > 0)?.frequency_data;

  // 检测识别失败或缺失值的照片
  const problemPhotos = photos.filter((p) => !p.recognized_value || !!p.error);

  const handleToggleInclude = async (photo: ArchivedPhoto) => {
    await onUpdate(photo.id, { include_in_report: !photo.include_in_report });
  };

  const handleConfirm = async (photo: ArchivedPhoto) => {
    const judgment = photo.standard_requirement
      ? judgeResult(photo.recognized_value || "", photo.standard_requirement, photo.material_spec || undefined)
      : "待判定";
    await onUpdate(photo.id, { status: "已识别", judgment, include_in_report: true });
  };

  return (
    <div className="border rounded-lg overflow-hidden mb-4">
      {/* 组标题栏 */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-wrap">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <span className="font-semibold text-sm">{groupLabel}</span>
          <Badge variant="outline" className="text-xs">{deviceName}</Badge>
          {entrustNo && <span className="text-xs text-muted-foreground">委托号: {entrustNo}</span>}
          <span className="text-xs text-muted-foreground">{photos.length} 个检测项</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={groupJudgment === "合格" ? "default" : groupJudgment === "不合格" ? "destructive" : "secondary"}>
            组判定: {groupJudgment}
          </Badge>
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="p-4">
          {/* 识别失败/缺失值警告 */}
          {problemPhotos.length > 0 && (
            <div className="flex items-start gap-2 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <AlertTriangle className="size-4 mt-0.5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-amber-800">
                  {problemPhotos.length} 个检测项未识别到有效数据
                </div>
                <div className="text-xs text-amber-600 mt-1">
                  建议重新上传更清晰的照片，或点击下方“手动填写”按钮人工录入数据
                </div>
              </div>
            </div>
          )}

          {/* 原始照片预览 */}
          {originalPhoto && (
            <div className="flex items-center gap-3 mb-3 pb-3 border-b">
              <Camera className="size-4 text-muted-foreground" />
              <img
                src={originalPhoto.photo_url}
                alt={originalPhoto.original_name}
                className="w-20 h-14 object-cover rounded border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="text-xs text-muted-foreground flex-1">
                <div className="truncate font-medium">{originalPhoto.original_name}</div>
                <div>上传时间: {new Date(originalPhoto.uploaded_at).toLocaleString()}</div>
              </div>
              <a href={getPhotoDownloadUrl(originalPhoto.id)} download={originalPhoto.original_name}>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <Download className="size-3 mr-1" /> 下载原图
                </Button>
              </a>
            </div>
          )}

          {/* 检测项表格 */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">检测项</TableHead>
                <TableHead className="w-[120px]">标准要求</TableHead>
                {Array.from({ length: maxSampleCount }).map((_, i) => (
                  <TableHead key={i} className="w-[70px] text-center">试样{i + 1}</TableHead>
                ))}
                <TableHead className="w-[100px] text-center">结果值</TableHead>
                <TableHead className="w-[70px] text-center">判定</TableHead>
                <TableHead className="w-[70px] text-center">状态</TableHead>
                <TableHead className="w-[60px] text-center">报告</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {photos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{p.test_item || "-"}</div>
                    {p.sub_item && <div className="text-xs text-muted-foreground">{p.sub_item}</div>}
                  </TableCell>
                  <TableCell className="text-xs text-center">{p.standard_requirement || "-"}</TableCell>
                  {Array.from({ length: maxSampleCount }).map((_, i) => (
                    <TableCell key={i} className="text-xs text-center">
                      {p.result_values && p.result_values[i] !== undefined ? p.result_values[i] : "-"}
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    <span
                      className="font-semibold text-sm"
                      style={{
                        color: p.status === "已识别" ? "#52c41a" : p.status === "待确认" ? "#faad14" : "#f5222d",
                      }}
                    >
                      {p.recognized_value || "-"}
                    </span>
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
                    <Switch checked={p.include_in_report} onCheckedChange={() => handleToggleInclude(p)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {(!p.recognized_value || !!p.error) && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-7 px-1 text-xs text-amber-600"
                          onClick={() => setManualEditPhoto(p)}
                        >
                          <Pencil className="size-3 mr-0.5" /> 手动填写
                        </Button>
                      )}
                      {p.status === "待确认" && p.recognized_value && (
                        <Button variant="link" size="sm" className="h-7 px-1 text-xs" onClick={() => handleConfirm(p)}>
                          确认
                        </Button>
                      )}
                      <Button variant="link" size="sm" className="h-7 px-1 text-xs" onClick={() => onPreview(p)}>
                        <Eye className="size-3" />
                      </Button>
                      {p.filename && !p.filename.startsWith("child_") && (
                        <Button variant="link" size="sm" className="h-7 px-1 text-xs text-destructive" onClick={() => onDelete(p.id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* 手动填写对话框 */}
          {manualEditPhoto && (
            <ManualEditDialog
              photo={manualEditPhoto}
              open={!!manualEditPhoto}
              onOpenChange={(open) => { if (!open) setManualEditPhoto(null); }}
              onSave={onUpdate}
            />
          )}

          {/* 声学频率子表 + 折线图 */}
          {frequencyData && frequencyData.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold text-sm mb-2">1/3 倍频程频率数据（声学设备）</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>频率 (Hz)</TableHead>
                        <TableHead className="text-center">吸声系数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {frequencyData.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{row.frequency}</TableCell>
                          <TableCell className="text-xs text-center font-medium">{row.coefficient.toFixed(3)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <FrequencyChart data={frequencyData} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
