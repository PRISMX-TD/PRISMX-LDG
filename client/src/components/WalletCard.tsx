import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: wallet.color
                ? `${wallet.color}20`
                : "hsl(var(--primary) / 0.1)",
            }}
          >
            <Icon
              className="w-5 h-5"
              style={{ color: wallet.color || "hsl(var(--primary))" }}
            />
          </div>
          <div>
            <h3 className="font-medium text-base">{wallet.name}</h3>
            <p className="text-xs text-muted-foreground">
              {walletTypeLabels[wallet.type] || wallet.type} · {wallet.currency || "MYR"}
            </p>
          </div>
        </div>
        {wallet.isDefault && (
          <Badge variant="secondary" className="text-xs">
            默认
          </Badge>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-right">
          <p
            className={`text-2xl font-semibold font-mono ${
              balance < 0 ? "text-expense" : ""
            }`}
            data-testid={`text-balance-${wallet.id}`}
          >
            {currencyInfo.symbol}{balance.toLocaleString("zh-CN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function WalletCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted" />
          <div>
            <div className="h-4 w-20 bg-muted rounded mb-1" />
            <div className="h-3 w-14 bg-muted rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-right">
          <div className="h-8 w-28 bg-muted rounded ml-auto" />
        </div>
      </CardContent>
    </Card>
  );
}
