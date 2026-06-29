import { useState, useRef, useEffect, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  fetchVolumeStats,
  fetchVolumeTrend,
  fetchVolumeBySupplier,
  fetchManufacturers,
  type VolumeData,
  type MonthlyVolume,
  type VolumeBySupplierData,
} from "@/services/stats";

type TimeDimension = "year" | "quarter" | "month" | "week" | "custom";

const COLORS = [
  "#1677ff", "#52c41a", "#faad14", "#ff4d4f", "#722ed1",
  "#13c2c2", "#eb2f96", "#fa8c16", "#2f54eb", "#a0d911",
];

function shortName(name: string, max = 12): string {
  return name.length > max ? name.slice(0, max) + "…" : name;
}

export default function VolumeStats() {
  const [dimension, setDimension] = useState<TimeDimension>("month");
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ---- API state ----
  const [volumeData, setVolumeData] = useState<VolumeData[]>([]);
  const [trendData, setTrendData] = useState<MonthlyVolume[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<VolumeBySupplierData | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Load manufacturers and trend data on mount
  useEffect(() => {
    fetchManufacturers()
      .then(setManufacturers)
      .catch((err) => console.error("获取厂家列表失败:", err));
    fetchVolumeTrend()
      .then(setTrendData)
      .catch((err) => console.error("获取检测趋势失败:", err));
  }, []);

  // Fetch volume stats when dimension / start_month / end_month changes
  useEffect(() => {
    setLoading(true);
    const params: { dimension?: string; start_month?: string; end_month?: string } = {};
    if (dimension === "custom") {
      params.dimension = "month";
      if (customStart) params.start_month = customStart;
      if (customEnd) params.end_month = customEnd;
    } else {
      params.dimension = dimension;
    }
    fetchVolumeStats(params)
      .then(setVolumeData)
      .catch((err) => {
        console.error("获取检测量统计失败:", err);
        setVolumeData([]);
      })
      .finally(() => setLoading(false));
  }, [dimension, customStart, customEnd]);

  // Fetch supplier comparison when 2+ suppliers selected
  useEffect(() => {
    if (selectedSuppliers.length < 2) {
      setComparisonData(null);
      return;
    }
    const dim = dimension === "custom" ? "month" : dimension;
    fetchVolumeBySupplier(selectedSuppliers, dim)
      .then(setComparisonData)
      .catch((err) => {
        console.error("获取供应商对比失败:", err);
        setComparisonData(null);
      });
  }, [selectedSuppliers, dimension]);

  const toggleSupplier = (m: string) => {
    setSelectedSuppliers((prev) =>
      prev.includes(m) ? prev.filter((s) => s !== m) : prev.length < 10 ? [...prev, m] : prev
    );
  };

  // Aggregate chart data (overall) — uses volumeData from API
  const getChartData = (): VolumeData[] => {
    return volumeData;
  };

  const chartData = getChartData();
  const totalTests = chartData.reduce((s, d) => s + d.total, 0);
  const totalQualified = chartData.reduce((s, d) => s + d.qualified, 0);

  // ---- Supplier comparison chart option ----
  const comparisonOption = useMemo(() => {
    if (!comparisonData) return null;
    const { periods, grouped, suppliers } = comparisonData;

    const series = suppliers.map((mfr, idx) => ({
      name: shortName(mfr),
      type: "bar" as const,
      data: periods.map((p) => grouped[p]?.[mfr]?.total || 0),
      itemStyle: { color: COLORS[idx % COLORS.length], borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 24,
    }));

    return {
      tooltip: {
        trigger: "axis" as const,
        formatter: (params: any[]) => {
          let html = `<b>${params[0].axisValue}</b><br/>`;
          params.forEach((p: any) => {
            html += `${p.marker} ${p.seriesName}: ${p.value} 批次<br/>`;
          });
          return html;
        },
      },
      legend: {
        data: suppliers.map((m) => shortName(m)),
        bottom: 0,
        type: "scroll" as const,
        icon: "circle",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { fontSize: 11 },
      },
      grid: { left: "3%", right: "4%", bottom: "12%", top: "5%", containLabel: true },
      xAxis: {
        type: "category" as const,
        data: periods,
        axisLabel: { rotate: periods.length > 6 ? 30 : 0, fontSize: 11 },
      },
      yAxis: { type: "value" as const, name: "检测量（批次）", splitLine: { lineStyle: { type: "dashed" as const, color: "#f0f0f0" } } },
      series,
    };
  }, [comparisonData]);

  // ---- Original aggregate bar chart ----
  const barOption = {
    tooltip: { trigger: "axis" as const },
    legend: { data: ["总检测量", "合格", "不合格"], bottom: 0, icon: "circle", itemWidth: 10, itemHeight: 10 },
    grid: { left: "3%", right: "4%", bottom: "10%", top: "5%", containLabel: true },
    xAxis: { type: "category" as const, data: chartData.map((d) => d.label), axisLabel: { rotate: chartData.length > 6 ? 30 : 0 } },
    yAxis: { type: "value" as const, splitLine: { lineStyle: { type: "dashed" as const, color: "#f0f0f0" } } },
    series: [
      { name: "总检测量", type: "bar" as const, data: chartData.map((d) => d.total), itemStyle: { color: "#1677ff", borderRadius: [4, 4, 0, 0] }, barWidth: chartData.length > 6 ? 20 : 40 },
      { name: "合格", type: "bar" as const, data: chartData.map((d) => d.qualified), itemStyle: { color: "#52c41a", borderRadius: [4, 4, 0, 0] }, barWidth: chartData.length > 6 ? 20 : 40 },
      { name: "不合格", type: "bar" as const, data: chartData.map((d) => d.unqualified), itemStyle: { color: "#ff4d4f", borderRadius: [4, 4, 0, 0] }, barWidth: chartData.length > 6 ? 20 : 40 },
    ],
  };

  const trendOption = {
    tooltip: { trigger: "axis" as const },
    legend: { data: ["检测量", "合格率"], bottom: 0, icon: "circle", itemWidth: 10, itemHeight: 10 },
    grid: { left: "3%", right: "5%", bottom: "10%", top: "5%", containLabel: true },
    xAxis: { type: "category" as const, data: trendData.map((d) => d.month), axisLabel: { rotate: 30 } },
    yAxis: [
      { type: "value" as const, name: "检测量", splitLine: { lineStyle: { type: "dashed" as const, color: "#f0f0f0" } } },
      { type: "value" as const, name: "合格率(%)", max: 100, splitLine: { show: false } },
    ],
    series: [
      {
        name: "检测量", type: "bar" as const, data: trendData.map((d) => d.total),
        itemStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#4096ff" }, { offset: 1, color: "#0958d9" }] }, borderRadius: [4, 4, 0, 0] },
        barWidth: 20,
      },
      {
        name: "合格率", type: "line" as const, yAxisIndex: 1, smooth: 0.4, symbol: "circle", symbolSize: 8,
        data: trendData.map((d) => (d.total > 0 ? +((d.qualified / d.total) * 100).toFixed(1) : 0)),
        itemStyle: { color: "#52c41a" }, lineStyle: { width: 3 },
      },
    ],
  };

  const dimLabel = dimension === "year" ? "年度" : dimension === "quarter" ? "季度" : dimension === "month" ? "月度" : dimension === "week" ? "周度" : "自定义";

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div>
          <div className="text-sm text-muted-foreground mb-2">时间维度</div>
          <Select value={dimension} onValueChange={(v) => setDimension(v as TimeDimension)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="year">年度</SelectItem>
              <SelectItem value="quarter">季度</SelectItem>
              <SelectItem value="month">月度</SelectItem>
              <SelectItem value="week">周度</SelectItem>
              <SelectItem value="custom">自定义</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div ref={dropdownRef} className="relative">
          <div className="text-sm text-muted-foreground mb-2">供应商对比（选2家以上）</div>
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span className="truncate">
              {selectedSuppliers.length === 0 ? "全部供应商" : `已选 ${selectedSuppliers.length} 家`}
            </span>
            <svg className="h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>

          {dropdownOpen && (
            <div className="absolute z-50 mt-1 w-full min-w-[280px] rounded-md border bg-popover text-popover-foreground shadow-md" style={{ maxHeight: 320, overflowY: "auto" }}>
              <div className="sticky top-0 bg-popover border-b px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">最多可选10家供应商</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setSelectedSuppliers(manufacturers.slice(0, 10))}
                  >
                    全选(前10)
                  </button>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setSelectedSuppliers([])}
                  >
                    清空
                  </button>
                </div>
              </div>
              {manufacturers.map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedSuppliers.includes(m)}
                    onChange={() => toggleSupplier(m)}
                    className="rounded border-gray-300"
                  />
                  <span className="truncate">{m}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-2">检测量</div>
          <div className="text-2xl font-bold">{loading ? "加载中…" : `${totalTests} 批次`}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-2">合格率</div>
          <div className="text-2xl font-bold text-green-600">{totalTests > 0 ? +((totalQualified / totalTests) * 100).toFixed(1) : 0}%</div>
        </div>
      </div>

      {/* Custom date range inputs */}
      {dimension === "custom" && (
        <div className="flex items-end gap-4 mb-4">
          <div>
            <div className="text-sm text-muted-foreground mb-2">起始月份</div>
            <Input type="month" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-[160px]" />
          </div>
          <span className="text-sm text-muted-foreground pb-2">至</span>
          <div>
            <div className="text-sm text-muted-foreground mb-2">结束月份</div>
            <Input type="month" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-[160px]" />
          </div>
        </div>
      )}

      {/* Selected supplier badges */}
      {selectedSuppliers.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {selectedSuppliers.map((s) => (
            <Badge key={s} variant="secondary" className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground" onClick={() => toggleSupplier(s)}>
              {shortName(s, 16)} ✕
            </Badge>
          ))}
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">{dimLabel}检测量统计</h3>
          <ReactECharts option={barOption} style={{ height: 320 }} />
        </CardContent>
      </Card>

      {/* Supplier comparison chart */}
      {comparisonData && comparisonOption && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">供应商检测量对比（{dimLabel}）</h3>
            <ReactECharts option={comparisonOption} style={{ height: 380 }} />
          </CardContent>
        </Card>
      )}
      {selectedSuppliers.length === 1 && (
        <div className="text-sm text-muted-foreground text-center py-4 mb-6 bg-muted rounded-lg">
          请选择至少2家供应商以显示对比图
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">检测趋势与合格率</h3>
          <ReactECharts option={trendOption} style={{ height: 320 }} />
        </CardContent>
      </Card>
    </div>
  );
}
