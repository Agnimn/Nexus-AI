import React from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";

export interface KpiCardProps {
  /** Card label */
  title: string;
  /** Displayed value — pass `undefined` to trigger emptyState */
  value?: string | number;
  /** Lucide icon component */
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
  /** When set, wraps the card in a <Link> that navigates here (supports query params) */
  href?: string;
  /** Trend direction shown beneath the value */
  trend?: "up" | "down" | "neutral";
  /** Short label next to the trend arrow, e.g. "+5 this week" */
  trendLabel?: string;
  /**
   * Semantic status colour:
   * green = healthy, yellow = warning, red = critical, blue = informational
   */
  statusColor?: "green" | "yellow" | "red" | "blue" | "default";
  /** Shown when value is undefined (replaces "-") */
  emptyState?: string;
  /** HTML title attribute used as a browser tooltip */
  tooltip?: string;
  className?: string;
}

// ─── Style maps ──────────────────────────────────────────────────────────────

const statusBorder: Record<string, string> = {
  green: "border-emerald-500/30",
  yellow: "border-amber-500/40",
  red: "border-red-500/40 shadow-[0_0_16px_rgba(239,68,68,0.09)]",
  blue: "border-primary/25",
  default: "border-muted",
};

const statusValueColor: Record<string, string> = {
  green: "text-emerald-400",
  yellow: "text-amber-400",
  red: "text-red-400",
  blue: "text-primary",
  default: "text-foreground",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function KpiCard({
  title,
  value,
  icon: Icon,
  isLoading = false,
  href,
  trend,
  trendLabel,
  statusColor = "default",
  emptyState = "No data available",
  tooltip,
  className,
}: KpiCardProps) {
  const isClickable = Boolean(href);

  const card = (
    <Card
      title={tooltip}
      className={[
        "bg-card/50 backdrop-blur-sm transition-all duration-200 h-full",
        statusBorder[statusColor],
        isClickable
          ? "cursor-pointer group-hover:scale-[1.015] group-hover:border-primary/50 group-hover:bg-card/80 group-hover:shadow-[0_0_22px_rgba(59,130,246,0.11)]"
          : "",
        className ?? "",
      ].join(" ")}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground leading-snug pr-2">
          {title}
        </CardTitle>
        <Icon
          className={[
            "h-4 w-4 shrink-0 transition-colors duration-200",
            isClickable
              ? "text-muted-foreground group-hover:text-primary"
              : "text-muted-foreground",
          ].join(" ")}
        />
      </CardHeader>

      <CardContent className="space-y-1.5">
        {isLoading ? (
          <div className="space-y-2 pt-1">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ) : (
          <>
            {/* Value */}
            <div className={`text-2xl font-bold leading-none ${statusValueColor[statusColor]}`}>
              {value !== undefined && value !== null ? (
                value
              ) : (
                <span className="text-xs font-normal text-muted-foreground/70 leading-relaxed block pt-1">
                  {emptyState}
                </span>
              )}
            </div>

            {/* Trend indicator */}
            {trend && trendLabel && (
              <div
                className={[
                  "flex items-center gap-1 text-[11px] font-medium",
                  trend === "up"
                    ? "text-emerald-500"
                    : trend === "down"
                    ? "text-red-400"
                    : "text-muted-foreground",
                ].join(" ")}
              >
                {trend === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : trend === "down" ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                <span>{trendLabel}</span>
              </div>
            )}

            {/* "View details" hint — fades in on hover */}
            {isClickable && (
              <p className="pt-0.5 text-[10px] text-transparent group-hover:text-primary/60 transition-colors duration-200 flex items-center gap-1 select-none">
                <ArrowRight className="h-3 w-3" />
                View details
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block group h-full">
        {card}
      </Link>
    );
  }

  return card;
}
