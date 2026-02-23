import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function InstallButton() {
  const { isInstallable, install } = usePWAInstall();

  if (!isInstallable) {
    return null;
  }

  return (
    <Button
      onClick={install}
      variant="default"
      size="sm"
      className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground golden-glow transition-all duration-300"
    >
      <Download className="w-4 h-4 mr-2" />
      Instalar App
    </Button>
  );
}
