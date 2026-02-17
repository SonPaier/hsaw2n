import { useTranslation } from 'react-i18next';
import { CalendarIcon } from 'lucide-react';
import { format, isSameDay, isBefore, startOfDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { OfferSearchAutocomplete } from '@/components/protocols/OfferSearchAutocomplete';
import { Station, WorkingHours, ReservationType } from './types';
import { RefObject } from 'react';

interface ReservationDateTimeSectionProps {
  instanceId: string;
  reservationType: ReservationType;
  setReservationType: (type: ReservationType) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  dateRangeOpen: boolean;
  setDateRangeOpen: (open: boolean) => void;
  dateRangeError?: string;
  onClearDateRangeError: () => void;
  manualStartTime: string;
  setManualStartTime: (time: string) => void;
  manualEndTime: string;
  setManualEndTime: (time: string) => void;
  setUserModifiedEndTime: (modified: boolean) => void;
  manualStationId: string | null;
  setManualStationId: (stationId: string | null) => void;
  stations: Station[];
  startTimeOptions: string[];
  endTimeOptions: string[];
  timeError?: string;
  offerNumber: string;
  setOfferNumber: (offerNumber: string) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  phone: string;
  setPhone: (phone: string) => void;
  carModel: string;
  setCarModel: (model: string) => void;
  workingHours?: Record<string, WorkingHours | null> | null;
  isMobile: boolean;
  markUserEditing: () => void;
  dateRangeRef: RefObject<HTMLDivElement>;
  timeRef: RefObject<HTMLDivElement>;
  /** Show station selector (edit mode or creating from offer) */
  showStationSelector?: boolean;
}

export const ReservationDateTimeSection = ({
  instanceId,
  reservationType,
  setReservationType,
  dateRange,
  setDateRange,
  dateRangeOpen,
  setDateRangeOpen,
  dateRangeError,
  onClearDateRangeError,
  manualStartTime,
  setManualStartTime,
  manualEndTime,
  setManualEndTime,
  setUserModifiedEndTime,
  manualStationId,
  setManualStationId,
  stations,
  startTimeOptions,
  endTimeOptions,
  timeError,
  offerNumber,
  setOfferNumber,
  customerName,
  setCustomerName,
  phone,
  setPhone,
  carModel,
  setCarModel,
  workingHours,
  isMobile,
  markUserEditing,
  dateRangeRef,
  timeRef,
  showStationSelector = false,
}: ReservationDateTimeSectionProps) => {
  const { t } = useTranslation();
  
  // Calendar months logic:
  // - Single day: always 1 month
  // - Multi day: 1 on mobile, 2 on desktop
  const getNumberOfMonths = () => {
    if (reservationType === 'single') return 1;
    return isMobile ? 1 : 2;
  };

  return (
    <div className="space-y-4" ref={dateRangeRef}>
      {/* Reservation Type Toggle */}
      <div className="space-y-2">
        <Label>{t('addReservation.reservationType')}</Label>
        <RadioGroup
          value={reservationType}
          onValueChange={(val: ReservationType) => {
            markUserEditing();
            setReservationType(val);
            // When switching to single, sync to = from
            if (val === 'single' && dateRange?.from) {
              setDateRange({ from: dateRange.from, to: dateRange.from });
            }
            // When switching to multi and no times set, prefill from working hours
            if (val === 'multi' && !manualStartTime && !manualEndTime && workingHours && dateRange?.from) {
              const dayName = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][dateRange.from.getDay()];
              const dayHours = workingHours[dayName];
              if (dayHours) {
                setManualStartTime(dayHours.open.substring(0, 5));
                setManualEndTime(dayHours.close.substring(0, 5));
              }
            }
          }}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="single" id="res-type-single" />
            <Label htmlFor="res-type-single" className="cursor-pointer font-normal">
              {t('addReservation.singleDay')}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="multi" id="res-type-multi" />
            <Label htmlFor="res-type-multi" className="cursor-pointer font-normal">
              {t('addReservation.multiDay')}
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Date Range Picker */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4" />
          {t('addReservation.dateRangePpf')} <span className="text-destructive">*</span>
        </Label>
        <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !dateRange?.from && 'text-muted-foreground',
                dateRangeError && 'border-destructive'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to && !isSameDay(dateRange.from, dateRange.to) ? (
                  <>
                    {format(dateRange.from, 'd MMM', { locale: pl })} -{' '}
                    {format(dateRange.to, 'd MMM yyyy', { locale: pl })}
                  </>
                ) : (
                  format(dateRange.from, 'EEEE, d MMM yyyy', { locale: pl })
                )
              ) : (
                <span>{t('addReservation.selectDateRange')}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            {reservationType === 'single' ? (
              <Calendar
                mode="single"
                defaultMonth={dateRange?.from || new Date()}
                selected={dateRange?.from}
                onSelect={(date) => {
                  markUserEditing();
                  onClearDateRangeError();
                  if (date) {
                    setDateRange({ from: date, to: date });
                    setDateRangeOpen(false);
                  }
                }}
                disabled={(date) => {
                  if (isBefore(date, startOfDay(new Date()))) return true;
                  if (workingHours) {
                    const dayName = format(date, 'EEEE').toLowerCase();
                    const dayHours = workingHours[dayName];
                    if (!dayHours || !dayHours.open || !dayHours.close) return true;
                  }
                  return false;
                }}
                numberOfMonths={1}
                locale={pl}
                className="pointer-events-auto"
              />
            ) : (
              <Calendar
                mode="range"
                defaultMonth={dateRange?.from || new Date()}
                selected={dateRange}
                onSelect={(range) => {
                  markUserEditing();
                  onClearDateRangeError();
                  setDateRange(range);
                  if (range?.from && range?.to) {
                    setDateRangeOpen(false);
                  }
                }}
                disabled={(date) => {
                  if (isBefore(date, startOfDay(new Date()))) return true;
                  if (workingHours) {
                    const dayName = format(date, 'EEEE').toLowerCase();
                    const dayHours = workingHours[dayName];
                    if (!dayHours || !dayHours.open || !dayHours.close) return true;
                  }
                  return false;
                }}
                numberOfMonths={getNumberOfMonths()}
                locale={pl}
                className="pointer-events-auto"
              />
            )}
          </PopoverContent>
        </Popover>
        {dateRangeError && <p className="text-sm text-destructive">{dateRangeError}</p>}
      </div>

      {/* Time selection */}
      <div className="space-y-4" ref={timeRef}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="manualStartTime">{t('addReservation.manualStartTime')}</Label>
            <Select
              value={manualStartTime}
              onValueChange={(val) => {
                markUserEditing();
                setManualStartTime(val);
              }}
            >
              <SelectTrigger id="manualStartTime" className="bg-white">
                <SelectValue placeholder="--:--" />
              </SelectTrigger>
              <SelectContent className="bg-white max-h-60">
                {startTimeOptions.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manualEndTime">{t('addReservation.manualEndTime')}</Label>
            <Select
              value={manualEndTime}
              onValueChange={(val) => {
                markUserEditing();
                setUserModifiedEndTime(true);
                setManualEndTime(val);
              }}
            >
              <SelectTrigger id="manualEndTime" className="bg-white">
                <SelectValue placeholder="--:--" />
              </SelectTrigger>
              <SelectContent className="bg-white max-h-60">
                {endTimeOptions.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Station selector */}
        {showStationSelector && (
          <div className="space-y-2">
            <Label htmlFor="manualStation">
              {t('addReservation.selectStation')} <span className="text-destructive">*</span>
            </Label>
            <Select value={manualStationId || ''} onValueChange={(val) => { markUserEditing(); setManualStationId(val); }}>
              <SelectTrigger className={cn(!manualStationId && timeError && 'border-destructive')}>
                <SelectValue placeholder={t('addReservation.selectStation')} />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {stations.map((station) => (
                  <SelectItem key={station.id} value={station.id}>
                    {station.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {timeError && <p className="text-sm text-destructive">{timeError}</p>}
      </div>

      {/* Offer number - hidden for now, will return to this later
      <div className="space-y-2">
        <Label>
          {t('addReservation.offerNumber')}{' '}
          <span className="text-muted-foreground text-xs">({t('common.optional')})</span>
        </Label>
        <OfferSearchAutocomplete
          instanceId={instanceId}
          value={offerNumber}
          onChange={setOfferNumber}
          onOfferSelect={(offer) => {
            setOfferNumber(offer.offer_number);
            // Optionally pre-fill customer data if not already filled
            if (!customerName && offer.customer_name) {
              setCustomerName(offer.customer_name);
            }
            if (!phone && offer.customer_phone) {
              setPhone(offer.customer_phone);
            }
            if (!carModel && offer.vehicle_model) {
              setCarModel(offer.vehicle_model);
            }
          }}
          placeholder={t('addReservation.offerNumberPlaceholder')}
        />
      </div>
      */}
    </div>
  );
};

export default ReservationDateTimeSection;
