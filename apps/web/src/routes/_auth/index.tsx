import { formatFineCount, isUnpaid } from "@sporty/api/rest/lib/fines";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { EventCard } from "@/components/event-card";
import { EmptyText, PageState } from "@/components/page-state";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/")({
	component: HomeComponent,
});

/** Kommende arrangementer i alle gruppene, og dine ubetalte bøter. */
function HomeComponent() {
	const { session } = Route.useRouteContext();
	const trpc = useTRPC();
	const events = useQuery(trpc.events.upcoming.queryOptions());
	const fines = useQuery(trpc.fines.mine.queryOptions());
	const unpaid = (fines.data ?? [])
		.filter(isUnpaid)
		.reduce((sum, fine) => sum + fine.count, 0);

	return (
		<div className="grid w-4xl grid-cols-1 gap-8">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold">
						Hei, {session.user.name.split(" ")[0]}!
					</h1>
					<p className="text-muted-foreground">
						Her er det som skjer fremover.
					</p>
				</div>
				{fines.data && (
					<Link
						to="/boter"
						className="rounded-xl border px-4 py-2 text-sm hover:bg-muted"
					>
						<span className="text-muted-foreground">Dine ubetalte bøter: </span>
						<span className="font-semibold">{formatFineCount(unpaid)}</span>
					</Link>
				)}
			</div>

			<section className="grid gap-3">
				<h2 className="font-medium">Kommende arrangementer</h2>
				<PageState query={events}>
					{(data) =>
						data.length === 0 ? (
							<EmptyText>Ingen kommende arrangementer.</EmptyText>
						) : (
							data.map((event) => (
								<EventCard key={event.id} event={event} showGroup />
							))
						)
					}
				</PageState>
			</section>
		</div>
	);
}
