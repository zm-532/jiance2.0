import { useState, useEffect, useMemo } from "react";
import {
  Wrench, CheckCircle, PauseCircle, AlertTriangle, History, XCircle, Clock,
  ArrowUp, ArrowDown, ArrowUpDown, BellRing, Activity,
} from "lucide-react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { devices, ocrRules, type Device } from "@/mock/data";
import { fetchDeviceIdleWarning, type DeviceIdleWarningResponse } from "@/services/ocr";
import { cn } from "@/lib/utils";

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
  const variantStyles = {
    default: "text-primary bg-primary/10",
    destructive: "text-destructive bg-destructive/10",
    secondary: "text-amber-500 bg-amber-500/10",
    outline: "text-muted-foreground bg-muted",
  };
  const currentStyle = variantStyles[variant];

  return (
    <Card className="group transition-all duration-300 hover:-translate-y-1">
      <CardContent className="pt-5 pb-5">
        <div className="flex justify-between items-start mb-3">
          <div className="text-sm font-medium text-muted-foreground">{title}</div>
          <div className={cn("relative flex size-9 items-center justify-center rounded-lg transition-colors group-hover:bg-opacity-80", currentStyle.split(" ")[1])}>
            <Icon className={cn("size-5 transition-transform group-hover:scale-110", currentStyle.split(" ")[0])} />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
          <span className="text-xs font-medium text-muted-foreground">{suffix}</span>
        </div>
      </CardContent>
    </Card>
  );
}

type SortKey = "nextCalibrationDate" | "totalTests" | null;
type SortDir = "asc" | "desc";

