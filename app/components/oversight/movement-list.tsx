import { RecordLinkList } from "@/app/components/record-link-list";
import { formatIsoDate } from "@/lib/dates";
import type { RatingMovementSummary } from "@/lib/oversight/movement";

export function RatingMovementList({
  summary,
}: {
  summary: RatingMovementSummary;
}) {
  return (
    <RecordLinkList
      variant="cards"
      limit={8}
      items={summary.moves.map((move) => ({
        id: move.riskId,
        href: `/risks/${move.riskId}/edit`,
        title: move.title,
        detail: `${move.previousBand} (${move.previousScore}) → ${move.finalBand} (${move.finalScore}) · ${move.delta > 0 ? "+" : ""}${move.delta} · ${formatIsoDate(move.reviewedAt)}`,
      }))}
      empty="No rating changes on the latest RCSA for each risk. Confirming the same score, or risks never reviewed, do not appear here."
    />
  );
}
