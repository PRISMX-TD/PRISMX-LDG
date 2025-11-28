import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { getCurrencyInfo } from "@shared/schema";

interface CategoryBreakdown {
  categoryId: number;
  categoryName: string;
  total: number;
  color: string;
}

interface ExpenseChartProps {
  data: CategoryBreakdown[];
  currency?: string;
  isLoading?: boolean;
}

export function ExpenseChart({ data, currency = "MYR", isLoading }: ExpenseChartProps) {
  const currencyInfo = getCurrencyInfo(currency);

  const chartData = useMemo(() => {
    return data.map((item) => ({
      name: item.categoryName,
      value: item.total,
      color: item.color,
    }));
  }, [data]);

  const total = useMemo(() => data.reduce((sum, item) => sum + item.total, 0), [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = ((item.value / total) * 100).toFixed(1);
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">
            {currencyInfo.symbol}{item.value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground">{percentage}%</p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <ul className="flex flex-wrap gap-2 justify-center mt-4">
        {payload.map((entry: any, index: number) => (
          <li key={`legend-${index}`} className="flex items-center gap-1 text-xs">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.value}</span>
          </li>
        ))}
      </ul>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">支出分类</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">加载中...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">支出分类</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            暂无数据
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          支出分类
          <span className="text-sm font-normal text-muted-foreground">
            总计: {currencyInfo.symbol}{total.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]" data-testid="chart-expense-pie">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={renderLegend} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
