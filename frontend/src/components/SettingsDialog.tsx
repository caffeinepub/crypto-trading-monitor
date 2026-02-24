import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BinanceCredentialsPanel } from './BinanceCredentialsPanel';
import LiveTradingToggle from './LiveTradingToggle';
import { TotalCapitalInput } from './TotalCapitalInput';
import { Settings, Key, Zap, DollarSign } from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ zIndex: 9999 }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Settings className="w-5 h-5" />
            Configurações
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="credentials" className="mt-2">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="credentials" className="flex items-center gap-1.5 text-xs">
              <Key className="w-3.5 h-3.5" />
              API Binance
            </TabsTrigger>
            <TabsTrigger value="trading" className="flex items-center gap-1.5 text-xs">
              <Zap className="w-3.5 h-3.5" />
              Live Trading
            </TabsTrigger>
            <TabsTrigger value="capital" className="flex items-center gap-1.5 text-xs">
              <DollarSign className="w-3.5 h-3.5" />
              Capital
            </TabsTrigger>
          </TabsList>

          <TabsContent value="credentials" className="mt-4">
            <BinanceCredentialsPanel />
          </TabsContent>

          <TabsContent value="trading" className="mt-4">
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-border bg-card">
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Modo Live Trading
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Ative para enviar ordens reais à Binance Futures. Certifique-se de que suas credenciais API estão configuradas corretamente.
                </p>
                <LiveTradingToggle />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="capital" className="mt-4">
            <div className="p-4 rounded-lg border border-border bg-card">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Capital Total
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Defina seu capital total para cálculos de exposição e gerenciamento de risco.
              </p>
              <TotalCapitalInput />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
