import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { supportedCurrencies, type Wallet } from "@shared/schema";
import { Loader2, Trash2 } from "lucide-react";

const walletTypes = [
  { value: "cash", label: "现金" },
  { value: "bank_card", label: "银行卡" },
  { value: "digital_wallet", label: "数字钱包" },
  { value: "credit_card", label: "信用卡" },
  { value: "investment", label: "投资账户" },
];

const walletColors = [
  "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B",
  "#EF4444", "#06B6D4", "#22C55E", "#1677FF", "#07C160",
];

interface WalletFormData {
  name: string;
  type: string;
  currency: string;
  color: string;
  exchangeRateToDefault: string;
  isFlexible: boolean;
}

interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet?: Wallet | null;
  defaultCurrency?: string;
}

export function WalletModal({ open, onOpenChange, wallet, defaultCurrency = "MYR" }: WalletModalProps) {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isEditing = !!wallet;

  const form = useForm<WalletFormData>({
    defaultValues: {
      name: "",
      type: "cash",
      currency: defaultCurrency,
      color: "#3B82F6",
      exchangeRateToDefault: "1",
      isFlexible: true,
    },
  });

  const watchedCurrency = form.watch("currency");
  const showExchangeRate = watchedCurrency !== defaultCurrency;

  useEffect(() => {
    if (wallet) {
      form.reset({
        name: wallet.name,
        type: wallet.type || "cash",
        currency: wallet.currency || defaultCurrency,
        color: wallet.color || "#3B82F6",
        exchangeRateToDefault: wallet.exchangeRateToDefault || "1",
        isFlexible: wallet.isFlexible !== false,
      });
    } else {
      form.reset({
        name: "",
        type: "cash",
        currency: defaultCurrency,
        color: "#3B82F6",
        exchangeRateToDefault: "1",
        isFlexible: true,
      });
    }
  }, [wallet, defaultCurrency, form]);

  const createMutation = useMutation({
    mutationFn: async (data: WalletFormData) => {
      return apiRequest("POST", "/api/wallets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "钱包已创建" });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "创建失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: WalletFormData) => {
      return apiRequest("PATCH", `/api/wallets/${wallet!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "钱包已更新" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "更新失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/wallets/${wallet!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "钱包已删除" });
      setShowDeleteDialog(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "删除失败",
        description: error.message || "无法删除最后一个钱包",
        variant: "destructive",
      });
      setShowDeleteDialog(false);
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/wallets/${wallet!.id}`, { isDefault: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "已设为默认钱包" });
    },
    onError: (error: any) => {
      toast({
        title: "设置失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: WalletFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" data-testid="modal-wallet">
          <DialogHeader>
            <DialogTitle>{isEditing ? "编辑钱包" : "新建钱包"}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                rules={{ required: "请输入钱包名称" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="输入钱包名称"
                        {...field}
                        data-testid="input-wallet-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>类型</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-wallet-type">
                          <SelectValue placeholder="选择类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {walletTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>货币</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-wallet-currency">
                          <SelectValue placeholder="选择货币" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {supportedCurrencies.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.symbol} {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showExchangeRate && (
                <FormField
                  control={form.control}
                  name="exchangeRateToDefault"
                  rules={{ 
                    required: "请输入汇率",
                    validate: (value) => {
                      const rate = parseFloat(value);
                      if (isNaN(rate) || rate <= 0) {
                        return "汇率必须为正数";
                      }
                      return true;
                    }
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        汇率 (1 {watchedCurrency} = ? {defaultCurrency})
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          placeholder="输入汇率"
                          {...field}
                          data-testid="input-exchange-rate"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        用于计算总资产时转换为默认货币
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>颜色</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {walletColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            field.value === color
                              ? "border-foreground scale-110"
                              : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => field.onChange(color)}
                          data-testid={`button-color-${color.replace("#", "")}`}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isFlexible"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">可灵活调用资金</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        非长期储蓄或应急储蓄，可随时使用
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-flexible"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
                {isEditing && (
                  <div className="flex gap-2 mr-auto">
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={wallet?.isDefault === true}
                      data-testid="button-delete-wallet"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {!wallet?.isDefault && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate()}
                        disabled={setDefaultMutation.isPending}
                        data-testid="button-set-default"
                      >
                        设为默认
                      </Button>
                    )}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isPending}
                  data-testid="button-submit-wallet"
                >
                  {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isEditing ? "保存" : "创建"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除钱包"{wallet?.name}"吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
