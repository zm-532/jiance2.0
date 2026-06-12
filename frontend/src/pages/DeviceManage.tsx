import { useState } from "react";
import {
  Wrench, CheckCircle, PauseCircle, AlertTriangle, History, XCircle, Clock,
} from "lucide-react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { devices, type Device } from "@/mock/data";

const calibStatusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  "正常": { color: "default", icon: <CheckCircle className="size-3" /> },
  "即将到期": { color: "secondary", icon: <Clock className="size-3" /> },
  "已过期": { color: "destructive", icon: <XCircle className="size-3" /> },
  "未到货": { color: "outline", icon: <PauseCircle className="size-3" /> },
  "无校准数据": { color: "outline", icon: null },
};

function StatCard({ title, value, suffix, icon: Icon, variant }: {
  title: string; value: number; suffix: string; icon: React.ElementType; variant: "default" | "destructive" | "secondary" | "outline";
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground mb-2">{title}</div>
        <div className="flex items-center gap-2">
          <Icon className="size-5" />
          <span className="text-2xl font-bold">{value}</span>
          <span className="text-xs text-muted-foreground">{suffix}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DeviceManage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [calibFilter, setCalibFilter] = useState<string>("all");

  const mainDevices = devices.filter((d) => d.status !== "未到");
  const filteredDevices = mainDevices.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (calibFilter !== "all" && d.calibrationStatus !== calibFilter) return false;
    return true;
  });

  const totalDevices = mainDevices.length;
  const normalDevices = mainDevices.filter((d) => d.status === "正常").length;
  const calibExpired = mainDevices.filter((d) => d.calibrationStatus === "已过期").length;
  const calibSoon = mainDevices.filter((d) => d.calibrationStatus === "即将到期").length;
  const calibNormal = mainDevices.filter((d) => d.calibrationStatus === "正常").length;
  const withTestCount = mainDevices.filter((d) => d.totalTests > 0).length;

  const calibPieOption = {
    tooltip: { trigger: "item" as const },
    legend: { bottom: 0, icon: "circle", itemWidth: 10, itemHeight: 10 },
    series: [{
      type: "pie" as const, radius: ["45%", "75%"], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: "#fff", borderWidth: 3 }, label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" as const } },
      data: [
        { value: calibNormal, name: "校准正常", itemStyle: { color: "#52c41a" } },
        { value: calibSoon, name: "即将到期", itemStyle: { color: "#faad14" } },
        { value: calibExpired, name: "已过期", itemStyle: { color: "#ff4d4f" } },
      ].filter((d) => d.value > 0),
    }],
  };

  const topTestDevices = [...mainDevices].filter((d) => d.totalTests > 0).sort((a, b) => b.totalTests - a.totalTests).slice(0, 15);
  const testRankOption = {
    tooltip: { trigger: "axis" as const },
    grid: { left: "3%", right: "4%", bottom: "3%", top: "10%", containLabel: true },
    xAxis: {
      type: "category" as const, data: topTestDevices.map((d) => d.name),
      axisLabel: { rotate: 30, fontSize: 11 }, axisLine: { lineStyle: { color: "#e8e8e8" } },
    },
    yAxis: { type: "value" as const, name: "检测次数", splitLine: { lineStyle: { type: "dashed" as const, color: "#f0f0f0" } } },
    series: [{
      type: "bar" as const, barWidth: 35,
      data: topTestDevices.map((d) => ({
        value: d.totalTests,
        itemStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#73d13d" }, { offset: 1, color: "#389e0d" }] }, borderRadius: [6, 6, 0, 0] },
      })),
      label: { show: true, position: "top" as const, fontWeight: 500 },
    }],
  };

  const locationMap: Record<string, number> = {};
  mainDevices.forEach((d) => { const loc = d.location || "未标注"; locationMap[loc] = (locationMap[loc] || 0) + 1; });
  const locationData = Object.entries(locationMap).sort((a, b) => b[1] - a[1]);
  const locationPieOption = {
    tooltip: { trigger: "item" as const },
    legend: { bottom: 0, icon: "circle", itemWidth: 10, itemHeight: 10 },
    series: [{
      type: "pie" as const, radius: ["45%", "75%"], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: "#fff", borderWidth: 3 }, label: { show: false },
      data: locationData.map(([name, value]) => ({ name, value })),
    }],
  };

  return (
    <div>
      <div className="mb-6 pb-4 border-b">
        <h2 className="text-xl font-bold tracking-tight">设备管理</h2>
        <p className="text-muted-foreground mt-1 text-sm">实验室检测设备台账管理 — 数据来自《实验室检测设备台账2025》</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        <StatCard title="设备总数" value={totalDevices} suffix="台" icon={Wrench} variant="default" />
        <StatCard title="正常运行" value={normalDevices} suffix="台" icon={CheckCircle} variant="default" />
        <StatCard title="校准正常" value={calibNormal} suffix="台" icon={CheckCircle} variant="default" />
        <StatCard title="即将到期" value={calibSoon} suffix="台" icon={Clock} variant="secondary" />
        <StatCard title="校准过期" value={calibExpired} suffix="台" icon={AlertTriangle} variant="destructive" />
        <StatCard title="有检测记录" value={withTestCount} suffix="台" icon={History} variant="outline" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base">校准状态分布</CardTitle></CardHeader>
          <CardContent><ReactECharts option={calibPieOption} style={{ height: 320 }} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">存放位置分布</CardTitle></CardHeader>
          <CardContent><ReactECharts option={locationPieOption} style={{ height: 320 }} /></CardContent>
        </Card>
      </div>
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">检测次数排行</CardTitle></CardHeader>
        <CardContent><ReactECharts option={testRankOption} style={{ height: 320 }} /></CardContent>
      </Card>

      {/* Device table */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">设备台账（{filteredDevices.length} 台）</h3>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]"><SelectValue placeholder="全部状态" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="正常">正常</SelectItem>
                </SelectContent>
              </Select>
              <Select value={calibFilter} onValueChange={setCalibFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="全部校准状态" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部校准状态</SelectItem>
                  <SelectItem value="正常">校准正常</SelectItem>
                  <SelectItem value="即将到期">即将到期</SelectItem>
                  <SelectItem value="已过期">已过期</SelectItem>
                  <SelectItem value="无校准数据">无校准数据</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[85px]">设备编号</TableHead>
                  <TableHead className="w-[170px]">设备名称</TableHead>
                  <TableHead className="w-[130px]">型号</TableHead>
                  <TableHead className="w-[180px]">生产厂家</TableHead>
                  <TableHead className="w-[90px] text-center">设备状态</TableHead>
                  <TableHead className="w-[100px] text-center">校准状态</TableHead>
                  <TableHead className="w-[110px]">存放位置</TableHead>
                  <TableHead className="w-[110px]">下次校准</TableHead>
                  <TableHead className="w-[90px] text-center">检测次数</TableHead>
                  <TableHead className="w-[120px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.slice(0, 15).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.id}</TableCell>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="truncate max-w-[130px]">{d.model || "-"}</TableCell>
                    <TableCell className="truncate max-w-[180px]">{d.manufacturer || "-"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={d.status === "正常" ? "default" : "outline"}>{d.status || "-"}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={calibStatusConfig[d.calibrationStatus]?.color as any || "outline"}>
                        {d.calibrationStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="truncate max-w-[110px]">{d.location || "-"}</TableCell>
                    <TableCell>{d.nextCalibrationDate || "-"}</TableCell>
                    <TableCell className="text-center">{d.totalTests > 0 ? d.totalTests : <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="link" size="sm" className="h-7 px-1"><History className="size-4" /></Button>
                          </TooltipTrigger>
                          <TooltipContent>使用记录</TooltipContent>
                        </Tooltip>
                        <Button variant="link" size="sm" className="h-7 px-1">详情</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
