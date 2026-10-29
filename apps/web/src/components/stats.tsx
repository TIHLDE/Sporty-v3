import { formatDateLong } from "@sporty/api/rest/lib/dates";
import type {
	AdminStats,
	GroupDetails,
	GroupStats,
	MatchResult,
	MyStats,
	StatsPerson,
	TeamStats,
} from "@sporty/api/rest/types";
import { Button } from "@sporty/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@sporty/ui/components/dialog";
import { Input } from "@sporty/ui/components/input";
import { cn } from "@sporty/ui/lib/utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, LockIcon } from "lucide-react";
import { type ReactNode, createContext, useContext, useState } from "react";

import { PageState } from "@/components/page-state";
import { UserAvatar } from "@/components/user-avatar";
import { useTRPC } from "@/utils/trpc";

type StatsView = "meg" | "laget" | "admin";

/** Gruppens farge, brukt i stedet for hovedfargen i hele fanen. */
const AccentContext = createContext<string>("#3768e8");
const useAccent = () => useContext(AccentContext);

const WEEKDAYS = [
	"mandag",
	"tirsdag",
	"onsdag",
	"torsdag",
	"fredag",
	"lørdag",
	"søndag",
];
const monthFormat = new Intl.DateTimeFormat("nb-NO", { month: "short" });
const percent = (rate: number | null) =>
	rate === null ? "–" : `${Math.round(rate * 100)} %`;
const monthLabel = (month: string) =>
	monthFormat.format(new Date(`${month}-15T12:00:00`)).replace(".", "");
const duration = (hours: number | null) =>
	hours === null
		? "–"
		: hours >= 24
			? `${(hours / 24).toFixed(1).replace(".", ",")} d`
			: `${Math.round(hours)} t`;

/**
 * Statistikk for gruppen: «Meg», «Laget» og (for sub-/admin) «Admin», per semester eller for alle
 * år. Oppmøte er påmelding («Kommer») på arrangementer som har vært. Samme som i appen.
 */
