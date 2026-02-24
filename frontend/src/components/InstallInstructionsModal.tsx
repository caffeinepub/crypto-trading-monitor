import { X, Share, MoreVertical, PlusSquare, Monitor } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface InstallInstructionsModalProps {
  open: boolean;
  onClose: () => void;
}

interface BrowserGuide {
  name: string;
  color: string;
  icon: React.ReactNode;
  steps: string[];
}

const browserGuides: BrowserGuide[] = [
  {
    name: 'Chrome / Edge (Android)',
    color: 'text-yellow-500',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="#4285F4" />
        <circle cx="12" cy="12" r="4" fill="white" />
        <path d="M12 2a10 10 0 0 1 8.66 5H12V2z" fill="#EA4335" />
        <path d="M3.34 7A10 10 0 0 0 12 22v-5a5 5 0 0 1-4.33-7.5L3.34 7z" fill="#34A853" />
        <path d="M20.66 7H15.5A5 5 0 0 1 12 17v5a10 10 0 0 0 8.66-15z" fill="#FBBC05" />
      </svg>
    ),
    steps: [
      'Toque no menu ⋮ (três pontos) no canto superior direito',
      'Selecione "Adicionar à tela inicial"',
      'Confirme tocando em "Adicionar"',
      'O app aparecerá na sua tela inicial como um ícone nativo',
    ],
  },
  {
    name: 'Safari (iPhone / iPad)',
    color: 'text-blue-400',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <circle cx="12" cy="12" r="10" fill="#006CFF" />
        <path d="M12 4l1.5 5.5L19 12l-5.5 1.5L12 20l-1.5-5.5L5 12l5.5-1.5z" fill="white" />
        <circle cx="12" cy="12" r="1.5" fill="#006CFF" />
      </svg>
    ),
    steps: [
      'Toque no ícone de Compartilhar (□↑) na barra inferior',
      'Role para baixo e toque em "Adicionar à Tela de Início"',
      'Edite o nome se desejar e toque em "Adicionar"',
      'O app será instalado como um ícone na sua tela inicial',
    ],
  },
  {
    name: 'Chrome (Desktop)',
    color: 'text-green-400',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="#4285F4" />
        <circle cx="12" cy="12" r="4" fill="white" />
        <path d="M12 2a10 10 0 0 1 8.66 5H12V2z" fill="#EA4335" />
        <path d="M3.34 7A10 10 0 0 0 12 22v-5a5 5 0 0 1-4.33-7.5L3.34 7z" fill="#34A853" />
        <path d="M20.66 7H15.5A5 5 0 0 1 12 17v5a10 10 0 0 0 8.66-15z" fill="#FBBC05" />
      </svg>
    ),
    steps: [
      'Clique no ícone de instalação (⊕) na barra de endereços',
      'Ou acesse o menu ⋮ → "Instalar Crypto Position Monitor"',
      'Clique em "Instalar" na janela de confirmação',
      'O app abrirá em uma janela separada como aplicativo nativo',
    ],
  },
  {
    name: 'Edge (Desktop)',
    color: 'text-blue-500',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M21.86 17.86C20.5 18.5 19 18.86 17.43 18.86c-4.29 0-8.14-2.57-9.86-6.43C6.71 10.14 6.57 7.71 7.43 5.57 4.71 7 3 9.86 3 13.14 3 18.07 7.07 22 12 22c3.14 0 5.86-1.43 7.71-3.71l2.15-.43z" fill="#0078D4" />
        <path d="M12 2C8.86 2 6.14 3.43 4.29 5.71c1.14-.57 2.43-.86 3.71-.86 4.29 0 7.86 3.43 7.86 7.71 0 1.14-.29 2.29-.71 3.29H21c.57-1.14.86-2.43.86-3.71C21.86 7.07 17.43 2 12 2z" fill="#50E6FF" />
      </svg>
    ),
    steps: [
      'Clique no ícone de instalação (⊕) na barra de endereços',
      'Ou acesse o menu … → "Aplicativos" → "Instalar este site como aplicativo"',
      'Clique em "Instalar" para confirmar',
      'O app será adicionado ao menu Iniciar e à área de trabalho',
    ],
  },
  {
    name: 'Firefox (Android)',
    color: 'text-orange-400',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="#FF6611" />
        <path d="M12 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" fill="#FFCC00" />
      </svg>
    ),
    steps: [
      'Toque no menu ⋮ (três pontos) no canto superior direito',
      'Selecione "Instalar" ou "Adicionar à tela inicial"',
      'Confirme a instalação tocando em "Adicionar"',
      'O ícone do app aparecerá na sua tela inicial',
    ],
  },
];

export function InstallInstructionsModal({ open, onClose }: InstallInstructionsModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-primary/30">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg overflow-hidden golden-glow flex-shrink-0">
              <img
                src="/assets/generated/app-logo.dim_512x512.png"
                alt="App Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Instalar o App
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Siga as instruções para o seu navegador
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-muted-foreground">
            💡 <strong className="text-foreground">Dica:</strong> Instalar como app oferece acesso rápido, funciona offline e ocupa menos espaço que um app nativo.
          </div>

          {browserGuides.map((guide) => (
            <div
              key={guide.name}
              className="rounded-xl border border-primary/20 bg-background/60 overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border-b border-primary/10">
                <span className={guide.color}>{guide.icon}</span>
                <span className="font-semibold text-sm text-foreground">{guide.name}</span>
              </div>
              <ol className="px-4 py-3 space-y-2">
                {guide.steps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Badge
                      variant="outline"
                      className="min-w-[1.5rem] h-6 flex items-center justify-center text-xs border-primary/40 text-primary font-bold flex-shrink-0 mt-0.5"
                    >
                      {idx + 1}
                    </Badge>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}

          <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-sm text-muted-foreground">
            📱 <strong className="text-foreground">iOS (iPhone/iPad):</strong> Use obrigatoriamente o <strong>Safari</strong> para instalar PWAs. Outros navegadores no iOS não suportam instalação.
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            onClick={onClose}
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground golden-glow"
          >
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
