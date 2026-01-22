import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SmsUsageCardProps {
  instanceId: string;
  showInstanceName?: boolean;
}

interface SmsUsageData {
  name: string;
  sms_used: number;
  sms_limit: number;
}

export function SmsUsageCard({ instanceId, showInstanceName = false }: SmsUsageCardProps) {
  const [usage, setUsage] = useState<SmsUsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      const { data, error } = await supabase
        .from("instances")
        .select("name, sms_used, sms_limit")
        .eq("id", instanceId)
        .single();

      if (error) {
        console.error("Error fetching SMS usage:", error);
      } else {
        setUsage(data);
      }
      setLoading(false);
    };

    fetchUsage();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`sms-usage-${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "instances",
          filter: `id=eq.${instanceId}`,
        },
        (payload) => {
          const newData = payload.new as SmsUsageData;
          setUsage({
            name: newData.name,
            sms_used: newData.sms_used,
            sms_limit: newData.sms_limit,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {showInstanceName ? "Zużycie SMS" : "Zużycie SMS"}
          </CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="h-8 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!usage) return null;

  const percentage = (usage.sms_used / usage.sms_limit) * 100;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;
  const isOverLimit = usage.sms_used > usage.sms_limit;
  const overCount = isOverLimit ? usage.sms_used - usage.sms_limit : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {showInstanceName ? usage.name : "Zużycie SMS"}
        </CardTitle>
        <MessageSquare className={`h-4 w-4 ${isOverLimit ? "text-destructive" : isAtLimit ? "text-destructive" : isNearLimit ? "text-amber-500" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${isOverLimit ? "text-destructive" : ""}`}>
          {usage.sms_used} / {usage.sms_limit}
        </div>
        <Progress 
          value={Math.min(percentage, 100)} 
          className={`mt-2 ${isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-amber-500" : ""}`}
        />
        <p className={`text-xs mt-1 ${isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {isOverLimit 
            ? `Przekroczono limit o ${overCount} SMS`
            : isAtLimit 
              ? "Limit wyczerpany" 
              : isNearLimit 
                ? `Pozostało ${usage.sms_limit - usage.sms_used} SMS`
                : `${Math.round(percentage)}% wykorzystane`
          }
        </p>
      </CardContent>
    </Card>
  );
}
