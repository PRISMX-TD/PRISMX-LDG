import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset, SidebarRail } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNavBar } from "@/components/MobileNavBar";
import { MobileHeader } from "@/components/MobileHeader";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Categories from "@/pages/Categories";
import Wallets from "@/pages/Wallets";
import Budgets from "@/pages/Budgets";
import Savings from "@/pages/Savings";
import Recurring from "@/pages/Recurring";
import Reminders from "@/pages/Reminders";
import Analytics from "@/pages/Analytics";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Exchange from "@/pages/Exchange";
import SubLedgers from "@/pages/SubLedgers";
import WalletDetail from "@/pages/WalletDetail";

function AuthenticatedLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  } as React.CSSProperties;

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden md:block h-screen">
        <SidebarProvider style={sidebarStyle}>
          <div className="flex h-screen w-full overflow-hidden">
            <AppSidebar user={user} />
            <SidebarRail />
            <SidebarInset className="flex flex-col flex-1 min-w-0 bg-transparent">
              <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-primary/10 bg-background/40 backdrop-blur-xl px-4">
                <SidebarTrigger data-testid="button-sidebar-toggle" className="-ml-1" />
              </header>
              <main className="flex-1 overflow-auto">
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/transactions" component={Transactions} />
                  <Route path="/categories" component={Categories} />
                  <Route path="/wallets" component={Wallets} />
                  <Route path="/wallets/:id" component={WalletDetail} />
                  <Route path="/exchange" component={Exchange} />
                  <Route path="/budgets" component={Budgets} />
                  <Route path="/savings" component={Savings} />
                  <Route path="/recurring" component={Recurring} />
                  <Route path="/reminders" component={Reminders} />
                  <Route path="/analytics" component={Analytics} />
                  <Route path="/reports" component={Reports} />
                  <Route path="/sub-ledgers" component={SubLedgers} />
                  <Route path="/settings" component={Settings} />
                  <Route component={NotFound} />
                </Switch>
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col min-h-screen">
        <MobileHeader user={user} />
        <main className="flex-1 overflow-auto pb-20">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/transactions" component={Transactions} />
            <Route path="/categories" component={Categories} />
            <Route path="/wallets" component={Wallets} />
            <Route path="/wallets/:id" component={WalletDetail} />
            <Route path="/exchange" component={Exchange} />
            <Route path="/budgets" component={Budgets} />
            <Route path="/savings" component={Savings} />
            <Route path="/recurring" component={Recurring} />
            <Route path="/reminders" component={Reminders} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/reports" component={Reports} />
            <Route path="/sub-ledgers" component={SubLedgers} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </main>
        <MobileNavBar user={user} />
      </div>
    </>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <PWAUpdatePrompt />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
