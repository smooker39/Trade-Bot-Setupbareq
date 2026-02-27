import { useState, useEffect, memo } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TradingProvider } from "@/contexts/TradingContext";
import { Dashboard_EME } from "@/components/Dashboard_EME";
import { Market_EME } from "@/components/Market_EME";
import { Risk_EME } from "@/components/Risk_EME";
import { Logs_EME } from "@/components/Logs_EME";
import { Telegram_EME } from "@/components/Telegram_EME";
import { BottomNav, type TabType } from "@/components/BottomNav";
import { Login_EME } from "./components/Login_EME";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // SECURITY CORE V3.1: window.onload equivalent integrity check
    const checkIntegrity = () => {
      const savedAuth = localStorage.getItem("aiq_auth");
      const savedCreds = localStorage.getItem("okx_credentials");
      
      if (savedAuth) {
        try {
          const creds = JSON.parse(savedCreds || "{}");
          // If keys are missing or malformed, purge immediately
          if (!creds.apiKey || !creds.secret || creds.apiKey.length < 5) {
            console.error("🔒 SECURITY CORE: Invalid or corrupt API keys detected. Purging session.");
            handleLogout();
          } else {
            setIsAuthenticated(true);
          }
        } catch (e) {
          console.error("🔒 SECURITY CORE: Session data corrupted. Purging.");
          handleLogout();
        }
      } else {
        setIsAuthenticated(false);
      }
    };

    checkIntegrity();
    
    // Listen for storage changes from other tabs to ensure synchronized logout
    window.addEventListener("storage", (e) => {
      if (e.key === "aiq_auth" && !e.newValue) {
        setIsAuthenticated(false);
      }
    });
  }, []);

  const handleLogout = async () => {
    console.log("🔒 SECURITY CORE: Executing atomic localStorage.clear()");
    try {
      // Must use POST as defined in server/routes.ts
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout API failed", e);
    }
    localStorage.clear();
    setIsAuthenticated(false);
    // Force a hard reload to origin to ensure clean state
    window.location.href = window.location.origin;
  };

  if (!isAuthenticated) {
    return <Login_EME onLogin={() => setIsAuthenticated(true)} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard": return <Dashboard_EME />;
      case "market": return <Market_EME />;
      case "risk": return <Risk_EME />;
      case "logs": return <Logs_EME />;
      case "telegram": return <Telegram_EME />;
      default: return <Dashboard_EME />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col overflow-hidden">
      {/* Sovereign Header */}
      <header className="p-4 border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50 flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-tighter text-primary uppercase">AIQ COINS</h1>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <div className="flex gap-2 items-center">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">Quantum Link Active</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout}
            className="text-white/50 hover:text-red-500"
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Full-Screen Viewport with Transitions */}
      <main className="flex-1 relative overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Sovereign Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}

const App = memo(function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TradingProvider>
          <Toaster />
          <AppContent />
        </TradingProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
});

export default App;
