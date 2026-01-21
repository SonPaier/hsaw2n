import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { GripVertical, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface SortableCategoryItemProps {
  category: Category;
  editingId: string | null;
  editName: string;
  onStartEdit: (cat: Category) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditNameChange: (value: string) => void;
  onDelete: (cat: Category) => void;
  productCount: number;
}

function SortableCategoryItem({
  category,
  editingId,
  editName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditNameChange,
  onDelete,
  productCount,
}: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isEditing = editingId === category.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-3 bg-background border rounded-lg",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none p-1 text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {isEditing ? (
        <div className="flex-1 flex items-center gap-2">
          <Input
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            className="h-8"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
          />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onSaveEdit}>
            <Check className="w-4 h-4 text-green-600" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCancelEdit}>
            <X className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ) : (
        <>
          <span className="flex-1 font-medium">{category.name}</span>
          <span className="text-sm text-muted-foreground">({productCount})</span>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onStartEdit(category)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-8 w-8 text-destructive hover:text-destructive" 
            onClick={() => onDelete(category)}
            disabled={productCount > 0}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </>
      )}
    </div>
  );
}

interface ProductCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  productCounts: Record<string, number>;
  onCategoriesChanged: () => void;
}

export function ProductCategoriesDialog({
  open,
  onOpenChange,
  instanceId,
  productCounts,
  onCategoriesChanged,
}: ProductCategoriesDialogProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingNew, setAddingNew] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch categories
  useEffect(() => {
    if (!open || !instanceId) return;

    const fetchCategories = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('offer_product_categories')
        .select('id, name, sort_order')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');

      if (error) {
        console.error('Error fetching categories:', error);
        toast.error('Błąd ładowania kategorii');
      } else {
        setCategories(data || []);
      }
      setLoading(false);
    };

    fetchCategories();
  }, [open, instanceId]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);

    const newCategories = arrayMove(categories, oldIndex, newIndex);
    setCategories(newCategories);

    // Update sort_order in DB
    setSaving(true);
    try {
      const updates = newCategories.map((cat, index) => ({
        id: cat.id,
        sort_order: index,
        instance_id: instanceId,
        name: cat.name,
      }));

      for (const update of updates) {
        await supabase
          .from('offer_product_categories')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }

      toast.success('Kolejność zapisana');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Błąd zapisywania kolejności');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;

    const oldCategory = categories.find(c => c.id === editingId);
    if (!oldCategory) return;

    setSaving(true);
    try {
      // Update category name in offer_product_categories
      const { error: catError } = await supabase
        .from('offer_product_categories')
        .update({ name: editName.trim() })
        .eq('id', editingId);

      if (catError) throw catError;

      // Update all products with old category name to new name
      const { error: prodError } = await supabase
        .from('products_library')
        .update({ category: editName.trim() })
        .eq('instance_id', instanceId)
        .eq('category', oldCategory.name);

      if (prodError) throw prodError;

      setCategories(prev => prev.map(c => 
        c.id === editingId ? { ...c, name: editName.trim() } : c
      ));
      setEditingId(null);
      setEditName('');
      toast.success('Kategoria zaktualizowana');
      onCategoriesChanged();
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Błąd aktualizacji kategorii');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = async (cat: Category) => {
    const count = productCounts[cat.name] || 0;
    if (count > 0) {
      toast.error(`Nie można usunąć kategorii z ${count} usługami`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('offer_product_categories')
        .delete()
        .eq('id', cat.id);

      if (error) throw error;

      setCategories(prev => prev.filter(c => c.id !== cat.id));
      toast.success('Kategoria usunięta');
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Błąd usuwania kategorii');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNew = async () => {
    if (!newCategoryName.trim()) return;

    setSaving(true);
    try {
      const maxOrder = categories.length > 0 
        ? Math.max(...categories.map(c => c.sort_order)) + 1 
        : 0;

      const { data, error } = await supabase
        .from('offer_product_categories')
        .insert({
          instance_id: instanceId,
          name: newCategoryName.trim(),
          sort_order: maxOrder,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => [...prev, data]);
      setNewCategoryName('');
      setAddingNew(false);
      toast.success('Kategoria dodana');
      onCategoriesChanged();
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error('Błąd dodawania kategorii');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kategorie usług</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={categories.map(c => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {categories.map((category) => (
                  <SortableCategoryItem
                    key={category.id}
                    category={category}
                    editingId={editingId}
                    editName={editName}
                    onStartEdit={handleStartEdit}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={handleCancelEdit}
                    onEditNameChange={setEditName}
                    onDelete={handleDelete}
                    productCount={productCounts[category.name] || 0}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {categories.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Brak kategorii. Dodaj pierwszą kategorie.
              </p>
            )}

            {/* Add new category */}
            {addingNew ? (
              <div className="flex items-center gap-2 p-3 border rounded-lg border-dashed">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nazwa kategorii..."
                  className="h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddNew();
                    if (e.key === 'Escape') {
                      setAddingNew(false);
                      setNewCategoryName('');
                    }
                  }}
                />
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8" 
                  onClick={handleAddNew}
                  disabled={saving || !newCategoryName.trim()}
                >
                  <Check className="w-4 h-4 text-green-600" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8" 
                  onClick={() => {
                    setAddingNew(false);
                    setNewCategoryName('');
                  }}
                >
                  <X className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setAddingNew(true)}
              >
                <Plus className="w-4 h-4" />
                Dodaj kategorię
              </Button>
            )}
          </div>
        )}

        {saving && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}