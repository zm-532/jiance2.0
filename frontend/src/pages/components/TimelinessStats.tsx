import { useState } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { timelinessData } from "@/mock/data";

export default function TimelinessStats() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [testItemFilter, setTestItemFilter] = useState<string>("all");

  const categories = [...new Set(timelinessData.map((d) => d.category))];

  const baseFiltered = categoryFilter === "all" ? timelinessData : timelinessData.filter((d) => d.category === categoryFilter);
  const availableTestItems = [...new Set(baseFiltered.map((d) => d.testItem))];
  const filtered = testItemFilter === "all" ? baseFiltered : baseFiltered.filter((d) => d.testItem === testItemFilter);

  const overallAvg = filtered.length > 0
    ? +(filtered.reduce((s, d) => s + d.avgDays * d.sampleCount, 0) / filtered.reduce((s, d) => s + d.sampleCount, 0)).toFixed(1)
    : 0;

  const barOption = {
    tooltip: { trigger: "axis" as const, formatter: (params: any) => `${params[0].name}<br/>平均检测时效: ${params[0].value} 天` },
    grid: { left: "3%", right: "4%", bottom: "15%", top: "10%", containLabel: true },
    xAxis: {
      type: "category" as const, data: filtered.map((d) => `${d.category}-${d.testItem}`),
      axisLabel: { rotate: 35, fontSize: 11 }, axisLine: { lineStyle: { color: "#e8e8e8" } },
    },
    yAxis: { type: "value" as const, name: "天数", splitLine: { lineStyle: { type: "dashed" as const, color: "#f0f0f0" } } },
    series: [{
      type: "bar" as const, barWidth: 30,
      data: filtered.map((d) => ({
        value: d.avgDays,
        itemStyle: {
          color: d.avgDays <= 2
            ? { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#73d13d" }, { offset: 1, color: "#389e0d" }] }
            : d.avgDays <= 4
            ? { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#4096ff" }, { offset: 1, color: "#0958d9" }] }
            : { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#ffc53d" }, { offset: 1, color: "#d48806" }] },
          borderRadius: [4, 4, 0, 0],
        },
      })),
      label: { show: true, position: "top" as const, formatter: "{c}天" },
    }],
  };

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm text-blue-800">
        <strong>时效性说明：</strong>检测时效性 = 实际检测日期 - 收样日期，已自动剔除周六/周日。当天收样当天完成计为0.5天。
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div>
          <div className="text-sm text-muted-foreground mb-2">材料类型</div>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setTestItemFilter("all"); }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="全部类型" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-2">检测项目</div>
          <Select value={testItemFilter} onValueChange={setTestItemFilter}>
            <SelectTrigger className="w-full"><SelectValue placeholder="全部项目" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部项目</SelectItem>
              {availableTestItems.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-2">平均检测时效</div>
          <div className="text-2xl font-bold">{overallAvg} 天</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-2">检测项目数</div>
          <div className="text-2xl font-bold">{filtered.length} 项</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-2">总样本数</div>
          <div className="text-2xl font-bold">{filtered.reduce((s, d) => s + d.sampleCount, 0)} 个</div>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">检测时效性分布</h3>
          <ReactECharts option={barOption} style={{ height: 320 }} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">检测时效性明细</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>材料类型</TableHead>
                <TableHead>检测项目</TableHead>
                <TableHead className="text-center">平均检测时效（天）</TableHead>
                <TableHead className="text-center">样本数量</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d, idx) => (
                <TableRow key={idx}>
                  <TableCell>{d.category}</TableCell>
                  <TableCell>{d.testItem}</TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold" style={{ color: d.avgDays <= 2 ? "#52c41a" : d.avgDays <= 4 ? "#1677ff" : "#faad14" }}>
                      {d.avgDays} 天
                    </span>
                  </TableCell>
                  <TableCell className="text-center">{d.sampleCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
