import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getCurrencyInfo } from "@shared/schema";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import type { Transaction, Category } from "@shared/schema";

export default function Analytics() {
  const { user } = useAuth();
  const currencyInfo = getCurrencyInfo(user?.defaultCurrency || "MYR");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: transactions = [], isLoading: isTransactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(selectedYear, i, 1);
      return {
        month: format(date, "M月"),
        monthNum: i + 1,
        income: 0,
        expense: 0,
      };
    });

    transactions.forEach((t) => {
      const date = new Date(t.date);
      if (date.getFullYear() !== selectedYear) return;
      const monthIndex = date.getMonth();
      const amount = parseFloat(t.amount);
      if (t.type === "income") {
        months[monthIndex].income += amount;
      } else if (t.type === "expense") {
        months[monthIndex].expense += amount;
      }
    });

    return months;
  }, [transactions, selectedYear]);

  const categoryData = useMemo(() => {
    const categoryTotals: Record<number, { name: string; color: string; total: number }> = {};
    
    transactions.forEach((t) => {
      if (t.type !== "expense") return;
      const date = new Date(t.date);
      if (date.getFullYear() !== selectedYear) return;
      
      const categoryId = t.categoryId || 0;
      if (!categoryTotals[categoryId]) {
        const category = categories.find((c) => c.id === categoryId);
        categoryTotals[categoryId] = {
          name: category?.name || "其他",
          color: category?.color || "#64748B",
          total: 0,
        };
      }
      categoryTotals[categoryId].total += parseFloat(t.amount);
    });

    return Object.values(categoryTotals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [transactions, categories, selectedYear]);

  const yearlyTotals = useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach((t) => {
      const date = new Date(t.date);
      if (date.getFullYear() !== selectedYear) return;
      const amount = parseFloat(t.amount);
      if (t.type === "income") {
        income += amount;
      } else if (t.type === "expense") {
        expense += amount;
      }
    });

    return { income, expense, net: income - expense };
  }, [transactions, selectedYear]);

  const compareData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentMonthExpense = monthlyData[currentMonth]?.expense || 0;
    const lastMonthExpense = currentMonth > 0 ? monthlyData[currentMonth - 1]?.expense || 0 : 0;
    
    const change = lastMonthExpense > 0 
      ? ((currentMonthExpense - lastMonthExpense) / lastMonthExpense) * 100 
      : 0;

    return {
      currentMonth: currentMonthExpense,
      lastMonth: lastMonthExpense,
      change,
    };
  }, [monthlyData]);

  if (isTransactionsLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="hidden md:flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          数据分析
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSelectedYear(selectedYear - 1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-lg font-medium min-w-[60px] text-center">{selectedYear}年</span>
          <Button variant="ghost" size="icon" onClick={() => setSelectedYear(selectedYear + 1)}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex md:hidden items-center justify-center gap-2 py-2">
        <Button variant="ghost" size="icon" onClick={() => setSelectedYear(selectedYear - 1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="text-lg font-medium min-w-[60px] text-center">{selectedYear}年</span>
        <Button variant="ghost" size="icon" onClick={() => setSelectedYear(selectedYear + 1)}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base text-muted-foreground">年度收入</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg md:text-2xl font-bold font-mono text-income">
              +{currencyInfo.symbol}{yearlyTotals.income.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base text-muted-foreground">年度支出</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg md:text-2xl font-bold font-mono text-expense">
              -{currencyInfo.symbol}{yearlyTotals.expense.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base text-muted-foreground">年度结余</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-lg md:text-2xl font-bold font-mono ${yearlyTotals.net >= 0 ? "text-income" : "text-expense"}`}>
              {yearlyTotals.net >= 0 ? "+" : ""}{currencyInfo.symbol}{yearlyTotals.net.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base text-muted-foreground">环比变化</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {compareData.change > 0 ? (
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-expense" />
              ) : compareData.change < 0 ? (
                <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-income" />
              ) : null}
              <p className={`text-lg md:text-2xl font-bold ${compareData.change > 0 ? "text-expense" : compareData.change < 0 ? "text-income" : ""}`}>
                {compareData.change > 0 ? "+" : ""}{compareData.change.toFixed(1)}%
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">本月vs上月支出</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trend">
        <TabsList>
          <TabsTrigger value="trend">收支趋势</TabsTrigger>
          <TabsTrigger value="category">分类分析</TabsTrigger>
          <TabsTrigger value="compare">月度对比</TabsTrigger>
        </TabsList>

        <TabsContent value="trend" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">月度收支趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] md:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${currencyInfo.symbol}${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => [`${currencyInfo.symbol}${value.toFixed(2)}`, ""]}
                      labelStyle={{ color: "var(--foreground)" }}
                      contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="income"
                      name="收入"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ fill: "#10B981" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="expense"
                      name="支出"
                      stroke="#EF4444"
                      strokeWidth={2}
                      dot={{ fill: "#EF4444" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category" className="mt-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg">支出分类占比</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] md:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="total"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${currencyInfo.symbol}${value.toFixed(2)}`, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg">分类排行</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryData.map((cat, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-6">{index + 1}</span>
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="flex-1 font-medium">{cat.name}</span>
                      <span className="font-mono text-expense">
                        {currencyInfo.symbol}{cat.total.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compare" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">月度收支对比</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] md:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${currencyInfo.symbol}${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => [`${currencyInfo.symbol}${value.toFixed(2)}`, ""]}
                      labelStyle={{ color: "var(--foreground)" }}
                      contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
                    />
                    <Legend />
                    <Bar dataKey="income" name="收入" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="支出" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
