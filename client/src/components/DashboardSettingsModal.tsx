import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface DashboardPreferences {
  showTotalAssets: boolean;
  showMonthlyIncome: boolean;
  showMonthlyExpense: boolean;
  showWallets: boolean;
  showBudgets: boolean;
  showSavingsGoals: boolean;
  showRecentTransactions: boolean;
  showFlexibleFunds: boolean;
}

const defaultPreferences: DashboardPreferences = {
  showTotalAssets: true,
  showMonthlyIncome: true,
  showMonthlyExpense: true,
  showWallets: true,
  showBudgets: true,
  showSavingsGoals: true,
  showRecentTransactions: true,
  showFlexibleFunds: false,
};

interface DashboardSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const settingsItems = [
  { key: "showTotalAssets", label: "总资产卡片", description: "显示所有钱包的总余额" },
  { key: "showMonthlyIncome", label: "本月收入", description: "显示当月收入统计" },
  { key: "showMonthlyExpense", label: "本月支出", description: "显示当月支出统计" },
  { key: "showFlexibleFunds", label: "可灵活调用资金", description: "仅显示可灵活调用的账户余额" },
  { key: "showWallets", label: "钱包列表", description: "显示所有钱包卡片" },
  { key: "showBudgets", label: "预算进度", description: "显示本月预算使用情况" },
  { key: "showSavingsGoals", label: "储蓄目标", description: "显示储蓄目标进度" },
  { key: "showRecentTransactions", label: "最近交易", description: "显示最近的交易记录" },
] as const;

export function DashboardSettingsModal({ open, onOpenChange }: DashboardSettingsModalProps) {
  const { toast } = useToast();

  const { data: preferences, isLoading } = useQuery<DashboardPreferences>({
    queryKey: ["/api/dashboard-preferences"],
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<DashboardPreferences>) => {
      return apiRequest("PATCH", "/api/dashboard-preferences", updates);
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["/api/dashboard-preferences"] });
      
      const previousPrefs = queryClient.getQueryData<DashboardPreferences>(["/api/dashboard-preferences"]);
      
      queryClient.setQueryData<DashboardPreferences>(["/api/dashboard-preferences"], (old) => ({
        ...(old ?? defaultPreferences),
        ...updates,
      }));
      
      return { previousPrefs };
    },
    onError: (error: any, _updates, context) => {
      if (context?.previousPrefs) {
        queryClient.setQueryData(["/api/dashboard-preferences"], context.previousPrefs);
      }
      toast({
        title: "保存失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-preferences"] });
    },
  });

  const handleToggle = (key: keyof DashboardPreferences, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  const currentPrefs = preferences ?? defaultPreferences;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-dashboard-settings">
        <DialogHeader>
          <DialogTitle>仪表盘设置</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            选择要在仪表盘上显示的卡片
          </p>
          
          {settingsItems.map((item) => {
            const key = item.key as keyof DashboardPreferences;
            const isChecked = currentPrefs[key];
            
            return (
              <div
                key={item.key}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
              >
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{item.label}</Label>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Switch
                  checked={isChecked}
                  onCheckedChange={(checked) => handleToggle(key, checked)}
                  disabled={updateMutation.isPending}
                  data-testid={`switch-${item.key}`}
                />
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
