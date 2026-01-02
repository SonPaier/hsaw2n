import { useState, useRef, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, Palette, Upload, Loader2, Save, Trash2, Image as ImageIcon, Users
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import InstanceUsersTab from './InstanceUsersTab';

interface Instance {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  invoice_company_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  nip?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  background_color?: string;
  social_facebook?: string;
  social_instagram?: string;
  google_maps_url?: string;
}

interface InstanceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: Instance | null;
  onUpdate: (instance: Instance) => void;
}

const InstanceSettingsDialog = ({ 
  open, 
  onOpenChange, 
  instance, 
  onUpdate 
}: InstanceSettingsDialogProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    invoice_company_name: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    nip: '',
    logo_url: '',
    primary_color: '#0ea5e9',
    secondary_color: '#06b6d4',
    background_color: '#ffffff',
    social_facebook: '',
    social_instagram: '',
    google_maps_url: '',
  });

  useEffect(() => {
    if (instance) {
      setFormData({
        name: instance.name || '',
        slug: instance.slug || '',
        invoice_company_name: instance.invoice_company_name || '',
        phone: instance.phone || '',
        email: instance.email || '',
        address: instance.address || '',
        website: instance.website || '',
        nip: instance.nip || '',
        logo_url: instance.logo_url || '',
        primary_color: instance.primary_color || '#0ea5e9',
        secondary_color: instance.secondary_color || '#06b6d4',
        background_color: instance.background_color || '#ffffff',
        social_facebook: instance.social_facebook || '',
        social_instagram: instance.social_instagram || '',
        google_maps_url: instance.google_maps_url || '',
      });
    }
  }, [instance]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !instance) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error(t('instanceSettings.selectImageFile'));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('instanceSettings.maxFileSize'));
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${instance.id}/logo-${Date.now()}.${fileExt}`;

      // Delete old logo if exists
      if (formData.logo_url) {
        const urlParts = formData.logo_url.split('/instance-logos/');
        if (urlParts[1]) {
          await supabase.storage.from('instance-logos').remove([urlParts[1]]);
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('instance-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('instance-logos')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, logo_url: publicUrl }));
      toast.success(t('instanceSettings.logoUploaded'));
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error(t('instanceSettings.logoUploadError'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!formData.logo_url || !instance) return;

    try {
      const urlParts = formData.logo_url.split('/instance-logos/');
      if (urlParts[1]) {
        await supabase.storage.from('instance-logos').remove([urlParts[1]]);
      }
      setFormData(prev => ({ ...prev, logo_url: '' }));
      toast.success(t('instanceSettings.logoRemoved'));
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error(t('instanceSettings.logoRemoveError'));
    }
  };

  const handleSave = async () => {
    if (!instance) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('instances')
        .update({
          name: formData.name,
          slug: formData.slug,
          invoice_company_name: formData.invoice_company_name || null,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          website: formData.website || null,
          nip: formData.nip || null,
          logo_url: formData.logo_url || null,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          background_color: formData.background_color,
          social_facebook: formData.social_facebook || null,
          social_instagram: formData.social_instagram || null,
          google_maps_url: formData.google_maps_url || null,
        })
        .eq('id', instance.id);

      if (error) throw error;

      onUpdate({ ...instance, ...formData });
      toast.success(t('instanceSettings.saved'));
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(t('instanceSettings.saveError'));
    } finally {
      setLoading(false);
    }
  };

  if (!instance) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {t('instanceSettings.title')}
          </DialogTitle>
          <DialogDescription>
            {t('instanceSettings.description', { name: instance.name })}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="company" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="company">{t('instanceSettings.companyTab')}</TabsTrigger>
            <TabsTrigger value="branding">{t('instanceSettings.brandingTab')}</TabsTrigger>
            <TabsTrigger value="contact">{t('instanceSettings.contactTab')}</TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {t('instanceSettings.usersTab')}
            </TabsTrigger>
          </TabsList>

          {/* Company Tab */}
          <TabsContent value="company" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('instanceSettings.carWashName')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="ARM CAR AUTO SPA"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">{t('instanceSettings.slug')} *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => handleInputChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="armcar-gdansk"
              />
              <p className="text-xs text-muted-foreground">
                {t('instanceSettings.slugDescription', { slug: formData.slug })}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_company_name">{t('instanceSettings.invoiceCompanyName')}</Label>
              <Input
                id="invoice_company_name"
                value={formData.invoice_company_name}
                onChange={(e) => handleInputChange('invoice_company_name', e.target.value)}
                placeholder="ARM CAR Sp. z o.o."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nip">{t('instanceSettings.nip')}</Label>
              <Input
                id="nip"
                value={formData.nip}
                onChange={(e) => handleInputChange('nip', e.target.value)}
                placeholder="123-456-78-90"
                maxLength={13}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">{t('instanceSettings.address')}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="ul. Przykładowa 123, 80-000 Gdańsk"
              />
            </div>
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-6 mt-4">
            {/* Logo Upload */}
            <div className="space-y-3">
              <Label>{t('instanceSettings.logo')}</Label>
              <div className="flex items-center gap-4">
                <div 
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/50 overflow-hidden cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  ) : formData.logo_url ? (
                    <img 
                      src={formData.logo_url} 
                      alt="Logo" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {formData.logo_url ? t('instanceSettings.changeLogo') : t('instanceSettings.uploadLogo')}
                  </Button>
                  {formData.logo_url && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={handleRemoveLogo}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('instanceSettings.removeLogo')}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('instanceSettings.logoInfo')}
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">{t('instanceSettings.primaryColor')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => handleInputChange('primary_color', e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => handleInputChange('primary_color', e.target.value)}
                    placeholder="#0ea5e9"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondary_color">{t('instanceSettings.secondaryColor')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => handleInputChange('secondary_color', e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => handleInputChange('secondary_color', e.target.value)}
                    placeholder="#06b6d4"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="background_color">{t('instanceSettings.backgroundColor')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="background_color"
                    type="color"
                    value={formData.background_color}
                    onChange={(e) => handleInputChange('background_color', e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.background_color}
                    onChange={(e) => handleInputChange('background_color', e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div 
              className="p-4 rounded-xl border border-border"
              style={{ backgroundColor: formData.background_color }}
            >
              <p className="text-sm mb-3" style={{ color: formData.background_color === '#ffffff' || formData.background_color.toLowerCase() === '#fff' ? '#666' : '#fff' }}>
                {t('instanceSettings.colorPreview')}
              </p>
              <div className="flex gap-3">
                <div 
                  className="h-10 flex-1 rounded-lg flex items-center justify-center text-white font-medium text-sm"
                  style={{ backgroundColor: formData.primary_color }}
                >
                  {t('instanceSettings.primaryButton')}
                </div>
                <div 
                  className="h-10 flex-1 rounded-lg flex items-center justify-center text-white font-medium text-sm"
                  style={{ backgroundColor: formData.secondary_color }}
                >
                  {t('instanceSettings.secondaryButton')}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t('instanceSettings.phone')}</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+48 123 456 789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('instanceSettings.email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="kontakt@firma.pl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">{t('instanceSettings.website')}</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                placeholder="https://www.firma.pl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="social_facebook">{t('instanceSettings.facebook')}</Label>
              <Input
                id="social_facebook"
                value={formData.social_facebook}
                onChange={(e) => handleInputChange('social_facebook', e.target.value)}
                placeholder="https://facebook.com/firma"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="social_instagram">{t('instanceSettings.instagram')}</Label>
              <Input
                id="social_instagram"
                value={formData.social_instagram}
                onChange={(e) => handleInputChange('social_instagram', e.target.value)}
                placeholder="https://instagram.com/firma"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="google_maps_url">{t('instanceSettings.googleMaps')}</Label>
              <Input
                id="google_maps_url"
                value={formData.google_maps_url}
                onChange={(e) => handleInputChange('google_maps_url', e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
              />
              <p className="text-xs text-muted-foreground">
                {t('instanceSettings.googleMapsInfo')}
              </p>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-4">
            <InstanceUsersTab instanceId={instance.id} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {t('instanceSettings.saveChanges')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InstanceSettingsDialog;
