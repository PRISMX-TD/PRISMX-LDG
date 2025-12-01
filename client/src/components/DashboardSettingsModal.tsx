import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";

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

const defaultPreferences: DashboardPreferences = {
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

interface DashboardSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SettingsItem {
  key: string;
  label: string;
  description: string;
}

const defaultSettingsItems: SettingsItem[] = [
  { key: "showTotalAssets", label: "总资产卡片", description: "显示所有钱包的总余额" },
  { key: "showMonthlyIncome", label: "本月收入", description: "显示当月收入统计" },
  { key: "showMonthlyExpense", label: "本月支出", description: "显示当月支出统计" },
  { key: "showFlexibleFunds", label: "可灵活调用资金", description: "仅显示可灵活调用的账户余额" },
  { key: "showWallets", label: "钱包列表", description: "显示所有钱包卡片" },
  { key: "showBudgets", label: "预算进度", description: "显示本月预算使用情况" },
  { key: "showSavingsGoals", label: "储蓄目标", description: "显示储蓄目标进度" },
  { key: "showRecentTransactions", label: "最近交易", description: "显示最近的交易记录" },
];

export function DashboardSettingsModal({ open, onOpenChange }: DashboardSettingsModalProps) {
  const { toast } = useToast();
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

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

  const currentPrefs = preferences ?? defaultPreferences;
  
  const orderedItems = useCallback(() => {
    const order = currentPrefs.cardOrder;
    if (!order || order.length === 0) {
      return defaultSettingsItems;
    }
    
    const orderedList: SettingsItem[] = [];
    const itemsMap = new Map(defaultSettingsItems.map(item => [item.key, item]));
    
    order.forEach(key => {
      const item = itemsMap.get(key);
      if (item) {
        orderedList.push(item);
        itemsMap.delete(key);
      }
    });
    
    itemsMap.forEach(item => orderedList.push(item));
    
    return orderedList;
  }, [currentPrefs.cardOrder]);

  const handleToggle = (key: string, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  const handleDragStart = (key: string) => {
    setDraggedItem(key);
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    if (draggedItem !== key) {
      setDragOverItem(key);
    }
  };

  const handleDragEnd = () => {
    if (draggedItem && dragOverItem && draggedItem !== dragOverItem) {
      const items = orderedItems();
      const currentOrder = items.map(item => item.key);
      const fromIndex = currentOrder.indexOf(draggedItem);
      const toIndex = currentOrder.indexOf(dragOverItem);
      
      if (fromIndex !== -1 && toIndex !== -1) {
        const newOrder = [...currentOrder];
        newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, draggedItem);
        
        updateMutation.mutate({ cardOrder: newOrder });
      }
    }
    
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const moveItem = (key: string, direction: 'up' | 'down') => {
    const items = orderedItems();
    const currentOrder = items.map(item => item.key);
    const currentIndex = currentOrder.indexOf(key);
    
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === currentOrder.length - 1) return;
    
    const newOrder = [...currentOrder];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];
    
    updateMutation.mutate({ cardOrder: newOrder });
  };

  const items = orderedItems();

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
          <DialogDescription>
            选择要显示的卡片，拖拽或使用箭头调整顺序
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2 py-4 max-h-[60vh] overflow-y-auto">
          {items.map((item, index) => {
            const key = item.key as keyof DashboardPreferences;
            const isChecked = currentPrefs[key] as boolean;
            const isDragging = draggedItem === item.key;
            const isDragOver = dragOverItem === item.key;
            
            return (
              <div
                key={item.key}
                draggable
                onDragStart={() => handleDragStart(item.key)}
                onDragOver={(e) => handleDragOver(e, item.key)}
                onDragEnd={handleDragEnd}
                className={`
                  flex items-center gap-2 p-3 rounded-lg border transition-all cursor-move
                  ${isDragging ? 'opacity-50 bg-muted' : ''}
                  ${isDragOver ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border'}
                `}
                data-testid={`card-item-${item.key}`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <Label className="text-sm font-medium cursor-move">{item.label}</Label>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
                
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => moveItem(item.key, 'up')}
                      disabled={index === 0 || updateMutation.isPending}
                      data-testid={`button-move-up-${item.key}`}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => moveItem(item.key, 'down')}
                      disabled={index === items.length - 1 || updateMutation.isPending}
                      data-testid={`button-move-down-${item.key}`}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  <Switch
                    checked={isChecked}
                    onCheckedChange={(checked) => handleToggle(item.key, checked)}
                    disabled={updateMutation.isPending}
                    data-testid={`switch-${item.key}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
