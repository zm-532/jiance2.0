import { useState, useEffect, useMemo } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ArchivedPhoto, PhotoUpdate } from "@/services/ocr";

interface ManualEditDialogProps {
  photo: ArchivedPhoto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: PhotoUpdate) => Promise<void>;
}

/** 聚合方式中文标签 */
const AGGREGATION_LABELS: Record<string, string> = {
  average: "平均值",
  median: "中值",
  max: "最大值",
  abs_max: "绝对值最大值",
  single: "直取",
  direct: "直取",
};

/**
 * 客户端聚合计算（与后端 aggregation.py 保持一致）。
 */
function clientAggregate(values: number[], method: string): number | null {
  const clean = values.filter((v) => !isNaN(v) && v !== null && v !== undefined);
  if (clean.length === 0) return null;

  switch (method) {
    case "average":
      return Math.round((clean.reduce((a, b) => a + b, 0) / clean.length) * 100) / 100;
    case "median": {
      const sorted = [...clean].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const med = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      return Math.round(med * 100) / 100;
    }
    case "max":
      return Math.round(Math.max(...clean) * 100) / 100;
    case "abs_max":
      return Math.round(Math.max(...clean.map(Math.abs)) * 100) / 100;
    case "single":
    case "direct":
      return Math.round(clean[0] * 100) / 100;
    default:
      return null;
  }
}

/**
 * 手动填写对话框：当 OCR 未能识别出有效数据时，提供结构化的人工输入表单。
 *
 * 根据 photo 的 sample_count 和 aggregation_method 动态生成输入框，
 * 并实时计算聚合结果。
 */
export default function ManualEditDialog({ photo, open, onOpenChange, onSave }: ManualEditDialogProps) {
  const sampleCount = photo.sample_count || 1;
  const aggregationMethod = photo.aggregation_method || "average";
  const isSingleValue = sampleCount <= 1 || aggregationMethod === "single" || aggregationMethod === "direct";

  // 试样值输入状态
  const [values, setValues] = useState<string[]>([]);
  // 结果值（可手动覆盖）
  const [resultOverride, setResultOverride] = useState<string>("");
  // 是否使用手动覆盖
  const [useOverride, setUseOverride] = useState(false);
  // 保存中
  const [saving, setSaving] = useState(false);

  // 初始化：从已有 result_values 或 recognized_value 回填
  useEffect(() => {
    if (!open) return;

    if (photo.result_values && photo.result_values.length > 0) {
      setValues(photo.result_values.map(String));
    } else {
      setValues(Array(sampleCount).fill(""));
    }

    if (photo.recognized_value) {
      setResultOverride(photo.recognized_value);
      setUseOverride(true);
    } else {
      setResultOverride("");
      setUseOverride(false);
    }
  }, [open, photo, sampleCount]);

  // 自动计算聚合结果
  const autoResult = useMemo(() => {
    if (useOverride && resultOverride !== "") return resultOverride;
    const nums = values.map(Number).filter((v) => !isNaN(v));
    const agg = clientAggregate(nums, aggregationMethod);
    return agg !== null ? String(agg) : "";
  }, [values, aggregationMethod, useOverride, resultOverride]);

  const handleValueChange = (index: number, val: string) => {
    setValues((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
    // 用户修改试样值时取消手动覆盖
    if (useOverride) setUseOverride(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const nums = values.map(Number).filter((v) => !isNaN(v));
      const patch: PhotoUpdate = {
        result_values: nums.length > 0 ? nums : null,
        recognized_value: autoResult || null,
        error: null, // 清除错误提示
      };
      await onSave(photo.id, patch);
      onOpenChange(false);
    } catch {
      // onSave 内部处理 toast
    } finally {
      setSaving(false);
    }
  };

  const hasError = !!photo.error;
  const hasNoValue = !photo.recognized_value;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {(hasError || hasNoValue) && <AlertTriangle className="size-5 text-amber-500" />}
            手动填写检测数据
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 检测项信息 */}
          <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">检测项：</span>
              <span className="font-medium">{photo.test_item || "-"}</span>
              {photo.sub_item && <span className="text-muted-foreground">({photo.sub_item})</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">标准要求：</span>
              <span>{photo.standard_requirement || "-"}</span>
            </div>
            {photo.error && (
              <div className="flex items-center gap-1 text-amber-600 text-xs mt-1">
                <AlertTriangle className="size-3" />
                {photo.error}
              </div>
            )}
          </div>

          {/* 聚合方式提示 */}
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <span>聚合方式：</span>
            <Badge variant="outline" className="text-xs">{AGGREGATION_LABELS[aggregationMethod] || aggregationMethod}</Badge>
            {!isSingleValue && <span>（系统将自动计算{AGGREGATION_LABELS[aggregationMethod]}作为结果值）</span>}
          </div>

          {/* 试样值输入 */}
          {isSingleValue ? (
            <div>
              <label className="text-sm font-medium mb-1 block">结果值</label>
              <Input
                value={values[0] || ""}
                onChange={(e) => handleValueChange(0, e.target.value)}
                placeholder="请输入检测值"
                type="number"
                step="any"
              />
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium mb-2 block">试样值（{sampleCount} 个试样）</label>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: sampleCount }).map((_, i) => (
                  <div key={i}>
                    <label className="text-xs text-muted-foreground">试样 {i + 1}</label>
                    <Input
                      value={values[i] || ""}
                      onChange={(e) => handleValueChange(i, e.target.value)}
                      placeholder="数值"
                      type="number"
                      step="any"
                      className="h-8"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 聚合结果 */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">计算结果值</label>
              <Button
                variant="link"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setUseOverride(!useOverride)}
              >
                {useOverride ? "使用自动计算" : "手动覆盖"}
              </Button>
            </div>
            {useOverride ? (
              <Input
                value={resultOverride}
                onChange={(e) => setResultOverride(e.target.value)}
                placeholder="手动输入结果值"
                className="mt-1"
              />
            ) : (
              <div
                className="mt-1 px-3 py-2 bg-muted rounded-md text-sm font-semibold"
                style={{ color: autoResult ? "#1677ff" : "#94a3b8" }}
              >
                {autoResult || "（请填写试样值后自动计算）"}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            <X className="size-3 mr-1" /> 取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !autoResult}>
            <Check className="size-3 mr-1" /> {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
