import { useState } from "react";
import { useBots, useCreateBot, useUpdateBot, useDeleteBot, useStartBot, useStopBot } from "@/hooks/use-bots";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Plus, Play, Square, Settings2, Trash2, Activity, ShieldAlert, Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Bot } from "@shared/schema";

export default function Bots() {
  const { data: bots = [], isLoading } = useBots();
  const createBot = useCreateBot();
  const updateBot = useUpdateBot();
  const deleteBot = useDeleteBot();
  const startBot = useStartBot();
  const stopBot = useStopBot();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<Bot | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    symbol: "BTC/USDT",
    amount: "1000",
    takeProfit: "5",
    stopLoss: "2"
  });

  const handleOpenModal = (bot?: Bot) => {
    if (bot) {
      setEditingBot(bot);
      setFormData({
        name: bot.name,
        symbol: bot.symbol,
        amount: bot.amount,
        takeProfit: bot.takeProfit || "",
        stopLoss: bot.stopLoss || ""
      });
    } else {
      setEditingBot(null);
      setFormData({ name: "", symbol: "BTC/USDT", amount: "1000", takeProfit: "5", stopLoss: "2" });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBot) {
        await updateBot.mutateAsync({ id: editingBot.id, ...formData });
      } else {
        await createBot.mutateAsync(formData);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this bot?")) {
      await deleteBot.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Trading Bots</h1>
          <p className="mt-2 text-muted-foreground">Manage and monitor your automated trading engines.</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto gap-2">
          <Plus size={18} /> Deploy Engine
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse h-64 border-white/5 bg-white/5" />
          ))}
        </div>
      ) : bots.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed border-white/10 rounded-3xl bg-card/30">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary box-glow">
            <Settings2 size={32} />
          </div>
          <h2 className="text-2xl font-bold font-display text-foreground mb-2">No Engines Deployed</h2>
          <p className="text-muted-foreground max-w-md mb-8">Deploy your first trading bot to start automating your crypto strategies 24/7.</p>
          <Button onClick={() => handleOpenModal()} size="lg">Create First Bot</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {bots.map((bot) => (
            <Card key={bot.id} className="flex flex-col glass-panel hover:border-primary/30 transition-all duration-300 hover:shadow-primary/5 hover:-translate-y-1 group">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{bot.name}</CardTitle>
                    <p className="text-sm font-mono mt-1 text-muted-foreground flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {bot.symbol}
                    </p>
                  </div>
                  <Badge variant={bot.status === 'active' ? 'success' : 'secondary'} className="uppercase px-3 py-1">
                    {bot.status}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 pb-4">
                <div className="grid grid-cols-2 gap-4 bg-background/50 p-4 rounded-xl border border-white/5">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Activity size={12} /> Allocation</p>
                    <p className="font-mono font-medium">{formatCurrency(bot.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Target size={12} /> Target</p>
                    <p className="font-mono font-medium text-emerald-500">+{bot.takeProfit}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><ShieldAlert size={12} /> Stop Loss</p>
                    <p className="font-mono font-medium text-destructive">-{bot.stopLoss}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Created</p>
                    <p className="font-mono font-medium text-sm">{new Date(bot.createdAt || '').toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-0 flex gap-2 border-t border-white/5 mt-auto pt-4">
                {bot.status === 'active' ? (
                  <Button 
                    variant="outline" 
                    className="flex-1 border-amber-500/50 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400" 
                    onClick={() => stopBot.mutate(bot.id)}
                    isLoading={stopBot.isPending}
                  >
                    <Square size={16} className="mr-2 fill-current" /> Halt
                  </Button>
                ) : (
                  <Button 
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold box-glow" 
                    onClick={() => startBot.mutate(bot.id)}
                    isLoading={startBot.isPending}
                  >
                    <Play size={16} className="mr-2 fill-current" /> Initialize
                  </Button>
                )}
                
                <Button variant="outline" size="icon" onClick={() => handleOpenModal(bot)}>
                  <Settings2 size={18} />
                </Button>
                <Button variant="outline" size="icon" className="hover:border-destructive/50 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(bot.id)}>
                  <Trash2 size={18} />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingBot ? "Configure Engine" : "Deploy New Engine"}
        description="Set your strategy parameters. Changes apply immediately upon deployment."
      >
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Engine Designation</label>
              <Input 
                required 
                placeholder="e.g. Quantum Alpha" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Trading Pair</label>
                <Input 
                  required 
                  placeholder="BTC/USDT" 
                  value={formData.symbol}
                  onChange={e => setFormData({...formData, symbol: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Capital Allocation ($)</label>
                <Input 
                  required 
                  type="number" 
                  step="0.01" 
                  placeholder="1000" 
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <label className="text-sm font-medium text-emerald-500 mb-1.5 block flex items-center gap-2"><Target size={14}/> Take Profit (%)</label>
                <Input 
                  type="number" 
                  step="0.1" 
                  placeholder="5.0" 
                  className="border-emerald-500/30 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                  value={formData.takeProfit}
                  onChange={e => setFormData({...formData, takeProfit: e.target.value})}
                />
              </div>
              <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5">
                <label className="text-sm font-medium text-destructive mb-1.5 block flex items-center gap-2"><ShieldAlert size={14}/> Stop Loss (%)</label>
                <Input 
                  type="number" 
                  step="0.1" 
                  placeholder="2.0" 
                  className="border-destructive/30 focus-visible:border-destructive focus-visible:ring-destructive/20"
                  value={formData.stopLoss}
                  onChange={e => setFormData({...formData, stopLoss: e.target.value})}
                />
              </div>
            </div>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createBot.isPending || updateBot.isPending}>
              {editingBot ? "Update Parameters" : "Initialize Engine"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
