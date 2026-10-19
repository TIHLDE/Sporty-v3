import { formatEventRange } from "@sporty/api/rest/lib/dates";
import type { Event, GroupDetails } from "@sporty/api/rest/types";
import { Badge } from "@sporty/ui/components/badge";
import { Button } from "@sporty/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@sporty/ui/components/dialog";
import { Input } from "@sporty/ui/components/input";
import { Label } from "@sporty/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	ClockIcon,
	GavelIcon,
	MapPinIcon,
	PencilIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AnswerButtons } from "@/components/event-card";
import { PageState } from "@/components/page-state";
import { answeringClosed, EVENT_TYPE_LABEL, summarize } from "@/lib/events";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/arrangementer/$eventId/")({
	component: EventComponent,
});

function EventComponent() {
	const { eventId } = Route.useParams();
	const trpc = useTRPC();
	const event = useQuery(trpc.events.get.queryOptions({ eventId }));

	return (
		<PageState query={event}>{(data) => <EventView event={data} />}</PageState>
	);
}

function EventView({ event }: { event: Event }) {
	const trpc = useTRPC();
	const me = useQuery(trpc.me.queryOptions());
	const group = useQuery(
		trpc.groups.get.queryOptions({ groupId: event.groupId }),
	);
	const myId = me.data?.id;
	const { kommer, kommerIkke, ubesvart } = summarize(event);
	const [now] = useState(() => Date.now());
	const isMember = Boolean(myId && event.memberIds.includes(myId));
	const isPast = new Date(event.end ?? event.start).getTime() < now;
	const closed = answeringClosed(event, new Date(now));
	const canAnswer = isMember && !closed;
	const started = new Date(event.start).getTime() <= now;
	const mapUrl = `https://www.openstreetmap.org/?mlat=${event.location.latitude}&mlon=${event.location.longitude}#map=16/${event.location.latitude}/${event.location.longitude}`;

	return (
		<div className="grid grid-cols-1 gap-6">
			<Link
				to="/grupper/$groupId"
				params={{ groupId: event.groupId }}
				className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ArrowLeftIcon className="size-4" />
				{event.groupName}
			</Link>

			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="grid gap-2">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-2xl font-semibold">
							{event.title}
							{event.opponent ? ` mot ${event.opponent}` : ""}
						</h1>
						<Badge variant="outline">{EVENT_TYPE_LABEL[event.type]}</Badge>
					</div>
					<p className="flex items-center gap-1.5 text-muted-foreground">
						<ClockIcon className="size-4" />
						{formatEventRange(event.start, event.end)}
					</p>
					<a
						href={mapUrl}
						target="_blank"
						rel="noreferrer"
						className="flex w-fit items-center gap-1.5 text-muted-foreground hover:text-foreground hover:underline"
					>
						<MapPinIcon className="size-4" />
						{event.location.name}
					</a>
					{event.signupDeadline && (
						<p className="text-sm text-muted-foreground">
							Svarfrist {formatEventRange(event.signupDeadline, null)}
						</p>
					)}
				</div>
				<div className="flex flex-col items-end gap-2">
					{event.canManage && !isPast && (
						<Button
							variant="outline"
							nativeButton={false}
							render={
								<Link
									to="/arrangementer/$eventId/rediger"
									params={{ eventId: event.id }}
								/>
							}
						>
							<PencilIcon />
							Rediger
						</Button>
					)}
					{canAnswer && (
						<AnswerButtons
							eventId={event.id}
							myStatus={myId ? event.attendance[myId] : undefined}
						/>
					)}
				</div>
			</div>

			{isMember && !isPast && closed && event.signupDeadline && (
				<p className="text-sm text-muted-foreground">
					Påmeldingsfristen har gått ut. Ta kontakt med sub-/admin hvis du må
					endre svaret.
				</p>
			)}

			{event.type === "kamp" && started && <MatchResult event={event} />}
			{event.description && (
				<p className="whitespace-pre-wrap">{event.description}</p>
			)}

			<div className="grid gap-4 sm:grid-cols-3">
				<Participants title="Kommer" ids={kommer} group={group.data} />
				<Participants title="Kommer ikke" ids={kommerIkke} group={group.data} />
				<Participants title="Ikke svart" ids={ubesvart} group={group.data} />
			</div>

			{event.canGiveFines &&
				closed &&
				ubesvart.length > 0 &&
				!event.collectiveFineGiven && (
					<CollectiveFineButton eventId={event.id} count={ubesvart.length} />
				)}
		</div>
	);
}

function Participants({
	title,
	ids,
	group,
}: {
	title: string;
	ids: string[];
	group: GroupDetails | undefined;
}) {
	const names = new Map(
		group?.members.map((m) => [m.user.id, m.user.name]) ?? [],
	);
	const sorted = ids
		.map((id) => names.get(id) ?? "Ukjent")
		.sort((a, b) => a.localeCompare(b));

	return (
		<section className="rounded-xl border p-4">
			<h2 className="mb-2 font-medium">
				{title} <span className="text-muted-foreground">({ids.length})</span>
			</h2>
			{sorted.length === 0 ? (
				<p className="text-sm text-muted-foreground">Ingen</p>
			) : (
				<ul className="grid gap-1 text-sm">
					{sorted.map((name, index) => (
						<li key={`${name}-${index}`}>{name}</li>
					))}
				</ul>
			)}
		</section>
	);
}

