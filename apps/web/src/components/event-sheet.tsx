import { Accordion } from "@animate-ui/react/primitives/base-ui/accordion";
import { formatRelative, formatTime } from "@sporty/api/rest/lib/dates";
import type { Event } from "@sporty/api/rest/types";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
} from "@sporty/ui/components/sheet";
import { useIsMobile } from "@sporty/ui/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDownIcon, PencilIcon } from "lucide-react";
import type { ReactNode } from "react";

import { AnswerButtons } from "@/components/answer-buttons";
import {
	CollectiveFineButton,
	canGiveCollectiveFine,
} from "@/components/collective-fine-button";
import {
	AttendanceBars,
	eventTitle,
	formatDayShort,
	myAnswer,
} from "@/components/event-board";
import { GroupBadge } from "@/components/group-badge";
import { UserAvatar } from "@/components/user-avatar";
import {
	answeringClosed,
	EVENT_TYPE_LABEL,
	locationLabel,
	summarize,
} from "@/lib/events";
import { useTRPC } from "@/utils/trpc";

export function Field({
	label,
	children,
	className,
}: {
	label: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={className}>
			<dt className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
				{label}
			</dt>
			<dd className="font-bold">{children}</dd>
		</div>
	);
}

/**
 * Arrangementet du trykket på i tavla: fra høyre på store skjermer, nedenfra på mobil.
 * Viser tid, sted, svaret ditt og hvem som kommer.
 */
export function EventSheet({
	event,
	onClose,
}: {
	event: Event | null;
	onClose: () => void;
}) {
	const isMobile = useIsMobile();
	return (
		<Sheet open={event !== null} onOpenChange={(open) => !open && onClose()}>
			<SheetContent
				side={isMobile ? "bottom" : "right"}
				className="gap-0 overflow-y-auto bg-background p-0 data-[side=bottom]:max-h-[88svh] data-[side=bottom]:rounded-t-2xl data-[side=right]:w-full data-[side=right]:sm:max-w-md"
			>
				{event && <EventDetails event={event} />}
			</SheetContent>
		</Sheet>
	);
}

function EventDetails({ event }: { event: Event }) {
	const trpc = useTRPC();
	const me = useQuery(trpc.me.queryOptions());
	const myId = me.data?.id;
	const answer = myAnswer(event, myId);
	const closed = answeringClosed(event);
	const { ubesvart } = summarize(event);

	return (
		<div className="grid gap-4 p-5 pt-14 sm:p-6 sm:pt-14">
			<div className="overflow-hidden rounded-2xl border bg-card">
				<div className="grid gap-1.5 p-5 pb-4">
					<p className="flex items-center gap-2 text-sm text-muted-foreground">
						<GroupBadge
							group={{ name: event.groupName, color: event.groupColor }}
						/>
						{event.groupName} · {EVENT_TYPE_LABEL[event.type]}
					</p>
					<SheetTitle className="text-2xl font-bold">
						{eventTitle(event)}
					</SheetTitle>
					<SheetDescription className="sr-only">
						Tidspunkt, sted og svaret ditt
					</SheetDescription>
				</div>
				<dl className="grid grid-cols-3 gap-x-4 gap-y-4 px-5 pb-5 [&_dd]:text-xl">
					{event.meetupAt && (
						<Field label="Oppmøte">{formatTime(event.meetupAt)}</Field>
					)}
					<Field label="Start">{formatTime(event.start)}</Field>
					{event.end && <Field label="Slutt">{formatTime(event.end)}</Field>}
					<Field
						label="Dato"
						className="col-span-3 sm:col-span-1 [&_dd]:text-base"
					>
						{formatDayShort(event.start)}
					</Field>
					{event.signupDeadline && (
						<Field
							label="Påmeldingsfrist"
							className="col-span-3 sm:col-span-2 [&_dd]:text-base"
						>
							{formatDayShort(event.signupDeadline)}{" "}
							{formatTime(event.signupDeadline)}
						</Field>
					)}
					<Field label="Sted" className="col-span-3 [&_dd]:text-base">
						{locationLabel(event.location)}
					</Field>
				</dl>
				<div className="grid gap-4 border-t border-dashed border-input p-5">
					{answer && !closed && (
						<div className="grid gap-2">
							<p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
								Ditt svar
							</p>
							<AnswerButtons
								eventId={event.id}
								myStatus={answer === "ubesvart" ? undefined : answer}
								myReason={myId ? event.absenceReasons[myId] : undefined}
							/>
						</div>
					)}
					{answer && closed && (
						<p className="text-sm text-muted-foreground">
							Påmeldingen er stengt.{" "}
							{answer === "ubesvart"
								? "Du svarte ikke."
								: answer === "kommer"
									? "Du kommer."
									: "Du kommer ikke."}
						</p>
					)}
					<div className="grid gap-2">
						<p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
							Hvem kommer
						</p>
						<AttendanceBars event={event} />
					</div>
					<AttendanceLists event={event} />
					{canGiveCollectiveFine(event, ubesvart.length) && (
						<CollectiveFineButton eventId={event.id} count={ubesvart.length} />
					)}
				</div>
			</div>
			{event.canManage && (
				<Link
					to="/arrangementer/$eventId/rediger"
					params={{ eventId: event.id }}
					className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold hover:underline"
				>
					<PencilIcon className="size-4" />
					Rediger arrangementet
				</Link>
			)}
		</div>
	);
}

