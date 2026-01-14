import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Plus, Pencil, Sparkles, Trash2, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface OfferScope {
  id: string;
  name: string;
  description: string | null;
  has_coating_upsell: boolean;
  is_extras_scope: boolean;
  sort_order: number | null;
}

interface OfferServicesListViewProps {
  instanceId: string;
  onBack: () => void;
  onEdit: (scopeId: string) => void;
  onCreate: () => void;
}

interface SortableScopeCardProps {
  scope: OfferScope;
  onEdit: (scopeId: string) => void;
  onDelete: (scope: OfferScope) => void;
}

function SortableScopeCard({ scope, onEdit, onDelete }: SortableScopeCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scope.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="transition-all duration-200 hover:shadow-md"
    >
      <CardContent className="p-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground touch-none"
            >
              <GripVertical className="w-5 h-5" />
            </div>
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
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-2"
              onClick={() => onEdit(scope.id)}
            >
              <Pencil className="w-4 h-4" />
              Edytuj
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onDelete(scope)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OfferServicesListView({ instanceId, onBack, onEdit, onCreate }: OfferServicesListViewProps) {
  const { t } = useTranslation();
  const [scopes, setScopes] = useState<OfferScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scopeToDelete, setScopeToDelete] = useState<OfferScope | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchScopes();
  }, [instanceId]);

  const fetchScopes = async () => {
    try {
      const { data, error } = await supabase
        .from('offer_scopes')
        .select('id, name, description, has_coating_upsell, is_extras_scope, sort_order')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setScopes(data || []);
    } catch (error) {
      console.error('Error fetching scopes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = scopes.findIndex((s) => s.id === active.id);
    const newIndex = scopes.findIndex((s) => s.id === over.id);

    const newScopes = arrayMove(scopes, oldIndex, newIndex);
    setScopes(newScopes);

    // Update sort_order in database
    try {
      const updates = newScopes.map((scope, index) => ({
        id: scope.id,
        sort_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from('offer_scopes')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }

      toast.success('Kolejność usług została zapisana');
    } catch (error) {
      console.error('Error updating sort order:', error);
      toast.error('Nie udało się zapisać kolejności');
      fetchScopes(); // Revert on error
    }
  };

  const handleDeleteClick = (scope: OfferScope) => {
    setScopeToDelete(scope);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!scopeToDelete) return;

    try {
      const { error } = await supabase
        .from('offer_scopes')
        .update({ active: false })
        .eq('id', scopeToDelete.id);

      if (error) throw error;

      toast.success('Usługa została usunięta');
      fetchScopes();
    } catch (error) {
      console.error('Error deleting scope:', error);
      toast.error('Nie udało się usunąć usługi');
    } finally {
      setDeleteDialogOpen(false);
      setScopeToDelete(null);
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={scopes.map(s => s.id)} strategy={rectSortingStrategy}>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {scopes.map((scope) => (
                  <SortableScopeCard
                    key={scope.id}
                    scope={scope}
                    onEdit={onEdit}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Usuń usługę"
          description={`Czy na pewno chcesz usunąć usługę "${scopeToDelete?.name}"?`}
          confirmLabel="Usuń"
          onConfirm={handleConfirmDelete}
          variant="destructive"
        />
      </div>
    </>
  );
}
