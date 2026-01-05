import * as React from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface AdminTabsListProps {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4 | 5;
}

/**
 * Unified tabs list component for admin panel views.
 * Uses white background with light gray for active tab.
 */
export const AdminTabsList = ({ children, className, columns = 2 }: AdminTabsListProps) => {
  const gridColsClass = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
  }[columns];

  return (
    <TabsList 
      className={cn(
        "bg-white border border-border/50",
        `grid ${gridColsClass}`,
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
        "data-[state=active]:bg-muted/30 data-[state=active]:text-foreground",
        "hover:bg-muted/30 hover:text-foreground",
        "gap-1.5",
        className
      )}
    >
      {children}
    </TabsTrigger>
  );
};
