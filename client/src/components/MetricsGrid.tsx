import { Wallet, CreditCard, Coins, PiggyBank, MoreHorizontal, TrendingUp } from "lucide-react";
import { getCurrencyInfo } from "@shared/schema";

interface MetricsGridProps {
  totalAssets: number;
  monthlyExpense: number;
  monthlyIncome: number;
  currencyCode?: string;
}

export function MetricsGrid({ 
  totalAssets, 
  monthlyExpense, 
  monthlyIncome, 
  currencyCode = "MYR" 
}: MetricsGridProps) {
  const currency = getCurrencyInfo(currencyCode);
  const netSavings = monthlyIncome - monthlyExpense;
  const savingsRate = monthlyIncome > 0 ? ((netSavings / monthlyIncome) * 100).toFixed(1) : "0";
  const expenseRate = monthlyIncome > 0 ? ((monthlyExpense / monthlyIncome) * 100).toFixed(1) : "0";

  const formatMoney = (amount: number) => {
    return `${currency.symbol} ${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Assets */}
      <div className="glass-card p-5 group">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Wallet className="w-4 h-4 text-blue-400" />
            总资产估值
          </div>
          <MoreHorizontal className="w-4 h-4 text-gray-600 cursor-pointer hover:text-white" />
        </div>
        <div className="text-2xl lg:text-3xl font-bold text-white mb-1 group-hover:text-blue-200 transition-colors font-mono">
          {formatMoney(totalAssets)}
        </div>
        <div className="flex items-center text-xs text-success bg-success/10 w-fit px-2 py-1 rounded">
          <TrendingUp className="w-3 h-3 mr-1" />
          +2.4% 与上月
        </div>
      </div>

      {/* Monthly Expense */}
      <div className="glass-card p-5 group">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <CreditCard className="w-4 h-4 text-neon-glow" />
            本月支出
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-bold text-white mb-1 group-hover:text-purple-200 transition-colors font-mono">
          {formatMoney(monthlyExpense)}
        </div>
        <div className="flex items-center text-xs text-gray-500 gap-2">
          <div className="h-1.5 w-16 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-neon-purple" 
              style={{ width: `${Math.min(parseFloat(expenseRate), 100)}%` }}
            ></div>
          </div>
          支出率 {expenseRate}%
        </div>
      </div>

      {/* Monthly Income */}
      <div className="glass-card p-5 group">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Coins className="w-4 h-4 text-yellow-400" />
            本月收入
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-bold text-white mb-1 font-mono">
          {formatMoney(monthlyIncome)}
        </div>
        <div className="flex items-center text-xs text-gray-500">
          固定工资 + 副业
        </div>
      </div>

      {/* Net Savings */}
      <div className="glass-card p-5 group relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-success/20 blur-xl rounded-full"></div>
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <PiggyBank className="w-4 h-4 text-success" />
            本月结余
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-bold text-white mb-1 relative z-10 group-hover:text-green-100 transition-colors font-mono">
          {formatMoney(netSavings)}
        </div>
        <div className="text-xs text-success relative z-10">
          储蓄率 {savingsRate}%
        </div>
      </div>
    </div>
  );
}
