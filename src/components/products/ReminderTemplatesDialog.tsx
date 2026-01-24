import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Loader2, MoreHorizontal, Pencil, Trash2, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { AddReminderTemplateDialog } from './AddReminderTemplateDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export interface ReminderTemplateItem {
  months: number;
  is_paid: boolean;
  service_type: string;
}

export interface ReminderTemplate {
  id: string;
  instance_id: string;
  name: string;
  description: string | null;
  sms_template: string;
  items: ReminderTemplateItem[];
  created_at: string;
  updated_at: string;
}

interface ReminderTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
}

export function ReminderTemplatesDialog({
  open,
  onOpenChange,
  instanceId,
}: ReminderTemplatesDialogProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; template: ReminderTemplate | null }>({ open: false, template: null });

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reminder_templates')
        .select('*')
        .eq('instance_id', instanceId)
        .order('name');

      if (error) throw error;
      
      // Parse items from JSONB - cast to unknown first for type safety
      const parsed = (data || []).map(t => ({
        ...t,
        items: (Array.isArray(t.items) ? t.items : []) as unknown as ReminderTemplateItem[]
      })) as ReminderTemplate[];
      
      setTemplates(parsed);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error(t('reminderTemplates.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && instanceId) {
      fetchTemplates();
    }
  }, [open, instanceId]);

  const handleDelete = async () => {
    const template = deleteDialog.template;
    if (!template) return;

    try {
      // Check if template is used in any products
      const result = await supabase
        .from('offer_option_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', template.id);
      const count = result.count;

      if (count && count > 0) {
        toast.error(t('reminderTemplates.templateInUse'));
        setDeleteDialog({ open: false, template: null });
        return;
      }

      const { error } = await supabase
        .from('reminder_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;
      
      setTemplates(prev => prev.filter(t => t.id !== template.id));
      toast.success(t('reminderTemplates.deleted'));
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error(t('reminderTemplates.deleteError'));
    } finally {
      setDeleteDialog({ open: false, template: null });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              {t('reminderTemplates.title')}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <div className="p-6 pt-4 space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('reminderTemplates.add')}
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">{t('reminderTemplates.empty')}</p>
                </div>
              ) : isMobile ? (
                // Mobile: Card layout
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div key={template.id} className="p-4 border rounded-lg bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{template.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {template.items.length} {t('reminderTemplates.remindersCount')}
                            </Badge>
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingTemplate(template)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {t('common.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setDeleteDialog({ open: true, template })}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('common.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Desktop: Table layout
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">{t('reminderTemplates.name')}</th>
                        <th className="text-center p-3 font-medium">{t('reminderTemplates.remindersCount')}</th>
                        <th className="w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map((template) => (
                        <tr key={template.id} className="border-t">
                          <td className="p-3">
                            <div className="font-medium">{template.name}</div>
                            {template.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {template.description}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline">{template.items.length}</Badge>
                          </td>
                          <td className="p-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingTemplate(template)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  {t('common.edit')}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setDeleteDialog({ open: true, template })}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t('common.delete')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Template Dialog */}
      <AddReminderTemplateDialog
        open={showAddDialog || !!editingTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingTemplate(null);
          }
        }}
        instanceId={instanceId}
        template={editingTemplate}
        onSaved={() => {
          fetchTemplates();
          setShowAddDialog(false);
          setEditingTemplate(null);
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, template: null })}
        title={t('reminderTemplates.deleteConfirmTitle')}
        description={t('reminderTemplates.deleteConfirmDesc', { name: deleteDialog.template?.name || '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}
