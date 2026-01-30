import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2, MoreHorizontal, Trash2, Users, ArrowLeft, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReminderTemplate {
  id: string;
  name: string;
  description: string | null;
  items: { months: number; service_type: string }[];
}

interface TemplateWithCount extends ReminderTemplate {
  activeCustomersCount: number;
}

interface RemindersViewProps {
  instanceId: string | null;
  onNavigateBack?: () => void;
}

export default function RemindersView({ instanceId, onNavigateBack }: RemindersViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateWithCount[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; template: ReminderTemplate | null }>({
    open: false,
    template: null,
  });
  
  // Detect if we're on admin path (for subdomain navigation)
  const isAdminPath = location.pathname.startsWith('/admin');
  const remindersBasePath = isAdminPath ? '/admin/reminders' : '/reminders';

  useEffect(() => {
    if (instanceId) {
      fetchTemplates();
    }
  }, [instanceId]);

  const fetchTemplates = async () => {
    if (!instanceId) return;
    
    setLoading(true);
    try {
      // Fetch templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('reminder_templates')
        .select('id, name, description, items')
        .eq('instance_id', instanceId)
        .order('name');

      if (templatesError) throw templatesError;

      // Fetch active customer counts per template
      const { data: countsData, error: countsError } = await supabase
        .from('customer_reminders')
        .select('reminder_template_id, customer_phone')
        .eq('instance_id', instanceId)
        .eq('status', 'scheduled')
        .gte('scheduled_date', new Date().toISOString().split('T')[0]);

      if (countsError) throw countsError;

      // Group counts by template_id
      const countsByTemplate: Record<string, Set<string>> = {};
      (countsData || []).forEach(row => {
        if (!countsByTemplate[row.reminder_template_id]) {
          countsByTemplate[row.reminder_template_id] = new Set();
        }
        countsByTemplate[row.reminder_template_id].add(row.customer_phone);
      });

      // Merge templates with counts
      const templatesWithCounts: TemplateWithCount[] = (templatesData || []).map(t => ({
        ...t,
        items: Array.isArray(t.items) ? t.items as { months: number; service_type: string }[] : [],
        activeCustomersCount: countsByTemplate[t.id]?.size || 0,
      }));

      setTemplates(templatesWithCounts);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error(t('reminderTemplates.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const template = deleteDialog.template;
    if (!template) return;

    try {
      // Check if template has active reminders
      const { count } = await supabase
        .from('customer_reminders')
        .select('*', { count: 'exact', head: true })
        .eq('reminder_template_id', template.id)
        .eq('status', 'scheduled');

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

  const handleTemplateClick = (template: ReminderTemplate) => {
    // Use first 8 chars of UUID for short URL
    const shortId = template.id.substring(0, 8);
    navigate(`${remindersBasePath}/${shortId}`);
  };

  const handleAddNew = () => {
    navigate(`${remindersBasePath}/new`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {onNavigateBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onNavigateBack}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              {t('reminders.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('reminders.description')}
            </p>
          </div>
        </div>
        <Button onClick={handleAddNew} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('reminders.addTemplate')}</span>
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bell className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground mb-4">{t('reminderTemplates.empty')}</p>
          <Button onClick={handleAddNew} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('reminders.addTemplate')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => handleTemplateClick(template)}
              className="flex items-center justify-between gap-3 p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{template.name}</div>
                {template.description && (
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                    {template.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {template.items.length} {t('reminderTemplates.remindersCount')}
                  </Badge>
                  {template.activeCustomersCount > 0 && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {template.activeCustomersCount} {template.activeCustomersCount === 1 ? t('reminders.customerSingular') : t('reminders.customerPlural')}
                    </Badge>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteDialog({ open: true, template });
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('common.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}
