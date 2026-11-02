import type { OfficePeriod } from "@sporty/api/rest/types";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/utils/trpc";

const dateFormat = new Intl.DateTimeFormat("nb-NO", {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});

/** «1. jan. 2026 – 31. des. 2026». Datoene er uten klokkeslett, så de formateres i UTC. */
export function formatPeriodDates(period: Pick<OfficePeriod, "from" | "to">) {
	const format = (date: string) => dateFormat.format(new Date(date));
	return `${format(period.from)} – ${format(period.to)}`;
}

/** Om perioden gjelder i dag (begge dagene er med). */
export function isCurrentPeriod(period: Pick<OfficePeriod, "from" | "to">) {
	const today = new Date().toLocaleDateString("sv-SE", {
		timeZone: "Europe/Oslo",
	});
	return period.from <= today && today <= period.to;
}

/**
 * Vervhistorikken til laget, nyeste periode først. Bare visning: admin i hovedgruppen endrer den
 * under Innstillinger. Vises ikke før det finnes minst én periode.
 */
export function OfficeHistory({ groupId }: { groupId: string }) {
	const trpc = useTRPC();
	const history = useQuery(trpc.groups.offices.queryOptions({ groupId }));
	const periods = history.data?.periods ?? [];
	if (periods.length === 0) return null;

	return (
		<section className="grid gap-3">
			<h2 className="text-lg font-medium">Vervhistorikk</h2>
			{periods.map((period) => (
				<div key={period.id} className="grid gap-2 rounded-xl border p-4">
					<div className="flex flex-wrap items-baseline gap-x-2">
						<h3 className="font-medium">
							{period.name || formatPeriodDates(period)}
						</h3>
						{period.name && (
							<span className="text-sm text-muted-foreground">
								{formatPeriodDates(period)}
							</span>
						)}
						{isCurrentPeriod(period) && (
							<span className="text-xs font-medium text-primary">Nå</span>
						)}
					</div>
					{period.holders.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Ingen verv er fordelt.
						</p>
					) : (
						<dl className="grid gap-1 text-sm sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-x-4">
							{period.holders.map(({ office, users }) => (
								<div key={office.id} className="contents">
									<dt className="text-muted-foreground">{office.name}</dt>
									<dd className="mb-1 sm:mb-0">
										{users.map((u) => u.name).join(", ")}
									</dd>
								</div>
							))}
						</dl>
					)}
				</div>
			))}
		</section>
	);
}