export default function DeviceManage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [calibFilter, setCalibFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // 设备闲置预警
  const [idleWarning, setIdleWarning] = useState<DeviceIdleWarningResponse | null>(null);
  const [idleLoading, setIdleLoading] = useState(false);
  const [idleDays, setIdleDays] = useState(7);

  useEffect(() => {
    let cancelled = false;
    setIdleLoading(true);
    fetchDeviceIdleWarning(idleDays)
      .then((data) => { if (!cancelled) setIdleWarning(data); })
      .catch(() => {}) 
      .finally(() => { if (!cancelled) setIdleLoading(false); });
    return () => { cancelled = true; };
  }, [idleDays]);

  // 根据 OCR 规则映射：哪些设备本周有使用（有照片上传）
  const { idleDevices, activeDeviceNames, weekLabel } = useMemo(() => {
    if (!idleWarning) {
      return { idleDevices: [] as Device[], activeDeviceNames: new Set<string>(), weekLabel: "" };
    }
    // 从 active_rules 映射到设备名称
    const ruleToEquipment = new Map(ocrRules.map((r) => [r.id, r.equipment]));
    const activeNames = new Set<string>();
    idleWarning.active_rules.forEach((rule) => {
      const eq = ruleToEquipment.get(rule.rule_id);
      if (eq) activeNames.add(eq);
    });
    // 正常设备中（排除未到/未到货）哪些没有活动
    const mainDevs = devices.filter((d) => d.status !== "未到");
    const idle = mainDevs.filter((d) => !activeNames.has(d.name));
    // 统计周期标签
    const since = new Date(idleWarning.since);
    const now = new Date(idleWarning.now);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const label = `${fmt(since)} 至 ${fmt(now)}`;
    return { idleDevices: idle, activeDeviceNames: activeNames, weekLabel: label };
  }, [idleWarning]);

  const mainDevices = devices.filter((d) => d.status !== "未到");
  const filteredDevices = mainDevices.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (calibFilter !== "all" && d.calibrationStatus !== calibFilter) return false;
    return true;
  });

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [statusFilter, calibFilter]);

  // Sort devices
  const sortedDevices = useMemo(() => {
    if (!sortKey) return filteredDevices;
    return [...filteredDevices].sort((a, b) => {
      let va: any, vb: any;
      if (sortKey === "nextCalibrationDate") {
        va = a.nextCalibrationDate || "9999";
        vb = b.nextCalibrationDate || "9999";
      } else if (sortKey === "totalTests") {
        va = a.totalTests;
        vb = b.totalTests;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredDevices, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="size-3.5 ml-1 inline opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="size-3.5 ml-1 inline text-primary" />
      : <ArrowDown className="size-3.5 ml-1 inline text-primary" />;
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedDevices.length / pageSize));
  const pagedDevices = sortedDevices.slice((page - 1) * pageSize, page * pageSize);

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
      axisLabel: { rotate: 30, fontSize: 11, color: "#475569" }, axisLine: { lineStyle: { color: "#e8e8e8" } },
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

      {/* 设备闲置预警 */}
      <Card className={cn("mb-6 border-l-4", idleDevices.length > 0 ? "border-l-amber-500" : "border-l-green-500")}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className={cn("size-5", idleDevices.length > 0 ? "text-amber-500" : "text-green-500")} />
              <CardTitle className="text-base">设备闲置预警</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(idleDays)} onValueChange={(v) => setIdleDays(Number(v))}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">近 7 天</SelectItem>
                  <SelectItem value="14">近 14 天</SelectItem>
                  <SelectItem value="30">近 30 天</SelectItem>
                </SelectContent>
              </Select>
              {weekLabel && (
                <span className="text-xs text-muted-foreground">统计周期：{weekLabel}</span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {idleLoading ? (
            <div className="text-sm text-muted-foreground py-3">加载闲置数据中...</div>
          ) : idleWarning === null ? (
            <div className="text-sm text-muted-foreground py-3">暂无预警数据（后端服务未连接）</div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-3 text-sm">
                <span className="flex items-center gap-1.5">
                  <Activity className="size-4 text-green-500" />
                  活跃设备：<strong className="text-green-600">{activeDeviceNames.size}</strong> 台
                </span>
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="size-4 text-amber-500" />
                  闲置设备：<strong className="text-amber-600">{idleDevices.length}</strong> 台
                </span>
                <span className="text-muted-foreground">
                  本期上传图片：{idleWarning.total_photos} 张
                </span>
              </div>
              {idleDevices.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-600 py-2">
                  <CheckCircle className="size-4" />
                  所有设备近期均有使用记录，无闲置预警。
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">以下设备在统计周期内无检测数据上传，请安排检查：</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {idleDevices.map((d) => (
                      <Tooltip key={d.id}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs cursor-default hover:bg-amber-100 transition-colors">
                            <AlertTriangle className="size-3 text-amber-500 flex-shrink-0" />
                            <span className="truncate font-medium text-amber-900">{d.name}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold">{d.name}</p>
                          <p className="text-muted-foreground text-xs">{d.id} | {d.location || "未标注位置"}</p>
                          <p className="text-muted-foreground text-xs">型号：{d.model || "-"} | 联系人：{d.contact || "-"}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
            <Table className="min-w-[1800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[85px]">设备编号</TableHead>
                  <TableHead className="w-[170px]">设备名称</TableHead>
                  <TableHead className="w-[130px]">型号</TableHead>
                  <TableHead className="w-[180px]">生产厂家</TableHead>
                  <TableHead className="w-[150px]">功能</TableHead>
                  <TableHead className="w-[120px]">测量范围</TableHead>
                  <TableHead className="w-[90px] text-center">设备状态</TableHead>
                  <TableHead className="w-[100px] text-center">校准状态</TableHead>
                  <TableHead className="w-[120px]">校准单位</TableHead>
                  <TableHead className="w-[140px]">证书编号</TableHead>
                  <TableHead className="w-[110px]">存放位置</TableHead>
                  <TableHead className="w-[100px]">联系人</TableHead>
                  <TableHead className="w-[110px] cursor-pointer hover:text-primary" onClick={() => toggleSort("nextCalibrationDate")}>
                    下次校准 <SortIcon columnKey="nextCalibrationDate" />
                  </TableHead>
                  <TableHead className="w-[90px] text-center cursor-pointer hover:text-primary" onClick={() => toggleSort("totalTests")}>
                    检测次数 <SortIcon columnKey="totalTests" />
                  </TableHead>
                  <TableHead className="w-[120px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedDevices.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.id}</TableCell>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="truncate max-w-[130px]">{d.model || "-"}</TableCell>
                    <TableCell className="truncate max-w-[180px]">{d.manufacturer || "-"}</TableCell>
                    <TableCell className="truncate max-w-[150px]">{d.functionDesc || "-"}</TableCell>
                    <TableCell className="truncate max-w-[120px]">{d.measurementRange || "-"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={d.status === "正常" ? "default" : "outline"}>{d.status || "-"}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={calibStatusConfig[d.calibrationStatus]?.color as any || "outline"}>
                        {d.calibrationStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="truncate max-w-[120px]">{d.calibrationUnit || "-"}</TableCell>
                    <TableCell className="truncate max-w-[140px]">{d.calibrationCertNo || "-"}</TableCell>
                    <TableCell className="truncate max-w-[110px]">{d.location || "-"}</TableCell>
                    <TableCell className="truncate max-w-[100px]">{d.contact || "-"}</TableCell>
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

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>每页</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>条，共 {filteredDevices.length} 台</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)}>首页</Button>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
              <span className="px-3 text-sm">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>末页</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
