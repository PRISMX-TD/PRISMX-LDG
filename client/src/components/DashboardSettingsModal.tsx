import { useState, useCallback, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, GripVertical, ChevronUp, ChevronDown, Wallet } from "lucide-react";
import type { Wallet as WalletType } from "@shared/schema";
import { walletTypes, walletTypeLabels } from "@shared/schema";

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

interface WalletPreferences {
  walletOrder: Record<string, number[]> | null;
  typeOrder: string[] | null;
  groupByType: boolean;
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
  const [draggedType, setDraggedType] = useState<string | null>(null);
  const [dragOverType, setDragOverType] = useState<string | null>(null);
  const [draggedWallet, setDraggedWallet] = useState<{ type: string; id: number } | null>(null);
  const [dragOverWallet, setDragOverWallet] = useState<{ type: string; id: number } | null>(null);

  const { data: preferences, isLoading } = useQuery<DashboardPreferences>({
    queryKey: ["/api/dashboard-preferences"],
  });

  const { data: walletPreferences } = useQuery<WalletPreferences>({
    queryKey: ["/api/wallet-preferences"],
  });

  const { data: wallets = [] } = useQuery<WalletType[]>({
    queryKey: ["/api/wallets"],
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

  const updateWalletMutation = useMutation({
    mutationFn: async (updates: Partial<WalletPreferences>) => {
      return apiRequest("PATCH", "/api/wallet-preferences", updates);
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["/api/wallet-preferences"] });
      
      const previousPrefs = queryClient.getQueryData<WalletPreferences>(["/api/wallet-preferences"]);
      
      queryClient.setQueryData<WalletPreferences>(["/api/wallet-preferences"], (old) => ({
        walletOrder: null,
        typeOrder: null,
        groupByType: true,
        ...(old ?? {}),
        ...updates,
      }));
      
      return { previousPrefs };
    },
    onError: (error: any, _updates, context) => {
      if (context?.previousPrefs) {
        queryClient.setQueryData(["/api/wallet-preferences"], context.previousPrefs);
      }
      toast({
        title: "保存失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet-preferences"] });
    },
  });

  const currentPrefs = preferences ?? defaultPreferences;
  const currentWalletPrefs = walletPreferences ?? { walletOrder: null, typeOrder: null, groupByType: true };
  
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

  const orderedTypes = useMemo(() => {
    const order = currentWalletPrefs.typeOrder;
    if (!order || order.length === 0) {
      return [...walletTypes];
    }
    const validOrder = order.filter(type => walletTypes.includes(type as typeof walletTypes[number]));
    const remaining = walletTypes.filter(type => !validOrder.includes(type));
    return [...validOrder, ...remaining];
  }, [currentWalletPrefs.typeOrder]);

  const groupedWallets = useMemo(() => {
    const groups: Record<string, WalletType[]> = {};
    const walletOrderByType = currentWalletPrefs.walletOrder || {};
    
    orderedTypes.forEach(type => {
      groups[type] = [];
    });

    wallets.forEach(wallet => {
      const type = wallet.type || "cash";
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(wallet);
    });

    Object.keys(groups).forEach(type => {
      const order = walletOrderByType[type];
      if (order && order.length > 0) {
        const numOrder = order.map(Number);
        groups[type].sort((a, b) => {
          const aIndex = numOrder.indexOf(a.id);
          const bIndex = numOrder.indexOf(b.id);
          if (aIndex === -1 && bIndex === -1) return 0;
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
      }
    });

    return groups;
  }, [wallets, currentWalletPrefs.walletOrder, orderedTypes]);

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

  const handleTypeDragStart = (type: string) => {
    setDraggedType(type);
  };

  const handleTypeDragOver = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    if (draggedType !== type) {
      setDragOverType(type);
    }
  };

  const handleTypeDragEnd = () => {
    if (draggedType && dragOverType && draggedType !== dragOverType) {
      const fromIndex = orderedTypes.indexOf(draggedType);
      const toIndex = orderedTypes.indexOf(dragOverType);
      
      if (fromIndex !== -1 && toIndex !== -1) {
        const newOrder = [...orderedTypes];
        newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, draggedType);
        
        updateWalletMutation.mutate({ typeOrder: newOrder });
      }
    }
    
    setDraggedType(null);
    setDragOverType(null);
  };

  const moveType = (type: string, direction: 'up' | 'down') => {
    const currentIndex = orderedTypes.indexOf(type);
    
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === orderedTypes.length - 1) return;
    
    const newOrder = [...orderedTypes];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];
    
    updateWalletMutation.mutate({ typeOrder: newOrder });
  };

  const handleWalletDragStart = (type: string, id: number) => {
    setDraggedWallet({ type, id });
  };

  const handleWalletDragOver = (e: React.DragEvent, type: string, id: number) => {
    e.preventDefault();
    if (draggedWallet && (draggedWallet.type !== type || draggedWallet.id !== id)) {
      if (draggedWallet.type === type) {
        setDragOverWallet({ type, id });
      }
    }
  };

  const handleWalletDragEnd = () => {
    if (draggedWallet && dragOverWallet && draggedWallet.type === dragOverWallet.type) {
      const type = draggedWallet.type;
      const walletsInType = groupedWallets[type] || [];
      const currentOrder = walletsInType.map(w => w.id);
      
      const fromIndex = currentOrder.indexOf(draggedWallet.id);
      const toIndex = currentOrder.indexOf(dragOverWallet.id);
      
      if (fromIndex !== -1 && toIndex !== -1) {
        const newOrder = [...currentOrder];
        newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, draggedWallet.id);
        
        const updatedWalletOrder = {
          ...(currentWalletPrefs.walletOrder || {}),
          [type]: newOrder,
        };
        
        updateWalletMutation.mutate({ walletOrder: updatedWalletOrder });
      }
    }
    
    setDraggedWallet(null);
    setDragOverWallet(null);
  };

  const moveWallet = (type: string, walletId: number, direction: 'up' | 'down') => {
    const walletsInType = groupedWallets[type] || [];
    const currentOrder = walletsInType.map(w => w.id);
    const currentIndex = currentOrder.indexOf(walletId);
    
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === currentOrder.length - 1) return;
    
    const newOrder = [...currentOrder];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];
    
    const updatedWalletOrder = {
      ...(currentWalletPrefs.walletOrder || {}),
      [type]: newOrder,
    };
    
    updateWalletMutation.mutate({ walletOrder: updatedWalletOrder });
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
      <DialogContent className="sm:max-w-lg" data-testid="modal-dashboard-settings">
        <DialogHeader className="pb-2">
          <DialogTitle>仪表盘设置</DialogTitle>
          <DialogDescription>
            自定义仪表盘显示内容和顺序
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="cards" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cards" data-testid="tab-cards">卡片设置</TabsTrigger>
            <TabsTrigger value="wallets" data-testid="tab-wallets">钱包排序</TabsTrigger>
          </TabsList>
          
          <TabsContent value="cards" className="mt-4">
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
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
          </TabsContent>
          
          <TabsContent value="wallets" className="mt-4">
            <p className="text-xs text-muted-foreground mb-3">
              拖拽调整钱包类型顺序，或在类型内调整钱包顺序
            </p>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {orderedTypes.map((type, typeIndex) => {
                const walletsInType = groupedWallets[type] || [];
                const isDraggingType = draggedType === type;
                const isDragOverType = dragOverType === type;
                
                return (
                  <div
                    key={type}
                    className={`
                      rounded-lg border transition-all
                      ${isDraggingType ? 'opacity-50 bg-muted' : ''}
                      ${isDragOverType ? 'border-primary bg-primary/5' : 'border-border/50'}
                    `}
                  >
                    <div
                      draggable
                      onDragStart={() => handleTypeDragStart(type)}
                      onDragOver={(e) => handleTypeDragOver(e, type)}
                      onDragEnd={handleTypeDragEnd}
                      className="flex items-center gap-2 p-2 cursor-move"
                      data-testid={`type-item-${type}`}
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Wallet className="w-4 h-4 text-primary shrink-0" />
                      <span className="flex-1 text-sm font-medium">
                        {walletTypeLabels[type] || type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {walletsInType.length} 个钱包
                      </span>
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => moveType(type, 'up')}
                          disabled={typeIndex === 0 || updateWalletMutation.isPending}
                          data-testid={`button-move-type-up-${type}`}
                        >
                          <ChevronUp className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => moveType(type, 'down')}
                          disabled={typeIndex === orderedTypes.length - 1 || updateWalletMutation.isPending}
                          data-testid={`button-move-type-down-${type}`}
                        >
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {walletsInType.length > 0 && (
                      <div className="px-2 pb-2 space-y-1">
                        {walletsInType.map((wallet, walletIndex) => {
                          const isDraggingWallet = draggedWallet?.type === type && draggedWallet?.id === wallet.id;
                          const isDragOverWallet = dragOverWallet?.type === type && dragOverWallet?.id === wallet.id;
                          
                          return (
                            <div
                              key={wallet.id}
                              draggable
                              onDragStart={() => handleWalletDragStart(type, wallet.id)}
                              onDragOver={(e) => handleWalletDragOver(e, type, wallet.id)}
                              onDragEnd={handleWalletDragEnd}
                              className={`
                                flex items-center gap-2 p-2 pl-8 rounded border cursor-move text-sm
                                ${isDraggingWallet ? 'opacity-50 bg-muted' : ''}
                                ${isDragOverWallet ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'}
                              `}
                              data-testid={`wallet-item-${wallet.id}`}
                            >
                              <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span 
                                className="w-3 h-3 rounded-full shrink-0" 
                                style={{ backgroundColor: wallet.color || '#8B5CF6' }}
                              />
                              <span className="flex-1 truncate">{wallet.name}</span>
                              <div className="flex flex-col">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4"
                                  onClick={() => moveWallet(type, wallet.id, 'up')}
                                  disabled={walletIndex === 0 || updateWalletMutation.isPending}
                                  data-testid={`button-move-wallet-up-${wallet.id}`}
                                >
                                  <ChevronUp className="w-2 h-2" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4"
                                  onClick={() => moveWallet(type, wallet.id, 'down')}
                                  disabled={walletIndex === walletsInType.length - 1 || updateWalletMutation.isPending}
                                  data-testid={`button-move-wallet-down-${wallet.id}`}
                                >
                                  <ChevronDown className="w-2 h-2" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
