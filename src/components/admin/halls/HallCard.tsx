import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Pencil, Trash2, MoreVertical, Eye, Columns, ExternalLink, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export interface Hall {
  id: string;
  instance_id: string;
  name: string;
  slug: string;
  station_ids: string[];
  visible_fields: {
    customer_name: boolean;
    customer_phone: boolean;
    vehicle_plate: boolean;
    services: boolean;
    admin_notes: boolean;
  };
  allowed_actions: {
    add_services: boolean;
    change_time: boolean;
    change_station: boolean;
    edit_reservation: boolean;
    delete_reservation: boolean;
  };
  sort_order: number;
  active: boolean;
}

interface Station {
  id: string;
  name: string;
}

interface HallCardProps {
  hall: Hall;
  hallNumber: number; // 1-indexed order number for URL
  instanceSlug: string;
  stations: Station[];
  onEdit: (hall: Hall) => void;
  onDelete: (hallId: string) => void;
}

const HallCard = ({ hall, hallNumber, instanceSlug, stations, onEdit, onDelete }: HallCardProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Generate full URL for this hall - use simple number for user-friendly URLs
  const getHallUrl = () => {
    return `https://${instanceSlug}.admin.n2wash.com/hall/${hallNumber}`;
  };

  // Get dev/preview URL for this hall
  const getDevHallUrl = () => {
    return `/admin/hall/${hallNumber}`;
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(getHallUrl());
      setCopied(true);
      toast.success(t('halls.urlCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const handleDelete = () => {
    onDelete(hall.id);
    setDeleteDialogOpen(false);
  };

  const handlePreview = () => {
    window.open(getDevHallUrl(), '_blank');
  };

  // Get visible field names
  const visibleFieldNames = Object.entries(hall.visible_fields)
    .filter(([_, visible]) => visible)
    .map(([key]) => t(`halls.fields.${key}`));

  // Get allowed action names (for edit section)
  const allowedActionNames = Object.entries(hall.allowed_actions)
    .filter(([_, allowed]) => allowed)
    .map(([key]) => t(`halls.actions.${key}`));

  // Get station names for this hall
  const hallStationNames = stations
    .filter(s => hall.station_ids.includes(s.id))
    .map(s => s.name);

  return (
    <>
      <Card className="hover:shadow-md transition-shadow flex flex-col">
        <CardContent className="p-4 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-semibold text-lg truncate flex-1">{hall.name}</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white">
                <DropdownMenuItem onClick={() => onEdit(hall)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {t('common.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* URL field - white background, full width */}
          <div className="mt-3 space-y-1">
            <span className="text-xs text-muted-foreground">
              {t('halls.calendarLinkLabel')}
            </span>
            <div className="flex items-center gap-2 bg-white border rounded-md px-3 py-2">
              <code className="text-xs text-muted-foreground truncate flex-1">
                {getHallUrl()}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={handleCopyUrl}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Stations - renamed to "Widoczne stanowiska" */}
          <div className="mt-6 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Columns className="h-3.5 w-3.5" />
              <span className="font-medium">{t('halls.visibleStationsLabel')}:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {hallStationNames.length > 0 ? (
                hallStationNames.map((name, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {name}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">{t('halls.noStationsSelected')}</span>
              )}
            </div>
          </div>

          {/* Visible fields */}
          <div className="mt-6 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              <span className="font-medium">{t('halls.visibleFieldsLabel')}:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {visibleFieldNames.length > 0 ? (
                visibleFieldNames.map((name, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {name}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">{t('halls.noFieldsSelected')}</span>
              )}
            </div>
          </div>

          {/* Allowed actions - new "Możliwość edycji" section */}
          <div className="mt-6 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Settings className="h-3.5 w-3.5" />
              <span className="font-medium">{t('halls.editCapabilitiesLabel')}:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {allowedActionNames.length > 0 ? (
                allowedActionNames.map((name, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {name}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">{t('halls.noActionsSelected')}</span>
              )}
            </div>
          </div>

          {/* Spacer to push button to bottom */}
          <div className="flex-1" />

          {/* Preview button - pinned to bottom, full width */}
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            onClick={handlePreview}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {t('halls.preview')}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('halls.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('halls.deleteConfirmDescription', { name: hall.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default HallCard;
