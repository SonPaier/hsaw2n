import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { OfferGenerator } from '@/components/offers/OfferGenerator';

const OffersPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  useEffect(() => {
    const fetchUserInstanceId = async () => {
      if (!user) return;
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('instance_id, role')
        .eq('user_id', user.id);
      
      if (!rolesData || rolesData.length === 0) return;
      const adminRole = rolesData.find(r => r.role === 'admin' && r.instance_id);
      if (adminRole?.instance_id) {
        setInstanceId(adminRole.instance_id);
        return;
      }
      const isSuperAdmin = rolesData.some(r => r.role === 'super_admin');
      if (isSuperAdmin) {
        const { data: instances } = await supabase
          .from('instances')
          .select('id')
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        if (instances?.id) {
          setInstanceId(instances.id);
        }
      }
    };
    fetchUserInstanceId();
  }, [user]);

  if (showGenerator && instanceId) {
    return (
      <>
        <Helmet>
          <title>Nowa oferta - Generator ofert</title>
        </Helmet>
        <div className="min-h-screen bg-background p-4 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Button variant="ghost" onClick={() => setShowGenerator(false)} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Wróć do listy
              </Button>
            </div>
            <h1 className="text-2xl font-bold mb-6">Nowa oferta</h1>
            <OfferGenerator
              instanceId={instanceId}
              onClose={() => setShowGenerator(false)}
              onSaved={() => setShowGenerator(false)}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Oferty - Panel Admina</title>
      </Helmet>
      <div className="min-h-screen bg-background p-4 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/admin')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Panel
              </Button>
              <h1 className="text-2xl font-bold">Oferty</h1>
            </div>
            <Button onClick={() => setShowGenerator(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Nowa oferta
            </Button>
          </div>
          
          <div className="glass-card p-8 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Brak ofert. Kliknij "Nowa oferta" aby utworzyć pierwszą.</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default OffersPage;
