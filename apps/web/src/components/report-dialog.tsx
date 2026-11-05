import { REPORT_REASONS } from "@sporty/api/rest/lib/messages";
import type { ReportReason } from "@sporty/api/rest/types";
import { Button } from "@sporty/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@sporty/ui/components/dialog";

/** Velg hvorfor en melding eller kommentar rapporteres. */
export function ReportDialog({
	open,
	onOpenChange,
	title,
	onSelect,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	onSelect: (reason: ReportReason) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				<div className="grid gap-2">
					{REPORT_REASONS.map((reason) => (
						<Button
							key={reason.value}
							variant="outline"
							onClick={() => {
								onOpenChange(false);
								onSelect(reason.value);
							}}
						>
							{reason.label}
						</Button>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
