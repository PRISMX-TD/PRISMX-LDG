import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Wallet,
  PieChart as PieChartIcon,
  Calendar,
  ArrowUpDown,
  Settings2,
  Target,
  Percent,
  Activity,
} from "lucide-react";
import { getCurrencyInfo } from "@shared/schema";
import {
  AreaChart,
  Area,
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
  LineChart,
  Line,
  ComposedChart,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Transaction, Category, Wallet as WalletType, Budget, SavingsGoal } from "@shared/schema";

const CHART_COLORS = [
  "#8B5CF6", "#A78BFA", "#C4B5FD", "#DDD6FE",
  "#10B981", "#34D399", "#6EE7B7", "#A7F3D0",
];

interface AnalyticsPreferences {
  showYearlyStats: boolean;
  showMonthlyTrend: boolean;
  showExpenseDistribution: boolean;
  showIncomeDistribution: boolean;
  showBudgetProgress: boolean;
  showSavingsProgress: boolean;
  showWalletDistribution: boolean;
  showCashflowTrend: boolean;
  showTopCategories: boolean;
  showMonthlyComparison: boolean;
  cardOrder: string[] | null;
}

const defaultPreferences: AnalyticsPreferences = {
  showYearlyStats: true,
  showMonthlyTrend: true,
  showExpenseDistribution: true,
  showIncomeDistribution: true,
  showBudgetProgress: true,
  showSavingsProgress: true,
  showWalletDistribution: true,
  showCashflowTrend: true,
  showTopCategories: true,
  showMonthlyComparison: true,
  cardOrder: null,
};

