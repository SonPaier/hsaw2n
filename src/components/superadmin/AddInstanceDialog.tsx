import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Building2, Globe, Phone, Mail, MapPin, Hash, User, Lock, 
  Loader2, CheckCircle2, XCircle, Clock, Eye, EyeOff, Info
} from "lucide-react";

interface AddInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (instanceData: SuccessData) => void;
}

export interface SuccessData {
  instanceName: string;
  slug: string;
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  base_price: number;
  price_per_station: number;
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function AddInstanceDialog({ open, onOpenChange, onSuccess }: AddInstanceDialogProps) {
  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [shortName, setShortName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [nip, setNip] = useState("");
  
  const [planId, setPlanId] = useState("");
  const [stationLimit, setStationLimit] = useState(1);
  const [trialDays, setTrialDays] = useState<number | null>(null);
  
  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // UI state
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Fetch subscription plans on mount
  useEffect(() => {
    const fetchPlans = async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, base_price, price_per_station')
        .eq('active', true)
        .order('sort_order');
      
      if (!error && data) {
        setPlans(data);
        if (data.length > 0) {
          setPlanId(data[0].id);
        }
      }
      setLoadingPlans(false);
    };
    
    if (open) {
      fetchPlans();
    }
  }, [open]);

  // Slug validation with debounce
  const checkSlugAvailability = useCallback(async (slugValue: string) => {
    if (!slugValue) {
      setSlugStatus('idle');
      return;
    }
    
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slugValue)) {
      setSlugStatus('invalid');
      return;
    }
    
    setSlugStatus('checking');
    
    const { data } = await supabase
      .from('instances')
      .select('id')
      .eq('slug', slugValue)
      .maybeSingle();
    
    setSlugStatus(data ? 'taken' : 'available');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkSlugAvailability(slug);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [slug, checkSlugAvailability]);

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value);
    const generatedSlug = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/g, 'l')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(generatedSlug);
  };

  const isValidEmail = (emailValue: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);

  const isFormValid = () => {
    return (
      name.trim() &&
      slug.trim() &&
      slugStatus === 'available' &&
      planId &&
      stationLimit >= 1 &&
      adminUsername.trim() &&
      adminEmail.trim() &&
      isValidEmail(adminEmail) &&
      adminPassword.length >= 6
    );
  };

  const handleSubmit = async () => {
    if (!isFormValid()) return;
    
    setLoading(true);
    
    try {
      // 1. Create instance
      const { data: instance, error: instanceError } = await supabase
        .from('instances')
        .insert({
          name: name.trim(),
          slug: slug.trim(),
          short_name: shortName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          nip: nip.trim() || null,
          active: true,
        })
        .select()
        .single();

      if (instanceError) throw instanceError;

      // 2. Create subscription
      const isTrial = trialDays !== null && trialDays > 0;
      const trialExpiresAt = isTrial 
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { error: subError } = await supabase
        .from('instance_subscriptions')
        .insert({
          instance_id: instance.id,
          plan_id: planId,
          station_limit: stationLimit,
          is_trial: isTrial,
          trial_expires_at: trialExpiresAt,
          status: 'active',
        });

      if (subError) throw subError;

      // 3. Create default station
      const { error: stationError } = await supabase
        .from('stations')
        .insert({
          instance_id: instance.id,
          name: 'Stanowisko 1',
          type: 'universal',
          is_active: true,
        });

      if (stationError) throw stationError;

      // 4. Create admin user via Edge Function
      const { error: userError } = await supabase.functions.invoke('create-user', {
        body: {
          email: adminEmail.trim(),
          password: adminPassword,
          username: adminUsername.trim(),
          role: 'admin',
          instanceId: instance.id,
        }
      });

      if (userError) throw userError;

      // Success - pass data to parent
      onSuccess({
        instanceName: name,
        slug: slug,
        adminUsername: adminUsername,
        adminEmail: adminEmail,
        adminPassword: adminPassword,
      });
      
      // Reset form
      resetForm();
      onOpenChange(false);
      
    } catch (error: any) {
      console.error('Error creating instance:', error);
      
      // Handle specific error for duplicate slug
      if (error.code === '23505' && error.message?.includes('instances_slug_key')) {
        setSlugStatus('taken');
        toast.error('Ten slug jest już zajęty. Wybierz inny.');
        return;
      }
      
      toast.error(`Błąd: ${error.message || 'Nie udało się utworzyć instancji'}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setSlug("");
    setShortName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNip("");
    setPlanId(plans[0]?.id || "");
    setStationLimit(1);
    setTrialDays(null);
    setAdminUsername("admin");
    setAdminEmail("");
    setAdminPassword("");
    setSlugStatus('idle');
  };

  const selectedPlan = plans.find(p => p.id === planId);
  // base_price includes 1 station, so we only add price for extra stations
  const extraStations = Math.max(0, stationLimit - 1);
  const monthlyPrice = selectedPlan 
    ? selectedPlan.base_price + (extraStations * selectedPlan.price_per_station)
    : 0;

  const SlugStatusIcon = () => {
    switch (slugStatus) {
      case 'checking':
        return <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />;
      case 'available':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'taken':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'invalid':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Nowa instancja
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-140px)] px-6">
          <div className="space-y-6 pb-6">
            {/* Section 1: Company Data */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="font-medium">Dane firmy</span>
              </div>
              <Separator />
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="name">Nazwa firmy *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="np. ARM CAR Gdańsk"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (URL) *</Label>
                  <div className="relative">
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase())}
                      placeholder="np. armcar-gdansk"
                      className={slugStatus === 'taken' || slugStatus === 'invalid' ? 'border-destructive' : ''}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <SlugStatusIcon />
                    </div>
                  </div>
                  {slugStatus === 'invalid' && (
                    <p className="text-xs text-destructive">Tylko małe litery, cyfry i myślniki</p>
                  )}
                  {slugStatus === 'taken' && (
                    <p className="text-xs text-destructive">Ten slug jest już zajęty</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="shortName">Skrócona nazwa (dla SMS)</Label>
                  <Input
                    id="shortName"
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value)}
                    placeholder="np. ARM CAR"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Telefon
                    </Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Adres
                  </Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="nip" className="flex items-center gap-1">
                    <Hash className="h-3 w-3" /> NIP
                  </Label>
                  <Input
                    id="nip"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Plan & Subscription */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4" />
                <span className="font-medium">Plan i subskrypcja</span>
              </div>
              <Separator />
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Wybierz plan *</Label>
                  <Select value={planId} onValueChange={setPlanId} disabled={loadingPlans}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingPlans ? "Ładowanie..." : "Wybierz plan"} />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} ({plan.base_price} zł z 1 stanowiskiem, +{plan.price_per_station} zł/dodatkowe)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="stationLimit">Limit stanowisk *</Label>
                  <Input
                    id="stationLimit"
                    type="number"
                    min={1}
                    max={20}
                    value={stationLimit}
                    onChange={(e) => setStationLimit(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                
                {selectedPlan && (
                  <div className="text-sm text-muted-foreground">
                    Szacunkowa cena miesięczna: <span className="font-medium text-foreground">{monthlyPrice} zł</span>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="trial"
                    checked={trialDays !== null}
                    onCheckedChange={(checked) => setTrialDays(checked ? 7 : null)}
                  />
                  <Label htmlFor="trial" className="text-sm font-normal cursor-pointer">
                    Okres próbny
                  </Label>
                  {trialDays !== null && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={trialDays}
                        onChange={(e) => setTrialDays(Math.max(1, parseInt(e.target.value) || 7))}
                        className="w-20 h-8"
                      />
                      <span className="text-sm text-muted-foreground">dni</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Admin Account */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span className="font-medium">Konto administratora</span>
              </div>
              <Separator />
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="adminUsername">Nazwa użytkownika *</Label>
                  <Input
                    id="adminUsername"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="np. admin"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Email administratora *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="np. admin@armcar.pl"
                    className={adminEmail && !isValidEmail(adminEmail) ? 'border-destructive' : ''}
                  />
                  {adminEmail && !isValidEmail(adminEmail) && (
                    <p className="text-xs text-destructive">Nieprawidłowy format adresu email</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="adminPassword" className="flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Hasło *
                  </Label>
                  <div className="relative">
                    <Input
                      id="adminPassword"
                      type={showPassword ? "text" : "password"}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Min. 6 znaków"
                      className={adminPassword && adminPassword.length < 6 ? 'border-destructive' : ''}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {adminPassword && adminPassword.length < 6 && (
                    <p className="text-xs text-destructive">Hasło musi mieć min. 6 znaków</p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: DNS Info */}
            {slug && slugStatus === 'available' && (
              <Alert className="bg-muted/50">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p className="font-medium mb-2">Po utworzeniu skonfiguruj DNS:</p>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div>• {slug}.n2wash.com → widok klienta</div>
                    <div>• {slug}.admin.n2wash.com → panel admina</div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>
        
        <div className="flex justify-end gap-2 p-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Anuluj
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isFormValid() || loading}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Utwórz instancję
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
