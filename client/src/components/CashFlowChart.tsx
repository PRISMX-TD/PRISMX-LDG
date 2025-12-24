import { useMemo, useEffect, useState, useRef } from "react";
import { format, subDays, startOfDay, isSameDay } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowUpRight, Calendar } from "lucide-react";

interface CashFlowChartProps {
  transactions?: any[];
}

export function CashFlowChart({ transactions = [] }: CashFlowChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [Recharts, setRecharts] = useState<any>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsVisible(true);
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || Recharts) return;
    import("recharts").then((mod) => setRecharts(mod));
  }, [isVisible, Recharts]);

  // Generate last 7 days data from actual transactions or mock if empty
  const data = useMemo(() => {
    const days = 7;
    const result = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayTransactions = transactions.filter(t => isSameDay(new Date(t.date), date));
      
      const income = dayTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
      const expense = dayTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      // Fallback to random data for demo if no transactions
      const hasData = transactions.length > 0;
      
      result.push({
        name: format(date, 'MM/dd'),
        income: hasData ? income : Math.floor(Math.random() * 5000) + 2000,
        expense: hasData ? expense : Math.floor(Math.random() * 3000) + 1000,
      });
    }
    return result;
  }, [transactions]);

  if (!Recharts || !isVisible) {
    return (
      <div ref={containerRef} className="flex-[2] glass-card p-6 min-h-[300px] flex items-center justify-center">
        <div className="animate-pulse text-gray-500">加载图表组件...</div>
      </div>
    );
  }

  const { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Defs, LinearGradient, Stop } = Recharts;

  return (
    <div ref={containerRef} className="flex-[2] glass-card p-6 flex flex-col min-w-[300px]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-neon-purple" />
            资金流向分析
          </h3>
          <p className="text-xs text-gray-500 mt-1">收入 vs 支出 (近7天)</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded-lg bg-white/5 text-xs text-white border border-white/10 hover:bg-white/10 transition-colors">周</button>
          <button className="px-3 py-1 rounded-lg bg-transparent text-xs text-gray-500 hover:text-white transition-colors">月</button>
          <button className="p-1.5 rounded-lg bg-transparent text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
            <Calendar className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#6B7280', fontSize: 12}} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#6B7280', fontSize: 12}} 
              tickFormatter={(value: number) => `¥${value}`}
            />
            <Tooltip 
              contentStyle={{backgroundColor: '#121216', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px'}}
              itemStyle={{color: '#fff'}}
            />
            <Area 
              type="monotone" 
              dataKey="income" 
              stroke="#8B5CF6" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorIncome)" 
            />
            <Area 
              type="monotone" 
              dataKey="expense" 
              stroke="#3B82F6" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorExpense)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
