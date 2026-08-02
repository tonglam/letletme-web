import { Badge } from "@/components/ui/badge";
import { positionBadgeClass } from "@/lib/position-style";
import { formatCompactNumber, normalizePosition } from "@/lib/utils";
import { ArrowLeftCircle, ArrowRightCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface Transfer {
  position: string;
  player: string;
  club: string;
  transfers: number;
  selectedByPercent?: number | null;
  points?: number | null;
}

interface TransferListProps {
  title: string;
  transfers: Transfer[];
  type: "in" | "out";
}

export function TransferList({ title, transfers, type }: TransferListProps) {
  const t = useTranslations("Home");
  const icon = type === "in" ? (
    <ArrowRightCircle aria-hidden="true" className="w-5 h-5 shrink-0 text-success" />
  ) : (
    <ArrowLeftCircle aria-hidden="true" className="w-5 h-5 shrink-0 text-destructive" />
  );

  const valueClassName = type === "in"
    ? "text-success"
    : "text-destructive";

  const bgClassName = type === "in"
    ? "border-success/30"
    : "border-destructive/30";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-display text-lg font-bold uppercase tracking-[0.1em]">{title}</h3>
        {transfers.length > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {transfers.length}
          </Badge>
        )}
      </div>
      <div className={`space-y-2 rounded-lg p-3 border ${bgClassName} flex-1`}>
        {transfers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {t("noTransfers")}
          </div>
        ) : (
          transfers.map((transfer) => (
            <div
              key={`${transfer.player}-${transfer.club}`}
              className="flex w-full items-center gap-3 rounded-lg border border-border/50 bg-background/80 p-3 text-left"
            >
              <Badge
                variant="secondary"
                className={`shrink-0 text-xs font-semibold ${positionBadgeClass(transfer.position)}`}
              >
                {normalizePosition(transfer.position)}
              </Badge>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold truncate">
                    {transfer.player}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground truncate block">
                  {[
                    transfer.club || "",
                    t("selectedShort", { value:
                      typeof transfer.selectedByPercent === "number"
                        ? `${transfer.selectedByPercent.toFixed(1)}%`
                        : "-"
                    }),
                    t("pointsShort", { value: typeof transfer.points === "number" ? transfer.points : "-" }),
                  ]
                    .filter((part) => part.length > 0)
                    .join(" | ")}
                </span>
              </div>

              <div className="flex flex-col items-end shrink-0">
                <span className={`text-base font-bold ${valueClassName}`}>
                  {formatCompactNumber(transfer.transfers)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
