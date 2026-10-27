import type {
	CreateEventInput,
	Event,
	EventType,
	Place,
} from "@sporty/api/rest/types";
import { Button } from "@sporty/ui/components/button";
import { Input } from "@sporty/ui/components/input";
import { Label } from "@sporty/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@sporty/ui/components/select";
import { Textarea } from "@sporty/ui/components/textarea";
import { useQuery } from "@tanstack/react-query";
import { MapPinIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { CheckboxField } from "@/components/checkbox-field";
import { toLocalInput } from "@/lib/datetime";
import { EVENT_TYPE_LABEL, placeDetail } from "@/lib/events";
import { useTRPC } from "@/utils/trpc";

const TYPES = Object.keys(EVENT_TYPE_LABEL) as EventType[];
const HOUR = 60 * 60 * 1000;

const toIso = (value: string) => new Date(value).toISOString();

/** I morgen kl. 18:00, en fornuftig standard for treninger. */
function defaultStart() {
	const date = new Date();
	date.setDate(date.getDate() + 1);
	date.setHours(18, 0, 0, 0);
	return date;
}

/**
 * Skjemaet for et arrangement, både for å lage nye og redigere. `groupId` er gruppen stedene
 * foreslås fra.
 */
export function EventForm({
	groupId,
	editing,
	busy,
	submitLabel,
	onSubmit,
	extra,
}: {
	groupId: string;
	editing?: Event;
	busy: boolean;
	submitLabel: string;
	onSubmit: (event: CreateEventInput) => void;
	/** Vises øverst i skjemaet, f.eks. valg av gruppe. */
	extra?: ReactNode;
}) {
	const [title, setTitle] = useState(editing?.title ?? "");
	const [type, setType] = useState<EventType>(editing?.type ?? "trening");
	const [opponent, setOpponent] = useState(editing?.opponent ?? "");
	const [start, setStart] = useState(() =>
		toLocalInput(editing ? new Date(editing.start) : defaultStart()),
	);
	const [end, setEnd] = useState(
		editing?.end ? toLocalInput(new Date(editing.end)) : "",
	);
	const [deadline, setDeadline] = useState(
		editing?.signupDeadline
			? toLocalInput(new Date(editing.signupDeadline))
			: "",
	);
	const [place, setPlace] = useState<Place | null>(
		editing ? { ...editing.location, id: null } : null,
	);
	const [description, setDescription] = useState(editing?.description ?? "");
	const [limitAttendees, setLimitAttendees] = useState(
		Boolean(editing?.maxAttendees),
	);
	const [maxAttendees, setMaxAttendees] = useState(
		String(editing?.maxAttendees ?? 20),
	);

	const endError =
		end && start && end <= start ? "Sluttid må være etter starttid" : null;
	const deadlineError =
		deadline && start && deadline > start
			? "Fristen må være før arrangementet starter"
			: null;
	const maxAttendeesError =
		limitAttendees &&
		!(Number.isInteger(Number(maxAttendees)) && Number(maxAttendees) > 0)
			? "Skriv et helt tall over 0"
			: null;
	const valid = Boolean(
		title.trim() &&
		start &&
		place &&
		!endError &&
		!deadlineError &&
		!maxAttendeesError,
	);

	/** Flytt sluttiden med, så varigheten beholdes. */
	const changeStart = (value: string) => {
		if (end && start && value) {
			const duration = new Date(end).getTime() - new Date(start).getTime();
			setEnd(toLocalInput(new Date(new Date(value).getTime() + duration)));
		}
		setStart(value);
	};

	const submit = () => {
		if (!valid || !place) return;
		onSubmit({
			title: title.trim(),
			type,
			opponent: type === "kamp" && opponent.trim() ? opponent.trim() : null,
			start: toIso(start),
			end: end ? toIso(end) : null,
			signupDeadline: deadline ? toIso(deadline) : null,
			maxAttendees: limitAttendees ? Number(maxAttendees) : null,
			location: {
				name: place.name,
				address: place.address,
				latitude: place.latitude,
				longitude: place.longitude,
			},
			description: description.trim(),
		});
	};

	return (
		<form
			className="grid gap-5"
			onSubmit={(e) => {
				e.preventDefault();
				submit();
			}}
		>
			{extra}

			<Field label="Arrangementets navn" htmlFor="event-title">
				<Input
					id="event-title"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="F.eks. Trening eller Kamp mot NTNUI"
				/>
			</Field>

			<div className="grid gap-5 sm:grid-cols-2">
				<Field label="Type arrangement">
					<Select
						value={type}
						onValueChange={(value) => value && setType(value as EventType)}
					>
						<SelectTrigger className="w-full" aria-label="Type arrangement">
							<SelectValue>{EVENT_TYPE_LABEL[type]}</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{TYPES.map((value) => (
								<SelectItem key={value} value={value}>
									{EVENT_TYPE_LABEL[value]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
				{type === "kamp" && (
					<Field label="Motstander (valgfritt)" htmlFor="event-opponent">
						<Input
							id="event-opponent"
							value={opponent}
							maxLength={80}
							onChange={(e) => setOpponent(e.target.value)}
							placeholder="F.eks. NTNUI"
						/>
					</Field>
				)}
			</div>

			<Field label="Starttid" htmlFor="event-start">
				<Input
					id="event-start"
					type="datetime-local"
					value={start}
					onChange={(e) => changeStart(e.target.value)}
				/>
			</Field>

			<OptionalField
				label="Sluttid"
				enabled={Boolean(end)}
				onToggle={(on) =>
					setEnd(
						on && start
							? toLocalInput(new Date(new Date(start).getTime() + 1.5 * HOUR))
							: "",
					)
				}
				error={endError}
			>
				<Input
					aria-label="Velg sluttid"
					type="datetime-local"
					value={end}
					min={start}
					onChange={(e) => setEnd(e.target.value)}
				/>
			</OptionalField>

			<Field label="Sted">
				<PlacePicker groupId={groupId} value={place} onChange={setPlace} />
			</Field>

			<Field label="Notat (valgfritt)" htmlFor="event-description">
				<Textarea
					id="event-description"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Ekstra informasjon, f.eks. hva man skal ta med"
				/>
			</Field>

			<OptionalField
				label="Påmeldingsfrist"
				enabled={Boolean(deadline)}
				onToggle={(on) =>
					setDeadline(
						on && start
							? toLocalInput(new Date(new Date(start).getTime() - 24 * HOUR))
							: "",
					)
				}
				error={deadlineError}
			>
				<Input
					aria-label="Velg påmeldingsfrist"
					type="datetime-local"
					value={deadline}
					max={start}
					onChange={(e) => setDeadline(e.target.value)}
				/>
			</OptionalField>

			<OptionalField
				label="Maks antall deltakere"
				enabled={limitAttendees}
				onToggle={setLimitAttendees}
				error={maxAttendeesError}
			>
				<Input
					aria-label="Maks antall deltakere"
					type="number"
					inputMode="numeric"
					min={1}
					step={1}
					value={maxAttendees}
					onChange={(e) => setMaxAttendees(e.target.value)}
				/>
				<p className="text-sm text-muted-foreground">
					Når så mange har svart «Kommer», kan ingen flere melde seg på.
				</p>
			</OptionalField>

			<Button type="submit" size="lg" disabled={!valid || busy}>
				{busy ? "Lagrer…" : submitLabel}
			</Button>
		</form>
	);
}

function Field({
	label,
	htmlFor,
	children,
}: {
	label: string;
	htmlFor?: string;
	children: ReactNode;
}) {
	return (
		<div className="grid gap-2">
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
		</div>
	);
}

/** Valgfritt felt som skrus av og på, f.eks. sluttid og påmeldingsfrist. */
function OptionalField({
	label,
	enabled,
	onToggle,
	error,
	children,
}: {
	label: string;
	enabled: boolean;
	onToggle: (enabled: boolean) => void;
	error: string | null;
	children: ReactNode;
}) {
	return (
		<div className="grid gap-2">
			<CheckboxField checked={enabled} onCheckedChange={onToggle}>
				{label}
			</CheckboxField>
			{enabled && children}
			{error && <p className="text-sm text-destructive">{error}</p>}
		</div>
	);
}

/** Velg sted: tidligere brukte steder i gruppen, eller søk i OpenStreetMap. */
function PlacePicker({
	groupId,
	value,
	onChange,
}: {
	groupId: string;
	value: Place | null;
	onChange: (place: Place | null) => void;
}) {
	const trpc = useTRPC();
	const [text, setText] = useState("");
	const [q, setQ] = useState("");
	// Vent til man har sluttet å skrive: OpenStreetMap tillater bare ett søk i sekundet.
	useEffect(() => {
		const timer = setTimeout(() => setQ(text.trim()), 500);
		return () => clearTimeout(timer);
	}, [text]);

	const recent = useQuery(trpc.places.recent.queryOptions({ groupId }));
	const search = useQuery({
		...trpc.places.search.queryOptions({ q }),
		enabled: q.length >= 3,
	});
	const options =
		q.length >= 3 ? (search.data ?? []) : (recent.data ?? []).slice(0, 5);

	if (value) {
		return (
			<div className="flex items-center gap-3 rounded-md border p-3">
				<MapPinIcon className="size-4 text-muted-foreground" />
				<div className="min-w-0 flex-1">
					<p className="font-medium">{value.name}</p>
					{placeDetail(value) && (
						<p className="truncate text-sm text-muted-foreground">
							{placeDetail(value)}
						</p>
					)}
				</div>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={() => onChange(null)}
				>
					Endre
				</Button>
			</div>
		);
	}

	return (
		<div className="grid gap-2">
			<Input
				aria-label="Søk etter sted"
				value={text}
				onChange={(e) => setText(e.target.value)}
				placeholder="Søk etter sted, f.eks. Dragvoll idrettssenter"
			/>
			{q.length >= 3 && search.isFetching && (
				<p className="text-sm text-muted-foreground">Søker…</p>
			)}
			{options.length > 0 && (
				<div className="divide-y rounded-md border">
					{q.length < 3 && (
						<p className="px-3 py-2 text-xs text-muted-foreground">Brukt før</p>
					)}
					{options.map((place) => (
						<button
							key={`${place.name}-${place.latitude}-${place.longitude}`}
							type="button"
							onClick={() => onChange(place)}
							className="block w-full px-3 py-2 text-left hover:bg-muted"
						>
							<span className="font-medium">{place.name}</span>
							{placeDetail(place) && (
								<span className="block truncate text-sm text-muted-foreground">
									{placeDetail(place)}
								</span>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
