import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CheckCircle2, Copy, Globe, User } from "lucide-react";
import type { SuccessData } from "./AddInstanceDialog";

interface InstanceCreatedSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: SuccessData | null;
}

export function InstanceCreatedSuccessDialog({ 
  open, 
  onOpenChange, 
  data 
}: InstanceCreatedSuccessDialogProps) {
  if (!data) return null;

  const publicDomain = `${data.slug}.n2wash.com`;
  const adminDomain = `${data.slug}.admin.n2wash.com`;

  const handleCopyAll = () => {
    const text = `Instancja: ${data.instanceName}
    
Subdomeny:
• Publiczna: ${publicDomain}
• Admin: ${adminDomain}

Dane logowania:
• Login: ${data.adminUsername}
• Email: ${data.adminEmail}
• Hasło: ${data.adminPassword}`;

    navigator.clipboard.writeText(text);
    toast.success("Skopiowano dane do schowka");
  };

  const handleCopyDomains = () => {
    const text = `Publiczna: ${publicDomain}\nAdmin: ${adminDomain}`;
    navigator.clipboard.writeText(text);
    toast.success("Skopiowano domeny");
  };

  const handleCopyCredentials = () => {
    const text = `Login: ${data.adminUsername}\nEmail: ${data.adminEmail}\nHasło: ${data.adminPassword}`;
    navigator.clipboard.writeText(text);
    toast.success("Skopiowano dane logowania");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            Instancja utworzona!
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Instancja <span className="font-medium text-foreground">"{data.instanceName}"</span> została pomyślnie utworzona.
          </p>

          {/* DNS Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Skonfiguruj DNS
              </div>
              <Button variant="ghost" size="sm" onClick={handleCopyDomains} className="h-7 text-xs">
                <Copy className="h-3 w-3 mr-1" />
                Kopiuj
              </Button>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 font-mono text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Publiczny:</span>
                <span className="font-medium">{publicDomain}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Admin:</span>
                <span className="font-medium">{adminDomain}</span>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Dodaj rekordy CNAME w IONOS, a następnie skonfiguruj domeny w Lovable → Settings → Custom Domains.
            </p>
          </div>

          <Separator />

          {/* Admin Credentials */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-muted-foreground" />
                Dane logowania administratora
              </div>
              <Button variant="ghost" size="sm" onClick={handleCopyCredentials} className="h-7 text-xs">
                <Copy className="h-3 w-3 mr-1" />
                Kopiuj
              </Button>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Login:</span>
                <span className="font-medium font-mono">{data.adminUsername}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium font-mono">{data.adminEmail}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Hasło:</span>
                <span className="font-medium font-mono">{data.adminPassword}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleCopyAll}>
            <Copy className="h-4 w-4 mr-2" />
            Kopiuj wszystko
          </Button>
          <Button 
            onClick={() => onOpenChange(false)}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
          >
            Zamknij
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