/**
 * Navnene bak strekene, i tre trekkspill: Kommer, Kommer ikke (med begrunnelse) og Ikke svart
 * (sub-/admin ser også om personen har åpnet arrangementet).
 */
function AttendanceLists({ event }: { event: Event }) {
	const trpc = useTRPC();
	const group = useQuery(
		trpc.groups.get.queryOptions({ groupId: event.groupId }),
	);
	const users = new Map(
		group.data?.members.map((m) => [m.user.id, m.user]) ?? [],
	);
	const { kommer, kommerIkke, ubesvart } = summarize(event);
	const seen = (id: string) => {
		const at = event.seenAt[id];
		return at ? `Sett ${formatRelative(at)}` : "Ikke sett";
	};
	const lists = [
		{ key: "kommer", title: "Kommer", ids: kommer, note: () => undefined },
		{
			key: "kommer-ikke",
			title: "Kommer ikke",
			ids: kommerIkke,
			note: (id: string) => event.absenceReasons[id],
		},
		{
			key: "ikke-svart",
			title: "Ikke svart",
			ids: ubesvart,
			note: (id: string) => (event.canManage ? seen(id) : undefined),
		},
	];

	return (
		<Accordion.Root multiple className="-mx-1 grid">
			{lists.map((list) => {
				const people = list.ids
					.map((id) => ({
						id,
						name: users.get(id)?.name ?? "Ukjent",
						imageUrl: users.get(id)?.imageUrl ?? null,
						note: list.note(id),
					}))
					.sort((a, b) => a.name.localeCompare(b.name, "nb"));
				return (
					<Accordion.Item
						key={list.key}
						value={list.key}
						className="border-b border-border last:border-b-0"
					>
						<Accordion.Header>
							<Accordion.Trigger className="group flex w-full items-center gap-2 rounded-md px-1 py-3 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
								{list.title}
								<span className="font-normal text-muted-foreground">
									{list.ids.length}
								</span>
								<ChevronDownIcon className="ml-auto size-4 text-muted-foreground transition-transform duration-300 group-data-[panel-open]:rotate-180" />
							</Accordion.Trigger>
						</Accordion.Header>
						<Accordion.Panel>
							{people.length === 0 ? (
								<p className="px-1 pb-3 text-sm text-muted-foreground">Ingen</p>
							) : (
								<ul className="grid gap-2.5 px-1 pb-4">
									{people.map((person) => (
										<li key={person.id} className="flex items-center gap-3">
											<UserAvatar
												user={{
													id: person.id,
													name: person.name,
													imageUrl: person.imageUrl,
												}}
												className="size-7 text-xs"
											/>
											<span className="grid min-w-0 leading-tight">
												<span className="truncate text-sm font-medium">
													{person.name}
												</span>
												{person.note && (
													<span className="truncate text-xs text-muted-foreground">
														{person.note}
													</span>
												)}
											</span>
										</li>
									))}
								</ul>
							)}
						</Accordion.Panel>
					</Accordion.Item>
				);
			})}
		</Accordion.Root>
	);
}
