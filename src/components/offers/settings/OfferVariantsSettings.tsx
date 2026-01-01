import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

interface OfferVariant {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
  isNew?: boolean;
  isDeleted?: boolean;
  isDirty?: boolean;
}

interface OfferVariantsSettingsProps {
  instanceId: string;
  onChange?: () => void;
}

export interface OfferVariantsSettingsRef {
  saveAll: () => Promise<boolean>;
}

export const OfferVariantsSettings = forwardRef<OfferVariantsSettingsRef, OfferVariantsSettingsProps>(
  ({ instanceId, onChange }, ref) => {
    const { t } = useTranslation();
    const [variants, setVariants] = useState<OfferVariant[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      fetchVariants();
    }, [instanceId]);

    useImperativeHandle(ref, () => ({
      saveAll: async () => {
        try {
          // Handle deletions
          const deletedVariants = variants.filter(v => v.isDeleted);
          for (const variant of deletedVariants) {
            if (!variant.isNew) {
              const { error } = await supabase
                .from('offer_variants')
                .delete()
                .eq('id', variant.id);
              if (error) throw error;
            }
          }

          // Handle new variants
          const newVariants = variants.filter(v => v.isNew && !v.isDeleted);
          for (const variant of newVariants) {
            const { error } = await supabase
              .from('offer_variants')
              .insert({
                instance_id: instanceId,
                name: variant.name,
                description: variant.description,
                sort_order: variant.sort_order,
                active: variant.active,
              });
            if (error) throw error;
          }

          // Handle updates
          const dirtyVariants = variants.filter(v => v.isDirty && !v.isNew && !v.isDeleted);
          for (const variant of dirtyVariants) {
            const { error } = await supabase
              .from('offer_variants')
              .update({
                name: variant.name,
                description: variant.description,
                active: variant.active,
                sort_order: variant.sort_order,
              })
              .eq('id', variant.id);
            if (error) throw error;
          }

          // Refresh data
          await fetchVariants();
          return true;
        } catch (error) {
          console.error('Error saving variants:', error);
          toast.error(t('offerSettings.variants.saveError'));
          return false;
        }
      },
    }));

    const fetchVariants = async () => {
      try {
        const { data, error } = await supabase
          .from('offer_variants')
          .select('*')
          .eq('instance_id', instanceId)
          .order('sort_order');

        if (error) throw error;
        setVariants((data || []).map(v => ({ ...v, isNew: false, isDeleted: false, isDirty: false })));
      } catch (error) {
        console.error('Error fetching variants:', error);
        toast.error(t('offerSettings.variants.fetchError'));
      } finally {
        setLoading(false);
      }
    };

    const handleAddVariant = () => {
      const newVariant: OfferVariant = {
        id: crypto.randomUUID(),
        name: t('offerSettings.variants.newVariant'),
        description: null,
        sort_order: variants.filter(v => !v.isDeleted).length,
        active: true,
        isNew: true,
        isDirty: true,
      };
      setVariants([...variants, newVariant]);
      onChange?.();
    };

    const handleUpdateVariant = (id: string, updates: Partial<OfferVariant>) => {
      setVariants(variants.map(v => 
        v.id === id ? { ...v, ...updates, isDirty: true } : v
      ));
      onChange?.();
    };

    const handleDeleteVariant = (id: string) => {
      if (!confirm(t('offerSettings.variants.confirmDelete'))) return;
      
      const variant = variants.find(v => v.id === id);
      if (variant?.isNew) {
        setVariants(variants.filter(v => v.id !== id));
      } else {
        setVariants(variants.map(v => v.id === id ? { ...v, isDeleted: true } : v));
      }
      onChange?.();
    };

    if (loading) {
      return <div className="text-muted-foreground">{t('common.loading')}</div>;
    }

    const visibleVariants = variants.filter(v => !v.isDeleted);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">{t('offerSettings.variants.title')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('offerSettings.variants.description')}
            </p>
          </div>
          <Button onClick={handleAddVariant} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t('offerSettings.variants.addVariant')}
          </Button>
        </div>

        {visibleVariants.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t('offerSettings.variants.noVariants')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibleVariants.map((variant) => (
              <Card key={variant.id} className={variant.isDirty ? 'ring-2 ring-primary/20' : ''}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="pt-2 cursor-grab text-muted-foreground">
                      <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-4">
                        <Input
                          value={variant.name}
                          onChange={(e) => handleUpdateVariant(variant.id, { name: e.target.value })}
                          placeholder={t('offerSettings.variants.namePlaceholder')}
                          className="flex-1"
                        />
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={variant.active}
                            onCheckedChange={(checked) => handleUpdateVariant(variant.id, { active: checked })}
                          />
                          <span className="text-sm text-muted-foreground">{t('common.active')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Input
                          value={variant.description || ''}
                          onChange={(e) => handleUpdateVariant(variant.id, { description: e.target.value })}
                          placeholder={t('offerSettings.variants.descriptionPlaceholder')}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteVariant(variant.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }
);

OfferVariantsSettings.displayName = 'OfferVariantsSettings';
