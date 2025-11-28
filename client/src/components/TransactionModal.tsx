import { useState, useEffect } from "react";
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
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Wallet, Category, TransactionType } from "@shared/schema";

interface TransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: Wallet[];
  categories: Category[];
}

const transactionSchema = z.object({
  type: z.enum(["expense", "income", "transfer"]),
  amount: z.string().min(1, "请输入金额").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "请输入有效金额"
  ),
  walletId: z.string().min(1, "请选择钱包"),
  toWalletId: z.string().optional(),
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
}: TransactionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TransactionType>("expense");

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "expense",
      amount: "",
      walletId: "",
      toWalletId: "",
      categoryId: "",
      description: "",
      date: new Date(),
    },
  });

  useEffect(() => {
    form.setValue("type", activeTab);
    form.setValue("categoryId", "");
    form.setValue("toWalletId", "");
  }, [activeTab, form]);

  useEffect(() => {
    if (open && wallets.length > 0) {
      const defaultWallet = wallets.find((w) => w.isDefault) || wallets[0];
      form.setValue("walletId", String(defaultWallet.id));
    }
  }, [open, wallets, form]);

  const mutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      await apiRequest("POST", "/api/transactions", {
        type: data.type,
        amount: data.amount,
        walletId: parseInt(data.walletId),
        toWalletId: data.toWalletId ? parseInt(data.toWalletId) : null,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        description: data.description || null,
        date: data.date.toISOString(),
      });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-transaction" aria-describedby={undefined}>
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
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>金额</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">
                        ¥
                      </span>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-8 text-2xl font-mono h-14 text-right"
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
                          {wallet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {activeTab === "transfer" && (
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
                              {wallet.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
