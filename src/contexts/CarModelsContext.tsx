import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CarModel {
  id: string;
  brand: string;
  name: string;
  size: 'S' | 'M' | 'L';
}

interface CarModelsContextType {
  carModels: CarModel[];
  isLoading: boolean;
  error: string | null;
  searchModels: (query: string, limit?: number) => CarModel[];
  getModelByName: (brand: string, name: string) => CarModel | undefined;
  getModelsByBrand: (brand: string) => CarModel[];
  getBrands: () => string[];
  refetch: () => Promise<void>;
}

const CarModelsContext = createContext<CarModelsContextType | undefined>(undefined);

// Helper function to normalize text for searching
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, ''); // Remove special characters
};

export const CarModelsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [carModels, setCarModels] = useState<CarModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCarModels = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('car_models')
        .select('id, brand, name, size')
        .eq('active', true)
        .order('brand')
        .order('name');

      if (fetchError) {
        throw fetchError;
      }

      setCarModels((data || []) as CarModel[]);
    } catch (err) {
      console.error('Error fetching car models:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch car models');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCarModels();
  }, [fetchCarModels]);

  // Search models in memory (no HTTP request)
  const searchModels = useCallback((query: string, limit: number = 50): CarModel[] => {
    if (!query || query.length < 1) {
      return [];
    }

    const normalizedQuery = normalizeText(query);
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);

    if (queryWords.length === 0) {
      return [];
    }

    // Score and filter models
    const scored = carModels
      .map(model => {
        const normalizedBrand = normalizeText(model.brand);
        const normalizedName = normalizeText(model.name);
        const fullText = `${normalizedBrand} ${normalizedName}`;

        // Check if all query words are found
        const allWordsMatch = queryWords.every(word => 
          fullText.includes(word)
        );

        if (!allWordsMatch) {
          return null;
        }

        // Calculate score
        let score = 0;

        // Exact brand match
        if (normalizedBrand === normalizedQuery) {
          score += 100;
        } else if (normalizedBrand.startsWith(normalizedQuery)) {
          score += 50;
        }

        // Exact name match
        if (normalizedName === normalizedQuery) {
          score += 100;
        } else if (normalizedName.startsWith(normalizedQuery)) {
          score += 50;
        }

        // Word-by-word matching
        queryWords.forEach(word => {
          if (normalizedBrand.includes(word)) score += 10;
          if (normalizedName.includes(word)) score += 10;
          if (normalizedBrand.startsWith(word)) score += 5;
          if (normalizedName.startsWith(word)) score += 5;
        });

        return { model, score };
      })
      .filter((item): item is { model: CarModel; score: number } => item !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.model);

    return scored;
  }, [carModels]);

  // Get model by brand and name
  const getModelByName = useCallback((brand: string, name: string): CarModel | undefined => {
    const normalizedBrand = normalizeText(brand);
    const normalizedName = normalizeText(name);
    
    return carModels.find(model => 
      normalizeText(model.brand) === normalizedBrand && 
      normalizeText(model.name) === normalizedName
    );
  }, [carModels]);

  // Get all models for a brand
  const getModelsByBrand = useCallback((brand: string): CarModel[] => {
    const normalizedBrand = normalizeText(brand);
    return carModels.filter(model => 
      normalizeText(model.brand) === normalizedBrand
    );
  }, [carModels]);

  // Get unique brands
  const getBrands = useCallback((): string[] => {
    const brands = new Set(carModels.map(m => m.brand));
    return Array.from(brands).sort();
  }, [carModels]);

  const value = useMemo(() => ({
    carModels,
    isLoading,
    error,
    searchModels,
    getModelByName,
    getModelsByBrand,
    getBrands,
    refetch: fetchCarModels,
  }), [carModels, isLoading, error, searchModels, getModelByName, getModelsByBrand, getBrands, fetchCarModels]);

  return (
    <CarModelsContext.Provider value={value}>
      {children}
    </CarModelsContext.Provider>
  );
};

export const useCarModels = (): CarModelsContextType => {
  const context = useContext(CarModelsContext);
  if (context === undefined) {
    throw new Error('useCarModels must be used within a CarModelsProvider');
  }
  return context;
};
