import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Pencil, Trash2, MoreVertical, Eye, Columns } from 'lucide-react';
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
  instanceSlug: string;
  stations: Station[];
  onEdit: (hall: Hall) => void;
  onDelete: (hallId: string) => void;
}

const HallCard = ({ hall, instanceSlug, stations, onEdit, onDelete }: HallCardProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Generate full URL for this hall - always use production subdomain format
  const getHallUrl = () => {
    return `https://${instanceSlug}.admin.n2wash.com/hall/${hall.id}`;
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

  // Get visible field names
  const visibleFieldNames = Object.entries(hall.visible_fields)
    .filter(([_, visible]) => visible)
    .map(([key]) => t(`halls.fields.${key}`));

  // Get station names for this hall
  const hallStationNames = stations
    .filter(s => hall.station_ids.includes(s.id))
    .map(s => s.name);

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{hall.name}</h3>
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[200px]">
                  {getHallUrl()}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCopyUrl}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Stations */}
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Columns className="h-3.5 w-3.5" />
                  <span className="font-medium">{t('halls.stationsLabel')}:</span>
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
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" />
                  <span className="font-medium">{t('halls.visibleFieldsLabel')}:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {visibleFieldNames.map((name, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
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
