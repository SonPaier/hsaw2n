import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { cn } from '@/lib/utils';

interface UpdateBannerProps {
  collapsed?: boolean;
}

export function UpdateBanner({ collapsed = false }: UpdateBannerProps) {
  const { updateAvailable, isUpdating, applyUpdate } = useAppUpdate();

  if (!updateAvailable) return null;

  if (collapsed) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="w-full h-10 text-primary animate-pulse"
        onClick={applyUpdate}
        disabled={isUpdating}
        title="Dostępna nowa wersja - kliknij aby zaktualizować"
      >
        <RefreshCw className={cn("w-4 h-4", isUpdating && "animate-spin")} />
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
      <p className="text-xs font-medium text-primary">
        Dostępna nowa wersja
      </p>
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
        onClick={applyUpdate}
        disabled={isUpdating}
      >
        <RefreshCw className={cn("w-3.5 h-3.5", isUpdating && "animate-spin")} />
        {isUpdating ? 'Aktualizuję...' : 'Wgraj'}
      </Button>
    </div>
  );
}
