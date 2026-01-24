import { useTranslation } from 'react-i18next';
import { CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface YardDateTimeSectionProps {
  arrivalDate: Date;
  setArrivalDate: (date: Date) => void;
  arrivalDateOpen: boolean;
  setArrivalDateOpen: (open: boolean) => void;
  pickupDate: Date | null;
  setPickupDate: (date: Date | null) => void;
  pickupDateOpen: boolean;
  setPickupDateOpen: (open: boolean) => void;
  deadlineTime: string;
  setDeadlineTime: (time: string) => void;
  timeOptions: string[];
}

export const YardDateTimeSection = ({
  arrivalDate,
  setArrivalDate,
  arrivalDateOpen,
  setArrivalDateOpen,
  pickupDate,
  setPickupDate,
  pickupDateOpen,
  setPickupDateOpen,
  deadlineTime,
  setDeadlineTime,
  timeOptions,
}: YardDateTimeSectionProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            {t('addReservation.arrivalDate')}
          </Label>
          <Popover open={arrivalDateOpen} onOpenChange={setArrivalDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !arrivalDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {arrivalDate
                  ? format(arrivalDate, 'd MMM', { locale: pl })
                  : t('addReservation.selectDate')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={arrivalDate}
                onSelect={(date) => {
                  if (date) {
                    setArrivalDate(date);
                    setArrivalDateOpen(false);
                  }
                }}
                locale={pl}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            {t('addReservation.pickupDate')}
          </Label>
          <Popover open={pickupDateOpen} onOpenChange={setPickupDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !pickupDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {pickupDate
                  ? format(pickupDate, 'd MMM', { locale: pl })
                  : t('addReservation.selectDate')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={pickupDate || undefined}
                onSelect={(date) => {
                  setPickupDate(date || null);
                  setPickupDateOpen(false);
                }}
                locale={pl}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {t('addReservation.deadline')}
        </Label>
        <Select value={deadlineTime} onValueChange={setDeadlineTime}>
          <SelectTrigger>
            <SelectValue placeholder="--:--" />
          </SelectTrigger>
          <SelectContent className="bg-white max-h-60">
            <SelectItem value="none">{t('common.noResults')}</SelectItem>
            {timeOptions.map((time) => (
              <SelectItem key={time} value={time}>
                {time}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default YardDateTimeSection;
