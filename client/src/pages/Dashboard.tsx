import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { TotalAssetsCard } from "@/components/TotalAssetsCard";
import { WalletCard, WalletCardSkeleton } from "@/components/WalletCard";
import {
  TransactionItem,
  TransactionItemSkeleton,
} from "@/components/TransactionItem";
import { TransactionModal } from "@/components/TransactionModal";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { EmptyState } from "@/components/EmptyState";
import { WalletModal } from "@/components/WalletModal";
import { BudgetCard } from "@/components/BudgetCard";
import { SavingsGoalCard } from "@/components/SavingsGoalCard";
import { DashboardSettingsModal } from "@/components/DashboardSettingsModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  Receipt,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  ArrowRightLeft,
  Plus,
  Settings,
  Unlock,
} from "lucide-react";
import type {
  Wallet as WalletType,
  Category,
  Transaction,
} from "@shared/schema";
import { getCurrencyInfo, walletTypes, walletTypeLabels } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface WalletPreferences {
  walletOrder: Record<string, number[]> | null;
  typeOrder: string[] | null;
  groupByType: boolean;
}

interface DashboardPreferences {
  showTotalAssets: boolean;
  showMonthlyIncome: boolean;
  showMonthlyExpense: boolean;
  showWallets: boolean;
  showBudgets: boolean;
  showSavingsGoals: boolean;
  showRecentTransactions: boolean;
  showFlexibleFunds: boolean;
  cardOrder: string[] | null;
}

type CardKey = "showTotalAssets" | "showMonthlyIncome" | "showMonthlyExpense" | "showFlexibleFunds" | "showWallets" | "showBudgets" | "showSavingsGoals" | "showRecentTransactions";

const defaultCardOrder: CardKey[] = [
  "showTotalAssets",
  "showMonthlyIncome", 
  "showMonthlyExpense",
  "showFlexibleFunds",
  "showWallets",
  "showBudgets",
  "showSavingsGoals",
  "showRecentTransactions",
];

interface TransactionWithRelations extends Transaction {
  category?: Category | null;
  wallet?: WalletType | null;
  toWallet?: WalletType | null;
}

