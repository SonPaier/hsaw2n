import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useCarModels, CarModel as ContextCarModel } from '@/contexts/CarModelsContext';

// Types
type CarSize = 'S' | 'M' | 'L';

interface CarModel {
  id: string;
  brand: string;
  name: string;
  size: CarSize;
  label: string;
}

export type CarSearchValue = CarModel | { type: 'custom'; label: string } | null;

interface CarSearchAutocompleteProps {
  value?: string;
  onChange: (value: CarSearchValue) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  maxResults?: number;
  className?: string;
  onSelect?: (model: CarModel) => void;
  onClear?: () => void;
  /** When true, prevents dropdown from opening automatically on focus (used in edit mode) */
  suppressAutoOpen?: boolean;
}

// Normalize text for searching
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Convert context model to component model format
const toCarModel = (model: ContextCarModel): CarModel => ({
  id: model.id,
  brand: model.brand,
  name: model.name,
  size: model.size,
  label: `${model.brand} ${model.name}`,
});

export const CarSearchAutocomplete = ({
  value = '',
  onChange,
  disabled = false,
  error = false,
  helperText,
  maxResults = 50,
  className,
  onSelect,
  onClear,
  suppressAutoOpen = false,
}: CarSearchAutocompleteProps) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync inputValue with external value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Use car models from context
  const { searchModels } = useCarModels();

  // Filter and group results using context search
  const { groupedResults, flatResults } = useMemo(() => {
    if (!inputValue || inputValue.length < 1) {
      return { groupedResults: new Map<string, CarModel[]>(), flatResults: [] };
    }

    // Use context's searchModels for in-memory search
    const contextMatches = searchModels(inputValue, maxResults);
    const matches = contextMatches.map(toCarModel);

    // Group by brand
    const grouped = new Map<string, CarModel[]>();
    matches.forEach((model) => {
      const existing = grouped.get(model.brand) || [];
      existing.push(model);
      grouped.set(model.brand, existing);
    });

    return { groupedResults: grouped, flatResults: matches };
  }, [inputValue, maxResults, searchModels]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setActiveIndex(-1);
    setHasUserInteracted(true);
    
    if (newValue.length >= 1) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Select a model
  const selectModel = useCallback((model: CarModel) => {
    setInputValue(model.label);
    setIsOpen(false);
    setActiveIndex(-1);
    onChange(model);
    onSelect?.(model);
  }, [onChange, onSelect]);

  // Select custom value
  const selectCustom = useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      setInputValue(trimmedValue);
      setIsOpen(false);
      setActiveIndex(-1);
      onChange({ type: 'custom', label: trimmedValue });
    }
  }, [inputValue, onChange]);

  // Clear value
  const handleClear = () => {
    setInputValue('');
    setIsOpen(false);
    setActiveIndex(-1);
    onChange(null);
    onClear?.();
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = flatResults.length + (flatResults.length === 0 && inputValue.trim() ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen && inputValue.length >= 1) {
          setIsOpen(true);
        } else if (totalItems > 0) {
          setActiveIndex((prev) => (prev < totalItems - 1 ? prev + 1 : prev));
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (totalItems > 0) {
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < flatResults.length) {
          selectModel(flatResults[activeIndex]);
        } else if (flatResults.length === 0 && inputValue.trim()) {
          selectCustom();
        } else if (flatResults.length > 0 && activeIndex === -1) {
          selectModel(flatResults[0]);
        }
        break;

      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        break;

      case 'Tab':
        if (isOpen && flatResults.length > 0 && activeIndex >= 0) {
          e.preventDefault();
          selectModel(flatResults[activeIndex]);
        } else if (isOpen && flatResults.length === 0 && inputValue.trim()) {
          e.preventDefault();
          selectCustom();
        }
        break;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeElement = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const normalizedQuery = normalizeText(query);
    const normalizedText = normalizeText(text);
    const queryParts = normalizedQuery.split(' ').filter(Boolean);

    // Find all matching parts
    let result: React.ReactNode[] = [];
    let lastIndex = 0;

    queryParts.forEach((part) => {
      const lowerText = text.toLowerCase();
      let searchIndex = 0;
      
      while (searchIndex < text.length) {
        const idx = lowerText.indexOf(part, searchIndex);
        if (idx === -1) break;
        
        // Only highlight if we haven't passed this point yet
        if (idx >= lastIndex) {
          if (idx > lastIndex) {
            result.push(<span key={`text-${lastIndex}-${idx}`}>{text.substring(lastIndex, idx)}</span>);
          }
          result.push(
            <span key={`match-${idx}`} className="font-semibold text-primary">
              {text.substring(idx, idx + part.length)}
            </span>
          );
          lastIndex = idx + part.length;
        }
        searchIndex = idx + 1;
      }
    });

    if (lastIndex < text.length) {
      result.push(<span key={`text-end-${lastIndex}`}>{text.substring(lastIndex)}</span>);
    }

    return result.length > 0 ? result : text;
  };

  let currentFlatIndex = 0;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            // Only auto-open if user has interacted or not suppressed
            if (!suppressAutoOpen || hasUserInteracted) {
              inputValue.length >= 1 && setIsOpen(true);
            }
          }}
          disabled={disabled}
          data-testid="car-input"
          className={cn(
            'pr-16 bg-white',
            error && 'border-destructive focus-visible:ring-destructive'
          )}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-label={t('reservations.carModel')}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-muted rounded-sm transition-colors"
              aria-label={t('common.clear', 'Wyczyść')}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-[9999] mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
          style={{ maxHeight: '250px' }}
          role="listbox"
        >
          <div className="overflow-y-auto" style={{ maxHeight: '250px' }}>
            {groupedResults.size > 0 ? (
              Array.from(groupedResults.entries()).map(([brand, models]) => (
                <div key={brand} role="group" aria-label={brand}>
                  {/* Models */}
                  {models.map((model) => {
                    const itemIndex = currentFlatIndex++;
                    const isActive = activeIndex === itemIndex;
                    
                    return (
                      <button
                        key={model.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        data-index={itemIndex}
                        data-testid="car-option"
                        className={cn(
                          'w-full px-3 py-2 text-left text-[0.9375rem] transition-colors flex items-center justify-between',
                          isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
                        )}
                        onClick={() => selectModel(model)}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                      >
                        <span>{highlightMatch(model.label, inputValue)}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">
                          {model.size}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            ) : inputValue.trim() ? (
              <button
                type="button"
                role="option"
                aria-selected={activeIndex === 0}
                data-index={0}
                className={cn(
                  'w-full px-3 py-3 text-left text-sm transition-colors',
                  activeIndex === 0 ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
                )}
                onClick={selectCustom}
                onMouseEnter={() => setActiveIndex(0)}
              >
                <span className="text-muted-foreground">{t('carSearch.useCustom', 'Użyj')}: </span>
                <span className="font-medium">"{inputValue.trim()}"</span>
              </button>
            ) : null}
          </div>
        </div>
      )}

      {helperText && (
        <p className={cn('mt-1 text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
          {helperText}
        </p>
      )}
    </div>
  );
};
