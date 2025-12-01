import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { TransactionFilters, TransactionFilterValues } from "@/components/TransactionFilters";
import { TransactionItem, TransactionItemSkeleton } from "@/components/TransactionItem";
import { TransactionModal } from "@/components/TransactionModal";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseChart } from "@/components/ExpenseChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import type { Wallet, Category, Transaction } from "@shared/schema";
import { getCurrencyInfo } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TransactionWithRelations extends Transaction {
  category?: Category | null;
  wallet?: Wallet | null;
  toWallet?: Wallet | null;
}

interface TransactionStats {
  totalIncome: number;
  totalExpense: number;
  categoryBreakdown: { categoryId: number; categoryName: string; total: number; color: string }[];
}

export default function Transactions() {
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filters, setFilters] = useState<TransactionFilterValues>({});

  const { data: wallets = [] } = useQuery<Wallet[]>({
    queryKey: ["/api/wallets"],
    enabled: isAuthenticated,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    enabled: isAuthenticated,
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append("startDate", filters.startDate.toISOString());
    if (filters.endDate) params.append("endDate", filters.endDate.toISOString());
    if (filters.categoryId) params.append("categoryId", filters.categoryId.toString());
    if (filters.walletId) params.append("walletId", filters.walletId.toString());
    if (filters.type) params.append("type", filters.type);
    if (filters.search) params.append("search", filters.search);
    return params.toString();
  }, [filters]);

  const { data: transactions = [], isLoading: isTransactionsLoading } = useQuery<TransactionWithRelations[]>({
    queryKey: ["/api/transactions", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/transactions${queryParams ? `?${queryParams}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: stats, isLoading: isStatsLoading } = useQuery<TransactionStats>({
    queryKey: ["/api/transactions/stats", { startDate: filters.startDate, endDate: filters.endDate }],
    queryFn: async () => {
      if (!filters.startDate || !filters.endDate) return { totalIncome: 0, totalExpense: 0, categoryBreakdown: [] };
      const res = await fetch(
        `/api/transactions/stats?startDate=${filters.startDate.toISOString()}&endDate=${filters.endDate.toISOString()}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: isAuthenticated && !!filters.startDate && !!filters.endDate,
  });

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

  const handleExport = () => {
    const exportUrl = `/api/transactions/export${queryParams ? `?${queryParams}` : ""}`;
    window.open(exportUrl, "_blank");
  };

  const handleDeleteTransaction = (transaction: Transaction) => {
    deleteMutation.mutate(transaction.id);
  };

  const handleCloseModal = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setEditingTransaction(null);
    }
  };

  const handleAddNew = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const currencyInfo = getCurrencyInfo(user?.defaultCurrency || "MYR");

  if (isAuthLoading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden md:block">
        <Header user={user} />
      </div>

      <main className="container mx-auto px-4 py-4 md:py-6 space-y-4 md:space-y-6">
        <div className="hidden md:flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Receipt className="w-6 h-6" />
            交易记录
          </h1>
        </div>

        <div className="grid gap-3 md:gap-6 grid-cols-2 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-base font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-income" />
                收入
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <p className="text-lg md:text-2xl font-bold font-mono text-income">
                  +{currencyInfo.symbol}{(stats?.totalIncome || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-base font-medium flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-expense" />
                支出
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <p className="text-lg md:text-2xl font-bold font-mono text-expense">
                  -{currencyInfo.symbol}{(stats?.totalExpense || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">净收入</CardTitle>
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p
                  className={`text-xl md:text-2xl font-bold font-mono ${
                    (stats?.totalIncome || 0) - (stats?.totalExpense || 0) >= 0 ? "text-income" : "text-expense"
                  }`}
                >
                  {(stats?.totalIncome || 0) - (stats?.totalExpense || 0) >= 0 ? "+" : ""}
                  {currencyInfo.symbol}
                  {((stats?.totalIncome || 0) - (stats?.totalExpense || 0)).toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <TransactionFilters
              categories={categories}
              wallets={wallets}
              filters={filters}
              onFiltersChange={setFilters}
              onExport={handleExport}
            />

            <Card>
              <CardContent className="p-4">
                {isTransactionsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <TransactionItemSkeleton key={i} />
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="没有找到交易记录"
                    description="调整筛选条件或添加新交易"
                    actionLabel="记一笔"
                    onAction={handleAddNew}
                  />
                ) : (
                  <div className="space-y-3">
                    {transactions.map((transaction) => (
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
          </div>

          <div>
            <ExpenseChart
              data={stats?.categoryBreakdown || []}
              currency={user?.defaultCurrency}
              isLoading={isStatsLoading}
            />
          </div>
        </div>
      </main>

      <FloatingActionButton onClick={handleAddNew} />

      <TransactionModal
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        wallets={wallets}
        categories={categories}
        defaultCurrency={user?.defaultCurrency || "MYR"}
        transaction={editingTransaction}
        onDelete={handleDeleteTransaction}
      />
    </div>
  );
}
