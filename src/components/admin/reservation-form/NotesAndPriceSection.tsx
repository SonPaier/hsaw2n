import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface NotesAndPriceSectionProps {
  adminNotes: string;
  setAdminNotes: (notes: string) => void;
  showPrice: boolean;
  finalPrice: string;
  setFinalPrice: (price: string) => void;
  discountedPrice: number;
  totalPrice: number;
  customerDiscountPercent: number | null;
  markUserEditing?: () => void;
  onFinalPriceUserEdit?: () => void;
}

export const NotesAndPriceSection = ({
  adminNotes,
  setAdminNotes,
  showPrice,
  finalPrice,
  setFinalPrice,
  discountedPrice,
  totalPrice,
  customerDiscountPercent,
  markUserEditing,
  onFinalPriceUserEdit,
}: NotesAndPriceSectionProps) => {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);

  // When focused: allow empty string for editing
  // When not focused: fallback to discountedPrice if empty
  const displayedValue = isFocused 
    ? finalPrice 
    : (finalPrice !== '' ? finalPrice : (discountedPrice || ''));

  return (
    <>
      {/* Notes - always visible */}
      <div className="space-y-2">
        <Label htmlFor="adminNotes" className="text-sm text-foreground">
          {t('addReservation.notes')}
        </Label>
        <Textarea
          id="adminNotes"
          value={adminNotes}
          onChange={(e) => {
            markUserEditing?.();
            setAdminNotes(e.target.value);
          }}
          rows={2}
          placeholder=""
        />
      </div>

      {/* Final Price - visible in reservation mode */}
      {showPrice && (
        <div className="space-y-2">
          <Label htmlFor="finalPrice" className="text-sm text-foreground">
            {t('addReservation.amount')}
          </Label>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              id="finalPrice"
              type="number"
              value={displayedValue}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onChange={(e) => {
                markUserEditing?.();
                onFinalPriceUserEdit?.();
                setFinalPrice(e.target.value);
              }}
              className="w-32"
              placeholder={discountedPrice > 0 ? String(discountedPrice) : '0'}
            />
            <span className="text-muted-foreground">zł</span>
            {customerDiscountPercent && customerDiscountPercent > 0 && totalPrice > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="line-through text-muted-foreground">{totalPrice} zł</span>
                <span className="text-green-600 font-medium">-{customerDiscountPercent}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default NotesAndPriceSection;
