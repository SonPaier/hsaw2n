import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Building2, Clock, Grid2X2, Settings2, Users, MessageSquare, Loader2, Save, Upload, Trash2, Image as ImageIcon,
  ChevronDown, Code, Warehouse
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import StationsSettings from './StationsSettings';
import WorkingHoursSettings from './WorkingHoursSettings';
import SmsMessageSettings from './SmsMessageSettings';
import { ReservationConfirmSettings } from './ReservationConfirmSettings';
import InstanceUsersTab from './InstanceUsersTab';
import WidgetSettings from './WidgetSettings';
import HallsListView from './halls/HallsListView';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useCombinedFeatures } from '@/hooks/useCombinedFeatures';

interface SettingsViewProps {
  instanceId: string | null;
  instanceData: any;
  onInstanceUpdate: (data: any) => void;
  onWorkingHoursUpdate?: () => void;
}

type SettingsTab = 'company' | 'stations' | 'hours' | 'halls' | 'app' | 'sms' | 'users' | 'widget';

const SettingsView = ({ instanceId, instanceData, onInstanceUpdate, onWorkingHoursUpdate }: SettingsViewProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { currentVersion } = useAppUpdate();
  const { hasFeature } = useCombinedFeatures(instanceId);
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Company form state
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [companyForm, setCompanyForm] = useState({
    name: '',
    short_name: '',
    invoice_company_name: '',
    nip: '',
    phone: '',
    reservation_phone: '',
    email: '',
    address: '',
    logo_url: '',
    social_facebook: '',
    social_instagram: '',
    google_maps_url: '',
    website: '',
    contact_person: '',
  });

  // Populate form when instanceData changes
  useEffect(() => {
    if (instanceData) {
      setCompanyForm({
        name: instanceData.name || '',
        short_name: instanceData.short_name || '',
        invoice_company_name: instanceData.invoice_company_name || '',
        nip: instanceData.nip || '',
        phone: instanceData.phone || '',
        reservation_phone: instanceData.reservation_phone || '',
        email: instanceData.email || '',
        address: instanceData.address || '',
        logo_url: instanceData.logo_url || '',
        social_facebook: instanceData.social_facebook || '',
        social_instagram: instanceData.social_instagram || '',
        google_maps_url: instanceData.google_maps_url || '',
        website: instanceData.website || '',
        contact_person: instanceData.contact_person || '',
      });
    }
  }, [instanceData]);

  const allTabs: { key: SettingsTab; label: string; icon: React.ReactNode; visible?: boolean }[] = [
    { key: 'company', label: t('settings.tabs.company'), icon: <Building2 className="w-4 h-4" /> },
    { key: 'stations', label: t('settings.tabs.stations'), icon: <Grid2X2 className="w-4 h-4" /> },
    { key: 'hours', label: t('settings.tabs.hours'), icon: <Clock className="w-4 h-4" /> },
    { key: 'halls', label: t('navigation.halls'), icon: <Warehouse className="w-4 h-4" />, visible: hasFeature('hall_view') },
    { key: 'app', label: t('settings.tabs.app'), icon: <Settings2 className="w-4 h-4" /> },
    { key: 'sms', label: t('settings.tabs.sms'), icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'users', label: t('settings.tabs.users'), icon: <Users className="w-4 h-4" /> },
    { key: 'widget', label: t('settings.tabs.widget'), icon: <Code className="w-4 h-4" /> },
  ];
  
  const tabs = allTabs.filter(tab => tab.visible !== false);

  const handleInputChange = (field: string, value: string) => {
    setCompanyForm(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !instanceId) return;

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
      const fileName = `${instanceId}/logo-${Date.now()}.${fileExt}`;

      if (companyForm.logo_url) {
        const urlParts = companyForm.logo_url.split('/instance-logos/');
        if (urlParts[1]) {
          await supabase.storage.from('instance-logos').remove([urlParts[1]]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('instance-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('instance-logos')
        .getPublicUrl(fileName);

      setCompanyForm(prev => ({ ...prev, logo_url: publicUrl }));
      
      // Auto-save logo_url to database immediately
      const { error: updateError } = await supabase
        .from('instances')
        .update({ logo_url: publicUrl })
        .eq('id', instanceId);
      
      if (updateError) throw updateError;
      
      // Invalidate instance data cache so sidebar picks it up
      queryClient.invalidateQueries({ queryKey: ['instance_data', instanceId] });
      
      toast.success(t('instanceSettings.logoUploaded'));
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error(t('instanceSettings.logoUploadError'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!companyForm.logo_url || !instanceId) return;

    try {
      const urlParts = companyForm.logo_url.split('/instance-logos/');
      if (urlParts[1]) {
        await supabase.storage.from('instance-logos').remove([urlParts[1]]);
      }
      setCompanyForm(prev => ({ ...prev, logo_url: '' }));
      
      // Auto-save removal to database
      await supabase.from('instances').update({ logo_url: null }).eq('id', instanceId);
      queryClient.invalidateQueries({ queryKey: ['instance_data', instanceId] });
      
      toast.success(t('instanceSettings.logoRemoved'));
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error(t('instanceSettings.logoRemoveError'));
    }
  };

  const handleSaveCompany = async () => {
    if (!instanceId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('instances')
        .update({
          name: companyForm.name,
          short_name: companyForm.short_name || null,
          invoice_company_name: companyForm.invoice_company_name || null,
          nip: companyForm.nip || null,
          phone: companyForm.phone || null,
          reservation_phone: companyForm.reservation_phone || null,
          email: companyForm.email || null,
          address: companyForm.address || null,
          logo_url: companyForm.logo_url || null,
          social_facebook: companyForm.social_facebook || null,
          social_instagram: companyForm.social_instagram || null,
          google_maps_url: companyForm.google_maps_url || null,
          website: companyForm.website || null,
          contact_person: companyForm.contact_person || null,
        })
        .eq('id', instanceId);

      if (error) throw error;

      onInstanceUpdate({ ...instanceData, ...companyForm });
      toast.success(t('settings.saved'));
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(t('settings.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const currentTab = tabs.find(t => t.key === activeTab);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'company':
        return (
          <div className="space-y-6">
            {/* Logo */}
            <div className="space-y-3">
              <Label>{t('instanceSettings.logo')}</Label>
              <div className="flex items-center gap-4">
                <div 
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/50 overflow-hidden cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  ) : companyForm.logo_url ? (
                    <img 
                      src={companyForm.logo_url} 
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
                    {companyForm.logo_url ? t('instanceSettings.changeLogo') : t('instanceSettings.uploadLogo')}
                  </Button>
                  {companyForm.logo_url && (
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

            {/* Car Wash Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{t('instanceSettings.carWashName')} *</Label>
              <Input
                id="name"
                value={companyForm.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="ARM CAR AUTO SPA"
              />
            </div>

            {/* Short Name for SMS */}
            <div className="space-y-2">
              <Label htmlFor="short_name">{t('instanceSettings.shortName')} *</Label>
              <Input
                id="short_name"
                value={companyForm.short_name}
                onChange={(e) => handleInputChange('short_name', e.target.value)}
                placeholder="ARM CAR"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                {t('instanceSettings.shortNameDescription')}
              </p>
            </div>

            {/* Invoice Company Name */}
            <div className="space-y-2">
              <Label htmlFor="invoice_company_name">{t('instanceSettings.invoiceCompanyName')}</Label>
              <Input
                id="invoice_company_name"
                value={companyForm.invoice_company_name}
                onChange={(e) => handleInputChange('invoice_company_name', e.target.value)}
                placeholder="ARM CAR Sp. z o.o."
              />
            </div>

            {/* NIP */}
            <div className="space-y-2">
              <Label htmlFor="nip">{t('instanceSettings.nip')}</Label>
              <Input
                id="nip"
                value={companyForm.nip}
                onChange={(e) => handleInputChange('nip', e.target.value)}
                placeholder="123-456-78-90"
                maxLength={13}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">{t('instanceSettings.phone')}</Label>
              <Input
                id="phone"
                type="tel"
                value={companyForm.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+48 123 456 789"
              />
            </div>

            {/* Reservation Phone */}
            <div className="space-y-2">
              <Label htmlFor="reservation_phone">{t('instanceSettings.reservationPhone')}</Label>
              <Input
                id="reservation_phone"
                type="tel"
                value={companyForm.reservation_phone}
                onChange={(e) => handleInputChange('reservation_phone', e.target.value)}
                placeholder="+48 123 456 789"
              />
              <p className="text-xs text-muted-foreground">
                {t('instanceSettings.reservationPhoneDescription')}
              </p>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">{t('instanceSettings.email')}</Label>
              <Input
                id="email"
                type="email"
                value={companyForm.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="kontakt@firma.pl"
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">{t('instanceSettings.address')}</Label>
              <Input
                id="address"
                value={companyForm.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="ul. Przykładowa 123, 80-000 Gdańsk"
              />
            </div>

            {/* Contact Person */}
            <div className="space-y-2">
              <Label htmlFor="contact_person">{t('instanceSettings.contactPerson')}</Label>
              <Input
                id="contact_person"
                value={companyForm.contact_person}
                onChange={(e) => handleInputChange('contact_person', e.target.value)}
                placeholder="Jan Kowalski"
              />
            </div>

            {/* Website */}
            <div className="space-y-2">
              <Label htmlFor="website">{t('instanceSettings.website')}</Label>
              <Input
                id="website"
                type="url"
                value={companyForm.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                placeholder="https://www.firma.pl"
              />
            </div>

            {/* Social Links */}
            <div className="space-y-2">
              <Label htmlFor="social_facebook">{t('instanceSettings.facebook')}</Label>
              <Input
                id="social_facebook"
                value={companyForm.social_facebook}
                onChange={(e) => handleInputChange('social_facebook', e.target.value)}
                placeholder="https://facebook.com/firma"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="social_instagram">{t('instanceSettings.instagram')}</Label>
              <Input
                id="social_instagram"
                value={companyForm.social_instagram}
                onChange={(e) => handleInputChange('social_instagram', e.target.value)}
                placeholder="https://instagram.com/firma"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="google_maps_url">{t('instanceSettings.googleMaps')}</Label>
              <Input
                id="google_maps_url"
                value={companyForm.google_maps_url}
                onChange={(e) => handleInputChange('google_maps_url', e.target.value)}
                placeholder="https://maps.google.com/..."
              />
            </div>

            {/* Save Button */}
            <Button onClick={handleSaveCompany} disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {t('common.save')}
            </Button>
          </div>
        );

      case 'stations':
        return <StationsSettings instanceId={instanceId} />;

      case 'hours':
        return <WorkingHoursSettings instanceId={instanceId} onSave={onWorkingHoursUpdate} />;

      case 'halls':
        return instanceId ? <HallsListView instanceId={instanceId} /> : null;

      case 'app':
        return <ReservationConfirmSettings instanceId={instanceId} />;

      case 'sms':
        return <SmsMessageSettings instanceId={instanceId} instanceName={instanceData?.short_name || instanceData?.name} />;

      case 'users':
        return instanceId ? <InstanceUsersTab instanceId={instanceId} /> : null;

      case 'widget':
        return <WidgetSettings instanceSlug={instanceData?.slug} />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 lg:space-y-0 lg:flex lg:flex-row lg:gap-6">
      {/* Sidebar / Mobile Dropdown */}
      {isMobile ? (
        <Collapsible open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} className="w-full">
          <CollapsibleTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-between bg-white border-border/50"
            >
              <span className="flex items-center gap-2">
                {currentTab?.icon}
                {currentTab?.label}
              </span>
              <ChevronDown className={cn(
                "w-4 h-4 transition-transform",
                mobileMenuOpen && "rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="bg-white rounded-lg border border-border/50 overflow-hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors border-b border-border/30 last:border-0",
                    activeTab === tab.key 
                      ? "bg-muted/30 text-foreground font-medium" 
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="w-56 shrink-0">
          <div className="bg-white rounded-lg border border-border/50 overflow-hidden sticky top-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors border-b border-border/30 last:border-0",
                  activeTab === tab.key 
                    ? "bg-muted/30 text-foreground font-medium" 
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          {/* Version info */}
          {currentVersion && (
            <p className="text-xs text-muted-foreground mt-3 px-1">
              Panel Admina v{currentVersion}
            </p>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="glass-card p-6 pb-24 md:pb-6 bg-secondary-foreground">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
