import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

export type PageType = 
  | 'landing'
  | 'game'
  | 'leaderboard'
  | 'account'
  | 'achievements'
  | 'premium'
  | 'payment-success'
  | 'ranked'
  | 'ranked-match'
  | 'casual-lobby'
  | 'casual-match'
  | 'announcements'
  | 'notifications'
  | 'contact'
  | 'more'
  | 'social'
  | 'shop'
  | 'product-detail'
  | 'user-profile'
  | 'wild-match'
  | 'test-match'
  | 'terms'
  | 'privacy'
  | 'faq'
  | 'about'
  | 'strategy'
  | 'my-ranking'
  | 'my-statistics'
  | 'ranked-guide'
  | 'admin'
  | 'settings'
  | 'not-found';

export interface PageParams {
  matchId?: string;
  userId?: string;
  [key: string]: string | undefined;
}

interface NavigationState {
  currentPage: PageType;
  params: PageParams;
  history: Array<{ page: PageType; params: PageParams }>;
}

interface NavigationContextType {
  currentPage: PageType;
  params: PageParams;
  navigateTo: (page: PageType, params?: PageParams) => void;
  goBack: () => void;
  canGoBack: boolean;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

const MAX_HISTORY = 50;

export const PROTECTED_PAGES = new Set<PageType>([
  'account', 'settings', 'achievements', 'premium', 'shop',
  'product-detail', 'social', 'notifications', 'payment-success',
  'ranked', 'ranked-match', 'casual-lobby', 'casual-match',
  'wild-match', 'test-match', 'my-ranking', 'my-statistics', 'admin',
]);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NavigationState>({
    currentPage: 'landing',
    params: {},
    history: [],
  });

  const navigateTo = useCallback((page: PageType, params: PageParams = {}) => {
    setState((prev) => {
      const newHistory = [...prev.history, { page: prev.currentPage, params: prev.params }];
      // Cap history to prevent memory leak
      if (newHistory.length > MAX_HISTORY) {
        newHistory.splice(0, newHistory.length - MAX_HISTORY);
      }
      return { currentPage: page, params, history: newHistory };
    });
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.history.length === 0) {
        return { ...prev, currentPage: 'landing', params: {} };
      }
      const newHistory = [...prev.history];
      const lastPage = newHistory.pop()!;
      return {
        currentPage: lastPage.page,
        params: lastPage.params,
        history: newHistory,
      };
    });
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        currentPage: state.currentPage,
        params: state.params,
        navigateTo,
        goBack,
        canGoBack: state.history.length > 0,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}
