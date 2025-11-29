import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Wallet } from "@shared/schema";
import { getCurrencyInfo } from "@shared/schema";
import {
  Wallet as WalletIcon,
  CreditCard,
  Banknote,
  Smartphone,
} from "lucide-react";

interface WalletCardProps {
  wallet: Wallet;
  onClick?: () => void;
}

const walletTypeLabels: Record<string, string> = {
  cash: "现金",
  bank_card: "银行卡",
  digital_wallet: "数字钱包",
  credit_card: "信用卡",
};

const walletTypeIcons: Record<string, typeof WalletIcon> = {
  cash: Banknote,
  bank_card: CreditCard,
  digital_wallet: Smartphone,
  credit_card: CreditCard,
};

export function WalletCard({ wallet, onClick }: WalletCardProps) {
  const Icon = walletTypeIcons[wallet.type] || WalletIcon;
  const balance = parseFloat(wallet.balance || "0");
  const currencyInfo = getCurrencyInfo(wallet.currency || "MYR");
  
  return (
    <Card
      className="hover-elevate cursor-pointer transition-all duration-200"
      onClick={onClick}
      data-testid={`card-wallet-${wallet.id}`}
    >
      <CardContent className="p-3 md:p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: wallet.color
                  ? `${wallet.color}20`
                  : "hsl(var(--primary) / 0.1)",
              }}
            >
              <Icon
                className="w-4 h-4 md:w-5 md:h-5"
                style={{ color: wallet.color || "hsl(var(--primary))" }}
              />
            </div>
            <h3 className="font-semibold text-sm md:text-base truncate">{wallet.name}</h3>
          </div>
          {wallet.isDefault && (
            <Badge variant="secondary" className="text-[10px] md:text-xs px-1.5 py-0.5 flex-shrink-0">
              默认
            </Badge>
          )}
        </div>
        <p className="text-[10px] md:text-xs text-muted-foreground mb-2 md:mb-3">
          {walletTypeLabels[wallet.type] || wallet.type} · {wallet.currency || "MYR"}
        </p>
        <p
          className={`text-lg md:text-2xl font-semibold font-mono ${
            balance < 0 ? "text-expense" : ""
          }`}
          data-testid={`text-balance-${wallet.id}`}
        >
          {currencyInfo.symbol}{balance.toLocaleString("zh-CN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      </CardContent>
    </Card>
  );
}

export function WalletCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-3 md:p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-muted flex-shrink-0" />
            <div className="h-4 w-16 md:w-20 bg-muted rounded" />
          </div>
        </div>
        <div className="h-2.5 md:h-3 w-20 bg-muted rounded mb-2 md:mb-3" />
        <div className="h-5 md:h-8 w-24 md:w-28 bg-muted rounded" />
      </CardContent>
    </Card>
  );
}
