import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Search, RotateCcw, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  fetchExperimentRecords,
  fetchSampleCategories,
  fetchManufacturers,
  type ExperimentRecord,
} from "@/services/stats";

export default function HistoryQuery() {
  const [manufacturerFilter, setManufacturerFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // API data state
  const [records, setRecords] = useState<ExperimentRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Searchable manufacturer dropdown
  const [mfrOpen, setMfrOpen] = useState(false);
  const [mfrSearch, setMfrSearch] = useState("");
  const mfrRef = useRef<HTMLDivElement>(null);

  // Load manufacturers once
  useEffect(() => {
    fetchManufacturers().then(setManufacturers).catch(console.error);
  }, []);

  // Load sample categories (正反链接)
  useEffect(() => {
    const mfr = manufacturerFilter === "all" ? undefined : manufacturerFilter;
    fetchSampleCategories(mfr).then(setAvailableCategories).catch(console.error);
  }, [manufacturerFilter]);

  // Fetch records when filters change
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetchExperimentRecords({
        manufacturer: manufacturerFilter === "all" ? undefined : manufacturerFilter,
        sample_name: categoryFilter === "all" ? undefined : categoryFilter,
        page,
        page_size: pageSize,
      });
      // 客户端关键字搜索（API不直接支持关键字搜索）
      let filtered = resp.records;
      if (searchText) {
        filtered = filtered.filter(
          (r) =>
            (r.entrustNo || "").includes(searchText) ||
            (r.sampleName || "").includes(searchText) ||
            (r.project || "").includes(searchText)
        );
      }
      setRecords(filtered);
      setTotalRecords(resp.total);
    } catch (e) {
      console.error("获取实验记录失败:", e);
    } finally {
      setLoading(false);
    }
  }, [manufacturerFilter, categoryFilter, page, pageSize]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => { setPage(1); }, [manufacturerFilter, categoryFilter, searchText]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mfrRef.current && !mfrRef.current.contains(e.target as Node)) setMfrOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredMfrs = useMemo(() => {
    if (!mfrSearch) return manufacturers;
    return manufacturers.filter((m) => m.toLowerCase().includes(mfrSearch.toLowerCase()));
  }, [mfrSearch, manufacturers]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const handleReset = () => {
    setManufacturerFilter("all");
    setCategoryFilter("all");
    setSearchText("");
  };

  const selectMfr = (val: string) => {
    setManufacturerFilter(val);
    setCategoryFilter("all");
    setMfrOpen(false);
    setMfrSearch("");
  };

  return (
    <div>
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            {/* Searchable manufacturer dropdown */}
            <div ref={mfrRef} className="relative flex-1">
              <div className="text-sm text-muted-foreground mb-2">生产厂家</div>
              <button
                type="button"
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
                onClick={() => setMfrOpen(!mfrOpen)}
              >
                <span className="truncate">{manufacturerFilter === "all" ? "全部厂家" : manufacturerFilter}</span>
                <ChevronDown className="size-4 opacity-50 shrink-0 ml-2" />
              </button>
              {mfrOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md" style={{ maxWidth: 400 }}>
                  <div className="sticky top-0 bg-popover border-b p-2">
                    <Input
                      placeholder="搜索厂家..."
                      value={mfrSearch}
                      onChange={(e) => setMfrSearch(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                  </div>
                  <div style={{ maxHeight: 260, overflowY: "auto" }}>
                    <button
                      type="button"
                      className={cn("w-full text-left px-3 py-1.5 text-sm hover:bg-accent cursor-pointer", manufacturerFilter === "all" && "bg-accent font-medium")}
                      onClick={() => selectMfr("all")}
                    >
                      全部厂家
                    </button>
                    {filteredMfrs.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={cn("w-full text-left px-3 py-1.5 text-sm hover:bg-accent cursor-pointer", manufacturerFilter === m && "bg-accent font-medium")}
                        onClick={() => selectMfr(m)}
                      >
                        {m}
                      </button>
                    ))}
                    {filteredMfrs.length === 0 && (
                      <div className="px-3 py-4 text-sm text-muted-foreground text-center">无匹配厂家</div>
                    )}
                  </div>
                </div>
              )}
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
            共 <span className="text-primary font-semibold">{totalRecords}</span> 条记录
            {loading && <span className="ml-2 text-muted-foreground">加载中...</span>}
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
              {records.map((r) => (
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
              {!loading && records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>每页</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>条，共 {totalRecords} 条</span>
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
