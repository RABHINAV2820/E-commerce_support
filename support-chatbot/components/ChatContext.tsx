"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type ChatMode = "min" | "dock" | "full";

interface ChatContextType {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  shouldMinimizeOnRouteChange: boolean;
  setShouldMinimizeOnRouteChange: (should: boolean) => void;
  orderContext: { orderId: string; message: string } | null;
  setOrderContext: (context: { orderId: string; message: string } | null) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ChatMode>("min");
  const [shouldMinimizeOnRouteChange, setShouldMinimizeOnRouteChange] = useState(true);
  const [orderContext, setOrderContext] = useState<{ orderId: string; message: string } | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Handle route changes
  useEffect(() => {
    console.log('ChatProvider: Route changed to:', pathname);
    
    // Check for openChat query parameter (legacy support)
    const openChat = searchParams.get('openChat');
    const orderId = searchParams.get('orderId');
    
    if (openChat === '1' && orderId) {
      console.log('ChatProvider: Opening chat with order context:', orderId);
      setOrderContext({
        orderId,
        message: `Hi, I see you're asking about Order #${orderId}. How can I help you?`
      });
      setMode("dock");
      setShouldMinimizeOnRouteChange(false);
    } else if (shouldMinimizeOnRouteChange) {
      console.log('ChatProvider: Minimizing chat due to route change');
      setMode("min");
      setOrderContext(null);
    }
    
    // Reset the minimize flag after handling
    setShouldMinimizeOnRouteChange(true);
  }, [pathname, searchParams, shouldMinimizeOnRouteChange]);

  return (
    <ChatContext.Provider value={{
      mode,
      setMode,
      shouldMinimizeOnRouteChange,
      setShouldMinimizeOnRouteChange,
      orderContext,
      setOrderContext
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
