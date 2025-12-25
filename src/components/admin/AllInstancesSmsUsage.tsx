import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface InstanceSmsData {
  id: string;
  name: string;
  sms_used: number;
  sms_limit: number;
}

export function AllInstancesSmsUsage() {
  const [instances, setInstances] = useState<InstanceSmsData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInstances = async () => {
      const { data, error } = await supabase
        .from("instances")
        .select("id, name, sms_used, sms_limit")
        .order("name");

      if (error) {
        console.error("Error fetching instances SMS usage:", error);
      } else {
        setInstances(data || []);
      }
      setLoading(false);
    };

    fetchInstances();
  }, []);

  const totalUsed = instances.reduce((sum, i) => sum + i.sms_used, 0);
  const totalLimit = instances.reduce((sum, i) => sum + i.sms_limit, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Zużycie SMS - Wszystkie instancje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Zużycie SMS - Wszystkie instancje
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            Łącznie: {totalUsed} / {totalLimit}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {instances.map((instance) => {
            const percentage = (instance.sms_used / instance.sms_limit) * 100;
            const isNearLimit = percentage >= 80;
            const isAtLimit = percentage >= 100;

            return (
              <div key={instance.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{instance.name}</span>
                  <span className={`${isAtLimit ? "text-destructive" : isNearLimit ? "text-amber-500" : "text-muted-foreground"}`}>
                    {instance.sms_used} / {instance.sms_limit}
                  </span>
                </div>
                <Progress 
                  value={Math.min(percentage, 100)} 
                  className={`h-2 ${isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-amber-500" : ""}`}
                />
              </div>
            );
          })}
          {instances.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Brak instancji
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
