import React, { useState, useEffect, useCallback } from 'react';
import { Position } from '../types/position';
import { PositionWithPrice } from '../types/position';
import { PositionEntryForm } from './PositionEntryForm';
import { PositionDashboard } from './PositionDashboard';
import { TotalCapitalSummary } from './TotalCapitalSummary';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { hasCredentials } from '../utils/liveTradingStorage';
import { fetchOpenPositions } from '../services/binancePositionService';
import { toast } from 'sonner';

interface DashboardTabProps {
  positions: Position[];
  positionsWithPrice: PositionWithPrice[];
  onAddPosition: (position: Position) => void;
  onRemovePosition: (id: string) => void;
  onUpdatePosition: (position: Position) => void;
}

export function DashboardTab({
  positions,
  positionsWithPrice,
  onAddPosition,
  onRemovePosition,
  onUpdatePosition,
}: DashboardTabProps) {
  // Reactive credential detection — updates immediately when credentials are saved/cleared
  // Listens to 'credential-change' and 'credentialsChanged' custom DOM events
  const [credentialsAvailable, setCredentialsAvailable] = useState<boolean>(() => hasCredentials());
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const handler = () => {
      setCredentialsAvailable(hasCredentials());
    };

    // Listen to both event names for compatibility
    window.addEventListener('credential-change', handler);
    window.addEventListener('credentialsChanged', handler);

    return () => {
      window.removeEventListener('credential-change', handler);
      window.removeEventListener('credentialsChanged', handler);
    };
  }, []); // Empty dependency array — register once only

  const handleImportFromBinance = useCallback(async () => {
    setIsImporting(true);
    try {
      const imported = await fetchOpenPositions();
      if (imported.length === 0) {
        toast.info('Nenhuma posição aberta encontrada na Binance.');
        return;
      }
      imported.forEach((pos) => onAddPosition(pos));
      toast.success(`${imported.length} posição(ões) importada(s) da Binance com sucesso!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Falha ao importar posições: ${message}`);
    } finally {
      setIsImporting(false);
    }
  }, [onAddPosition]);

  return (
    <div className="space-y-6">
      {/* Capital Summary */}
      <TotalCapitalSummary positions={positionsWithPrice} />

      {/* Header row with Import button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Posições Abertas</h2>
        {/* Import from Binance button — visible as soon as credentials are saved */}
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

      {/* Position Entry Form */}
      <PositionEntryForm onSubmit={onAddPosition} onCancel={() => {}} />

      {/* Position Dashboard */}
      <PositionDashboard
        positions={positions}
        onUpdate={(id, updates) => {
          const pos = positions.find((p) => p.id === id);
          if (pos) onUpdatePosition({ ...pos, ...updates });
        }}
        onDelete={onRemovePosition}
        onAddNew={() => {}}
      />
    </div>
  );
}

export default DashboardTab;
