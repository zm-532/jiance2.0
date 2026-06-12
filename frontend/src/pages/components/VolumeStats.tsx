import { useState } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { monthlyTestVolume, manufacturers } from "@/mock/data";

type TimeDimension = "year" | "quarter" | "month" | "week" | "custom";

export default function VolumeStats() {
  const [dimension, setDimension] = useState<TimeDimension>("month");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  const getChartData = () => {
    let data = [...monthlyTestVolume];
    if (dimension === "quarter") {
      const quarters: Record<string, { total: number; qualified: number; unqualified: number }> = {};
      data.forEach((d: any) => {
        const month = parseInt(d.month.split("-")[1]);
        const q = Math.ceil(month / 3);
        const key = `${d.month.split("-")[0]}Q${q}`;
        if (!quarters[key]) quarters[key] = { total: 0, qualified: 0, unqualified: 0 };
        quarters[key].total += d.total; quarters[key].qualified += d.qualified; quarters[key].unqualified += d.unqualified;
      });
      return Object.entries(quarters).map(([k, v]) => ({ label: k, ...v }));
    }
    if (dimension === "year") {
      const years: Record<string, { total: number; qualified: number; unqualified: number }> = {};
      data.forEach((d: any) => {
        const year = d.month.split("-")[0];
        if (!years[year]) years[year] = { total: 0, qualified: 0, unqualified: 0 };
        years[year].total += d.total; years[year].qualified += d.qualified; years[year].unqualified += d.unqualified;
      });
      return Object.entries(years).map(([k, v]) => ({ label: k, ...v }));
    }
    return data.map((d: any) => ({ label: d.month, total: d.total, qualified: d.qualified, unqualified: d.unqualified }));
  };

  const chartData = getChartData();
  const totalTests = chartData.reduce((s, d) => s + d.total, 0);
  const totalQualified = chartData.reduce((s, d) => s + d.qualified, 0);

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
    xAxis: { type: "category" as const, data: monthlyTestVolume.map((d: any) => d.month), axisLabel: { rotate: 30 } },
    yAxis: [
      { type: "value" as const, name: "检测量", splitLine: { lineStyle: { type: "dashed" as const, color: "#f0f0f0" } } },
      { type: "value" as const, name: "合格率(%)", max: 100, splitLine: { show: false } },
    ],
    series: [
      {
        name: "检测量", type: "bar" as const, data: monthlyTestVolume.map((d: any) => d.total),
        itemStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#4096ff" }, { offset: 1, color: "#0958d9" }] }, borderRadius: [4, 4, 0, 0] },
        barWidth: 20,
      },
      {
        name: "合格率", type: "line" as const, yAxisIndex: 1, smooth: 0.4, symbol: "circle", symbolSize: 8,
        data: monthlyTestVolume.map((d: any) => +((d.qualified / d.total) * 100).toFixed(1)),
        itemStyle: { color: "#52c41a" }, lineStyle: { width: 3 },
      },
    ],
  };

  return (
    <div>
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div>
          <div className="text-sm text-muted-foreground mb-2">时间维度</div>
          <Select value={dimension} onValueChange={(v) => setDimension(v as TimeDimension)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="year">年度</SelectItem>
              <SelectItem value="quarter">季度</SelectItem>
              <SelectItem value="month">月度</SelectItem>
              <SelectItem value="week">周度</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-2">供应商筛选</div>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-full"><SelectValue placeholder="全部供应商" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部供应商</SelectItem>
              {manufacturers.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-2">检测量</div>
          <div className="text-2xl font-bold">{totalTests} 批次</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-2">合格率</div>
          <div className="text-2xl font-bold text-green-600">{totalTests > 0 ? +((totalQualified / totalTests) * 100).toFixed(1) : 0}%</div>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">{dimension === "year" ? "年度" : dimension === "quarter" ? "季度" : "月度"}检测量统计</h3>
          <ReactECharts option={barOption} style={{ height: 320 }} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">检测趋势与合格率</h3>
          <ReactECharts option={trendOption} style={{ height: 320 }} />
        </CardContent>
      </Card>
    </div>
  );
}
