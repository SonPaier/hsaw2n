import { useState } from 'react';
import { X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface AddSalesProductDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddSalesProductDrawer = ({ open, onOpenChange }: AddSalesProductDrawerProps) => {
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [shortName, setShortName] = useState('');
  const [description, setDescription] = useState('');
  const [priceNet, setPriceNet] = useState('');
  const [priceUnit, setPriceUnit] = useState<'piece' | 'meter'>('piece');
  const [available, setAvailable] = useState(true);

  const resetForm = () => {
    setCode('');
    setFullName('');
    setShortName('');
    setDescription('');
    setPriceNet('');
    setPriceUnit('piece');
    setAvailable(true);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (!code.trim() || !fullName.trim() || !shortName.trim()) {
      toast.error('Uzupełnij wymagane pola');
      return;
    }
    toast.info('Moduł dodawania produktów w przygotowaniu');
    handleClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          resetForm();
          onOpenChange(false);
        }
      }}
      modal={false}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-[27rem] flex flex-col h-full p-0 gap-0 shadow-[-8px_0_30px_-12px_rgba(0,0,0,0.15)]"
        hideOverlay
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Fixed Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle>Dodaj produkt</SheetTitle>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-code">Kod produktu</Label>
              <Input
                id="product-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-full-name">Pełna nazwa produktu</Label>
              <Input
                id="product-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-short-name">Skrócona nazwa produktu</Label>
              <Input
                id="product-short-name"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-description">Opis</Label>
              <Textarea
                id="product-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-price">Cena netto</Label>
              <Input
                id="product-price"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={priceNet}
                onChange={(e) => setPriceNet(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Cena za</Label>
              <RadioGroup
                value={priceUnit}
                onValueChange={(v) => setPriceUnit(v as 'piece' | 'meter')}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="piece" id="unit-piece" />
                  <Label htmlFor="unit-piece" className="font-normal cursor-pointer">
                    Sztukę
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="meter" id="unit-meter" />
                  <Label htmlFor="unit-meter" className="font-normal cursor-pointer">
                    Metr bieżący
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-status">Status</Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="product-status"
                  checked={available}
                  onCheckedChange={setAvailable}
                />
                <span className="text-sm text-muted-foreground">
                  {available ? 'Dostępny' : 'Niedostępny'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <SheetFooter className="px-6 py-4 border-t shrink-0">
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              Anuluj
            </Button>
            <Button className="flex-1" onClick={handleSubmit}>
              Dodaj produkt
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default AddSalesProductDrawer;
