import React, { useState, useEffect, useCallback } from 'react';
import { Position } from '../types/position';
import { PositionWithPrice } from '../types/position';
import { PositionDashboard } from './PositionDashboard';
import { TotalCapitalSummary } from './TotalCapitalSummary';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, Loader2, KeyRound, Settings } from 'lucide-react';
import { hasCredentials } from '../utils/liveTradingStorage';
import { fetchOpenPositions } from '../services/binancePositionService';
import { toast } from 'sonner';

interface DashboardTabProps {
  positions: Position[];
  positionsWithPrice: PositionWithPrice[];
  onAddPosition: (position: Position) => void;
  onRemovePosition: (id: string) => void;
  onUpdatePosition: (position: Position) => void;
  onOpenSettings?: () => void;
}

export function DashboardTab({
  positions,
  positionsWithPrice,
  onAddPosition,
  onRemovePosition,
  onUpdatePosition,
  onOpenSettings,
}: DashboardTabProps) {
  // Reactive credential detection — updates immediately when credentials are saved/cleared
  const [credentialsAvailable, setCredentialsAvailable] = useState<boolean>(() => hasCredentials());
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const handler = () => {
      setCredentialsAvailable(hasCredentials());
    };

    window.addEventListener('credential-change', handler);
    window.addEventListener('credentialsChanged', handler);

    return () => {
      window.removeEventListener('credential-change', handler);
      window.removeEventListener('credentialsChanged', handler);
    };
  }, []);

  const handleImportFromBinance = useCallback(async () => {
    setIsImporting(true);
    try {
      const imported = await fetchOpenPositions();
      if (imported.length === 0) {
        toast.info('Nenhuma posição aberta encontrada na Binance.');
        return;
      }

      // Skip duplicates by symbol
      const existingSymbols = new Set(positions.map((p) => p.symbol));
      const newPositions = imported.filter((p) => !existingSymbols.has(p.symbol));

      if (newPositions.length === 0) {
        toast.info('Todas as posições da Binance já estão sendo monitoradas.');
        return;
      }

      for (const pos of newPositions) {
        await onAddPosition(pos);
      }
      toast.success(`${newPositions.length} posição(ões) importada(s) da Binance com sucesso!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Falha ao importar posições: ${message}`);
    } finally {
      setIsImporting(false);
    }
  }, [onAddPosition, positions]);

  return (
    <div className="space-y-6">
      {/* Capital Summary */}
      <TotalCapitalSummary positions={positionsWithPrice} />

      {/* REQ-116: Onboarding banner when no credentials are configured */}
      {!credentialsAvailable && (
        <Alert className="border-primary/40 bg-primary/5">
          <KeyRound className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary font-semibold">
            Configure suas credenciais da Binance
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Para importar posições reais, sincronizar automaticamente e enviar ordens, você precisa
              configurar sua API Key e Secret da Binance Futures.
            </p>
            <Button
              size="sm"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Settings className="w-3.5 h-3.5" />
              Abrir Configurações
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header row with Import button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Posições Abertas</h2>
        {credentialsAvailable && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportFromBinance}
            disabled={isImporting}
            className="flex items-center gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
          >
            {isImporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {isImporting ? 'Importando...' : 'Importar da Binance'}
          </Button>
        )}
      </div>

      {/* Position Dashboard */}
      <PositionDashboard
        positions={positions}
        onUpdate={(id, updates) => {
          const pos = positions.find((p) => p.id === id);
          if (pos) onUpdatePosition({ ...pos, ...updates });
        }}
        onDelete={onRemovePosition}
      />
    </div>
  );
}

export default DashboardTab;
