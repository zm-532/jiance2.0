import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Clock, TrendingUp, Search } from "lucide-react";
import SupplierStats from "./components/SupplierStats";
import TimelinessStats from "./components/TimelinessStats";
import VolumeStats from "./components/VolumeStats";
import HistoryQuery from "./components/HistoryQuery";

export default function ExperimentDB() {
  return (
    <div>
      <div className="mb-6 pb-4 border-b">
        <h2 className="text-xl font-bold tracking-tight">实验数据库</h2>
        <p className="text-muted-foreground mt-1 text-sm">检测数据统计分析与历史查询</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="supplier">
            <TabsList>
              <TabsTrigger value="supplier"><BarChart3 className="size-4 mr-1" /> 供应商检测数据统计</TabsTrigger>
              <TabsTrigger value="timeliness"><Clock className="size-4 mr-1" /> 检测时效性统计</TabsTrigger>
              <TabsTrigger value="volume"><TrendingUp className="size-4 mr-1" /> 样品检测量统计</TabsTrigger>
              <TabsTrigger value="history"><Search className="size-4 mr-1" /> 历史数据查询</TabsTrigger>
            </TabsList>
            <TabsContent value="supplier" className="mt-4"><SupplierStats /></TabsContent>
            <TabsContent value="timeliness" className="mt-4"><TimelinessStats /></TabsContent>
            <TabsContent value="volume" className="mt-4"><VolumeStats /></TabsContent>
            <TabsContent value="history" className="mt-4"><HistoryQuery /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
