import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { GlobalBackground } from "@/components/GlobalBackground";
import { FloatingSidebar } from "@/components/FloatingSidebar";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { NavigationProvider, useNavigation, PageType, PROTECTED_PAGES } from "@/contexts/NavigationContext";
import { GameProvider } from "@/contexts/GameContext";
import { useAuth } from "@/hooks/use-auth";

import Landing from "@/pages/Landing";
import Game from "@/pages/Game";
import Leaderboard from "@/pages/Leaderboard";
import Account from "@/pages/Account";
import Premium from "@/pages/Premium";
import PaymentSuccess from "@/pages/PaymentSuccess";
import RankedLobby from "@/pages/RankedLobby";
import RankedMatch from "@/pages/RankedMatch";
import CasualLobby from "@/pages/CasualLobby";
import CasualMatch from "@/pages/CasualMatch";
import Announcements from "@/pages/Announcements";
import Notifications from "@/pages/Notifications";
import Contact from "@/pages/Contact";
import More from "@/pages/More";
import Social from "@/pages/Social";
import Shop from "@/pages/Shop";
import ProductDetail from "@/pages/ProductDetail";
import UserProfile from "@/pages/UserProfile";
import WildMatch from "@/pages/WildMatch";
import TestMatch from "@/pages/TestMatch";
import Achievements from "@/pages/Achievements";
import Strategy from "@/pages/Strategy";
import MyRanking from "@/pages/MyRanking";
import MyStatistics from "@/pages/MyStatistics";
import RankedGuide from "@/pages/RankedGuide";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

function ProtectedPageGuard({ children }: { children: React.ReactNode }) {
  const { currentPage, navigateTo } = useNavigation();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && PROTECTED_PAGES.has(currentPage)) {
      navigateTo('landing');
    }
  }, [isLoading, isAuthenticated, currentPage, navigateTo]);

  if (PROTECTED_PAGES.has(currentPage) && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (PROTECTED_PAGES.has(currentPage) && !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

function PageRenderer() {
  const { currentPage, params } = useNavigation();

  const pageComponents: Record<PageType, React.ReactNode> = {
    'landing': <Landing />,
    'game': <Game />,
    'leaderboard': <Leaderboard />,
    'account': <Account />,
    'achievements': <Achievements />,
    'premium': <Premium />,
    'payment-success': <PaymentSuccess />,
    'ranked': <RankedLobby />,
    'ranked-match': <RankedMatch />,
    'casual-lobby': <CasualLobby />,
    'casual-match': <CasualMatch />,
    'announcements': <Announcements />,
    'notifications': <Notifications />,
    'contact': <Contact />,
    'more': <More />,
    'social': <Social />,
    'shop': <Shop />,
    'product-detail': <ProductDetail />,
    'user-profile': <UserProfile />,
    'wild-match': <WildMatch />,
    'test-match': <TestMatch />,
    'terms': <NotFound />,
    'privacy': <NotFound />,
    'faq': <NotFound />,
    'about': <NotFound />,
    'strategy': <Strategy />,
    'my-ranking': <MyRanking />,
    'my-statistics': <MyStatistics />,
    'ranked-guide': <RankedGuide />,
    'admin': <Admin />,
    'settings': <Account />,
    'not-found': <NotFound />,
  };

  return (
    <ProtectedPageGuard>
      {pageComponents[currentPage] || <NotFound />}
    </ProtectedPageGuard>
  );
}

function ThemeInitializer() {
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = stored === 'dark' || (!stored && prefersDark) || !stored;
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, []);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NavigationProvider>
          <SidebarProvider>
            <GameProvider>
              <ThemeInitializer />
              <GlobalBackground />
              <FloatingSidebar />
              <Toaster />
              <PageRenderer />
            </GameProvider>
          </SidebarProvider>
        </NavigationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
