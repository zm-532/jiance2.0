import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, FileText } from "lucide-react";
import PhotoOCR from "./components/PhotoOCR";
import ReportGenerate from "./components/ReportGenerate";

export default function DataJudgment() {
  return (
    <div>
      <div className="mb-6 pb-4 border-b">
        <h2 className="text-xl font-bold tracking-tight">数据源判定</h2>
        <p className="text-muted-foreground mt-1 text-sm">试验数据照片OCR识别与检测报告自动生成</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="photo-ocr">
            <TabsList>
              <TabsTrigger value="photo-ocr"><Camera className="size-4 mr-1" /> 试验数据照片识别</TabsTrigger>
              <TabsTrigger value="report-gen"><FileText className="size-4 mr-1" /> 检测报告自动生成</TabsTrigger>
            </TabsList>
            <TabsContent value="photo-ocr" className="mt-4">
              <PhotoOCR />
            </TabsContent>
            <TabsContent value="report-gen" className="mt-4">
              <ReportGenerate />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
