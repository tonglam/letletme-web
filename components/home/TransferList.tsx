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
        <h3 className="font-display text-lg font-bold uppercase tracking-caps">{title}</h3>
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
					className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-lg border border-border/50 bg-background/80 p-3 text-left"
				>
					<Badge
						variant="secondary"
						className={`row-span-2 self-start text-xs font-semibold ${positionBadgeClass(transfer.position)}`}
					>
						{normalizePosition(transfer.position)}
					</Badge>

					<div className="min-w-0">
						<span className="block whitespace-normal text-sm font-semibold leading-tight">
							{transfer.player}
						</span>
					</div>

					<div className="col-start-2 mt-1 flex min-w-0 items-center justify-between gap-2">
						<span className="min-w-0 truncate text-xs text-muted-foreground">
							{[
								transfer.club || "",
								t("selectedShort", {
									value:
										typeof transfer.selectedByPercent === "number"
											? `${transfer.selectedByPercent.toFixed(1)}%`
											: "-"
								}),
								t("pointsShort", {
									value:
										typeof transfer.points === "number" ? transfer.points : "-"
								}),
							]
								.filter((part) => part.length > 0)
								.join(" | ")}
						</span>
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
