import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Shield, Key, Lock, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export function Login_EME({ onLogin }: { onLogin: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [passphrase, setPassphrase] = useState(""); // ضع نص مؤقت إذا Binance لا تحتاجه
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const { toast } = useToast();

  // ✅ التحقق التلقائي من المفاتيح المخزنة
  useEffect(() => {
    const verifySession = async () => {
      const stored = localStorage.getItem("binance_credentials");
      if (!stored) {
        setIsVerifying(false);
        return;
      }

      try {
        const res = await apiRequest("GET", "/api/auth/check");
        const data = await res.json();

        if (res.ok && data.success === true) {
          onLogin();
          return;
        }
      } catch (error) {
        console.error("Session verification failed:", error);
      }

      setIsVerifying(false);
    };

    verifySession();
  }, [onLogin]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanApiKey = apiKey.trim();
    const cleanSecret = secret.trim();
    const cleanPassphrase = passphrase.trim();

    if (!cleanApiKey || !cleanSecret) {
      toast({
        variant: "destructive",
        title: "بيانات ناقصة",
        description: "يرجى إدخال API Key و Secret Key الخاصة بـ Binance بشكل صحيح",
      });
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiRequest("POST", "/api/auth/login", {
        binanceApiKey: cleanApiKey,
        binanceSecret: cleanSecret,
        binancePassword: cleanPassphrase, // إذا غير مطلوب يمكن وضع "-"
      });

      const data = await res.json();

      if (res.ok && data.success === true) {
        localStorage.setItem(
          "binance_credentials",
          JSON.stringify({
            apiKey: cleanApiKey,
            secret: cleanSecret,
            passphrase: cleanPassphrase,
          })
        );

        toast({
          title: "تم الربط بنجاح",
          description: "تم تفعيل محرك التداول بنجاح",
        });

        onLogin();
      } else {
        toast({
          variant: "destructive",
          title: "فشل الارتباط",
          description:
            data?.message ||
            "عذراً، مفاتيح Binance غير صالحة أو لم يتم تفعيل التداول",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطأ في الاتصال",
        description: "تعذر الاتصال بالسيرفر، يرجى المحاولة مرة أخرى",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass-card neon-glow border-primary/20">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 neon-pulse">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-neon-cyan tracking-tighter">
            نظام البارق صباح
          </CardTitle>
          <p className="text-white/40 text-xs uppercase tracking-[0.2em] mt-2">
            Quantum Authentication Layer
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary/60 text-xs font-mono mb-1">
                <Key className="w-3 h-3" /> Binance API KEY
              </div>
              <Input
                placeholder="API KEY"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-black/50 border-white/10 font-mono text-xs focus:border-primary/50"
                autoComplete="off"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary/60 text-xs font-mono mb-1">
                <Key className="w-3 h-3" /> Binance SECRET
              </div>
              <Input
                type="password"
                placeholder="API SECRET"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="bg-black/50 border-white/10 font-mono text-xs focus:border-primary/50"
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary/60 text-xs font-mono mb-1">
                <Lock className="w-3 h-3" /> Passphrase (اختياري)
              </div>
              <Input
                type="password"
                placeholder="PASSPHRASE"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="bg-black/50 border-white/10 font-mono text-xs focus:border-primary/50"
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary/80 text-black font-bold uppercase tracking-widest mt-6"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  جاري الربط...
                </>
              ) : (
                "Activate Link"
              )}
            </Button>

            <p className="text-[10px] text-center text-white/20 uppercase tracking-widest mt-4">
              تطوير وبرمجة: المطور البارق صباح | OMEGA v4.0
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}