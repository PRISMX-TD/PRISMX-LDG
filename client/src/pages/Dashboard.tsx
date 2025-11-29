import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import type {
  Wallet as WalletType,
  Category,
  Transaction,
} from "@shared/schema";
import { getCurrencyInfo } from "@shared/schema";

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
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);

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

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden md:block">
        <Header user={user} />
      </div>

      <main className="container mx-auto px-4 py-4 md:py-6 space-y-4 md:space-y-6">
        <div className="grid gap-3 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <TotalAssetsCard 
            wallets={wallets} 
            isLoading={isWalletsLoading} 
            defaultCurrency={user?.defaultCurrency || "MYR"}
          />

          <Card>
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

          <Card>
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
        </div>

        <section>
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
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={Wallet}
                  title="还没有钱包"
                  description="系统正在为您初始化默认钱包，请稍候刷新页面"
                />
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="hidden md:grid gap-4 grid-cols-2 lg:grid-cols-3">
                {wallets.map((wallet) => (
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
                {wallets.map((wallet) => (
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
            </>
          )}
        </section>

        <div className="grid gap-3 md:gap-6 grid-cols-1 md:grid-cols-2">
          <BudgetCard currency={user?.defaultCurrency || "MYR"} categories={categories} />
          <SavingsGoalCard currency={user?.defaultCurrency || "MYR"} />
        </div>

        <section>
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

          <Card>
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
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <FloatingActionButton onClick={() => setIsModalOpen(true)} />

      <TransactionModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        wallets={wallets}
        categories={categories}
        defaultCurrency={user?.defaultCurrency || "MYR"}
      />

      <WalletModal
        open={isWalletModalOpen}
        onOpenChange={setIsWalletModalOpen}
        wallet={selectedWallet}
        defaultCurrency={user?.defaultCurrency || "MYR"}
      />
    </div>
  );
}
