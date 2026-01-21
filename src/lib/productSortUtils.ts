/**
 * Utility for sorting products by category order and price
 * Used in ProductsView and ScopeProductSelectionDrawer for consistent sorting
 */

interface ProductForSorting {
  category?: string | null;
  price: number;
}

/**
 * Creates a comparator function for sorting products by category order and then by price (ascending)
 * @param categoryOrder - Map of category name to sort order (lower = first)
 * @returns Comparator function for use with Array.sort()
 */
export function createProductSortComparator<T extends ProductForSorting>(
  categoryOrder: Record<string, number>
): (a: T, b: T) => number {
  return (a, b) => {
    const catOrderA = a.category ? (categoryOrder[a.category] ?? 999) : 999;
    const catOrderB = b.category ? (categoryOrder[b.category] ?? 999) : 999;
    
    if (catOrderA !== catOrderB) {
      return catOrderA - catOrderB;
    }
    
    // Within same category, sort by price ascending
    return a.price - b.price;
  };
}

/**
 * Sorts an array of products by category order and price
 * @param products - Array of products to sort
 * @param categoryOrder - Map of category name to sort order
 * @returns New sorted array (does not mutate original)
 */
export function sortProductsByCategoryAndPrice<T extends ProductForSorting>(
  products: T[],
  categoryOrder: Record<string, number>
): T[] {
  return [...products].sort(createProductSortComparator(categoryOrder));
}