/** Resultatet på en kamp som har startet. Sub-/admin kan registrere, endre eller fjerne det. */
function MatchResult({ event }: { event: Event }) {
	const [editing, setEditing] = useState(false);
	const hasResult = event.ourScore !== null && event.theirScore !== null;
	if (!hasResult && !event.canManage) return null;

	const outcome = !hasResult
		? null
		: event.ourScore! > event.theirScore!
			? { label: "Seier", className: "text-green-600" }
			: event.ourScore! < event.theirScore!
				? { label: "Tap", className: "text-red-600" }
				: { label: "Uavgjort", className: "text-muted-foreground" };

	return (
		<div className="flex items-center gap-4 rounded-xl border p-4">
			<div className="flex-1">
				<p className="text-sm text-muted-foreground">Resultat</p>
				{hasResult ? (
					<p className="flex items-baseline gap-3">
						<span className="text-3xl font-bold">
							{event.ourScore} – {event.theirScore}
						</span>
						<span className={`font-semibold ${outcome!.className}`}>
							{outcome!.label}
						</span>
					</p>
				) : (
					<p className="font-medium">Ikke registrert</p>
				)}
			</div>
			{event.canManage && (
				<Button variant="outline" onClick={() => setEditing(true)}>
					{hasResult ? "Endre" : "Registrer"}
				</Button>
			)}
			{editing && (
				<ResultDialog event={event} onClose={() => setEditing(false)} />
			)}
		</div>
	);
}

const parseScore = (text: string) =>
	/^\d{1,2}$/.test(text) ? Number(text) : null;

function ResultDialog({
	event,
	onClose,
}: {
	event: Event;
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [ours, setOurs] = useState(event.ourScore?.toString() ?? "");
	const [theirs, setTheirs] = useState(event.theirScore?.toString() ?? "");
	const ourScore = parseScore(ours);
	const theirScore = parseScore(theirs);

	const setResult = useMutation(
		trpc.events.setResult.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.events.pathKey() });
				onClose();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const save = (score: {
		ourScore: number | null;
		theirScore: number | null;
	}) => setResult.mutate({ eventId: event.id, ...score });

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>Resultat</DialogTitle>
					<DialogDescription>
						{event.groupName}
						{event.opponent ? ` mot ${event.opponent}` : ""}
					</DialogDescription>
				</DialogHeader>
				<div className="flex items-end gap-3">
					<ScoreField
						id="score-ours"
						label={event.groupName}
						value={ours}
						onChange={setOurs}
					/>
					<span className="pb-2 text-2xl font-bold">–</span>
					<ScoreField
						id="score-theirs"
						label={event.opponent ?? "Motstander"}
						value={theirs}
						onChange={setTheirs}
					/>
				</div>
				<DialogFooter>
					{event.ourScore !== null && (
						<Button
							variant="ghost"
							className="text-destructive"
							disabled={setResult.isPending}
							onClick={() => save({ ourScore: null, theirScore: null })}
						>
							Fjern resultat
						</Button>
					)}
					<Button
						disabled={
							ourScore === null || theirScore === null || setResult.isPending
						}
						onClick={() => save({ ourScore, theirScore })}
					>
						Lagre resultat
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ScoreField({
	id,
	label,
	value,
	onChange,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className="grid flex-1 gap-2">
			<Label htmlFor={id} className="justify-center truncate">
				{label}
			</Label>
			<Input
				id={id}
				inputMode="numeric"
				className="h-12 text-center text-2xl font-bold"
				value={value}
				placeholder="0"
				onChange={(e) =>
					onChange(e.target.value.replace(/\D/g, "").slice(0, 2))
				}
			/>
		</div>
	);
}

/** (Sub-/admin) Én bot til alle som ikke har svart. Kan bare gis én gang. */
function CollectiveFineButton({
	eventId,
	count,
}: {
	eventId: string;
	count: number;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const collectiveFine = useMutation(
		trpc.events.collectiveFine.mutationOptions({
			onSuccess: ({ count: given }) => {
				queryClient.invalidateQueries({ queryKey: trpc.events.pathKey() });
				queryClient.invalidateQueries({ queryKey: trpc.fines.pathKey() });
				toast.success(
					`Fellesbot gitt: ${given} ${given === 1 ? "medlem" : "medlemmer"} fikk 1 bot.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Button
			variant="outline"
			className="justify-self-start border-destructive text-destructive"
			disabled={collectiveFine.isPending}
			onClick={() =>
				window.confirm(
					`Gi fellesbot? ${count} medlemmer som ikke har svart får 1 bot hver.`,
				) && collectiveFine.mutate({ eventId })
			}
		>
			<GavelIcon />
			Gi fellesbot ({count})
		</Button>
	);
}