export default function Dashboard() {
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      toast({
        title: "会话已过期",
        description: "正在重新登录...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isAuthLoading, toast]);

  const { data: wallets = [], isLoading: isWalletsLoading } = useQuery<
    WalletType[]
  >({
    queryKey: ["/api/wallets"],
    enabled: isAuthenticated,
  });

  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery<
    Category[]
  >({
    queryKey: ["/api/categories"],
    enabled: isAuthenticated,
  });

  const { data: transactions = [], isLoading: isTransactionsLoading } =
    useQuery<TransactionWithRelations[]>({
      queryKey: ["/api/transactions"],
      enabled: isAuthenticated,
    });

  const { data: preferences } = useQuery<DashboardPreferences>({
    queryKey: ["/api/dashboard-preferences"],
    enabled: isAuthenticated,
  });

  const { data: walletPreferences } = useQuery<WalletPreferences>({
    queryKey: ["/api/wallet-preferences"],
    enabled: isAuthenticated,
  });

  const prefs = preferences ?? {
    showTotalAssets: true,
    showMonthlyIncome: true,
    showMonthlyExpense: true,
    showWallets: true,
    showBudgets: true,
    showSavingsGoals: true,
    showRecentTransactions: true,
    showFlexibleFunds: false,
    cardOrder: null,
  };

  const orderedCardKeys = useMemo(() => {
    const order = prefs.cardOrder;
    if (!order || order.length === 0) {
      return defaultCardOrder;
    }
    const validOrder = order.filter((key): key is CardKey => 
      defaultCardOrder.includes(key as CardKey)
    );
    const remaining = defaultCardOrder.filter(key => !validOrder.includes(key));
    return [...validOrder, ...remaining];
  }, [prefs.cardOrder]);

  const groupedWallets = useMemo(() => {
    const wPrefs = walletPreferences;
    const savedTypeOrder = wPrefs?.typeOrder || [];
    const walletOrderByType = wPrefs?.walletOrder || {};

    const fullTypeOrder = [...savedTypeOrder];
    walletTypes.forEach((type) => {
      if (!fullTypeOrder.includes(type)) {
        fullTypeOrder.push(type);
      }
    });

    const groups: Record<string, WalletType[]> = {};
    
    fullTypeOrder.forEach((type) => {
      groups[type] = [];
    });

    wallets.forEach((wallet) => {
      const type = wallet.type || "cash";
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(wallet);
    });

    Object.keys(groups).forEach((type) => {
      const order = walletOrderByType[type];
      if (order && order.length > 0) {
        groups[type].sort((a, b) => {
          const aIndex = order.map(Number).indexOf(a.id);
          const bIndex = order.map(Number).indexOf(b.id);
          if (aIndex === -1 && bIndex === -1) return 0;
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
      }
    });

    return { groups, typeOrder: fullTypeOrder };
  }, [wallets, walletPreferences]);

  const recentTransactions = transactions.slice(0, 10);

  const getMonthlyStats = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyTransactions = transactions.filter((t) => {
      const date = new Date(t.date);
      return (
        date.getMonth() === currentMonth && date.getFullYear() === currentYear
      );
    });

    const income = monthlyTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);

    const expense = monthlyTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);

    return { income, expense };
  };

  const { income: monthlyIncome, expense: monthlyExpense } = getMonthlyStats();
  const userCurrencyInfo = getCurrencyInfo(user?.defaultCurrency || "MYR");

  const flexibleFundsTotal = wallets
    .filter((w) => w.isFlexible !== false)
    .reduce((sum, w) => {
      const balance = parseFloat(w.balance || "0");
      const rate = parseFloat(w.exchangeRateToDefault || "1");
      return sum + balance * rate;
    }, 0);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({
        title: "删除成功",
        description: "交易记录已删除",
      });
    },
    onError: () => {
      toast({
        title: "删除失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const handleDeleteTransaction = (transaction: Transaction) => {
    deleteMutation.mutate(transaction.id);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Wallet className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const renderSummaryCard = (key: CardKey) => {
    switch (key) {
      case "showTotalAssets":
        return prefs.showTotalAssets ? (
          <TotalAssetsCard 
            key={key}
            wallets={wallets} 
            isLoading={isWalletsLoading} 
            defaultCurrency={user?.defaultCurrency || "MYR"}
          />
        ) : null;
      case "showFlexibleFunds":
        return prefs.showFlexibleFunds ? (
          <Card key={key} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Unlock className="w-4 h-4 text-primary" />
                可灵活调用
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isWalletsLoading ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <p
                  className="text-3xl font-bold font-mono text-primary"
                  data-testid="text-flexible-funds"
                >
                  {userCurrencyInfo.symbol}
                  {flexibleFundsTotal.toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                非长期储蓄/应急资金
              </p>
            </CardContent>
          </Card>
        ) : null;
      case "showMonthlyIncome":
        return prefs.showMonthlyIncome ? (
          <Card key={key} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-income" />
                本月收入
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isTransactionsLoading ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <p
                  className="text-3xl font-bold font-mono text-income"
                  data-testid="text-monthly-income"
                >
                  +{userCurrencyInfo.symbol}
                  {monthlyIncome.toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        ) : null;
      case "showMonthlyExpense":
        return prefs.showMonthlyExpense ? (
          <Card key={key} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-expense" />
                本月支出
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isTransactionsLoading ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <p
                  className="text-3xl font-bold font-mono text-expense"
                  data-testid="text-monthly-expense"
                >
                  -{userCurrencyInfo.symbol}
                  {monthlyExpense.toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        ) : null;
      default:
        return null;
    }
  };

  const renderSection = (key: CardKey) => {
    switch (key) {
      case "showWallets":
        return prefs.showWallets ? (
          <section key={key}>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                我的钱包
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedWallet(null);
                  setIsWalletModalOpen(true);
                }}
                data-testid="button-add-wallet"
              >
                <Plus className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">添加钱包</span>
                <span className="sm:hidden">添加</span>
              </Button>
            </div>
            {isWalletsLoading ? (
              <>
                <div className="hidden md:grid gap-4 grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <WalletCardSkeleton key={i} />
                  ))}
                </div>
                <div className="md:hidden space-y-2">
                  {[1, 2, 3].map((i) => (
                    <WalletCardSkeleton key={i} />
                  ))}
                </div>
              </>
            ) : wallets.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-0">
                  <EmptyState
                    icon={Wallet}
                    title="还没有钱包"
                    description="系统正在为您初始化默认钱包，请稍候刷新页面"
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {groupedWallets.typeOrder.map((type) => {
                  const walletsInType = groupedWallets.groups[type] || [];
                  if (walletsInType.length === 0) return null;
                  return (
                    <div key={type} className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        {walletTypeLabels[type] || type}
                        <span className="text-xs text-muted-foreground/60">({walletsInType.length})</span>
                      </h3>
                      <div className="hidden md:grid gap-3 grid-cols-2 lg:grid-cols-3">
                        {walletsInType.map((wallet) => (
                          <WalletCard
                            key={wallet.id}
                            wallet={wallet}
                            onClick={() => {
                              setSelectedWallet(wallet);
                              setIsWalletModalOpen(true);
                            }}
                          />
                        ))}
                      </div>
                      <div className="md:hidden space-y-2">
                        {walletsInType.map((wallet) => (
                          <WalletCard
                            key={wallet.id}
                            wallet={wallet}
                            onClick={() => {
                              setSelectedWallet(wallet);
                              setIsWalletModalOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null;
      case "showBudgets":
        return prefs.showBudgets ? (
          <BudgetCard key={key} currency={user?.defaultCurrency || "MYR"} categories={categories} />
        ) : null;
      case "showSavingsGoals":
        return prefs.showSavingsGoals ? (
          <SavingsGoalCard key={key} currency={user?.defaultCurrency || "MYR"} />
        ) : null;
      case "showRecentTransactions":
        return prefs.showRecentTransactions ? (
          <section key={key}>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-lg md:text-xl font-semibold flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                最近交易
              </h2>
              <Link href="/transactions">
                <Button variant="ghost" size="sm" data-testid="button-view-all">
                  查看全部
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <Card className="glass-card">
              <CardContent className="p-4">
                {isTransactionsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <TransactionItemSkeleton key={i} />
                    ))}
                  </div>
                ) : recentTransactions.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="还没有交易记录"
                    description="点击右下角的按钮开始记录您的第一笔交易"
                    actionLabel="记一笔"
                    onAction={() => setIsModalOpen(true)}
                  />
                ) : (
                  <div className="space-y-3">
                    {recentTransactions.map((transaction) => (
                      <TransactionItem
                        key={transaction.id}
                        transaction={transaction}
                        category={transaction.category}
                        wallet={transaction.wallet}
                        toWallet={transaction.toWallet}
                        onClick={(tx) => {
                          setEditingTransaction(tx);
                          setIsModalOpen(true);
                        }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        ) : null;
      default:
        return null;
    }
  };

  const summaryCardKeys: CardKey[] = ["showTotalAssets", "showFlexibleFunds", "showMonthlyIncome", "showMonthlyExpense"];
  
  const renderCardByKey = (key: CardKey): JSX.Element | null => {
    if (summaryCardKeys.includes(key)) {
      return renderSummaryCard(key);
    }
    return renderSection(key);
  };

  return (
    <div className="min-h-screen">
      <div className="hidden md:block">
        <Header user={user} />
      </div>

      <main className="container mx-auto px-4 py-4 md:py-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold md:hidden">仪表盘</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            data-testid="button-dashboard-settings"
            className="ml-auto"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {orderedCardKeys.map((key, index) => {
          const isSummaryCard = summaryCardKeys.includes(key);
          const isBudgetOrSavings = key === "showBudgets" || key === "showSavingsGoals";
          const isFirstSummaryCard = isSummaryCard && 
            orderedCardKeys.slice(0, index).filter(k => summaryCardKeys.includes(k)).length === 0;
          
          if (isSummaryCard) {
            if (isFirstSummaryCard) {
              const summaryCards = orderedCardKeys.filter(k => summaryCardKeys.includes(k));
              return (
                <div key="summary-grid" className="grid gap-3 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {summaryCards.map(k => renderSummaryCard(k))}
                </div>
              );
            }
            return null;
          }
          
          if (isBudgetOrSavings) {
            const budgetIndex = orderedCardKeys.indexOf("showBudgets");
            const savingsIndex = orderedCardKeys.indexOf("showSavingsGoals");
            const areBothVisible = prefs.showBudgets && prefs.showSavingsGoals;
            const areConsecutive = Math.abs(budgetIndex - savingsIndex) === 1;
            
            if (areBothVisible && areConsecutive) {
              const firstOfPair = Math.min(budgetIndex, savingsIndex);
              if (index === firstOfPair) {
                const pairKeys = budgetIndex < savingsIndex 
                  ? ["showBudgets", "showSavingsGoals"] 
                  : ["showSavingsGoals", "showBudgets"];
                return (
                  <div key="budget-savings-grid" className="grid gap-3 md:gap-6 grid-cols-1 md:grid-cols-2">
                    {pairKeys.map(k => renderSection(k as CardKey))}
                  </div>
                );
              }
              return null;
            }
          }
          
          return renderCardByKey(key);
        })}
      </main>

      <FloatingActionButton onClick={() => {
        setEditingTransaction(null);
        setIsModalOpen(true);
      }} />

      <TransactionModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setEditingTransaction(null);
          }
        }}
        wallets={wallets}
        categories={categories}
        defaultCurrency={user?.defaultCurrency || "MYR"}
        transaction={editingTransaction}
        onDelete={handleDeleteTransaction}
      />

      <WalletModal
        open={isWalletModalOpen}
        onOpenChange={setIsWalletModalOpen}
        wallet={selectedWallet}
        defaultCurrency={user?.defaultCurrency || "MYR"}
      />

      <DashboardSettingsModal
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </div>
  );
}
