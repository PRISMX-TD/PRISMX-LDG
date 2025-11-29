import { useLocation } from "wouter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Target } from "lucide-react";
import type { User } from "@shared/schema";

interface MobileHeaderProps {
  user: User;
}

const pageTitles: Record<string, string> = {
  "/": "首页",
  "/transactions": "交易记录",
  "/wallets": "钱包管理",
  "/categories": "分类管理",
  "/budgets": "预算管理",
  "/savings": "储蓄目标",
  "/recurring": "定期交易",
  "/reminders": "账单提醒",
  "/analytics": "数据分析",
  "/reports": "财务报表",
  "/settings": "设置",
};

export function MobileHeader({ user }: MobileHeaderProps) {
  const [location] = useLocation();
  const pageTitle = pageTitles[location] || "PRISMX";
  const isHome = location === "/";

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b safe-area-top">
      <div className="flex h-14 items-center justify-between px-4">
        {isHome ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Target className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">PRISMX</span>
          </div>
        ) : (
          <h1 className="font-semibold text-lg">{pageTitle}</h1>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
