import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Settings } from 'lucide-react';
import { LiveTradingToggle } from './LiveTradingToggle';
import { BinanceCredentialsPanel } from './BinanceCredentialsPanel';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg w-full border-primary/20 bg-card max-h-[90vh] overflow-y-auto"
        style={{ zIndex: 9999 }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Settings className="w-5 h-5 text-primary" />
            Configurações
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Gerencie suas credenciais da Binance e o modo de trading.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* API Credentials Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              Credenciais da API Binance Futures
            </h3>
            <BinanceCredentialsPanel />
          </div>

          <Separator className="bg-border/60" />

          {/* Trading Mode Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              Modo de Trading
            </h3>
            <LiveTradingToggle />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
