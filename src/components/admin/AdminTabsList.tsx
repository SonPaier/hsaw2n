import * as React from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface AdminTabsListProps {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3;
}

/**
 * Unified tabs list component for admin panel views.
 * Uses white background with light gray for active tab.
 */
export const AdminTabsList = ({ children, className, columns = 2 }: AdminTabsListProps) => {
  return (
    <TabsList 
      className={cn(
        "bg-white border border-border/50",
        columns === 2 ? "grid grid-cols-2" : "grid grid-cols-3",
        "w-full",
        className
      )}
    >
      {children}
    </TabsList>
  );
};

interface AdminTabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const AdminTabsTrigger = ({ value, children, className }: AdminTabsTriggerProps) => {
  return (
    <TabsTrigger 
      value={value}
      className={cn(
        "data-[state=active]:bg-muted data-[state=active]:text-foreground",
        "gap-1.5",
        className
      )}
    >
      {children}
    </TabsTrigger>
  );
};
