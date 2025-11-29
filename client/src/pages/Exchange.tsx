import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ArrowUpDown, 
  Key, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Shield,
  TrendingUp,
  Coins,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";

interface ExchangeCredential {
  id: number;
  exchange: string;
  label: string;
  isActive: boolean;
  lastSyncAt: string | null;
  createdAt: string;
  apiKeyPreview: string;
}

interface MexcBalance {
  asset: string;
  free: string;
  locked: string;
  usdtValue?: string;
  price?: string;
  accountType?: string;
}

interface MexcBalancesResponse {
  balances: MexcBalance[];
  totalUsdtValue: string;
  lastSyncAt: string;
}

export default function Exchange() {
  const { toast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [label, setLabel] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const { data: credentials = [], isLoading: isLoadingCredentials } = useQuery<ExchangeCredential[]>({
    queryKey: ["/api/exchange-credentials"],
  });

  const hasMexcCredential = credentials.some(c => c.exchange === 'mexc');

  const { data: balances, isLoading: isLoadingBalances, refetch: refetchBalances, error: balancesError } = useQuery<MexcBalancesResponse>({
    queryKey: ["/api/mexc/balances"],
    enabled: hasMexcCredential,
    refetchInterval: 60000,
  });

  const addCredentialMutation = useMutation({
    mutationFn: async (data: { exchange: string; apiKey: string; apiSecret: string; label: string }) => {
      const res = await apiRequest("POST", "/api/exchange-credentials", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "API凭证已保存", description: "正在获取账户信息..." });
      setIsAddModalOpen(false);
      setApiKey("");
      setApiSecret("");
      setLabel("");
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mexc/balances"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "保存失败", 
        description: error.message || "请检查API凭证是否正确",
        variant: "destructive",
      });
    },
  });

  const deleteCredentialMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/exchange-credentials/${id}`);
    },
    onSuccess: () => {
      toast({ title: "已删除API凭证" });
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mexc/balances"] });
    },
    onError: () => {
      toast({ 
        title: "删除失败", 
        variant: "destructive",
      });
    },
  });

  const handleAddCredential = () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      toast({ title: "请填写API Key和Secret", variant: "destructive" });
      return;
    }
    addCredentialMutation.mutate({
      exchange: "mexc",
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      label: label.trim() || "MEXC账户",
    });
  };

  const formatCurrency = (value: string | number, decimals = 2) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatCrypto = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    if (num === 0) return '0';
    if (num < 0.00001) return num.toExponential(4);
    if (num < 1) return num.toFixed(8);
    if (num < 1000) return num.toFixed(4);
    return formatCurrency(num, 2);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowUpDown className="w-6 h-6" />
          交易所账户
        </h1>
        {!hasMexcCredential && (
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-exchange">
                <Plus className="w-4 h-4 mr-1" />
                连接交易所
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  连接MEXC交易所
                </DialogTitle>
                <DialogDescription>
                  请输入您的MEXC API Key和Secret以查看账户余额。
                  请确保API权限仅包含"读取"，不要开启"交易"权限。
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="label">账户标签 (可选)</Label>
                  <Input
                    id="label"
                    placeholder="我的MEXC账户"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    data-testid="input-exchange-label"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    placeholder="mx0v..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    data-testid="input-api-key"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="apiSecret">API Secret</Label>
                  <div className="relative">
                    <Input
                      id="apiSecret"
                      type={showSecret ? "text" : "password"}
                      placeholder="输入API Secret"
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      className="pr-10"
                      data-testid="input-api-secret"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSecret(!showSecret)}
                      data-testid="button-toggle-secret"
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="bg-muted p-3 rounded-md flex items-start gap-2">
                  <Shield className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                  <p className="text-xs text-muted-foreground">
                    您的API凭证将被加密存储，只用于读取账户余额。
                    建议创建仅具有"读取"权限的API Key。
                  </p>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddModalOpen(false)}
                    data-testid="button-cancel-add"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleAddCredential}
                    disabled={addCredentialMutation.isPending}
                    data-testid="button-save-exchange"
                  >
                    {addCredentialMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        验证中...
                      </>
                    ) : (
                      "保存并验证"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoadingCredentials ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : !hasMexcCredential ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <ArrowUpDown className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">连接您的交易所账户</h3>
              <p className="text-muted-foreground max-w-md">
                连接MEXC交易所API以查看您的加密货币资产余额和实时估值。
              </p>
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                data-testid="button-connect-exchange"
              >
                <Plus className="w-4 h-4 mr-1" />
                连接MEXC交易所
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {credentials.filter(c => c.exchange === 'mexc').map((credential) => (
            <Card key={credential.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{credential.label}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span className="font-mono text-xs">{credential.apiKeyPreview}</span>
                        <Badge variant="outline" className="text-xs">
                          {credential.isActive ? (
                            <><CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />已连接</>
                          ) : (
                            <><AlertCircle className="w-3 h-3 mr-1 text-yellow-500" />已禁用</>
                          )}
                        </Badge>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchBalances()}
                      disabled={isLoadingBalances}
                      data-testid="button-refresh-balances"
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${isLoadingBalances ? 'animate-spin' : ''}`} />
                      刷新
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          data-testid="button-delete-credential"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确定要删除此API连接吗？</AlertDialogTitle>
                          <AlertDialogDescription>
                            删除后将无法查看此交易所的资产信息，您可以随时重新添加。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteCredentialMutation.mutate(credential.id)}
                            data-testid="button-confirm-delete"
                          >
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="w-5 h-5" />
                    资产余额
                  </CardTitle>
                  {balances?.lastSyncAt && (
                    <CardDescription>
                      最后更新: {new Date(balances.lastSyncAt).toLocaleString('zh-CN')}
                    </CardDescription>
                  )}
                </div>
                {balances?.totalUsdtValue && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">总估值 (USDT)</p>
                    <p className="text-2xl font-bold text-primary" data-testid="text-total-value">
                      ${formatCurrency(balances.totalUsdtValue)}
                    </p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingBalances ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : balancesError ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-destructive" />
                  <p>获取余额失败</p>
                  <p className="text-sm">{(balancesError as any)?.message}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => refetchBalances()}
                  >
                    重试
                  </Button>
                </div>
              ) : balances?.balances && balances.balances.length > 0 ? (
                <div className="space-y-3">
                  {balances.balances.map((balance, index) => (
                    <div 
                      key={`${balance.accountType || 'spot'}-${balance.asset}-${index}`} 
                      className="flex items-center justify-between py-2 border-b last:border-0"
                      data-testid={`row-balance-${balance.asset}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                          <span className="text-xs font-bold">{balance.asset.substring(0, 2)}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{balance.asset}</p>
                            {balance.accountType && (
                              <Badge variant="outline" className="text-xs py-0 px-1">
                                {balance.accountType}
                              </Badge>
                            )}
                          </div>
                          {balance.price && balance.asset !== 'USDT' && (
                            <p className="text-xs text-muted-foreground">
                              ${formatCurrency(balance.price, 6)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono" data-testid={`text-balance-${balance.asset}`}>
                          {formatCrypto(parseFloat(balance.free) + parseFloat(balance.locked))}
                        </p>
                        {balance.usdtValue && (
                          <p className="text-xs text-muted-foreground">
                            ≈ ${formatCurrency(balance.usdtValue)}
                          </p>
                        )}
                        {parseFloat(balance.locked) > 0 && (
                          <p className="text-xs text-yellow-600">
                            锁定: {formatCrypto(balance.locked)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Coins className="w-8 h-8 mx-auto mb-2" />
                  <p>暂无资产</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            安全提示
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• 请仅创建具有"读取"权限的API Key，不要开启交易权限</p>
          <p>• 您的API凭证使用AES-256加密存储，只有您可以访问</p>
          <p>• 本应用仅用于查看余额，不会执行任何交易操作</p>
          <p>• 建议定期更换API Key以确保账户安全</p>
        </CardContent>
      </Card>
    </div>
  );
}
