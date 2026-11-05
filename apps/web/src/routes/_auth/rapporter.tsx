import { formatRelative } from "@sporty/api/rest/lib/dates";
import { REPORT_REASONS } from "@sporty/api/rest/lib/messages";
import type { MessageReport } from "@sporty/api/rest/types";
import { Button } from "@sporty/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { EmptyText, PageState } from "@/components/page-state";
import { UserAvatar } from "@/components/user-avatar";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/rapporter")({
	component: ReportsComponent,
});

const reasonLabel = (reason: MessageReport["reason"]) =>
	REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;

/** Åpne rapporter for sub-/admin og Index. Alle andre ser bare at det ikke er noe her. */
function ReportsComponent() {
	const trpc = useTRPC();
	const reports = useQuery(trpc.messages.reports.queryOptions());

	return (
		<div className="grid w-full max-w-2xl min-w-0 grid-cols-1 gap-6">
			<div>
				<h1 className="text-2xl font-semibold">Rapporter</h1>
				<p className="text-sm text-muted-foreground">
					Meldinger som er rapportert i gruppene dine. Behandle dem innen 24
					timer.
				</p>
			</div>
			<PageState query={reports}>
				{(data) =>
					data.length === 0 ? (
						<EmptyText>Ingen åpne rapporter</EmptyText>
					) : (
						<div className="grid gap-3">
							{data.map((report) => (
								<ReportCard key={report.id} report={report} />
							))}
						</div>
					)
				}
			</PageState>
		</div>
	);
}

function ReportCard({ report }: { report: MessageReport }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const resolve = useMutation(
		trpc.messages.resolveReport.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.messages.reports.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.messages.page.pathKey(),
				});
			},
			onError: (error) =>
				toast.error(`Rapporten ble ikke behandlet: ${error.message}`),
		}),
	);

	return (
		<article className="grid gap-3 rounded-lg border p-4">
			<div className="flex items-center gap-3">
				<UserAvatar user={report.sender} className="size-9" />
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium">{report.sender.name}</p>
					<p className="truncate text-xs text-muted-foreground">
						{report.groupName ?? "Direktemelding"} ·{" "}
						{reasonLabel(report.reason)} · {formatRelative(report.createdAt)}
					</p>
				</div>
			</div>
			{report.gifUrl ? (
				<img
					src={report.gifUrl}
					alt="Rapportert GIF"
					className="w-48 rounded-md"
				/>
			) : (
				<p className="text-sm whitespace-pre-wrap">{report.body}</p>
			)}
			<p className="text-xs text-muted-foreground">
				Rapportert av {report.reporter.name}
			</p>
			<div className="flex flex-wrap gap-2">
				<Button
					variant="destructive"
					size="sm"
					disabled={resolve.isPending}
					onClick={() =>
						resolve.mutate({ reportId: report.id, action: "remove" })
					}
				>
					Slett meldingen
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={resolve.isPending}
					onClick={() =>
						resolve.mutate({ reportId: report.id, action: "dismiss" })
					}
				>
					Avvis rapporten
				</Button>
			</div>
		</article>
	);
}
