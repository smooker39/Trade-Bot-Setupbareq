import { Sidebar } from "./Sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation } from "wouter";

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Mobile Header */}
      <div className="lg:hidden flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md sticky top-0 z-40">
        <h1 className="font-display text-lg font-bold text-primary text-glow">AIQ COINS</h1>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
          <Menu />
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 w-64 bg-card border-l border-border p-6 shadow-2xl lg:hidden"
            >
              <h2 className="font-display text-xl font-bold mb-8">Navigation</h2>
              <div className="flex flex-col gap-2">
                {[
                  { href: "/", label: "Dashboard" },
                  { href: "/bots", label: "Trading Bots" },
                  { href: "/trades", label: "Trade History" },
                ].map(item => (
                  <Link key={item.href} href={item.href}>
                    <div 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium ${location === item.href ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
                    >
                      {item.label}
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="lg:pl-72 min-h-screen pb-12">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pt-8">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
