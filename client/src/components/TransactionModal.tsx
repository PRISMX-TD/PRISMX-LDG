import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Loader2, ArrowRightLeft, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Wallet, Category, TransactionType } from "@shared/schema";
import { supportedCurrencies, getCurrencyInfo } from "@shared/schema";

interface TransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: Wallet[];
  categories: Category[];
  defaultCurrency?: string;
}

const transactionSchema = z.object({
  type: z.enum(["expense", "income", "transfer"]),
  amount: z.string().min(1, "请输入金额").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "请输入有效金额"
  ),
  currency: z.string().min(1, "请选择币种"),
  exchangeRate: z.string().optional(),
  convertedAmount: z.string().optional(),
  walletId: z.string().min(1, "请选择钱包"),
  toWalletId: z.string().optional(),
  toWalletAmount: z.string().optional(),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  date: z.date(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

export function TransactionModal({
  open,
  onOpenChange,
  wallets,
  categories,
  defaultCurrency = "MYR",
}: TransactionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TransactionType>("expense");

  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "expense",
      amount: "",
      currency: defaultCurrency,
      exchangeRate: "1",
      convertedAmount: "",
      walletId: "",
      toWalletId: "",
      toWalletAmount: "",
      categoryId: "",
      description: "",
      date: new Date(),
    },
  });

  const watchCurrency = form.watch("currency");
  const watchWalletId = form.watch("walletId");
  const watchToWalletId = form.watch("toWalletId");
  const watchAmount = form.watch("amount");
  const watchExchangeRate = form.watch("exchangeRate");
  const watchConvertedAmount = form.watch("convertedAmount");

  const selectedWallet = wallets.find((w) => String(w.id) === watchWalletId);
  const selectedToWallet = wallets.find((w) => String(w.id) === watchToWalletId);

  const needsCurrencyConversion = selectedWallet && watchCurrency !== selectedWallet.currency;
  const needsTransferConversion = activeTab === "transfer" && selectedWallet && selectedToWallet && selectedWallet.currency !== selectedToWallet.currency;

  const fetchExchangeRate = useCallback(async (from: string, to: string) => {
    if (from === to) {
      form.setValue("exchangeRate", "1");
      return 1;
    }
    
    setIsLoadingRate(true);
    setRateError(null);
    
    try {
      const response = await fetch(`/api/exchange-rate?from=${from}&to=${to}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const data = await response.json();
        setRateError(data.message || "无法获取汇率");
        return null;
      }
      
      const data = await response.json();
      const rate = data.rate;
      form.setValue("exchangeRate", rate.toFixed(4));
      return rate;
    } catch (error) {
      setRateError("无法获取汇率，请手动输入");
      return null;
    } finally {
      setIsLoadingRate(false);
    }
  }, [form]);

  useEffect(() => {
    form.setValue("type", activeTab);
    form.setValue("categoryId", "");
    form.setValue("toWalletId", "");
    form.setValue("toWalletAmount", "");
  }, [activeTab, form]);

  useEffect(() => {
    if (open && wallets.length > 0) {
      const defaultWallet = wallets.find((w) => w.isDefault) || wallets[0];
      form.setValue("walletId", String(defaultWallet.id));
      form.setValue("currency", defaultCurrency);
      form.setValue("exchangeRate", "1");
      form.setValue("convertedAmount", "");
      setRateError(null);
    }
  }, [open, wallets, form, defaultCurrency]);

  useEffect(() => {
    if (selectedWallet && watchCurrency === selectedWallet.currency) {
      form.setValue("exchangeRate", "1");
      form.setValue("convertedAmount", "");
      setRateError(null);
    } else if (selectedWallet && watchCurrency && watchCurrency !== selectedWallet.currency) {
      fetchExchangeRate(watchCurrency, selectedWallet.currency);
    }
  }, [watchCurrency, selectedWallet, form, fetchExchangeRate]);

  useEffect(() => {
    if (needsCurrencyConversion && watchAmount && watchExchangeRate) {
      const amount = parseFloat(watchAmount);
      const rate = parseFloat(watchExchangeRate);
      if (!isNaN(amount) && !isNaN(rate) && rate > 0) {
        const converted = (amount * rate).toFixed(2);
        if (watchConvertedAmount !== converted) {
          form.setValue("convertedAmount", converted);
        }
      }
    }
  }, [watchAmount, watchExchangeRate, needsCurrencyConversion, form, watchConvertedAmount]);

  const handleConvertedAmountChange = (value: string) => {
    form.setValue("convertedAmount", value);
    if (watchAmount && value) {
      const amount = parseFloat(watchAmount);
      const converted = parseFloat(value);
      if (!isNaN(amount) && !isNaN(converted) && amount > 0) {
        const newRate = (converted / amount).toFixed(4);
        form.setValue("exchangeRate", newRate);
      }
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const wallet = wallets.find((w) => String(w.id) === data.walletId);
      const toWallet = wallets.find((w) => String(w.id) === data.toWalletId);
      const walletCurrency = wallet?.currency || "MYR";
      const isCrossCurrency = data.currency !== walletCurrency;
      const isTransferCrossCurrency = data.type === "transfer" && toWallet && wallet && wallet.currency !== toWallet.currency;
      
      const requestData: Record<string, unknown> = {
        type: data.type,
        amount: data.amount,
        walletId: parseInt(data.walletId),
        toWalletId: data.toWalletId ? parseInt(data.toWalletId) : null,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        description: data.description || null,
        date: data.date.toISOString(),
      };

      // Only include currency conversion data when needed
      if (isCrossCurrency) {
        requestData.currency = data.currency;
        requestData.exchangeRate = parseFloat(data.exchangeRate || "1");
      }

      // Only include toWalletAmount for cross-currency transfers
      if (isTransferCrossCurrency && data.toWalletAmount) {
        requestData.toWalletAmount = parseFloat(data.toWalletAmount);
      }
      
      await apiRequest("POST", "/api/transactions", requestData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({
        title: "记录成功",
        description: "交易已成功添加",
      });
      onOpenChange(false);
      form.reset();
      setActiveTab("expense");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "会话已过期",
          description: "正在重新登录...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "记录失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TransactionFormData) => {
    if (data.type === "transfer" && data.walletId === data.toWalletId) {
      toast({
        title: "转账失败",
        description: "转出和转入钱包不能相同",
        variant: "destructive",
      });
      return;
    }
    
    // For cross-currency transfers, require destination amount
    if (data.type === "transfer") {
      const fromWallet = wallets.find((w) => String(w.id) === data.walletId);
      const toWallet = wallets.find((w) => String(w.id) === data.toWalletId);
      if (fromWallet && toWallet && fromWallet.currency !== toWallet.currency) {
        if (!data.toWalletAmount || parseFloat(data.toWalletAmount) <= 0) {
          toast({
            title: "转账失败",
            description: "跨币种转账需要输入转入金额",
            variant: "destructive",
          });
          return;
        }
      }
    }
    
    mutation.mutate(data);
  };

  const filteredCategories = categories.filter(
    (c) => c.type === (activeTab === "income" ? "income" : "expense")
  );

  const typeLabels = {
    expense: "支出",
    income: "收入",
    transfer: "转账",
  };

  const currencyInfo = getCurrencyInfo(watchCurrency);
  const walletCurrencyInfo = selectedWallet ? getCurrencyInfo(selectedWallet.currency) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" data-testid="modal-transaction" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold">
            记一笔
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TransactionType)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-transaction-type">
            <TabsTrigger value="expense" data-testid="tab-expense">
              支出
            </TabsTrigger>
            <TabsTrigger value="income" data-testid="tab-income">
              收入
            </TabsTrigger>
            <TabsTrigger value="transfer" data-testid="tab-transfer">
              转账
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>金额</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                          {currencyInfo.symbol}
                        </span>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="pl-10 text-xl font-mono h-12 text-right"
                          data-testid="input-amount"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem className="w-28">
                    <FormLabel>币种</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12" data-testid="select-currency">
                          <SelectValue placeholder="币种" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {supportedCurrencies.map((currency) => (
                          <SelectItem
                            key={currency.code}
                            value={currency.code}
                            data-testid={`option-currency-${currency.code}`}
                          >
                            {currency.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {needsCurrencyConversion && (
              <div className="p-3 bg-muted rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ArrowRightLeft className="h-4 w-4" />
                    <span>需要货币转换 ({watchCurrency} → {selectedWallet?.currency})</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => selectedWallet && fetchExchangeRate(watchCurrency, selectedWallet.currency)}
                    disabled={isLoadingRate}
                    className="h-7 px-2"
                    data-testid="button-refresh-rate"
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoadingRate ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="exchangeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">
                        汇率 (1 {watchCurrency} = ? {selectedWallet?.currency})
                        {isLoadingRate && <Loader2 className="inline ml-2 h-3 w-3 animate-spin" />}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          placeholder="1.0000"
                          className="font-mono"
                          data-testid="input-exchange-rate"
                        />
                      </FormControl>
                      {rateError && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-500">{rateError}</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel className="text-sm">
                    转换后金额 ({selectedWallet?.currency})
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {walletCurrencyInfo?.symbol}
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={watchConvertedAmount || ""}
                        onChange={(e) => handleConvertedAmountChange(e.target.value)}
                        placeholder="0.00"
                        className="pl-10 font-mono"
                        data-testid="input-converted-amount"
                      />
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    此金额将记入钱包，可手动修改
                  </p>
                </FormItem>
              </div>
            )}

            <FormField
              control={form.control}
              name="walletId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {activeTab === "transfer" ? "转出钱包" : "账户"}
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-wallet">
                        <SelectValue placeholder="选择钱包" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {wallets.map((wallet) => (
                        <SelectItem
                          key={wallet.id}
                          value={String(wallet.id)}
                          data-testid={`option-wallet-${wallet.id}`}
                        >
                          {wallet.name} ({wallet.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {activeTab === "transfer" && (
              <>
                <FormField
                  control={form.control}
                  name="toWalletId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>转入钱包</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-to-wallet">
                            <SelectValue placeholder="选择转入钱包" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {wallets
                            .filter((w) => String(w.id) !== form.watch("walletId"))
                            .map((wallet) => (
                              <SelectItem
                                key={wallet.id}
                                value={String(wallet.id)}
                                data-testid={`option-to-wallet-${wallet.id}`}
                              >
                                {wallet.name} ({wallet.currency})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {needsTransferConversion && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ArrowRightLeft className="h-4 w-4" />
                      <span>不同币种转账 ({selectedWallet?.currency} → {selectedToWallet?.currency})</span>
                    </div>
                    <FormField
                      control={form.control}
                      name="toWalletAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">转入金额 ({selectedToWallet?.currency})</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                {getCurrencyInfo(selectedToWallet?.currency || "MYR").symbol}
                              </span>
                              <Input
                                {...field}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="pl-10 font-mono"
                                data-testid="input-to-wallet-amount"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </>
            )}

            {activeTab !== "transfer" && (
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分类</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="选择分类" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredCategories.map((category) => (
                          <SelectItem
                            key={category.id}
                            value={String(category.id)}
                            data-testid={`option-category-${category.id}`}
                          >
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>日期</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          data-testid="button-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value
                            ? format(field.value, "yyyy年M月d日", {
                                locale: zhCN,
                              })
                            : "选择日期"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注（可选）</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="添加备注..."
                      className="resize-none"
                      rows={2}
                      data-testid="input-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={mutation.isPending}
              data-testid="button-submit-transaction"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                `记录${typeLabels[activeTab]}`
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
