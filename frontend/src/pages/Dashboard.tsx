import { useState } from "react";
import {
  Wrench, CheckCircle, FlaskConical, TrendingUp, Users, Shield, Clock, RefreshCw,
} from "lucide-react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  devices, materialStats, testItemDistribution, monthlyTestVolume,
  pipeline, photoCount,
} from "@/mock/data";

function StatCard({ title, value, suffix, icon: Icon, color }: {
  title: string; value: number; suffix: string; icon: React.ElementType; color: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground mb-2">{title}</div>
        <div className="flex items-center gap-2">
          <Icon className="size-5" style={{ color }} />
          <span className="text-2xl font-bold">{value}</span>
          <span className="text-xs text-muted-foreground">{suffix}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const mainDevices = devices.filter((d) => d.status !== "未到");
  const totalDevices = mainDevices.length;
  const calibNormal = mainDevices.filter((d) => d.calibrationStatus === "正常").length;
  const calibSoon = mainDevices.filter((d) => d.calibrationStatus === "即将到期").length;
  const calibExpired = mainDevices.filter((d) => d.calibrationStatus === "已过期").length;

  const devicePieOption = {
    tooltip: { trigger: "item" as const },
    legend: { bottom: 0, icon: "circle", itemWidth: 10, itemHeight: 10 },
    series: [{
      type: "pie" as const, radius: ["45%", "75%"], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: "#fff", borderWidth: 3 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: "bold" as const } },
      data: [
        { value: calibNormal, name: "校准正常", itemStyle: { color: "#52c41a" } },
        { value: calibSoon, name: "即将到期", itemStyle: { color: "#faad14" } },
        { value: calibExpired, name: "已过期", itemStyle: { color: "#ff4d4f" } },
      ].filter((d) => d.value > 0),
    }],
  };

  const testItemPieOption = {
    tooltip: { trigger: "item" as const },
    legend: { bottom: 0, icon: "circle", itemWidth: 10, itemHeight: 10 },
    series: [{
      type: "pie" as const, radius: ["45%", "75%"], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: "#fff", borderWidth: 3 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: "bold" as const } },
      data: testItemDistribution.map((item: any) => ({
        value: item.value, name: item.name, itemStyle: { color: item.color },
      })),
    }],
  };

  const trendLineOption = {
    tooltip: { trigger: "axis" as const },
    legend: { data: ["总检测量", "合格", "不合格"], bottom: 0, icon: "circle", itemWidth: 10, itemHeight: 10 },
    grid: { left: "3%", right: "4%", bottom: "12%", top: "5%", containLabel: true },
    xAxis: {
      type: "category" as const, data: monthlyTestVolume.map((d: any) => d.month),
      axisLabel: { rotate: 30 }, axisLine: { lineStyle: { color: "#e8e8e8" } },
    },
    yAxis: { type: "value" as const, splitLine: { lineStyle: { type: "dashed" as const, color: "#f0f0f0" } } },
    series: [
      {
        name: "总检测量", type: "line" as const, smooth: 0.4, symbol: "circle", symbolSize: 8,
        data: monthlyTestVolume.map((d: any) => d.total),
        itemStyle: { color: "#1677ff" },
        areaStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(22,119,255,0.2)" }, { offset: 1, color: "rgba(22,119,255,0.01)" }] } },
      },
      { name: "合格", type: "line" as const, smooth: 0.4, symbol: "circle", symbolSize: 8, data: monthlyTestVolume.map((d: any) => d.qualified), itemStyle: { color: "#52c41a" } },
      { name: "不合格", type: "line" as const, smooth: 0.4, symbol: "circle", symbolSize: 8, data: monthlyTestVolume.map((d: any) => d.unqualified), itemStyle: { color: "#ff4d4f" } },
    ],
  };

  const topDevices = [...mainDevices].filter((d) => d.totalTests > 0).sort((a, b) => b.totalTests - a.totalTests).slice(0, 6);

  return (
    <div>
      <div className="mb-6 pb-4 border-b">
        <h2 className="text-xl font-bold tracking-tight">总览工作台</h2>
        <p className="text-muted-foreground mt-1 text-sm">实验室设备及检测业务数据总览</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        <StatCard title="委托申请" value={pipeline.totalApplications} suffix="单" icon={FlaskConical} color="#1677ff" />
        <StatCard title="待登记检测" value={pipeline.pendingRegistration} suffix="单" icon={Clock} color="#faad14" />
        <StatCard title="检测中" value={pipeline.inProgress} suffix="单" icon={RefreshCw} color="#13c2c2" />
        <StatCard title="已完成检测" value={pipeline.completed} suffix="单" icon={CheckCircle} color="#52c41a" />
        <StatCard title="设备总数" value={totalDevices} suffix="台" icon={Wrench} color="#722ed1" />
        <StatCard title="送样图片" value={photoCount} suffix="张" icon={TrendingUp} color="#eb2f96" />
      </div>

      {/* Supplier & Test Distribution */}
      <div className="grid grid-cols-14 gap-4 mb-6">
        <div className="col-span-9">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base"><Users className="size-4" /> 供应商与材料统计</CardTitle>
                <Button variant="link" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
                  {isExpanded ? "收起" : "展开"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>材料类型</TableHead>
                    <TableHead className="text-center">供应商数</TableHead>
                    <TableHead className="w-[150px]">平均合格率</TableHead>
                    <TableHead className="text-center">总送检批次</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(isExpanded ? materialStats : materialStats.slice(0, 6)).map((item: any) => (
                    <TableRow key={item.material}>
                      <TableCell className="font-medium">{item.material}</TableCell>
                      <TableCell className="text-center">{item.supplierCount}</TableCell>
                      <TableCell>
                        {item.avgQualifyRate == null ? (
                          <span className="text-xs text-muted-foreground">缺数据</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Progress value={item.avgQualifyRate} className="h-2 flex-1" />
                            <span className="text-xs w-10 text-right">{item.avgQualifyRate}%</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{item.totalBatches}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="size-4" /> 检测项目分布</CardTitle>
            </CardHeader>
            <CardContent>
              <ReactECharts option={testItemPieOption} style={{ height: 300 }} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Device Calibration & Monthly Trend */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Wrench className="size-4" /> 设备校准状态</CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts option={devicePieOption} style={{ height: 280 }} />
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="size-4" /> 月度检测趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts option={trendLineOption} style={{ height: 280 }} />
          </CardContent>
        </Card>
      </div>

      {/* Top Devices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="size-4" /> 常用设备排行</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-3">
            {topDevices.map((device, idx) => (
              <Card key={device.id} className="text-center">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold" style={{ color: idx < 3 ? "#1677ff" : "#999" }}>#{idx + 1}</div>
                  <div className="text-sm font-medium mt-2">{device.name}</div>
                  <div className="text-xs text-muted-foreground">{device.model || ""}</div>
                  <div className="text-xs text-muted-foreground">{device.totalTests} 次检测</div>
                  <Badge
                    variant={device.calibrationStatus === "正常" ? "default" : device.calibrationStatus === "即将到期" ? "secondary" : "destructive"}
                    className="mt-2"
                  >
                    {device.calibrationStatus}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
