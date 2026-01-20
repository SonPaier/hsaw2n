import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppUpdate } from '@/hooks/useAppUpdate';

export const UpdateBanner = () => {
  const { updateAvailable, isUpdating, applyUpdate } = useAppUpdate();

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground p-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4" />
        <span className="text-sm font-medium">
          Dostępna nowa wersja aplikacji
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={applyUpdate}
        disabled={isUpdating}
      >
        {isUpdating ? 'Aktualizuję...' : 'Aktualizuj'}
      </Button>
    </div>
  );
};
