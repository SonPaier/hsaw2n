import { cn } from '@/lib/utils';

interface ServiceTagProps {
  name: string;
  shortcut?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

const ServiceTag = ({ name, shortcut, size = 'md', className }: ServiceTagProps) => {
  const sizeClasses = size === 'sm' 
    ? 'px-1 py-0.5 text-[9px] md:text-[10px]'
    : 'px-1.5 py-0.5 text-xs';

  return (
    <span 
      className={cn(
        "inline-block font-medium bg-slate-700/90 text-white rounded leading-none",
        sizeClasses,
        className
      )}
    >
      {shortcut || name}
    </span>
  );
};

export default ServiceTag;
