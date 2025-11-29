import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { WalletCard, WalletCardSkeleton } from "@/components/WalletCard";
import { WalletModal } from "@/components/WalletModal";
import { TotalAssetsCard } from "@/components/TotalAssetsCard";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Plus } from "lucide-react";
import type { Wallet as WalletType } from "@shared/schema";

export default function Wallets() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);

  const { data: wallets = [], isLoading } = useQuery<WalletType[]>({
    queryKey: ["/api/wallets"],
  });

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="hidden md:flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6" />
          钱包管理
        </h1>
        <Button
          onClick={() => {
            setSelectedWallet(null);
            setIsModalOpen(true);
          }}
          data-testid="button-add-wallet"
        >
          <Plus className="w-4 h-4 mr-1" />
          添加钱包
        </Button>
      </div>

      <TotalAssetsCard
        wallets={wallets}
        defaultCurrency={user?.defaultCurrency || "MYR"}
        isLoading={isLoading}
      />

      <div className="flex md:hidden items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          我的钱包
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedWallet(null);
            setIsModalOpen(true);
          }}
          className="text-sm"
          data-testid="button-add-wallet-inline"
        >
          <Plus className="w-4 h-4 mr-1" />
          添加
        </Button>
      </div>

      {isLoading ? (
        <>
          <div className="hidden md:grid gap-4 grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4].map((i) => (
              <WalletCardSkeleton key={i} />
            ))}
          </div>
          <div className="md:hidden space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <WalletCardSkeleton key={i} />
            ))}
          </div>
        </>
      ) : wallets.length === 0 ? (
        <Card>
          <CardContent className="p-4 md:p-6">
            <EmptyState
              icon={Wallet}
              title="还没有钱包"
              description="添加您的第一个钱包开始记账"
              actionLabel="添加钱包"
              onAction={() => setIsModalOpen(true)}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden md:grid gap-4 grid-cols-2 lg:grid-cols-3">
            {wallets.map((wallet) => (
              <WalletCard
                key={wallet.id}
                wallet={wallet}
                onClick={() => {
                  setSelectedWallet(wallet);
                  setIsModalOpen(true);
                }}
              />
            ))}
          </div>
          <div className="md:hidden space-y-2">
            {wallets.map((wallet) => (
              <WalletCard
                key={wallet.id}
                wallet={wallet}
                onClick={() => {
                  setSelectedWallet(wallet);
                  setIsModalOpen(true);
                }}
              />
            ))}
          </div>
        </>
      )}

      <WalletModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        wallet={selectedWallet}
        defaultCurrency={user?.defaultCurrency || "MYR"}
      />
    </div>
  );
}
