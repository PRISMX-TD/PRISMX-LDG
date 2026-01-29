import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet as WalletIcon, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Trash2,
  HandCoins
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Loan, Wallet } from "@shared/schema";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export default function Loans() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // Fetch loans
  const { data: loans = [], isLoading: isLoansLoading } = useQuery<Loan[]>({
    queryKey: ["/api/loans"],
  });

  // Fetch wallets for loan creation (money source/destination)
  const { data: wallets = [] } = useQuery<Wallet[]>({
    queryKey: ["/api/wallets"],
  });

  // Calculate totals
  const totalLent = loans
    .filter(l => l.type === 'lend' && l.status !== 'bad_debt')
    .reduce((sum, l) => sum + (parseFloat(l.totalAmount) - parseFloat(l.paidAmount || '0')), 0);

  const totalBorrowed = loans
    .filter(l => l.type === 'borrow')
    .reduce((sum, l) => sum + (parseFloat(l.totalAmount) - parseFloat(l.paidAmount || '0')), 0);

  const netPosition = totalLent - totalBorrowed;

  // Filtered loans
  const filteredLoans = loans.filter(loan => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return loan.status === "active";
    if (activeTab === "settled") return loan.status === "settled";
    if (activeTab === "bad_debt") return loan.status === "bad_debt";
    return true;
  });

  return (
    <PageContainer title="借贷管理">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待收回 (应收)</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {totalLent.toLocaleString('zh-CN', { style: 'currency', currency: 'MYR' })}
              </div>
              <p className="text-xs text-muted-foreground">
                借出未还总额
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待偿还 (应付)</CardTitle>
              <ArrowDownLeft className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {totalBorrowed.toLocaleString('zh-CN', { style: 'currency', currency: 'MYR' })}
              </div>
              <p className="text-xs text-muted-foreground">
                借入未还总额
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">净头寸</CardTitle>
              <WalletIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                netPosition >= 0 ? "text-primary" : "text-red-500"
              )}>
                {netPosition.toLocaleString('zh-CN', { style: 'currency', currency: 'MYR' })}
              </div>
              <p className="text-xs text-muted-foreground">
                应收 - 应付
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="active">进行中</TabsTrigger>
              <TabsTrigger value="settled">已结清</TabsTrigger>
              <TabsTrigger value="bad_debt">坏账</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            新增借贷
          </Button>
        </div>

        {/* Loans List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoansLoading ? (
            <div className="col-span-full text-center py-10 text-muted-foreground">加载中...</div>
          ) : filteredLoans.length === 0 ? (
            <div className="col-span-full text-center py-10 text-muted-foreground">
              <HandCoins className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              暂无借贷记录
            </div>
          ) : (
            filteredLoans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} />
            ))
          )}
        </div>
      </div>

      <CreateLoanDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
        wallets={wallets}
      />
    </PageContainer>
  );
}

function LoanCard({ loan }: { loan: Loan }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isRepayOpen, setIsRepayOpen] = useState(false);
  
  // Delete loan mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/loans/${loan.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete loan");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      toast({ title: "已删除", description: "借贷记录已删除" });
    },
  });

  // Mark bad debt mutation
  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/loans/${loan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Failed to update status");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      toast({ title: "状态已更新" });
    },
  });

  const total = parseFloat(loan.totalAmount);
  const paid = parseFloat(loan.paidAmount || '0');
  const remaining = total - paid;
  const progress = Math.min(100, (paid / total) * 100);

  const isLend = loan.type === 'lend';
  const isSettled = loan.status === 'settled';
  const isBadDebt = loan.status === 'bad_debt';

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all hover:shadow-md",
      isSettled && "opacity-75 bg-muted/30",
      isBadDebt && "opacity-75 border-red-200 bg-red-50 dark:bg-red-900/10"
    )}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant={isLend ? "outline" : "secondary"} className={cn(
                isLend ? "text-green-600 border-green-200" : "text-red-600 bg-red-100 dark:bg-red-900/20"
              )}>
                {isLend ? "借出" : "借入"}
              </Badge>
              <CardTitle className="text-lg">{loan.person}</CardTitle>
            </div>
            <CardDescription className="mt-1 flex items-center gap-1 text-xs">
              <Calendar className="h-3 w-3" />
              {format(new Date(loan.startDate), "yyyy年MM月dd日", { locale: zhCN })}
              {loan.dueDate && (
                <span className={cn(
                  "ml-2 flex items-center gap-1",
                  new Date(loan.dueDate) < new Date() && !isSettled ? "text-red-500 font-medium" : ""
                )}>
                  <Clock className="h-3 w-3" />
                  到期: {format(new Date(loan.dueDate), "MM-dd")}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">
              {remaining.toLocaleString('zh-CN', { style: 'currency', currency: loan.currency })}
            </div>
            <div className="text-xs text-muted-foreground">
              总额: {parseFloat(loan.totalAmount).toLocaleString()}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>已还: {paid.toLocaleString()}</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-500", isLend ? "bg-green-500" : "bg-red-500")} 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {loan.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {loan.description}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {!isSettled && !isBadDebt && (
              <Button 
                variant="default" 
                size="sm" 
                className="flex-1"
                onClick={() => setIsRepayOpen(true)}
              >
                {isLend ? "收款" : "还款"}
              </Button>
            )}
            
            {!isSettled && !isBadDebt && isLend && (
               <Button 
               variant="outline" 
               size="sm"
               className="text-red-500 hover:text-red-600 hover:bg-red-50"
               onClick={() => {
                 if (confirm("确定要标记为坏账吗？这意味着这笔钱可能收不回来了。")) {
                   statusMutation.mutate('bad_debt');
                 }
               }}
             >
               坏账
             </Button>
            )}

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (confirm("确定要删除这个借贷记录吗？关联的交易记录不会被删除，但会解除关联。")) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
      
      {/* Status Badges Overlay */}
      {isSettled && (
        <div className="absolute top-2 right-2 rotate-12 opacity-80 pointer-events-none">
           <div className="border-2 border-green-500 text-green-500 px-2 py-1 rounded font-bold text-xs uppercase tracking-widest">
             已结清
           </div>
        </div>
      )}
      {isBadDebt && (
        <div className="absolute top-2 right-2 rotate-12 opacity-80 pointer-events-none">
           <div className="border-2 border-red-500 text-red-500 px-2 py-1 rounded font-bold text-xs uppercase tracking-widest">
             坏账
           </div>
        </div>
      )}

      <RepayDialog 
        open={isRepayOpen} 
        onOpenChange={setIsRepayOpen} 
        loan={loan} 
      />
    </Card>
  );
}