export function StatsTab({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const [period, setPeriod] = useState<string | null>(null);
	const [view, setView] = useState<StatsView | null>(null);
	const stats = useQuery({
		...trpc.groups.stats.queryOptions({ groupId: group.id, period }),
		placeholderData: keepPreviousData,
	});

	return (
		<AccentContext.Provider value={group.color}>
			<PageState query={stats}>
				{(data) => {
					const views: { value: StatsView; label: string }[] = [
						...(data.me ? [{ value: "meg" as const, label: "Meg" }] : []),
						{ value: "laget", label: "Laget" },
						...(data.admin
							? [{ value: "admin" as const, label: "Admin" }]
							: []),
					];
					const shown = views.some((v) => v.value === view)
						? view!
						: views[0].value;
					return (
						<div
							className={cn(
								"grid gap-4",
								stats.isPlaceholderData && "opacity-60",
							)}
						>
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div
									className="flex gap-1 rounded-full bg-muted p-1"
									role="tablist"
								>
									{views.map((v) => (
										<button
											key={v.value}
											type="button"
											role="tab"
											aria-selected={v.value === shown}
											onClick={() => setView(v.value)}
											className={cn(
												"rounded-full px-4 py-1.5 text-sm",
												v.value === shown
													? "bg-background font-semibold shadow-sm"
													: "text-muted-foreground",
											)}
										>
											{v.label}
										</button>
									))}
								</div>
								<div className="flex flex-wrap gap-2">
									{data.periods.map((p) => (
										<Button
											key={p.id}
											size="sm"
											variant="outline"
											className="rounded-full"
											style={
												p.id === data.period.id
													? {
															backgroundColor: group.color,
															borderColor: group.color,
															color: "#ffffff",
														}
													: undefined
											}
											onClick={() => setPeriod(p.id)}
										>
											{p.label}
										</Button>
									))}
								</div>
							</div>
							{data.team.events.total === 0 ? (
								<p className="text-sm text-muted-foreground">
									Ingen arrangementer som har vært i {data.period.label}.
								</p>
							) : shown === "meg" && data.me ? (
								<MeView stats={data} me={data.me} />
							) : shown === "admin" && data.admin ? (
								<AdminView admin={data.admin} />
							) : (
								<TeamView team={data.team} period={data.period.label} />
							)}
						</div>
					);
				}}
			</PageState>
		</AccentContext.Provider>
	);
}

function MeView({ stats, me }: { stats: GroupStats; me: MyStats }) {
	const accent = useAccent();
	const rate =
		me.attendance.total > 0 ? me.attendance.count / me.attendance.total : null;
	const highest = Math.max(
		...me.monthly.map((m) => (m.total ? m.count / m.total : 0)),
		0.01,
	);
	const favorite = me.favoriteWeekday;

	return (
		<div className="grid gap-3 md:grid-cols-2">
			<Card>
				<p className="text-sm font-medium text-muted-foreground">Oppmøte</p>
				<p className="flex items-baseline gap-2.5">
					<span className="text-5xl font-extrabold">{percent(rate)}</span>
					<span className="text-sm">
						{me.attendance.count} av {me.attendance.total} arrangementer
					</span>
				</p>
				<Progress value={rate ?? 0} />
				<p className="text-xs text-muted-foreground">
					Lagets snitt: {percent(stats.team.attendanceRate)}
					{me.rank ? ` · nr. ${me.rank} på laget` : ""}
				</p>
			</Card>
			<div className="grid grid-cols-3 gap-3">
				<Tile
					label="Treninger"
					value={me.trainings.count}
					total={me.trainings.total}
				/>
				<Tile
					label="Kamper"
					value={me.matches.count}
					total={me.matches.total}
				/>
				<Tile label="Mål" value={me.goals} />
				<Tile label="Bøter" value={me.fines} />
				<Tile
					label="Avbud"
					value={me.absences.count}
					detail={
						me.absences.count
							? `${me.absences.withReason} med begrunnelse`
							: undefined
					}
				/>
				<Tile
					label="Favorittdag"
					text={favorite ? WEEKDAYS[favorite.weekday] : "–"}
					detail={
						favorite ? `${favorite.count} av ${favorite.total}` : undefined
					}
				/>
			</div>
			{me.monthly.length > 1 && (
				<Card className="md:col-span-2">
					<p className="font-semibold">Oppmøte per måned</p>
					<div
						role="img"
						aria-label={me.monthly
							.map(
								(m) =>
									`${monthLabel(m.month)} ${percent(m.total ? m.count / m.total : null)}`,
							)
							.join(", ")}
						className="flex h-36 items-end gap-3 border-b"
					>
						{me.monthly.map((m) => {
							const value = m.total ? m.count / m.total : 0;
							return (
								<div
									key={m.month}
									className="flex h-full flex-1 flex-col items-center justify-end gap-1"
								>
									<span className="text-xs">{percent(value)}</span>
									<div
										className="w-full max-w-12 rounded-t"
										style={{
											height: `${Math.max((value / highest) * 75, 2)}%`,
											backgroundColor: accent,
										}}
									/>
								</div>
							);
						})}
					</div>
					<div className="flex gap-3">
						{me.monthly.map((m) => (
							<span
								key={m.month}
								className="flex-1 text-center text-xs text-muted-foreground"
							>
								{monthLabel(m.month)}
							</span>
						))}
					</div>
				</Card>
			)}
		</div>
	);
}

function TeamView({ team, period }: { team: TeamStats; period: string }) {
	const change =
		team.attendanceRate !== null && team.previousAttendanceRate !== null
			? Math.round((team.attendanceRate - team.previousAttendanceRate) * 100)
			: null;
	const { matches } = team;
	const hasMatches = matches.wins + matches.draws + matches.losses > 0;

	return (
		<div className="grid gap-3 md:grid-cols-2">
			<div className="grid grid-cols-2 gap-3">
				<Tile
					label="Snitt oppmøte"
					text={percent(team.attendanceRate)}
					detail={
						change === null
							? undefined
							: change === 0
								? "Som semesteret før"
								: `${change > 0 ? "↑" : "↓"} ${Math.abs(change)} % fra semesteret før`
					}
				/>
				<Tile
					label="Arrangementer"
					value={team.events.total}
					detail={`${team.events.trening} treninger · ${team.events.kamp} kamper`}
				/>
			</div>
			{hasMatches && (
				<Card>
					<div className="flex items-center justify-between">
						<p className="font-semibold">Kamper</p>
						<div className="flex items-center gap-1">
							<span className="text-sm text-muted-foreground">
								Mål {matches.goalsFor}–{matches.goalsAgainst}
							</span>
							<MatchesDialog matches={matches} period={period} />
						</div>
					</div>
					<div className="grid grid-cols-3 text-center">
						{(
							[
								["Seier", matches.wins],
								["Uavgjort", matches.draws],
								["Tap", matches.losses],
							] as const
						).map(([label, value]) => (
							<div key={label}>
								<p className="text-2xl font-extrabold">{value}</p>
								<p className="text-xs text-muted-foreground">{label}</p>
							</div>
						))}
					</div>
					<div
						className="flex items-center gap-1.5"
						role="img"
						aria-label={`Form siste kamper: ${matches.form.join(", ")}`}
					>
						<span className="mr-1 text-xs text-muted-foreground">Form</span>
						{matches.form.map((result, index) => (
							<ResultBadge key={index} result={result} />
						))}
					</div>
				</Card>
			)}
			{team.scorers.length > 0 && (
				<PeopleCard
					title="Toppscorere"
					people={team.scorers}
					unit="mål"
					period={period}
				/>
			)}
			{team.trainings.some((p) => p.value > 0) && (
				<PeopleCard
					title="Flest treninger"
					people={team.trainings}
					period={period}
				>
					{team.bestSlot && (
						<p className="pt-1 text-xs text-muted-foreground">
							Best oppmøte i {period.toLowerCase()}:{" "}
							{WEEKDAYS[team.bestSlot.weekday]}er kl.{" "}
							{String(team.bestSlot.hour).padStart(2, "0")}:00 (
							{percent(team.bestSlot.rate)})
						</p>
					)}
				</PeopleCard>
			)}
		</div>
	);
}

function AdminView({ admin }: { admin: AdminStats }) {
	const { payments } = admin;
	return (
		<div className="grid gap-3">
			<p className="flex items-center gap-1.5 justify-self-end text-xs text-muted-foreground">
				<LockIcon className="size-3.5" />
				Bare sub-/admin
			</p>
			<div className="grid gap-3 md:grid-cols-2">
				<Card>
					<p className="font-semibold">Svar-disiplin</p>
					<div className="grid grid-cols-2 gap-3">
						<Tile
							inner
							label="Ikke svart"
							text={percent(admin.unansweredRate)}
							detail="av alle som var ventet"
						/>
						<Tile
							inner
							label="Fellesbøter"
							value={admin.collectiveFines.events}
							detail={`${admin.collectiveFines.fines} bøter totalt`}
						/>
					</div>
					{admin.leastResponsive.length > 0 && (
						<>
							<p className="pt-1 text-sm font-medium">Svarer sjeldnest</p>
							{admin.leastResponsive.map((p) => (
								<PersonRow
									key={p.user.id}
									person={p}
									text={`${p.value} av ${p.total} ubesvart`}
								/>
							))}
						</>
					)}
				</Card>
				<Card>
					<p className="font-semibold">Betalinger</p>
					<div className="grid grid-cols-2 gap-3">
						<Tile
							inner
							label="Betalt innen frist"
							text={percent(payments.onTimeRate)}
						/>
						<Tile
							inner
							label="Snitt til godkjent"
							text={duration(payments.avgApprovalHours)}
						/>
					</div>
					{payments.open.map((p) => (
						<div key={p.id} className="grid gap-1.5">
							<div className="flex items-baseline justify-between gap-2">
								<span className="truncate text-sm font-medium">{p.title}</span>
								<span className="shrink-0 text-xs text-muted-foreground">
									{p.approved} av {p.memberCount} betalt
									{p.pending ? ` · ${p.pending} venter` : ""}
								</span>
							</div>
							<Progress
								value={p.memberCount ? p.approved / p.memberCount : 0}
								thin
							/>
						</div>
					))}
				</Card>
			</div>
		</div>
	);
}

/** S, U eller T i en farget rute. Bokstaven bærer betydningen, fargen er bare støtte. */
function ResultBadge({ result }: { result: MatchResult }) {
	return (
		<span
			className={cn(
				"inline-flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold",
				result === "S" && "bg-green-600/25",
				result === "U" && "bg-muted",
				result === "T" && "bg-red-600/25",
			)}
		>
			{result}
		</span>
	);
}

/** Alle kampene og resultatene mot hver motstander. Kampene lenker til arrangementet. */
function MatchesDialog({
	matches,
	period,
}: {
	matches: TeamStats["matches"];
	period: string;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button
				size="sm"
				variant="ghost"
				className="text-muted-foreground"
				onClick={() => setOpen(true)}
			>
				Se alle
				<ChevronRightIcon />
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-h-[85svh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Kamper</DialogTitle>
						<DialogDescription>
							{period} · {matches.wins}–{matches.draws}–{matches.losses} · mål{" "}
							{matches.goalsFor}–{matches.goalsAgainst}
						</DialogDescription>
					</DialogHeader>
					<section className="grid gap-2">
						<h3 className="text-xs font-medium text-muted-foreground uppercase">
							Mot motstander
						</h3>
						{matches.opponents.map((o) => (
							<div key={o.name} className="flex items-center gap-3 text-sm">
								<span className="flex-1 truncate font-medium">{o.name}</span>
								<span className="text-xs text-muted-foreground">
									mål {o.goalsFor}–{o.goalsAgainst}
								</span>
								<span className="w-14 text-right font-semibold tabular-nums">
									{o.wins}–{o.draws}–{o.losses}
								</span>
							</div>
						))}
					</section>
					<section className="grid gap-1">
						<h3 className="text-xs font-medium text-muted-foreground uppercase">
							Alle kamper
						</h3>
						{matches.games.map((game) => (
							<Link
								key={game.eventId}
								to="/arrangementer/$eventId"
								params={{ eventId: game.eventId }}
								className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted"
							>
								<ResultBadge result={game.result} />
								<span className="flex-1 truncate">
									{game.opponent ? `mot ${game.opponent}` : game.title}
									<span className="block text-xs text-muted-foreground">
										{formatDateLong(game.start)}
									</span>
								</span>
								<span className="font-bold tabular-nums">
									{game.ourScore}–{game.theirScore}
								</span>
							</Link>
						))}
					</section>
				</DialogContent>
			</Dialog>
		</>
	);
}

/** Plassering der like verdier deler plass: 5, 3, 3, 2 gir 1, 2, 2, 4. */
const withRanks = (people: StatsPerson[]) =>
	people.map((person) => ({
		person,
		rank: 1 + people.filter((p) => p.value > person.value).length,
	}));

/** Topp tre på kortet. «Se alle» åpner hele listen med søk. */
function PeopleCard({
	title,
	people,
	unit,
	period,
	children,
}: {
	title: string;
	people: StatsPerson[];
	unit?: string;
	period: string;
	children?: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const value = (p: StatsPerson) =>
		unit ? `${p.value} ${unit}` : `${p.value} / ${p.total}`;
	const ranked = withRanks(people);
	const q = query.trim().toLowerCase();

	return (
		<Card>
			<div className="flex items-center justify-between">
				<p className="font-semibold">{title}</p>
				<Button
					size="sm"
					variant="ghost"
					className="text-muted-foreground"
					onClick={() => setOpen(true)}
				>
					Se alle
					<ChevronRightIcon />
				</Button>
			</div>
			{ranked.slice(0, 3).map(({ person, rank }) => (
				<PersonRow
					key={person.user.id}
					rank={rank}
					person={person}
					text={value(person)}
				/>
			))}
			{children}
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-h-[85svh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>
							{period} · {people.length} personer
						</DialogDescription>
					</DialogHeader>
					<Input
						aria-label="Søk etter navn"
						placeholder="Søk etter navn"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
					<div className="grid gap-2.5">
						{ranked
							.filter(({ person }) =>
								person.user.name.toLowerCase().includes(q),
							)
							.map(({ person, rank }) => (
								<PersonRow
									key={person.user.id}
									rank={rank}
									person={person}
									text={value(person)}
								/>
							))}
					</div>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

function PersonRow({
	person,
	text,
	rank,
}: {
	person: StatsPerson;
	text: string;
	rank?: number;
}) {
	return (
		<div className="flex items-center gap-2.5">
			{rank !== undefined && (
				<span className="w-6 text-sm font-semibold text-muted-foreground">
					{rank}
				</span>
			)}
			<UserAvatar user={person.user} className="size-7" />
			<span className="flex-1 truncate text-sm">{person.user.name}</span>
			<span className="text-sm font-bold">{text}</span>
		</div>
	);
}

function Card({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<section
			className={cn(
				"grid content-start gap-3 rounded-xl border p-4",
				className,
			)}
		>
			{children}
		</section>
	);
}

function Tile({
	label,
	value,
	total,
	text,
	detail,
	inner,
}: {
	label: string;
	value?: number;
	total?: number;
	text?: string;
	detail?: string;
	inner?: boolean;
}) {
	return (
		<div
			className={cn(
				"grid content-start gap-0.5 rounded-xl p-3.5",
				inner ? "bg-muted" : "border",
			)}
		>
			<span className="text-xs text-muted-foreground">{label}</span>
			<span className="text-2xl font-bold capitalize">
				{text ?? value}
				{total !== undefined && (
					<span className="text-sm font-medium text-muted-foreground">
						{" "}
						/ {total}
					</span>
				)}
			</span>
			{detail && (
				<span className="text-xs text-muted-foreground">{detail}</span>
			)}
		</div>
	);
}

function Progress({ value, thin }: { value: number; thin?: boolean }) {
	const accent = useAccent();
	return (
		<div
			role="img"
			aria-label={percent(value)}
			className={cn(
				"overflow-hidden rounded-full bg-muted",
				thin ? "h-1.5" : "h-2",
			)}
		>
			<div
				className="h-full rounded-full"
				style={{
					width: `${Math.min(Math.max(value, 0), 1) * 100}%`,
					backgroundColor: accent,
				}}
			/>
		</div>
	);
}
