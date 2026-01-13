import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Plus, Pencil, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface OfferScope {
  id: string;
  name: string;
  description: string | null;
  has_coating_upsell: boolean;
  is_extras_scope: boolean;
}

interface OfferServicesListViewProps {
  instanceId: string;
  onBack: () => void;
  onEdit: (scopeId: string) => void;
  onCreate: () => void;
}

export function OfferServicesListView({ instanceId, onBack, onEdit, onCreate }: OfferServicesListViewProps) {
  const { t } = useTranslation();
  const [scopes, setScopes] = useState<OfferScope[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScopes();
  }, [instanceId]);

  const fetchScopes = async () => {
    try {
      const { data, error } = await supabase
        .from('offer_scopes')
        .select('id, name, description, has_coating_upsell, is_extras_scope')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');

      if (error) throw error;
      setScopes(data || []);
    } catch (error) {
      console.error('Error fetching scopes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Twoje Usługi - {t('common.adminPanel')}</title>
      </Helmet>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Wróć
          </Button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Twoje Usługi</h1>
          <Button onClick={onCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Stwórz usługę
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Ładowanie usług...
          </div>
        ) : scopes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Brak zdefiniowanych usług. Dodaj pierwszą usługę, aby rozpocząć.
            </p>
            <Button onClick={onCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Stwórz pierwszą usługę
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {scopes.map((scope) => (
              <Card
                key={scope.id}
                className="transition-all duration-200 hover:shadow-md"
              >
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold truncate">{scope.name}</h3>
                          {scope.has_coating_upsell && (
                            <Badge variant="secondary" className="gap-1 shrink-0">
                              <Sparkles className="h-3 w-3" />
                              +Powłoka
                            </Badge>
                          )}
                        </div>
                        {scope.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {scope.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full gap-2"
                      onClick={() => onEdit(scope.id)}
                    >
                      <Pencil className="w-4 h-4" />
                      Edytuj
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