export default function Analytics() {
  const { user } = useAuth();
  const currencyInfo = getCurrencyInfo(user?.defaultCurrency || "MYR");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dataView, setDataView] = useState<"overview" | "income" | "expense" | "savings">("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: preferences = defaultPreferences } = useQuery<AnalyticsPreferences>({
    queryKey: ["/api/analytics-preferences"],
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (data: Partial<AnalyticsPreferences>) =>
      apiRequest("/api/analytics-preferences", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics-preferences"] });
    },
  });

  const { data: transactions = [], isLoading: isTransactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: wallets = [] } = useQuery<WalletType[]>({
    queryKey: ["/api/wallets"],
  });

  const { data: budgets = [] } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });

  const { data: savingsGoals = [] } = useQuery<SavingsGoal[]>({
    queryKey: ["/api/savings-goals"],
  });

  const { data: budgetSpending = [] } = useQuery<any[]>({
    queryKey: ["/api/budgets/spending", { month: new Date().getMonth() + 1, year: selectedYear }],
  });

  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(selectedYear, i, 1);
      return {
        month: format(date, "M月"),
        shortMonth: format(date, "M"),
        income: 0,
        expense: 0,
        savings: 0,
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

    months.forEach((m) => {
      m.savings = m.income - m.expense;
    });

    return months;
  }, [transactions, selectedYear]);

  const expenseCategoryData = useMemo(() => {
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
          color: category?.color || CHART_COLORS[Object.keys(categoryTotals).length % CHART_COLORS.length],
          total: 0,
        };
      }
      categoryTotals[categoryId].total += parseFloat(t.amount);
    });

    return Object.values(categoryTotals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [transactions, categories, selectedYear]);

  const incomeCategoryData = useMemo(() => {
    const categoryTotals: Record<number, { name: string; color: string; total: number }> = {};
    
    transactions.forEach((t) => {
      if (t.type !== "income") return;
      const date = new Date(t.date);
      if (date.getFullYear() !== selectedYear) return;
      
      const categoryId = t.categoryId || 0;
      if (!categoryTotals[categoryId]) {
        const category = categories.find((c) => c.id === categoryId);
        categoryTotals[categoryId] = {
          name: category?.name || "其他",
          color: category?.color || CHART_COLORS[Object.keys(categoryTotals).length % CHART_COLORS.length],
          total: 0,
        };
      }
      categoryTotals[categoryId].total += parseFloat(t.amount);
    });

    return Object.values(categoryTotals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [transactions, categories, selectedYear]);

  const walletData = useMemo(() => {
    return wallets.map((w, i) => ({
      name: w.name,
      balance: parseFloat(w.balance || "0"),
      color: w.color || CHART_COLORS[i % CHART_COLORS.length],
    })).filter(w => w.balance > 0);
  }, [wallets]);

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

    return { income, expense, savings: income - expense };
  }, [transactions, selectedYear]);

  const compareData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentMonthData = monthlyData[currentMonth];
    const lastMonthData = currentMonth > 0 ? monthlyData[currentMonth - 1] : null;
    
    const expenseChange = lastMonthData && lastMonthData.expense > 0 
      ? ((currentMonthData.expense - lastMonthData.expense) / lastMonthData.expense) * 100 
      : 0;

    const incomeChange = lastMonthData && lastMonthData.income > 0 
      ? ((currentMonthData.income - lastMonthData.income) / lastMonthData.income) * 100 
      : 0;

    return { expenseChange, incomeChange };
  }, [monthlyData]);

  const totalBalance = useMemo(() => {
    return wallets.reduce((sum, w) => sum + parseFloat(w.balance || "0"), 0);
  }, [wallets]);

  const cumulativeSavingsData = useMemo(() => {
    let cumulative = 0;
    return monthlyData.map((m) => {
      cumulative += m.savings;
      return {
        ...m,
        cumulative,
      };
    });
  }, [monthlyData]);

  const budgetProgressData = useMemo(() => {
    return budgetSpending.map((b: any) => ({
      name: b.categoryName,
      budget: parseFloat(b.amount),
      spent: b.spent,
      remaining: Math.max(0, parseFloat(b.amount) - b.spent),
      percentage: (b.spent / parseFloat(b.amount)) * 100,
      color: b.categoryColor,
    })).slice(0, 5);
  }, [budgetSpending]);

  const savingsGoalsProgress = useMemo(() => {
    return savingsGoals.map((g: SavingsGoal) => {
      const current = parseFloat(g.currentAmount);
      const target = parseFloat(g.targetAmount);
      return {
        name: g.name,
        current,
        target,
        percentage: target > 0 ? (current / target) * 100 : 0,
        isCompleted: g.isCompleted,
      };
    });
  }, [savingsGoals]);

  const formatAmount = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toFixed(0);
  };

  const togglePreference = (key: keyof AnalyticsPreferences) => {
    updatePreferencesMutation.mutate({ [key]: !preferences[key] });
  };

  if (isTransactionsLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="hidden md:flex text-2xl font-bold items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          数据分析
        </h1>
        <div className="flex items-center gap-2 mx-auto md:mx-0">
          <Button variant="ghost" size="icon" onClick={() => setSelectedYear(selectedYear - 1)} data-testid="button-prev-year">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-lg font-semibold min-w-[80px] text-center" data-testid="text-selected-year">{selectedYear}年</span>
          <Button variant="ghost" size="icon" onClick={() => setSelectedYear(selectedYear + 1)} data-testid="button-next-year">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} data-testid="button-analytics-settings">
          <Settings2 className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: "overview", label: "总览", icon: BarChart3 },
          { key: "income", label: "收入分析", icon: TrendingUp },
          { key: "expense", label: "支出分析", icon: TrendingDown },
          { key: "savings", label: "储蓄趋势", icon: Wallet },
        ].map((item) => (
          <Button
            key={item.key}
            variant={dataView === item.key ? "default" : "outline"}
            size="sm"
            onClick={() => setDataView(item.key as any)}
            className="gap-1.5"
            data-testid={`button-view-${item.key}`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Button>
        ))}
      </div>

      {preferences.showYearlyStats && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="glass-card" data-testid="card-yearly-income">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <TrendingUp className="w-4 h-4 text-income" />
                <span>年度收入</span>
              </div>
              <p className="text-xl md:text-2xl font-bold font-mono text-income">
                +{currencyInfo.symbol}{formatAmount(yearlyTotals.income)}
              </p>
              {compareData.incomeChange !== 0 && (
                <p className={`text-xs mt-1 ${compareData.incomeChange > 0 ? "text-income" : "text-expense"}`}>
                  {compareData.incomeChange > 0 ? "↑" : "↓"} {Math.abs(compareData.incomeChange).toFixed(1)}% vs上月
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card" data-testid="card-yearly-expense">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <TrendingDown className="w-4 h-4 text-expense" />
                <span>年度支出</span>
              </div>
              <p className="text-xl md:text-2xl font-bold font-mono text-expense">
                -{currencyInfo.symbol}{formatAmount(yearlyTotals.expense)}
              </p>
              {compareData.expenseChange !== 0 && (
                <p className={`text-xs mt-1 ${compareData.expenseChange > 0 ? "text-expense" : "text-income"}`}>
                  {compareData.expenseChange > 0 ? "↑" : "↓"} {Math.abs(compareData.expenseChange).toFixed(1)}% vs上月
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card" data-testid="card-yearly-savings">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Wallet className="w-4 h-4 text-primary" />
                <span>年度结余</span>
              </div>
              <p className={`text-xl md:text-2xl font-bold font-mono ${yearlyTotals.savings >= 0 ? "text-income" : "text-expense"}`}>
                {yearlyTotals.savings >= 0 ? "+" : ""}{currencyInfo.symbol}{formatAmount(yearlyTotals.savings)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                储蓄率: {yearlyTotals.income > 0 ? ((yearlyTotals.savings / yearlyTotals.income) * 100).toFixed(1) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card" data-testid="card-total-assets">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <ArrowUpDown className="w-4 h-4 text-transfer" />
                <span>总资产</span>
              </div>
              <p className="text-xl md:text-2xl font-bold font-mono">
                {currencyInfo.symbol}{formatAmount(totalBalance)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {wallets.length} 个账户
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {dataView === "overview" && (
        <>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            {preferences.showMonthlyTrend && (
              <Card className="glass-card lg:col-span-2" data-testid="card-monthly-trend">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    月度收支趋势
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyData}>
                        <defs>
                          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis 
                          dataKey="shortMonth" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                        />
                        <YAxis 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickFormatter={(v) => formatAmount(v)}
                        />
                        <Tooltip
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))',
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                          formatter={(value: number, name: string) => [
                            `${currencyInfo.symbol}${value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`,
                            name === "income" ? "收入" : "支出"
                          ]}
                          labelFormatter={(label) => `${label}月`}
                        />
                        <Area
                          type="monotone"
                          dataKey="income"
                          stroke="#10B981"
                          strokeWidth={2}
                          fill="url(#colorIncome)"
                        />
                        <Area
                          type="monotone"
                          dataKey="expense"
                          stroke="#EF4444"
                          strokeWidth={2}
                          fill="url(#colorExpense)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {preferences.showExpenseDistribution && (
              <Card className="glass-card" data-testid="card-expense-distribution">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4" />
                    支出分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseCategoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          dataKey="total"
                          paddingAngle={2}
                        >
                          {expenseCategoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [`${currencyInfo.symbol}${value.toFixed(2)}`, ""]} 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))',
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-2">
                    {expenseCategoryData.slice(0, 4).map((cat, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="text-muted-foreground">{cat.name}</span>
                        </div>
                        <span className="font-mono text-xs">{currencyInfo.symbol}{formatAmount(cat.total)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {preferences.showBudgetProgress && budgetProgressData.length > 0 && (
              <Card className="glass-card" data-testid="card-budget-progress">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    预算执行情况
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {budgetProgressData.map((b, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                          <span>{b.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {currencyInfo.symbol}{formatAmount(b.spent)} / {currencyInfo.symbol}{formatAmount(b.budget)}
                          </span>
                          <Badge variant={b.percentage > 100 ? "destructive" : b.percentage > 80 ? "secondary" : "outline"} className="text-xs">
                            {b.percentage.toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                      <Progress value={Math.min(b.percentage, 100)} className="h-1.5" />
                    </div>
                  ))}
                  {budgetProgressData.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无预算数据</p>
                  )}
                </CardContent>
              </Card>
            )}

            {preferences.showSavingsProgress && savingsGoalsProgress.length > 0 && (
              <Card className="glass-card" data-testid="card-savings-progress">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    储蓄目标进度
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {savingsGoalsProgress.map((g, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className={g.isCompleted ? "line-through text-muted-foreground" : ""}>{g.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {currencyInfo.symbol}{formatAmount(g.current)} / {currencyInfo.symbol}{formatAmount(g.target)}
                          </span>
                          <Badge variant={g.isCompleted ? "default" : "outline"} className="text-xs">
                            {g.percentage.toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                      <Progress value={Math.min(g.percentage, 100)} className="h-1.5" />
                    </div>
                  ))}
                  {savingsGoalsProgress.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无储蓄目标</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {preferences.showCashflowTrend && (
            <Card className="glass-card" data-testid="card-cashflow-trend">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  累计现金流趋势
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={cumulativeSavingsData}>
                      <defs>
                        <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="shortMonth" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickFormatter={(v) => formatAmount(v)}
                      />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number, name: string) => [
                          `${currencyInfo.symbol}${value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`,
                          name === "savings" ? "月结余" : "累计储蓄"
                        ]}
                        labelFormatter={(label) => `${label}月`}
                      />
                      <Bar dataKey="savings" fill="#8B5CF6" opacity={0.6} radius={[4, 4, 0, 0]} />
                      <Line 
                        type="monotone" 
                        dataKey="cumulative" 
                        stroke="#10B981" 
                        strokeWidth={2}
                        dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {dataView === "income" && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">月度收入</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="shortMonth" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(v) => formatAmount(v)}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [`${currencyInfo.symbol}${value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`, "收入"]}
                    />
                    <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">收入来源</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incomeCategoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="total"
                      paddingAngle={2}
                    >
                      {incomeCategoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`${currencyInfo.symbol}${value.toFixed(2)}`, ""]} 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {incomeCategoryData.map((cat, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-muted-foreground">{cat.name}</span>
                    </div>
                    <span className="font-mono text-income">{currencyInfo.symbol}{formatAmount(cat.total)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {dataView === "expense" && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">月度支出</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="shortMonth" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(v) => formatAmount(v)}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [`${currencyInfo.symbol}${value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`, "支出"]}
                    />
                    <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">支出分类排行</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {expenseCategoryData.map((cat, index) => {
                  const maxTotal = expenseCategoryData[0]?.total || 1;
                  const percentage = (cat.total / maxTotal) * 100;
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {index + 1}
                          </Badge>
                          <span>{cat.name}</span>
                        </div>
                        <span className="font-mono text-expense">{currencyInfo.symbol}{formatAmount(cat.total)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all" 
                          style={{ width: `${percentage}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {dataView === "savings" && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Card className="glass-card lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">月度储蓄趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(v) => formatAmount(v)}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [`${currencyInfo.symbol}${value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`, "结余"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="savings"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      fill="url(#colorSavings)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {preferences.showWalletDistribution && (
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">账户分布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={walletData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        dataKey="balance"
                        paddingAngle={2}
                      >
                        {walletData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [`${currencyInfo.symbol}${value.toFixed(2)}`, ""]} 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-2">
                  {walletData.slice(0, 4).map((wallet, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: wallet.color }} />
                        <span className="text-muted-foreground">{wallet.name}</span>
                      </div>
                      <span className="font-mono">{currencyInfo.symbol}{formatAmount(wallet.balance)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">储蓄概览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">平均月储蓄</span>
                <span className="font-mono font-medium">
                  {currencyInfo.symbol}{formatAmount(yearlyTotals.savings / 12)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">最高月储蓄</span>
                <span className="font-mono font-medium text-income">
                  {currencyInfo.symbol}{formatAmount(Math.max(...monthlyData.map(m => m.savings)))}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">最低月储蓄</span>
                <span className="font-mono font-medium text-expense">
                  {currencyInfo.symbol}{formatAmount(Math.min(...monthlyData.map(m => m.savings)))}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">储蓄率</span>
                <span className="font-mono font-medium">
                  {yearlyTotals.income > 0 ? ((yearlyTotals.savings / yearlyTotals.income) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              分析页设置
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="showYearlyStats" className="cursor-pointer">年度统计卡片</Label>
              <Switch
                id="showYearlyStats"
                checked={preferences.showYearlyStats}
                onCheckedChange={() => togglePreference("showYearlyStats")}
                data-testid="switch-yearly-stats"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="showMonthlyTrend" className="cursor-pointer">月度收支趋势</Label>
              <Switch
                id="showMonthlyTrend"
                checked={preferences.showMonthlyTrend}
                onCheckedChange={() => togglePreference("showMonthlyTrend")}
                data-testid="switch-monthly-trend"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="showExpenseDistribution" className="cursor-pointer">支出分布</Label>
              <Switch
                id="showExpenseDistribution"
                checked={preferences.showExpenseDistribution}
                onCheckedChange={() => togglePreference("showExpenseDistribution")}
                data-testid="switch-expense-distribution"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="showBudgetProgress" className="cursor-pointer">预算执行情况</Label>
              <Switch
                id="showBudgetProgress"
                checked={preferences.showBudgetProgress}
                onCheckedChange={() => togglePreference("showBudgetProgress")}
                data-testid="switch-budget-progress"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="showSavingsProgress" className="cursor-pointer">储蓄目标进度</Label>
              <Switch
                id="showSavingsProgress"
                checked={preferences.showSavingsProgress}
                onCheckedChange={() => togglePreference("showSavingsProgress")}
                data-testid="switch-savings-progress"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="showWalletDistribution" className="cursor-pointer">账户分布</Label>
              <Switch
                id="showWalletDistribution"
                checked={preferences.showWalletDistribution}
                onCheckedChange={() => togglePreference("showWalletDistribution")}
                data-testid="switch-wallet-distribution"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="showCashflowTrend" className="cursor-pointer">累计现金流趋势</Label>
              <Switch
                id="showCashflowTrend"
                checked={preferences.showCashflowTrend}
                onCheckedChange={() => togglePreference("showCashflowTrend")}
                data-testid="switch-cashflow-trend"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
