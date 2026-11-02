import { formatTime } from "@sporty/api/rest/lib/dates";
import { formatFineCount, isUnpaid } from "@sporty/api/rest/lib/fines";
import type { Event } from "@sporty/api/rest/types";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { AnswerButtons } from "@/components/answer-buttons";
import {
	AttendanceBars,
	EventBoard,
	eventTitle,
	myAnswer,
} from "@/components/event-board";
import { EventSheet, Field } from "@/components/event-sheet";
import { GroupBadge } from "@/components/group-badge";
import { EmptyText, PageState } from "@/components/page-state";
import { answeringClosed } from "@/lib/events";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/")({
	component: HomeComponent,
});

/** "torsdag 5. november" */
const dayLong = new Intl.DateTimeFormat("nb-NO", {
	weekday: "long",
	day: "numeric",
	month: "long",
});

/** Neste arrangement du skal svare på eller er med på øverst som billett, resten på tavla. */
function HomeComponent() {
	const { session } = Route.useRouteContext();
	const trpc = useTRPC();
	const me = useQuery(trpc.me.queryOptions());
	const events = useQuery(trpc.events.upcoming.queryOptions());
	const fines = useQuery(trpc.fines.mine.queryOptions());
	const [selected, setSelected] = useState<Event | null>(null);
	const [todayLabel] = useState(() => dayLong.format(new Date()));
	const myId = me.data?.id;
	const unpaid = (fines.data ?? [])
		.filter(isUnpaid)
		.reduce((sum, fine) => sum + fine.count, 0);

	return (
		<div className="grid w-full max-w-5xl gap-8">
			<header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h1 className="text-3xl font-bold tracking-tight">
					Hei, {session.user.name.split(" ")[0]}
				</h1>
				<p className="text-muted-foreground first-letter:uppercase">
					{todayLabel}
				</p>
			</header>

			<PageState query={events}>
				{(data) => {
					const next = data.find((event) => myAnswer(event, myId) !== null);
					const rest = data.filter((event) => event !== next);
					return (
						<>
							<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
								{next ? (
									<Ticket
										event={next}
										myId={myId}
										onOpen={() => setSelected(next)}
									/>
								) : (
									<EmptyText>Ingen kommende arrangementer.</EmptyText>
								)}
								{fines.data && (
									<Link
										to="/boter"
										className="group flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-input lg:flex-col lg:items-start lg:p-6"
									>
										<span className="grid gap-1">
											<span className="text-sm font-semibold">
												Dine ubetalte bøter
											</span>
											<span className="text-5xl font-bold tracking-tight lg:text-6xl">
												{unpaid}
											</span>
											<span className="text-sm text-muted-foreground">
												{unpaid === 0
													? "Alt er betalt"
													: formatFineCount(unpaid)}
											</span>
										</span>
										<span className="inline-flex items-center gap-1.5 text-sm font-semibold group-hover:underline">
											Se bøter
											<ArrowRightIcon className="size-4" />
										</span>
									</Link>
								)}
							</div>

							{rest.length > 0 && (
								<section className="grid gap-3">
									<h2 className="flex items-baseline gap-2 text-xl font-bold">
										Kommende arrangementer
										<span className="text-sm font-normal text-muted-foreground">
											{rest.length} til
										</span>
									</h2>
									<EventBoard
										label="Kommende arrangementer"
										events={rest}
										myId={myId}
										showGroup={() => true}
										onSelect={setSelected}
									/>
								</section>
							)}
						</>
					);
				}}
			</PageState>
			<EventSheet event={selected} onClose={() => setSelected(null)} />
		</div>
	);
}

/** Oppdateres hvert minutt, for nedtellingen. */
function useNow() {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 60_000);
		return () => clearInterval(id);
	}, []);
	return now;
}

/** "2 d 23 t", "5 t 10 min", "12 min" */
function countdown(iso: string, now: number) {
	const minutes = Math.max(
		0,
		Math.floor((new Date(iso).getTime() - now) / 60_000),
	);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	if (days > 0) return `${days} d ${hours % 24} t`;
	if (hours > 0) return `${hours} t ${minutes % 60} min`;
	return `${minutes} min`;
}

/**
 * Billetten: det neste arrangementet du er med på. Den mørke stubben har nedtellingen og
 * svarknappene, adskilt med en stiplet linje.
 */
function Ticket({
	event,
	myId,
	onOpen,
}: {
	event: Event;
	myId: string | undefined;
	onOpen: () => void;
}) {
	const now = useNow();
	const answer = myAnswer(event, myId);
	const closed = answeringClosed(event);

	return (
		<article className="flex flex-col overflow-hidden rounded-2xl border bg-card md:flex-row">
			<div className="grid min-w-0 flex-1 gap-5 p-6 md:p-7">
				<div className="grid gap-1">
					<h2 className="flex min-w-0 items-center gap-3 text-3xl font-bold tracking-tight md:text-4xl">
						<GroupBadge
							group={{ name: event.groupName, color: event.groupColor }}
							className="h-6 text-xs"
						/>
						<button
							type="button"
							onClick={onOpen}
							className="truncate text-left hover:underline"
						>
							{eventTitle(event)}
						</button>
					</h2>
					<p className="text-sm text-muted-foreground">
						Neste arrangement · {event.groupName} ·{" "}
						{dayLong.format(new Date(event.start))}
					</p>
				</div>
				<dl className="flex flex-wrap gap-x-8 gap-y-4 [&_dd]:text-xl">
					{event.meetupAt && (
						<Field label="Oppmøte">{formatTime(event.meetupAt)}</Field>
					)}
					<Field label="Start">{formatTime(event.start)}</Field>
					{event.end && <Field label="Slutt">{formatTime(event.end)}</Field>}
					<Field label="Sted">{event.location.name}</Field>
				</dl>
				<AttendanceBars event={event} />
			</div>
			<div className="grid content-center gap-3 border-t border-dashed border-board-subtle/60 bg-board p-6 text-board-foreground md:w-72 md:border-t-0 md:border-l md:p-7">
				<div className="flex flex-wrap items-baseline gap-x-3 md:grid">
					<p className="text-[11px] font-semibold tracking-[0.1em] text-board-subtle uppercase">
						Starter om
					</p>
					<p className="text-4xl font-bold tracking-tight text-signal">
						{countdown(event.start, now)}
					</p>
				</div>
				{event.signupDeadline && !closed && (
					<p className="text-sm text-board-muted">
						Påmeldingsfrist {dayLong.format(new Date(event.signupDeadline))}{" "}
						{formatTime(event.signupDeadline)}
					</p>
				)}
				{answer && !closed ? (
					<AnswerButtons
						tone="board"
						eventId={event.id}
						myStatus={answer === "ubesvart" ? undefined : answer}
						myReason={myId ? event.absenceReasons[myId] : undefined}
						className="md:grid-cols-1"
					/>
				) : (
					<p className="text-sm text-board-muted">Påmeldingen er stengt.</p>
				)}
			</div>
		</article>
	);
}
