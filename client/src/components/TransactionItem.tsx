import type { Transaction, Category, Wallet } from "@shared/schema";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  TrendingDown,
  TrendingUp,
  ArrowRightLeft,
  ShoppingBag,
  Utensils,
  Car,
  Home,
  Gamepad2,
  Gift,
  Heart,
  BookOpen,
  Briefcase,
  DollarSign,
  MoreHorizontal,
} from "lucide-react";

interface TransactionItemProps {
  transaction: Transaction;
  category?: Category | null;
  wallet?: Wallet | null;
  toWallet?: Wallet | null;
}

const categoryIcons: Record<string, typeof ShoppingBag> = {
  shopping: ShoppingBag,
  food: Utensils,
  transport: Car,
  housing: Home,
  entertainment: Gamepad2,
  gift: Gift,
  health: Heart,
  education: BookOpen,
  work: Briefcase,
  salary: DollarSign,
  other: MoreHorizontal,
};

export function TransactionItem({
  transaction,
  category,
  wallet,
  toWallet,
}: TransactionItemProps) {
  const amount = parseFloat(transaction.amount || "0");
  const isExpense = transaction.type === "expense";
  const isIncome = transaction.type === "income";
  const isTransfer = transaction.type === "transfer";

  const getTypeIcon = () => {
    if (isExpense) return TrendingDown;
    if (isIncome) return TrendingUp;
    return ArrowRightLeft;
  };

  const getTypeColor = () => {
    if (isExpense) return "text-expense";
    if (isIncome) return "text-income";
    return "text-transfer";
  };

  const getBorderColor = () => {
    if (isExpense) return "border-l-expense";
    if (isIncome) return "border-l-income";
    return "border-l-transfer";
  };

  const getAmountPrefix = () => {
    if (isExpense) return "-";
    if (isIncome) return "+";
    return "";
  };

  const TypeIcon = getTypeIcon();
  const CategoryIcon = category?.icon
    ? categoryIcons[category.icon] || MoreHorizontal
    : TypeIcon;

  const getDescription = () => {
    if (isTransfer && wallet && toWallet) {
      return `${wallet.name} → ${toWallet.name}`;
    }
    if (transaction.description) {
      return transaction.description;
    }
    if (category) {
      return category.name;
    }
    if (isExpense) return "支出";
    if (isIncome) return "收入";
    return "转账";
  };

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border-l-4 bg-card hover-elevate ${getBorderColor()}`}
      data-testid={`item-transaction-${transaction.id}`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isExpense
            ? "bg-expense/10"
            : isIncome
            ? "bg-income/10"
            : "bg-transfer/10"
        }`}
      >
        <CategoryIcon className={`w-5 h-5 ${getTypeColor()}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate" data-testid={`text-description-${transaction.id}`}>
          {getDescription()}
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{wallet?.name || "未知钱包"}</span>
          <span>·</span>
          <span>
            {format(new Date(transaction.date), "M月d日 HH:mm", {
              locale: zhCN,
            })}
          </span>
        </div>
      </div>

      <div className="text-right">
        <p
          className={`font-semibold font-mono ${getTypeColor()}`}
          data-testid={`text-amount-${transaction.id}`}
        >
          {getAmountPrefix()}¥
          {amount.toLocaleString("zh-CN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        {category && !isTransfer && (
          <p className="text-xs text-muted-foreground">{category.name}</p>
        )}
      </div>
    </div>
  );
}

export function TransactionItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border-l-4 border-l-muted bg-card animate-pulse">
      <div className="w-10 h-10 rounded-full bg-muted" />
      <div className="flex-1">
        <div className="h-4 w-32 bg-muted rounded mb-2" />
        <div className="h-3 w-24 bg-muted rounded" />
      </div>
      <div className="text-right">
        <div className="h-5 w-20 bg-muted rounded mb-1" />
        <div className="h-3 w-12 bg-muted rounded ml-auto" />
      </div>
    </div>
  );
}
