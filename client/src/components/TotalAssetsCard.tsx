import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Wallet } from "lucide-react";
import type { Wallet as WalletType } from "@shared/schema";
import { getCurrencyInfo } from "@shared/schema";

interface TotalAssetsCardProps {
  wallets: WalletType[];
  isLoading?: boolean;
  defaultCurrency?: string;
}

export function TotalAssetsCard({ wallets, isLoading, defaultCurrency = "MYR" }: TotalAssetsCardProps) {
  const currencyInfo = getCurrencyInfo(defaultCurrency);
  
  const totalBalance = wallets.reduce(
    (sum, wallet) => sum + parseFloat(wallet.balance || "0"),
    0
  );
  
  const currencyGroups = wallets.reduce((acc, wallet) => {
    const currency = wallet.currency || "MYR";
    if (!acc[currency]) acc[currency] = 0;
    acc[currency] += parseFloat(wallet.balance || "0");
    return acc;
  }, {} as Record<string, number>);
  
  const currencies = Object.keys(currencyGroups);

  if (isLoading) {
    return (
      <Card className="bg-primary text-primary-foreground">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2 opacity-90">
            <Wallet className="w-5 h-5" />
            总资产
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-12 w-48 bg-white/20 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-primary text-primary-foreground overflow-visible">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2 opacity-90">
          <Wallet className="w-5 h-5" />
          总资产
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currencies.length <= 1 ? (
          <div className="flex items-baseline gap-1">
            <span className="text-lg opacity-80">{currencyInfo.symbol}</span>
            <span
              className="text-4xl font-bold font-mono tracking-tight"
              data-testid="text-total-assets"
            >
              {totalBalance.toLocaleString("zh-CN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        ) : (
          <div className="space-y-1" data-testid="text-total-assets">
            {currencies.map((currency) => {
              const info = getCurrencyInfo(currency);
              const amount = currencyGroups[currency];
              return (
                <div key={currency} className="flex items-baseline gap-1">
                  <span className="text-sm opacity-80">{info.symbol}</span>
                  <span className="text-2xl font-bold font-mono tracking-tight">
                    {amount.toLocaleString("zh-CN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-xs opacity-60 ml-1">{currency}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-2 mt-3 text-sm opacity-80">
          <TrendingUp className="w-4 h-4" />
          <span>{wallets.length} 个账户</span>
        </div>
      </CardContent>
    </Card>
  );
}
