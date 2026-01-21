import { useState, useRef, useEffect } from 'react';
import { parseMarkdownLists } from '@/lib/textUtils';
import { cn } from '@/lib/utils';

interface TruncatedDescriptionProps {
  text: string;
  maxLines?: number;
  className?: string;
  textColor?: string;
}

export const TruncatedDescription = ({
  text,
  maxLines = 3,
  className,
  textColor,
}: TruncatedDescriptionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const parsed = parseMarkdownLists(text);

  // Measure if content exceeds maxLines
  useEffect(() => {
    if (contentRef.current && measureRef.current) {
      const lineHeight = parseFloat(getComputedStyle(contentRef.current).lineHeight) || 20;
      const maxHeight = lineHeight * maxLines;
      const actualHeight = measureRef.current.scrollHeight;
      
      setIsTruncated(actualHeight > maxHeight + 2); // +2 for tolerance
    }
  }, [text, maxLines]);

  return (
    <div className={cn("relative", className)}>
      {/* Hidden element to measure full height */}
      <div
        ref={measureRef}
        className="absolute invisible pointer-events-none w-full text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0"
        dangerouslySetInnerHTML={{ __html: parsed }}
        aria-hidden="true"
      />
      
      {/* Visible content */}
      <div
        ref={contentRef}
        className={cn(
          "text-sm text-foreground/70 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 overflow-hidden transition-all duration-200",
          !isExpanded && isTruncated && "line-clamp-3"
        )}
        style={{ color: textColor }}
        dangerouslySetInnerHTML={{ __html: parsed }}
      />
      
      {/* See more / less button */}
      {isTruncated && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm font-medium hover:underline mt-1 transition-colors"
          style={{ color: textColor ? textColor : undefined }}
        >
          {isExpanded ? 'Zobacz mniej' : 'Zobacz więcej'}
        </button>
      )}
    </div>
  );
};
