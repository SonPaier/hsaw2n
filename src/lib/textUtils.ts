/**
 * Normalizes a search query by removing all whitespace characters.
 * Used for space-agnostic searching of phone numbers, offer numbers, etc.
 * 
 * @param query - The search query string
 * @returns Query with all whitespace removed
 * 
 * @example
 * normalizeSearchQuery("511 042 123") // returns "511042123"
 * normalizeSearchQuery("+48 733 854 184") // returns "+48733854184"
 */
export const normalizeSearchQuery = (query: string): string => {
  if (!query) return '';
  return query.replace(/\s/g, '');
};

/**
 * Parses simple markdown-style lists into HTML.
 * Lines starting with "- " or "* " are converted to <ul><li> elements.
 * Other lines become <p> elements.
 */
export const parseMarkdownLists = (text: string): string => {
  if (!text) return '';
  
  const lines = text.split('\n');
  let result = '';
  let inList = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    const isBullet = /^[-*]\s+/.test(trimmed);
    
    if (isBullet) {
      if (!inList) {
        result += '<ul class="list-disc pl-5 my-1">';
        inList = true;
      }
      result += `<li class="my-0">${trimmed.replace(/^[-*]\s+/, '')}</li>`;
    } else {
      if (inList) {
        result += '</ul>';
        inList = false;
      }
      if (trimmed) {
        result += `<p class="my-1">${trimmed}</p>`;
      }
    }
  }
  
  if (inList) result += '</ul>';
  return result;
};
