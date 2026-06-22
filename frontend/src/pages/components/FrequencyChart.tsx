import { useMemo } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import type { ArchivedPhoto } from "@/services/ocr";

interface FrequencyChartProps {
  data: Array<{ frequency: string; coefficient: number }>;
}

/**
 * 声学 1/3 倍频程频率折线图（纯 SVG 实现，避免引入 recharts 依赖）。
 */
export default function FrequencyChart({ data }: FrequencyChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    const freqs = data.map((d) => Number(d.frequency));
    const coeffs = data.map((d) => d.coefficient);
    const maxFreq = Math.max(...freqs);
    const minFreq = Math.min(...freqs);
    const maxCoeff = Math.max(...coeffs, 1);
    const minCoeff = Math.min(...coeffs, 0);
    const width = 600;
    const height = 240;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const points = data.map((d, i) => {
      const freq = Number(d.frequency);
      const x = padding.left + ((freq - minFreq) / (maxFreq - minFreq || 1)) * chartW;
      const y = padding.top + chartH - ((d.coefficient - minCoeff) / (maxCoeff - minCoeff || 1)) * chartH;
      return { x, y, freq, coeff: d.coefficient, label: d.frequency };
    });

    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    return { points, pathD, width, height, padding, chartW, chartH, maxFreq, minFreq, maxCoeff, minCoeff };
  }, [data]);

  if (!chartData) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        <LineChartIcon className="size-4 mx-auto mb-1" />
        暂无频率数据
      </div>
    );
  }

  const { points, pathD, width, height, padding, chartW, chartH, minCoeff, maxCoeff, minFreq, maxFreq } = chartData;

  return (
    <div className="border rounded-lg p-3 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <LineChartIcon className="size-4 text-primary" />
        <span className="text-sm font-semibold">1/3 倍频程吸声系数折线图</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 240 }}>
        {/* Y 轴刻度线 */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => {
          const y = padding.top + chartH - ((v - minCoeff) / (maxCoeff - minCoeff || 1)) * chartH;
          return (
            <g key={v}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#64748b">{v.toFixed(2)}</text>
            </g>
          );
        })}
        {/* X 轴 */}
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#94a3b8" strokeWidth={1} />
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#94a3b8" strokeWidth={1} />
        {/* X 轴刻度 */}
        {points.map((p, i) => (
          i % Math.ceil(points.length / 8) === 0 ? (
            <text key={i} x={p.x} y={height - padding.bottom + 14} textAnchor="middle" fontSize={9} fill="#64748b">{p.label}</text>
          ) : null
        ))}
        {/* 折线 */}
        <path d={pathD} fill="none" stroke="#1677ff" strokeWidth={2} />
        {/* 数据点 */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#1677ff" />
        ))}
        {/* 轴标签 */}
        <text x={width / 2} y={height - 4} textAnchor="middle" fontSize={11} fill="#475569">频率 (Hz)</text>
        <text x={14} y={height / 2} textAnchor="middle" fontSize={11} fill="#475569" transform={`rotate(-90 14 ${height / 2})`}>吸声系数</text>
      </svg>
    </div>
  );
}
