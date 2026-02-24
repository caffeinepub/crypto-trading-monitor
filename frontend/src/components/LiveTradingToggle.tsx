import React, { useState, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Zap, ZapOff } from 'lucide-react';
import { toast } from 'sonner';
import { useLiveTradingMode } from '../hooks/useLiveTradingMode';

// Named constant for the overall activation timeout
const LIVE_TRADING_ACTIVATION_TIMEOUT_MS = 20000;

export function LiveTradingToggle() {
  const { isLiveTrading, toggleLiveTrading } = useLiveTradingMode();
  const [isPending, setIsPending] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Handle toggle click — if turning ON, show confirmation dialog first
  const handleToggleClick = useCallback(() => {
    if (isPending) return;

    if (!isLiveTrading) {
      // Show confirmation dialog before activating
      setShowConfirmDialog(true);
    } else {
      // Disable instantly — no async validation needed
      toggleLiveTrading(false);
    }
  }, [isLiveTrading, isPending, toggleLiveTrading]);

  // Called when user confirms activation in the dialog
  const handleConfirmActivation = useCallback(async () => {
    setShowConfirmDialog(false);
    setIsPending(true);

    // Outer race timeout — if the entire activation takes > 20s, reset to OFF
    const outerTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('OUTER_TIMEOUT')), LIVE_TRADING_ACTIVATION_TIMEOUT_MS)
    );

    try {
      await Promise.race([
        toggleLiveTrading(true),
        outerTimeoutPromise,
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      if (message === 'OUTER_TIMEOUT') {
        // Force disable and show error
        toggleLiveTrading(false);
        toast.error(
          'A ativação do Live Trading excedeu 20 segundos. Modo desativado por segurança.'
        );
      }
      // Other errors are handled inside toggleLiveTrading (useLiveTradingMode)
    } finally {
      // Always clear the pending/loading state
      setIsPending(false);
    }
  }, [toggleLiveTrading]);

  const handleCancelActivation = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {isLiveTrading ? (
            <Zap className="w-4 h-4 text-amber-400" />
          ) : (
            <ZapOff className="w-4 h-4 text-muted-foreground" />
          )}
          <Label
            htmlFor="live-trading-switch"
            className={`text-sm font-medium cursor-pointer ${
              isLiveTrading ? 'text-amber-400' : 'text-muted-foreground'
            }`}
          >
            {isLiveTrading ? 'Live Trading Ativo' : 'Live Trading Inativo'}
          </Label>
        </div>

        <div className="flex items-center gap-2">
          {isPending && (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          )}
          <Switch
            id="live-trading-switch"
            checked={isLiveTrading}
            onCheckedChange={handleToggleClick}
            disabled={isPending}
            className={isLiveTrading ? 'data-[state=checked]:bg-amber-500' : ''}
          />
        </div>
      </div>

      {isPending && (
        <p className="text-xs text-muted-foreground mt-1">
          Aguarde... validando credenciais
        </p>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent style={{ zIndex: 10000 }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-400">
              <Zap className="w-5 h-5" />
              Ativar Live Trading?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Ao ativar o Live Trading, as ordens serão enviadas diretamente à Binance Futures com dinheiro real.
              </span>
              <span className="block font-semibold text-foreground">
                Certifique-se de que suas credenciais API estão corretas e que você entende os riscos envolvidos.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelActivation}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmActivation}
              className="bg-amber-500 hover:bg-amber-600 text-black"
            >
              Confirmar Ativação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default LiveTradingToggle;
