import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface SidebarContextType {
  expanded: boolean;
  toggleExpanded: () => void;
  setExpanded: (value: boolean) => void;
  notificationOpen: boolean;
  setNotificationOpen: (value: boolean) => void;
  languageOpen: boolean;
  setLanguageOpen: (value: boolean) => void;
  profileOpen: boolean;
  setProfileOpen: (value: boolean) => void;
  dmOpen: boolean;
  setDmOpen: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  return (
    <SidebarContext.Provider value={{ 
      expanded, 
      toggleExpanded, 
      setExpanded,
      notificationOpen,
      setNotificationOpen,
      languageOpen,
      setLanguageOpen,
      profileOpen,
      setProfileOpen,
      dmOpen,
      setDmOpen
    }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
