import { formatTime } from "@sporty/api/rest/lib/dates";
import type { Answer, Event } from "@sporty/api/rest/types";
import { cn } from "@sporty/ui/lib/utils";

import { GroupBadge } from "@/components/group-badge";
import { locationLabel, summarize } from "@/lib/events";

const weekday = new Intl.DateTimeFormat("nb-NO", { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat("nb-NO", {
	day: "numeric",
	month: "short",
});

/** "Tor 5. nov." */
export function formatDayShort(iso: string) {
	const date = new Date(iso);
	const day = weekday.format(date).replace(".", "");
	return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${dayMonth.format(date)}`;
}

export function eventTitle(event: Event) {
	return event.opponent ? `${event.title} mot ${event.opponent}` : event.title;
}

/** Ditt svar, eller null hvis du ikke er blant dem som skal svare. */
export function myAnswer(
	event: Event,
	myId: string | undefined,
): Answer | "ubesvart" | null {
	if (!myId || !event.memberIds.includes(myId)) return null;
	const answer: Answer | undefined = event.attendance[myId];
	return answer ?? "ubesvart";
}

/** Svaret ditt på tavla. «Ikke svart» er det eneste som lyser. */
export function AnswerChip({
	answer,
	className,
}: {
	answer: ReturnType<typeof myAnswer>;
	className?: string;
}) {
	if (!answer) return null;
	const base =
		"inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-bold tracking-wider whitespace-nowrap uppercase";
	if (answer === "ubesvart") {
		return (
			<span className={cn(base, "bg-signal text-signal-foreground", className)}>
				Ikke svart
			</span>
		);
	}
	if (answer === "kommer") {
		return (
			<span
				className={cn(
					base,
					"border border-board-foreground/35 text-board-foreground",
					className,
				)}
			>
				Kommer
			</span>
		);
	}
	return (
		<span
			className={cn(
				base,
				"border border-board-foreground/15 text-board-subtle",
				className,
			)}
		>
			Kommer ikke
		</span>
	);
}

/**
 * Én strek per medlem: mørk kommer, ravgul har ikke svart, lys kommer ikke. Store lag skaleres
 * ned til høyst 48 streker med samme fordeling. Tallene står ved siden av.
 */
const MAX_BARS = 48;

/** Fordeler `total` streker på gruppene etter andel (største rest), så alle synlige får minst én. */
function scaleCounts(counts: number[], total: number) {
	const sum = counts.reduce((a, b) => a + b, 0);
	if (sum <= total) return counts;
	const exact = counts.map((c) => (c / sum) * total);
	const scaled = exact.map((x, i) =>
		Math.max(counts[i]! > 0 ? 1 : 0, Math.floor(x)),
	);
	let left = total - scaled.reduce((a, b) => a + b, 0);
	const order = exact
		.map((x, i) => ({ i, rest: x - Math.floor(x) }))
		.sort((a, b) => b.rest - a.rest);
	for (const { i } of order) {
		if (left <= 0) break;
		scaled[i]! += 1;
		left -= 1;
	}
	return scaled;
}

export function AttendanceBars({
	event,
	className,
}: {
	event: Event;
	className?: string;
}) {
	const { kommer, kommerIkke, ubesvart } = summarize(event);
	const [k, u, ki] = scaleCounts(
		[kommer.length, ubesvart.length, kommerIkke.length],
		MAX_BARS,
	);
	const bars = [
		...Array<string>(k ?? 0).fill("bg-foreground"),
		...Array<string>(u ?? 0).fill("bg-signal"),
		...Array<string>(ki ?? 0).fill("bg-input"),
	];
	return (
		<div
			className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}
		>
			{bars.length > 0 && (
				<div
					aria-hidden
					className="flex h-6 max-w-full gap-[3px] overflow-hidden"
				>
					{bars.map((color, index) => (
						<span
							key={index}
							className={cn("w-[3px] shrink-0 rounded-[1px]", color)}
						/>
					))}
				</div>
			)}
			<p className="text-sm text-muted-foreground">
				{kommer.length} kommer · {kommerIkke.length} kommer ikke ·{" "}
				{ubesvart.length} ikke svart
			</p>
		</div>
	);
}

/**
 * Tavla: arrangementene sortert på tid. Hver rad åpner arrangementspanelet.
 * `showGroup` bestemmer hvilke rader som får gruppemerket (f.eks. bare undergruppenes).
 */
export function EventBoard({
	events,
	myId,
	showGroup,
	onSelect,
	label,
}: {
	events: Event[];
	myId: string | undefined;
	showGroup: (event: Event) => boolean;
	onSelect: (event: Event) => void;
	label: string;
}) {
	return (
		<div
			className="overflow-hidden rounded-2xl border border-board-edge bg-board text-board-foreground"
			role="list"
			aria-label={label}
		>
			<div
				aria-hidden
				className="hidden grid-cols-[5.5rem_7rem_minmax(0,1fr)_minmax(0,13rem)_4.5rem_8.5rem] gap-4 border-b border-board-line px-5 py-3 text-[11px] font-semibold tracking-[0.1em] text-board-subtle uppercase md:grid"
			>
				<span>Start</span>
				<span>Dato</span>
				<span>Arrangement</span>
				<span>Sted</span>
				<span>Kommer</span>
				<span className="text-right">Ditt svar</span>
			</div>
			{events.map((event) => {
				const answer = myAnswer(event, myId);
				const { kommer } = summarize(event);
				return (
					<div
						key={event.id}
						role="listitem"
						className="border-b border-board-line last:border-b-0"
					>
						<button
							type="button"
							onClick={() => onSelect(event)}
							className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition-colors outline-none hover:bg-board-foreground/[0.04] focus-visible:bg-board-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-inset md:grid-cols-[5.5rem_7rem_minmax(0,1fr)_minmax(0,13rem)_4.5rem_8.5rem] md:gap-4 md:px-5"
						>
							<span className="grid">
								<span className="text-2xl leading-7 font-bold text-signal">
									{formatTime(event.start)}
								</span>
								<span className="text-[11px] font-medium text-board-subtle md:hidden">
									{formatDayShort(event.start)}
								</span>
							</span>
							<span className="hidden text-sm font-semibold text-board-muted md:block">
								{formatDayShort(event.start)}
							</span>
							<span className="grid min-w-0 gap-0.5">
								<span className="flex min-w-0 items-center gap-2">
									<span className="truncate text-base font-semibold md:text-lg">
										{eventTitle(event)}
									</span>
									{showGroup(event) && (
										<GroupBadge
											group={{ name: event.groupName, color: event.groupColor }}
										/>
									)}
								</span>
								<span className="truncate text-xs text-board-muted md:hidden">
									{event.location.name}
								</span>
							</span>
							<span
								className="hidden truncate text-sm text-board-muted md:block"
								title={locationLabel(event.location)}
							>
								{event.location.name}
							</span>
							<span className="hidden text-sm font-semibold md:block">
								{kommer.length}
							</span>
							<span className="flex justify-end">
								<AnswerChip answer={answer} />
							</span>
						</button>
					</div>
				);
			})}
		</div>
	);
}
