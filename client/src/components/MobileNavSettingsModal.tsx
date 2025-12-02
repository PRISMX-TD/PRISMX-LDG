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
import {
  Loader2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  LayoutDashboard,
  Receipt,
  Wallet,
  BarChart3,
  Tags,
  TrendingUp,
  PiggyBank,
  CalendarClock,
  Bell,
  FileText,
  Settings,
  ArrowUpDown,
} from "lucide-react";

interface MobileNavPreferences {
  mainNavItems: string[];
}

const defaultPreferences: MobileNavPreferences = {
  mainNavItems: ["dashboard", "transactions", "wallets", "analytics"],
};

interface NavItem {
  key: string;
  label: string;
  icon: typeof LayoutDashboard;
  defaultMain: boolean;
}

const allNavItems: NavItem[] = [
  { key: "dashboard", label: "仪表盘", icon: LayoutDashboard, defaultMain: true },
  { key: "transactions", label: "交易记录", icon: Receipt, defaultMain: true },
  { key: "wallets", label: "钱包", icon: Wallet, defaultMain: true },
  { key: "analytics", label: "数据分析", icon: BarChart3, defaultMain: true },
  { key: "exchange", label: "交易所", icon: ArrowUpDown, defaultMain: false },
  { key: "categories", label: "分类管理", icon: Tags, defaultMain: false },
  { key: "budgets", label: "预算管理", icon: TrendingUp, defaultMain: false },
  { key: "savings", label: "储蓄目标", icon: PiggyBank, defaultMain: false },
  { key: "recurring", label: "定期交易", icon: CalendarClock, defaultMain: false },
  { key: "reminders", label: "账单提醒", icon: Bell, defaultMain: false },
  { key: "reports", label: "财务报表", icon: FileText, defaultMain: false },
  { key: "settings", label: "设置", icon: Settings, defaultMain: false },
];

interface MobileNavSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNavSettingsModal({ open, onOpenChange }: MobileNavSettingsModalProps) {
  const { toast } = useToast();
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  const { data: preferences, isLoading } = useQuery<MobileNavPreferences>({
    queryKey: ["/api/mobile-nav-preferences"],
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<MobileNavPreferences>) => {
      return apiRequest("PATCH", "/api/mobile-nav-preferences", updates);
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["/api/mobile-nav-preferences"] });
      
      const previousPrefs = queryClient.getQueryData<MobileNavPreferences>(["/api/mobile-nav-preferences"]);
      
      queryClient.setQueryData<MobileNavPreferences>(["/api/mobile-nav-preferences"], (old) => ({
        ...(old ?? defaultPreferences),
        ...updates,
      }));
      
      return { previousPrefs };
    },
    onError: (error: any, _updates, context) => {
      if (context?.previousPrefs) {
        queryClient.setQueryData(["/api/mobile-nav-preferences"], context.previousPrefs);
      }
      toast({
        title: "保存失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-nav-preferences"] });
    },
  });

  const currentPrefs = preferences ?? defaultPreferences;
  const currentMainItems = currentPrefs.mainNavItems || defaultPreferences.mainNavItems;

  const orderedItems = useCallback(() => {
    const mainItems = currentMainItems.slice(0, 4);
    const allKeys = allNavItems.map(item => item.key);
    
    const orderedList: NavItem[] = [];
    mainItems.forEach(key => {
      const item = allNavItems.find(i => i.key === key);
      if (item) orderedList.push(item);
    });
    
    allKeys.forEach(key => {
      if (!mainItems.includes(key)) {
        const item = allNavItems.find(i => i.key === key);
        if (item) orderedList.push(item);
      }
    });
    
    return orderedList;
  }, [currentMainItems]);

  const handleToggleMain = (key: string) => {
    const isCurrentlyMain = currentMainItems.includes(key);
    let newMainItems: string[];
    
    if (isCurrentlyMain) {
      if (currentMainItems.length <= 3) {
        toast({
          title: "至少需要3个主导航项",
          description: "底部导航栏至少需要显示3个项目",
          variant: "destructive",
        });
        return;
      }
      newMainItems = currentMainItems.filter(k => k !== key);
    } else {
      if (currentMainItems.length >= 4) {
        toast({
          title: "最多4个主导航项",
          description: "底部导航栏最多显示4个项目（加上【更多】按钮）",
          variant: "destructive",
        });
        return;
      }
      newMainItems = [...currentMainItems, key];
    }
    
    updateMutation.mutate({ mainNavItems: newMainItems });
  };

  const handleDragStart = (key: string) => {
    if (currentMainItems.includes(key)) {
      setDraggedItem(key);
    }
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    if (draggedItem && currentMainItems.includes(key) && draggedItem !== key) {
      setDragOverItem(key);
    }
  };

  const handleDragEnd = () => {
    if (draggedItem && dragOverItem && draggedItem !== dragOverItem) {
      const mainItems = [...currentMainItems];
      const fromIndex = mainItems.indexOf(draggedItem);
      const toIndex = mainItems.indexOf(dragOverItem);
      
      if (fromIndex !== -1 && toIndex !== -1) {
        mainItems.splice(fromIndex, 1);
        mainItems.splice(toIndex, 0, draggedItem);
        updateMutation.mutate({ mainNavItems: mainItems });
      }
    }
    
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const moveItem = (key: string, direction: 'up' | 'down') => {
    const mainItems = [...currentMainItems];
    const currentIndex = mainItems.indexOf(key);
    
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === mainItems.length - 1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    [mainItems[currentIndex], mainItems[targetIndex]] = [mainItems[targetIndex], mainItems[currentIndex]];
    
    updateMutation.mutate({ mainNavItems: mainItems });
  };

  const items = orderedItems();
  const mainNavItems = items.filter(item => currentMainItems.includes(item.key));
  const moreMenuItems = items.filter(item => !currentMainItems.includes(item.key));

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
      <DialogContent className="sm:max-w-md" data-testid="modal-mobile-nav-settings">
        <DialogHeader className="pb-2">
          <DialogTitle>底部导航设置</DialogTitle>
          <DialogDescription>
            选择显示在底部导航栏的项目（最多4个），其余在"更多"菜单中
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">主导航栏（拖拽排序）</h3>
            <div className="space-y-2">
              {mainNavItems.map((item, index) => {
                const isDragging = draggedItem === item.key;
                const isDragOver = dragOverItem === item.key;
                const Icon = item.icon;
                
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
                    data-testid={`nav-item-${item.key}`}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="flex-1 text-sm font-medium">{item.label}</span>
                    
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
                          disabled={index === mainNavItems.length - 1 || updateMutation.isPending}
                          data-testid={`button-move-down-${item.key}`}
                        >
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      <Switch
                        checked={true}
                        onCheckedChange={() => handleToggleMain(item.key)}
                        disabled={updateMutation.isPending}
                        data-testid={`switch-${item.key}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">更多菜单项目</h3>
            <div className="space-y-2">
              {moreMenuItems.map((item) => {
                const Icon = item.icon;
                
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border/50 hover:border-border transition-all"
                    data-testid={`nav-item-${item.key}`}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm">{item.label}</span>
                    
                    <Switch
                      checked={false}
                      onCheckedChange={() => handleToggleMain(item.key)}
                      disabled={updateMutation.isPending || currentMainItems.length >= 4}
                      data-testid={`switch-${item.key}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
