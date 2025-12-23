import { Clock, ArrowRight } from 'lucide-react';
import { Service } from '@/types';
import { cn } from '@/lib/utils';

interface ServiceCardProps {
  service: Service;
  selected: boolean;
  onSelect: (service: Service) => void;
}

const ServiceCard = ({ service, selected, onSelect }: ServiceCardProps) => {
  return (
    <button
      onClick={() => onSelect(service)}
      className={cn(
        "w-full p-4 rounded-xl border text-left transition-all duration-300 group",
        selected
          ? "bg-primary/10 border-primary shadow-lg shadow-primary/20"
          : "bg-card/50 border-border/50 hover:border-primary/50 hover:bg-card"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <h3 className={cn(
            "font-semibold transition-colors",
            selected ? "text-primary" : "text-foreground group-hover:text-primary"
          )}>
            {service.name}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {service.description}
          </p>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-4 h-4" />
              {service.duration >= 60 
                ? `${Math.floor(service.duration / 60)}h ${service.duration % 60 > 0 ? `${service.duration % 60}min` : ''}`
                : `${service.duration}min`
              }
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={cn(
            "text-xl font-bold",
            selected ? "text-primary" : "text-foreground"
          )}>
            {service.price} zł
          </span>
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center transition-all",
            selected 
              ? "bg-primary text-primary-foreground" 
              : "bg-secondary text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
          )}>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </button>
  );
};

export default ServiceCard;
