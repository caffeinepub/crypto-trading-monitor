import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { InstallInstructionsModal } from './InstallInstructionsModal';

export function InstallButton() {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showInstructions, setShowInstructions] = useState(false);

  // Don't show if already installed as standalone PWA
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowInstructions(true);
    }
  };

  return (
    <>
      <Button
        onClick={handleClick}
        variant="default"
        size="sm"
        className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground golden-glow transition-all duration-300"
      >
        <Download className="w-4 h-4 mr-2" />
        <span className="hidden sm:inline">Instalar App</span>
        <span className="sm:hidden">Instalar</span>
      </Button>

      <InstallInstructionsModal
        open={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </>
  );
}
