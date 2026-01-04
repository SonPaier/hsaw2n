import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const DynamicManifest = () => {
  const location = useLocation();

  useEffect(() => {
    const updateManifest = () => {
      // Determine context based on current path
      const isAdmin = location.pathname.startsWith('/admin');
      const context = isAdmin ? 'admin' : 'public';

      // Get slug from subdomain
      const hostname = window.location.hostname;
      let slug: string | null = null;

      // Check for subdomain pattern: [slug].n2wash.com or [slug].domain.com
      const parts = hostname.split('.');
      if (parts.length >= 2 && !['www', 'super', 'admin'].includes(parts[0])) {
        // Check if it's not localhost or lovable preview
        if (!hostname.includes('localhost') && !hostname.includes('lovable')) {
          slug = parts[0];
        }
      }

      // Build manifest URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      let manifestUrl = `${supabaseUrl}/functions/v1/get-manifest?context=${context}`;
      if (slug) {
        manifestUrl += `&slug=${slug}`;
      }

      // Update or create manifest link
      let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
      
      if (manifestLink) {
        manifestLink.href = manifestUrl;
      } else {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        manifestLink.href = manifestUrl;
        document.head.appendChild(manifestLink);
      }
    };

    updateManifest();
  }, [location.pathname]);

  return null;
};

export default DynamicManifest;