function CreateLoanDialog({ open, onOpenChange, wallets }: { open: boolean, onOpenChange: (open: boolean) => void, wallets: Wallet[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: 'lend',
    person: '',
    amount: '',
    currency: 'MYR',
    walletId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    dueDate: '',
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.person || !formData.amount || !formData.walletId) {
      toast({ title: "请填写必填项", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Loan Record
      const loanRes = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          person: formData.person,
          totalAmount: formData.amount,
          currency: formData.currency,
          startDate: new Date(formData.startDate).toISOString(),
          dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
          description: formData.description,
          status: 'active'
        })
      });

      if (!loanRes.ok) throw new Error("Failed to create loan record");
      const loan = await loanRes.json();

      // 2. Create Initial Transaction (Money moving out/in)
      const transactionType = formData.type === 'lend' ? 'expense' : 'income'; // If I lend, money goes out (expense-like flow but recorded as debt). Wait, actually:
      // Lend = I give money -> Wallet balance decreases -> Type 'expense' (conceptually) or transfer?
      // Borrow = I get money -> Wallet balance increases -> Type 'income'
      // To keep analytics clean, we might want to tag these specifically or use categories.
      // For now, let's use 'expense' for lending (money out) and 'income' for borrowing (money in),
      // BUT we should probably use a special category like "Debt/Loan".
      
      // Ideally, we'd auto-create/find a category "借出/借入".
      // For simplicity, let's just create the transaction and let user recategorize if needed, 
      // or we just don't categorize it (categoryId: null).
      
      // However, current system treats 'expense' as spending. 
      // Maybe we need a 'transfer' type where toWallet is null? Or just accept it affects balance.
      
      const txRes = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type === 'lend' ? 'expense' : 'income',
          amount: parseFloat(formData.amount),
          walletId: parseInt(formData.walletId),
          date: new Date(formData.startDate).toISOString(),
          description: `${formData.type === 'lend' ? '借给' : '向某人借款'}: ${formData.person}`,
          loanId: loan.id, // Link to the loan
          // categoryId: ... (optional)
        })
      });

      if (!txRes.ok) {
         // If transaction fails, we should probably delete the loan or warn user.
         console.error("Failed to create transaction for loan");
         toast({ title: "借贷记录创建成功，但资金流水记录失败", variant: "destructive" });
      } else {
         toast({ title: "借贷记录已创建", description: "已自动记录资金流水" });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      onOpenChange(false);
      setFormData({
        type: 'lend',
        person: '',
        amount: '',
        currency: 'MYR',
        walletId: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        dueDate: '',
        description: ''
      });
    } catch (error) {
      console.error(error);
      toast({ title: "创建失败", description: "请重试", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>新增借贷</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>类型</Label>
              <Select 
                value={formData.type} 
                onValueChange={(v) => setFormData({...formData, type: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lend">我借出 (别人欠我)</SelectItem>
                  <SelectItem value="borrow">我借入 (我欠别人)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>对方姓名</Label>
              <Input 
                placeholder="张三" 
                value={formData.person}
                onChange={(e) => setFormData({...formData, person: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>金额</Label>
              <Input 
                type="number" 
                placeholder="0.00" 
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>关联钱包 (资金来源/去向)</Label>
              <Select 
                value={formData.walletId} 
                onValueChange={(v) => setFormData({...formData, walletId: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择钱包" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map(w => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      {w.name} ({w.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>借款日期</Label>
              <Input 
                type="date" 
                value={formData.startDate}
                onChange={(e) => setFormData({...formData, startDate: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>约定还款日 (可选)</Label>
              <Input 
                type="date" 
                value={formData.dueDate}
                onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>备注</Label>
            <Textarea 
              placeholder="借款用途等..." 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RepayDialog({ open, onOpenChange, loan }: { open: boolean, onOpenChange: (open: boolean) => void, loan: Loan }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: wallets = [] } = useQuery<Wallet[]>({
    queryKey: ["/api/wallets"],
  });

  const remaining = parseFloat(loan.totalAmount) - parseFloat(loan.paidAmount || '0');

  const [formData, setFormData] = useState({
    amount: remaining.toFixed(2),
    walletId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.walletId) {
      toast({ title: "请填写必填项", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create Repayment Transaction
      // If Loan is 'lend' (I lent), repayment means I get money back -> 'income'
      // If Loan is 'borrow' (I borrowed), repayment means I pay back -> 'expense'
      const type = loan.type === 'lend' ? 'income' : 'expense';
      
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          amount: parseFloat(formData.amount),
          walletId: parseInt(formData.walletId),
          date: new Date(formData.date).toISOString(),
          description: `还款: ${loan.person} ${formData.description ? `(${formData.description})` : ''}`,
          loanId: loan.id, // Linking this transaction will trigger auto-recalculation of loan status
        })
      });

      if (!res.ok) throw new Error("Failed to record repayment");

      toast({ title: "还款记录已保存", description: "借贷状态已更新" });
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({ title: "保存失败", description: "请重试", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{loan.type === 'lend' ? "收款 (对方还钱)" : "还款 (我还钱)"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>还款金额 (剩余: {remaining.toFixed(2)})</Label>
            <Input 
              type="number" 
              placeholder="0.00" 
              min="0.01"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
            />
          </div>
          
          <div className="space-y-2">
            <Label>{loan.type === 'lend' ? "存入钱包" : "扣款钱包"}</Label>
            <Select 
              value={formData.walletId} 
              onValueChange={(v) => setFormData({...formData, walletId: v})}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择钱包" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map(w => (
                  <SelectItem key={w.id} value={w.id.toString()}>
                    {w.name} ({w.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>日期</Label>
            <Input 
              type="date" 
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label>备注</Label>
            <Input 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "保存中..." : "确认"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
