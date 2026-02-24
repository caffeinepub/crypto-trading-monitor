import React, { useState, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { useLiveTradingMode } from '../hooks/useLiveTradingMode';
import { hasValidCredentials } from '../utils/liveTradingStorage';
import { toast } from 'sonner';
import { Zap, ZapOff, Loader2 } from 'lucide-react';

interface LiveTradingToggleProps {
  onCredentialsRequired?: () => void;
}

export const LiveTradingToggle: React.FC<LiveTradingToggleProps> = ({ onCredentialsRequired }) => {
  const { isLiveMode, isValidating, toggleLiveTrading } = useLiveTradingMode();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  // Track pending toggle value separately from the switch state
  const [pendingEnable, setPendingEnable] = useState(false);

  const handleSwitchChange = useCallback((checked: boolean) => {
    if (checked) {
      // Check credentials before showing confirmation dialog
      if (!hasValidCredentials()) {
        toast.error('API credentials required', {
          description: 'Please configure your Binance API keys before enabling live trading.',
        });
        onCredentialsRequired?.();
        return;
      }
      // Show confirmation dialog — do NOT change switch state yet
      setPendingEnable(true);
      setShowConfirmDialog(true);
    } else {
      // Disabling live mode — no confirmation needed
      handleToggle(false);
    }
  }, [onCredentialsRequired]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback(async (enabled: boolean) => {
    try {
      await toggleLiveTrading(enabled);
      if (enabled) {
        toast.success('Live Trading Enabled', {
          description: 'Real orders will now be placed on Binance Futures.',
        });
      } else {
        toast.info('Live Trading Disabled', {
          description: 'Switched back to simulation mode.',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle live trading mode.';
      toast.error('Live Trading Error', { description: message });
    }
  }, [toggleLiveTrading]);

  const handleConfirm = useCallback(async () => {
    setShowConfirmDialog(false);
    if (pendingEnable) {
      await handleToggle(true);
    }
    setPendingEnable(false);
  }, [pendingEnable, handleToggle]);

  const handleCancel = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingEnable(false);
  }, []);

  return (
    <>
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3">
          {isLiveMode ? (
            <Zap className="h-4 w-4 text-amber-500" />
          ) : (
            <ZapOff className="h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <Label htmlFor="live-trading-switch" className="text-sm font-medium cursor-pointer">
              Live Trade Mode
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLiveMode ? 'Real orders on Binance Futures' : 'Simulation mode (no real orders)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLiveMode && (
            <Badge variant="outline" className="text-amber-500 border-amber-500 text-xs">
              LIVE
            </Badge>
          )}
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              id="live-trading-switch"
              checked={isLiveMode}
              onCheckedChange={handleSwitchChange}
              disabled={isValidating}
              className="data-[state=checked]:bg-amber-500"
            />
          )}
        </div>
      </div>

      {/* Confirmation dialog rendered at this level, not nested inside another dialog portal */}
      <AlertDialog open={showConfirmDialog} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <AlertDialogContent style={{ zIndex: 10000 }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Enable Live Trading?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                You are about to enable <strong>Live Trading Mode</strong>. This will place{' '}
                <strong>real orders</strong> on Binance Futures using your API credentials.
              </span>
              <span className="block text-destructive font-medium">
                ⚠️ Real funds are at risk. Only proceed if you understand the risks.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              Enable Live Trading
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LiveTradingToggle;
