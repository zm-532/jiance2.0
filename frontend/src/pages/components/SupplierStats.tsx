import { useState } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supplierStats, materialStats } from "@/mock/data";

export default function SupplierStats() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredSuppliers = selectedCategory
    ? supplierStats.filter((s) => s.sampleName === selectedCategory)
    : [];

  const barOption = {
    tooltip: { trigger: "axis" as const },
    grid: { left: "3%", right: "4%", bottom: "3%", top: "10%", containLabel: true },
    xAxis: {
      type: "category" as const, data: materialStats.map((c) => c.material),
      axisLabel: { rotate: 25, fontSize: 12 }, axisLine: { lineStyle: { color: "#e8e8e8" } },
    },
    yAxis: { type: "value" as const, max: 100, name: "合格率(%)", splitLine: { lineStyle: { type: "dashed" as const, color: "#f0f0f0" } } },
    series: [{
      type: "bar" as const, barWidth: 30,
      data: materialStats.map((c) => ({
        value: c.avgQualifyRate,
        itemStyle: {
          color: c.avgQualifyRate >= 95
            ? { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#73d13d" }, { offset: 1, color: "#389e0d" }] }
            : c.avgQualifyRate >= 90
            ? { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#4096ff" }, { offset: 1, color: "#0958d9" }] }
            : { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#ffc53d" }, { offset: 1, color: "#d48806" }] },
          borderRadius: [4, 4, 0, 0],
        },
      })),
      label: { show: true, position: "top" as const, formatter: "{c}%", fontSize: 11 },
    }],
  };

  return (
    <div>
      {/* Category cards */}
      <div className="grid grid-cols-8 gap-2 mb-6">
        {materialStats.map((cat) => (
          <Card
            key={cat.material}
            className={`cursor-pointer transition-all hover:shadow-md ${cat.material === selectedCategory ? "border-primary bg-primary/5" : ""}`}
            onClick={() => setSelectedCategory(cat.material === selectedCategory ? null : cat.material)}
          >
            <CardContent className="pt-4 text-center">
              <div className="text-sm font-semibold">{cat.material}</div>
              <div className="text-xs text-muted-foreground mt-1">{cat.supplierCount} 家供应商</div>
              <div className="text-xs text-muted-foreground">{cat.totalBatches} 批次</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bar chart */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">各类别平均合格率</h3>
          <ReactECharts option={barOption} style={{ height: 280 }} />
        </CardContent>
      </Card>

      {/* Supplier details */}
      {selectedCategory && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">{selectedCategory} - 供应商检测数据明细</h3>
            {filteredSuppliers.length > 0 ? (
              <>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center"><div className="text-2xl font-bold">{filteredSuppliers.length}</div><div className="text-xs text-muted-foreground">供应商数量</div></div>
                  <div className="text-center"><div className="text-2xl font-bold">{filteredSuppliers.reduce((s, sp) => s + sp.totalBatches, 0)}</div><div className="text-xs text-muted-foreground">总送检批次</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-green-600">{filteredSuppliers.reduce((s, sp) => s + sp.qualifiedBatches, 0)}</div><div className="text-xs text-muted-foreground">合格批次</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-red-600">{filteredSuppliers.reduce((s, sp) => s + sp.unqualifiedBatches, 0)}</div><div className="text-xs text-muted-foreground">不合格批次</div></div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>供应商名称</TableHead>
                      <TableHead className="text-center">送检批次数</TableHead>
                      <TableHead className="text-center">合格批次</TableHead>
                      <TableHead className="text-center">不合格批次</TableHead>
                      <TableHead className="text-center">待定批次</TableHead>
                      <TableHead className="w-[150px]">合格率</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuppliers.map((s, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="truncate max-w-[280px]">{s.manufacturer}</TableCell>
                        <TableCell className="text-center">{s.totalBatches}</TableCell>
                        <TableCell className="text-center text-green-600">{s.qualifiedBatches}</TableCell>
                        <TableCell className="text-center text-red-600">{s.unqualifiedBatches}</TableCell>
                        <TableCell className="text-center">{s.pendingBatches}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={s.qualifyRate} className="h-2 flex-1" />
                            <span className="text-xs w-10 text-right">{s.qualifyRate}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">该类别暂无供应商数据</div>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedCategory && (
        <div className="text-center py-12 text-muted-foreground bg-white rounded-lg">
          请点击上方样品类别卡片查看对应供应商检测数据
        </div>
      )}
    </div>
  );
}
