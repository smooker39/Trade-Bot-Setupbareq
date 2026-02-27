import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Send, Key, MessageSquare, CheckCircle, XCircle, Loader2, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TelegramStatus {
  configured: boolean;
  hasToken: boolean;
  hasChatId: boolean;
}

interface TestResult {
  success: boolean;
  error?: string;
}

interface SaveResult {
  success: boolean;
  message?: string;
  welcomeMessageSent?: boolean;
  encrypted?: boolean;
  error?: string;
}

export function TelegramSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const { data: telegramStatus, isLoading } = useQuery<TelegramStatus>({
    queryKey: ['/api/settings/telegram'],
    refetchInterval: 10000
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      setTestStatus('testing');
      const res = await apiRequest('POST', '/api/settings/telegram/test', { 
        telegramToken: token, 
        telegramChatId: chatId 
      });
      return await res.json() as TestResult;
    },
    onSuccess: (data) => {
      if (data.success) {
        setTestStatus('success');
        toast({
          title: "Connection Successful",
          description: "A test message was sent to your Telegram chat."
        });
      } else {
        setTestStatus('error');
        toast({
          title: "Connection Failed",
          description: data.error || "Could not connect to Telegram.",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      setTestStatus('error');
      toast({
        title: "Test Failed",
        description: error.message || "Connection test failed.",
        variant: "destructive"
      });
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/settings/telegram', { 
        telegramToken: token, 
        telegramChatId: chatId 
      });
      return await res.json() as SaveResult;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/settings/telegram'] });
        toast({
          title: "Telegram Connected",
          description: data.welcomeMessageSent 
            ? "Welcome message sent! Alerts are now active." 
            : "Alerts configured successfully."
        });
        setToken("");
        setChatId("");
        setTestStatus('idle');
      } else {
        toast({
          title: "Save Failed",
          description: data.error || "Could not save settings.",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save Telegram settings.",
        variant: "destructive"
      });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', '/api/settings/telegram');
      return await res.json() as SaveResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/telegram'] });
      toast({
        title: "Telegram Disconnected",
        description: "Telegram alerts have been disabled."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect Telegram.",
        variant: "destructive"
      });
    }
  });

  const handleTest = () => {
    if (!token || !chatId) {
      toast({
        title: "Missing Fields",
        description: "Please enter both Bot Token and Chat ID.",
        variant: "destructive"
      });
      return;
    }
    testMutation.mutate();
  };

  const handleSave = () => {
    if (!token || !chatId) {
      toast({
        title: "Missing Fields",
        description: "Please enter both Bot Token and Chat ID.",
        variant: "destructive"
      });
      return;
    }
    saveMutation.mutate();
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  return (
    <Card 
      className="border-0 shadow-2xl mobile-card w-full max-w-full"
      style={{
        background: "rgba(13, 13, 13, 0.8)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(0, 255, 255, 0.15)",
      }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-muted-foreground tracking-widest flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-neon-cyan" />
            TELEGRAM ALERTS
          </div>
          {telegramStatus?.configured ? (
            <Badge variant="outline" className="border-green-500/50 text-green-400" data-testid="badge-telegram-connected">
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="border-yellow-500/50 text-yellow-400" data-testid="badge-telegram-disconnected">
              <XCircle className="w-3 h-3 mr-1" />
              Not Configured
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {telegramStatus?.configured ? (
          <div className="space-y-4">
            <div 
              className="p-4 rounded-lg text-center"
              style={{ 
                background: "rgba(0, 255, 0, 0.05)",
                border: "1px solid rgba(0, 255, 0, 0.2)"
              }}
            >
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-green-400 font-medium">Telegram alerts are active</p>
              <p className="text-xs text-muted-foreground mt-1">
                You will receive notifications for critical events, safe mode, and emergencies.
              </p>
            </div>
            <Button 
              variant="outline" 
              className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
              onClick={handleDisconnect}
              disabled={disconnectMutation.isPending}
              data-testid="button-disconnect-telegram"
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Disconnect Telegram
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Connect your Telegram bot to receive critical alerts, safe mode notifications, and emergency updates.
            </p>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="telegram-token" className="text-xs text-muted-foreground flex items-center gap-2">
                  <Key className="w-3 h-3" />
                  Bot Token
                </Label>
                <Input
                  id="telegram-token"
                  type="password"
                  placeholder="123456789:ABCdefGHI..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="bg-black/40 border-white/10 text-sm font-mono"
                  data-testid="input-telegram-token"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="telegram-chat-id" className="text-xs text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" />
                  Chat ID
                </Label>
                <Input
                  id="telegram-chat-id"
                  type="text"
                  placeholder="-1001234567890"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="bg-black/40 border-white/10 text-sm font-mono"
                  data-testid="input-telegram-chat-id"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button 
                variant="outline" 
                className="flex-1 w-full"
                onClick={handleTest}
                disabled={testMutation.isPending || !token || !chatId}
                data-testid="button-test-telegram"
              >
                {testMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : testStatus === 'success' ? (
                  <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                ) : testStatus === 'error' ? (
                  <XCircle className="w-4 h-4 mr-2 text-red-400" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Test Connection
              </Button>
              
              <Button 
                className="flex-1 w-full bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30"
                onClick={handleSave}
                disabled={saveMutation.isPending || testStatus !== 'success'}
                data-testid="button-save-telegram"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Save & Connect
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Test your connection first, then save to activate alerts.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}