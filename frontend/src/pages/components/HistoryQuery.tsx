import { useState, useMemo } from "react";
import { Search, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { experimentRecords, sampleCategories } from "@/mock/data";

export default function HistoryQuery() {
  const [manufacturerFilter, setManufacturerFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");

  const manufacturers = useMemo(() => [...new Set(experimentRecords.map((r) => r.manufacturer))], []);

  const availableCategories = useMemo(() => {
    if (manufacturerFilter === "all") return sampleCategories;
    const cats = new Set(experimentRecords.filter((r) => r.manufacturer === manufacturerFilter).map((r) => r.sampleName));
    return sampleCategories.filter((c) => cats.has(c));
  }, [manufacturerFilter]);

  const filteredData = useMemo(() => {
    return experimentRecords.filter((r) => {
      if (manufacturerFilter !== "all" && r.manufacturer !== manufacturerFilter) return false;
      if (categoryFilter !== "all" && r.sampleName !== categoryFilter) return false;
      if (searchText && !r.entrustNo.includes(searchText) && !r.sampleName.includes(searchText) && !r.project.includes(searchText)) return false;
      return true;
    });
  }, [manufacturerFilter, categoryFilter, searchText]);

  const handleReset = () => { setManufacturerFilter("all"); setCategoryFilter("all"); setSearchText(""); };

  return (
    <div>
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <div className="text-sm text-muted-foreground mb-2">生产厂家</div>
              <Select value={manufacturerFilter} onValueChange={(v) => { setManufacturerFilter(v); setCategoryFilter("all"); }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="全部厂家" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部厂家</SelectItem>
                  {manufacturers.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <div className="text-sm text-muted-foreground mb-2">样品类别</div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full"><SelectValue placeholder="全部类别" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类别</SelectItem>
                  {availableCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <div className="text-sm text-muted-foreground mb-2">关键字搜索</div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="委托单号/样品名称/项目" value={searchText} onChange={(e) => setSearchText(e.target.value)} className="pl-9" />
              </div>
            </div>
            <Button variant="outline" onClick={handleReset}><RotateCcw className="size-4 mr-1" /> 重置</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 text-sm text-muted-foreground">
            共 <span className="text-primary font-semibold">{filteredData.length}</span> 条记录
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>委托单号</TableHead>
                <TableHead>样品名称</TableHead>
                <TableHead>规格型号</TableHead>
                <TableHead>生产厂家</TableHead>
                <TableHead>检测日期</TableHead>
                <TableHead>检测项目</TableHead>
                <TableHead className="text-center">判定结果</TableHead>
                <TableHead>标准要求</TableHead>
                <TableHead>检测结果</TableHead>
                <TableHead>所属项目</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.slice(0, 10).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.entrustNo}</TableCell>
                  <TableCell>{r.sampleName}</TableCell>
                  <TableCell className="truncate max-w-[180px]">{r.specModel}</TableCell>
                  <TableCell className="truncate max-w-[220px]">{r.manufacturer}</TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell className="truncate max-w-[160px]">{r.testItem}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={r.judgment === "合格" ? "default" : r.judgment === "不合格" ? "destructive" : "secondary"}>
                      {r.judgment}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.requirement}</TableCell>
                  <TableCell>{r.result}</TableCell>
                  <TableCell className="truncate max-w-[200px]">{r.project}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
