import { Accordion } from "@animate-ui/react/primitives/base-ui/accordion";
import {
	FINE_STATUS_LABEL,
	formatFineCount,
	formatLaw,
} from "@sporty/api/rest/lib/fines";
import type {
	Fine,
	FineStatistics,
	FineStatus,
	GroupDetails,
	MemberFines,
} from "@sporty/api/rest/types";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@sporty/ui/components/select";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@sporty/ui/components/tabs";
import { Textarea } from "@sporty/ui/components/textarea";
import { cn } from "@sporty/ui/lib/utils";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ChevronDownIcon,
	CircleDollarSignIcon,
	MinusIcon,
	PlusIcon,
	XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { CheckboxField } from "@/components/checkbox-field";
import { GroupAvatar } from "@/components/group-avatar";
import { EmptyText, PageState } from "@/components/page-state";
import { UserAvatar } from "@/components/user-avatar";
import { uploadFile } from "@/lib/upload";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/boter")({
	validateSearch: z.object({ gruppe: z.string().optional() }),
	component: FinesComponent,
});

const MAX_COUNT = 20;

/**
 * Bøtene i et lag. For lag fra tihlde.org hentes de derfra: alle medlemmer ser alle, alle kan gi
 * bot, og botsjefen og lederne godkjenner. Sporty-grupper bruker Sporty sitt eget botsystem.
 */
function FinesComponent() {
	const { gruppe } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const trpc = useTRPC();
	const groups = useQuery(trpc.groups.list.queryOptions());

	return (
		<PageState query={groups}>
			{(list) => {
				if (list.length === 0)
					return <EmptyText>Du er ikke med i noen grupper.</EmptyText>;
				const selected = list.find((g) => g.id === gruppe) ?? list[0]!;
				return (
					<div className="grid w-full max-w-4xl min-w-0 grid-cols-1 gap-6">
						<div className="flex flex-wrap items-center justify-between gap-4">
							<h1 className="text-2xl font-semibold">Bøter</h1>
							<Select
								value={selected.id}
								onValueChange={(value) =>
									value && navigate({ search: { gruppe: value } })
								}
							>
								<SelectTrigger className="w-full sm:w-64">
									<SelectValue>
										<GroupAvatar group={selected} size={20} />
										{selected.name}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{list.map((group) => (
										<SelectItem key={group.id} value={group.id}>
											<GroupAvatar group={group} size={20} />
											{group.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<GroupFines key={selected.id} groupId={selected.id} />
					</div>
				);
			}}
		</PageState>
	);
}

function GroupFines({ groupId }: { groupId: string }) {
	const trpc = useTRPC();
	const group = useQuery(trpc.groups.get.queryOptions({ groupId }));
	return (
		<PageState query={group}>{(data) => <FinesList group={data} />}</PageState>
	);
}

function FinesList({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const { source, activated, canGive, canSettle } = group.fines;
	const fromTihlde = source === "tihlde";
	const [giving, setGiving] = useState(false);
	const [view, setView] = useState<"alle" | "medlemmer">("alle");
	const [status, setStatus] = useState<FineStatus | "alle">("alle");
	const [fromDate, setFromDate] = useState("");
	const [toDate, setToDate] = useState("");
	const range = dateRange(fromDate, toDate);
	const statusOptions = fromTihlde ? TIHLDE_STATUSES : SPORTY_STATUSES;
	const fines = useInfiniteQuery(
		trpc.fines.page.infiniteQueryOptions(
			{
				groupId: group.id,
				status: status === "alle" ? undefined : status,
				...range,
			},
			{ getNextPageParam: (last) => last.nextPage, enabled: activated },
		),
	);

	if (fromTihlde && !activated) {
		return (
			<EmptyText>Bøter er ikke slått på for laget på tihlde.org.</EmptyText>
		);
	}

	const all = fines.data?.pages.flatMap((page) => page.fines) ?? [];
	const statistics = fines.data?.pages[0]?.statistics;
	const ownOnly = !fromTihlde && !group.canManage;

	return (
		<div className="grid gap-5">
			{canGive && (
				<Button
					size="lg"
					className="w-full sm:w-fit sm:justify-self-end"
					onClick={() => setGiving(true)}
				>
					<CircleDollarSignIcon />
					Gi bot
				</Button>
			)}
			{statistics && (
				<FineStatisticsCards
					statistics={statistics}
					withApproval={fromTihlde}
					ownOnly={ownOnly}
				/>
			)}
			{fromTihlde && (
				<p className="text-sm text-muted-foreground">
					Bøtene hentes fra tihlde.org. Nye bøter venter på godkjenning fra
					botsjefen
					{canSettle
						? ". Åpne en bot for å godkjenne, markere som betalt eller avvise."
						: "."}
				</p>
			)}

			<Tabs
				value={view}
				onValueChange={(value) => setView(value as typeof view)}
				className="gap-4"
			>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<TabsList className="w-full sm:w-fit">
						<TabsTrigger value="alle" className="flex-1 px-3">
							Alle bøter
						</TabsTrigger>
						<TabsTrigger value="medlemmer" className="flex-1 px-3">
							Per medlem
						</TabsTrigger>
					</TabsList>
				</div>
				<div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
					<Select
						value={status}
						onValueChange={(value) =>
							value && setStatus(value as typeof status)
						}
					>
						<SelectTrigger
							aria-label="Vis bøter med status"
							className="col-span-2 w-full sm:w-56"
						>
							<SelectValue>
								{(value: string) =>
									statusOptions.find((o) => o.value === value)?.label
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{statusOptions.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={periodOf(fromDate, toDate)}
						onValueChange={(value) => {
							const period = PERIODS.find((p) => p.value === value);
							if (!period) return;
							const [from, to] = period.range(new Date());
							setFromDate(from);
							setToDate(to);
						}}
					>
						<SelectTrigger
							aria-label="Periode"
							className="col-span-2 w-full sm:w-48"
						>
							<SelectValue>
								{(value: string) =>
									value === "egendefinert"
										? "Egendefinert"
										: PERIODS.find((p) => p.value === value)?.label
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{PERIODS.map((period) => (
								<SelectItem key={period.value} value={period.value}>
									{period.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<DateField
						label="Fra"
						value={fromDate}
						max={toDate || undefined}
						onChange={setFromDate}
					/>
					<DateField
						label="Til"
						value={toDate}
						min={fromDate || undefined}
						onChange={setToDate}
					/>
					{(fromDate || toDate || status !== "alle") && (
						<Button
							variant="ghost"
							className="col-span-2 sm:col-span-1"
							onClick={() => {
								setStatus("alle");
								setFromDate("");
								setToDate("");
							}}
						>
							<XIcon />
							Nullstill
						</Button>
					)}
				</div>

				<TabsContent value="alle" className="grid gap-4">
					<PageState query={{ ...fines, data: fines.data ? all : undefined }}>
						{(list) =>
							list.length === 0 ? (
								<EmptyText>Ingen bøter 🎉</EmptyText>
							) : (
								<Accordion.Root
									multiple
									className="overflow-hidden rounded-2xl border bg-card"
								>
									{list.map((fine) => (
										<FineItem
											key={fine.id}
											fine={fine}
											canSettle={canSettle && fine.source === "tihlde"}
										/>
									))}
								</Accordion.Root>
							)
						}
					</PageState>
					{fines.hasNextPage && (
						<Button
							variant="outline"
							disabled={fines.isFetchingNextPage}
							onClick={() => fines.fetchNextPage()}
						>
							{fines.isFetchingNextPage ? "Laster…" : "Last inn flere"}
						</Button>
					)}
				</TabsContent>

				<TabsContent value="medlemmer">
					<FinesPerMember
						groupId={group.id}
						withApproval={fromTihlde}
						status={status}
						range={range}
						canSettle={canSettle}
					/>
				</TabsContent>
			</Tabs>

			{giving && (
				<GiveFineDialog group={group} onClose={() => setGiving(false)} />
			)}
		</div>
	);
}

/** Valgene i statusfilteret. Sporty-grupper har ikke godkjenning, så der er det bare betalt/ikke. */
const TIHLDE_STATUSES: { value: FineStatus | "alle"; label: string }[] = [
	{ value: "alle", label: "Alle bøter" },
	{ value: "pending", label: "Ikke godkjent" },
	{ value: "approved", label: "Godkjent, ikke betalt" },
	{ value: "paid", label: "Betalt" },
	{ value: "rejected", label: "Avvist" },
];
const SPORTY_STATUSES: { value: FineStatus | "alle"; label: string }[] = [
	{ value: "alle", label: "Alle bøter" },
	{ value: "approved", label: "Ikke betalt" },
	{ value: "paid", label: "Betalt" },
];

type DateRange = { from?: string; to?: string };

/** YYYY-MM-DD i lokal tid, som i datofeltene. */
const isoDay = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const day = (year: number, month: number, date: number) =>
	isoDay(new Date(year, month, date));

/**
 * Snarveier for «Fra» og «Til», regnet fra i dag. Semesteret er vår (januar–juli) eller høst
 * (august–desember).
 */
const PERIODS: {
	value: string;
	label: string;
	range: (today: Date) => [string, string];
}[] = [
	{ value: "alle", label: "Hele perioden", range: () => ["", ""] },
	{
		value: "7-dager",
		label: "Siste 7 dager",
		range: (t) => [
			day(t.getFullYear(), t.getMonth(), t.getDate() - 6),
			isoDay(t),
		],
	},
	{
		value: "denne-maaneden",
		label: "Denne måneden",
		range: (t) => [
			day(t.getFullYear(), t.getMonth(), 1),
			day(t.getFullYear(), t.getMonth() + 1, 0),
		],
	},
	{
		value: "forrige-maaned",
		label: "Forrige måned",
		range: (t) => [
			day(t.getFullYear(), t.getMonth() - 1, 1),
			day(t.getFullYear(), t.getMonth(), 0),
		],
	},
	{
		value: "semester",
		label: "Dette semesteret",
		range: (t) =>
			t.getMonth() >= 7
				? [day(t.getFullYear(), 7, 1), day(t.getFullYear(), 11, 31)]
				: [day(t.getFullYear(), 0, 1), day(t.getFullYear(), 6, 31)],
	},
	{
		value: "i-aar",
		label: "I år",
		range: (t) => [day(t.getFullYear(), 0, 1), day(t.getFullYear(), 11, 31)],
	},
];

/** Hvilken snarvei datoene tilsvarer, eller «egendefinert» når de er valgt for hånd. */
function periodOf(fromDate: string, toDate: string) {
	const today = new Date();
	return (
		PERIODS.find((period) => {
			const [from, to] = period.range(today);
			return from === fromDate && to === toDate;
		})?.value ?? "egendefinert"
	);
}

/** «Fra» og «Til» (YYYY-MM-DD) som tidspunkter i norsk tid: starten og slutten av dagene. */
function dateRange(fromDate: string, toDate: string): DateRange {
	return {
		...(fromDate
			? { from: new Date(`${fromDate}T00:00:00`).toISOString() }
			: {}),
		...(toDate ? { to: new Date(`${toDate}T23:59:59.999`).toISOString() } : {}),
	};
}

function DateField({
	label,
	value,
	min,
	max,
	onChange,
}: {
	label: string;
	value: string;
	min?: string;
	max?: string;
	onChange: (value: string) => void;
}) {
	return (
		<label className="grid gap-1 text-xs font-medium text-muted-foreground sm:w-40">
			{label}
			<Input
				type="date"
				value={value}
				min={min}
				max={max}
				onChange={(e) => onChange(e.target.value)}
				className="h-9 text-foreground"
			/>
		</label>
	);
}

const statusLabel = (status: FineStatus, withApproval: boolean) =>
	(withApproval ? TIHLDE_STATUSES : SPORTY_STATUSES).find(
		(o) => o.value === status,
	)?.label ?? "";

const perMember = new Intl.NumberFormat("nb-NO", {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

/**
 * Bøtene i laget per status, og snittet per medlem. Uten godkjenning (Sporty-grupper) er det
 * bare «Ikke betalt» og «Betalt».
 */
function FineStatisticsCards({
	statistics,
	withApproval,
	ownOnly,
}: {
	statistics: FineStatistics;
	withApproval: boolean;
	ownOnly: boolean;
}) {
	const cards = [
		...(withApproval
			? [{ label: "Ikke godkjent", value: statistics.notApproved }]
			: []),
		{
			label: withApproval ? "Godkjent, ikke betalt" : "Ikke betalt",
			value: statistics.approvedNotPaid,
		},
		{ label: "Betalt", value: statistics.paid },
	];
	return (
		// Side om side også på mobil, så kortene ikke fyller hele skjermen i høyden.
		<div
			className={cn(
				"grid gap-2 sm:gap-3",
				withApproval ? "grid-cols-3" : "grid-cols-2",
			)}
		>
			{cards.map((card) => (
				<div
					key={card.label}
					className="flex min-w-0 flex-col rounded-2xl border bg-card p-3 sm:p-5"
				>
					<p className="text-xs leading-tight text-muted-foreground sm:text-sm">
						{ownOnly ? `Dine bøter: ${card.label.toLowerCase()}` : card.label}
					</p>
					<p className="mt-auto pt-1 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
						{card.value}
					</p>
					{!ownOnly && statistics.members > 0 && (
						<p className="text-xs text-muted-foreground sm:text-sm">
							{perMember.format(card.value / statistics.members)}
							<span className="hidden sm:inline"> per medlem</span>
							<span className="sm:hidden"> / medlem</span>
						</p>
					)}
				</div>
			))}
		</div>
	);
}

/** Hvor mange bøter hvert medlem har, flest ubetalte først. */
function FinesPerMember({
	groupId,
	withApproval,
	status,
	range,
	canSettle,
}: {
	groupId: string;
	withApproval: boolean;
	status: FineStatus | "alle";
	range: DateRange;
	canSettle: boolean;
}) {
	const trpc = useTRPC();
	const members = useQuery(
		trpc.fines.members.queryOptions({ groupId, ...range }),
	);
	// Det store tallet: ubetalte uten filter, ellers antallet med den valgte statusen.
	const countFor = (member: MemberFines) =>
		status === "alle"
			? member.notApproved + member.approvedNotPaid
			: {
					pending: member.notApproved,
					approved: member.approvedNotPaid,
					paid: member.paid,
					rejected: member.rejected,
				}[status];
	return (
		<PageState query={members}>
			{(all) => {
				const list =
					status === "alle"
						? all.filter((m) => m.notApproved + m.approvedNotPaid + m.paid > 0)
						: all
								.filter((m) => countFor(m) > 0)
								.sort(
									(a, b) =>
										countFor(b) - countFor(a) ||
										a.user.name.localeCompare(b.user.name, "nb"),
								);
				return list.length === 0 ? (
					<EmptyText>
						{status === "alle"
							? "Ingen bøter 🎉"
							: "Ingen medlemmer har bøter med denne statusen."}
					</EmptyText>
				) : (
					<Accordion.Root
						multiple
						className="overflow-hidden rounded-2xl border bg-card"
					>
						{list.map((member) => {
							const shown = countFor(member);
							return (
								<Accordion.Item
									key={member.user.id}
									value={member.user.id}
									className="border-b last:border-b-0"
								>
									<Accordion.Header>
										<Accordion.Trigger className="group flex w-full items-center gap-4 px-4 py-3 text-left outline-none hover:bg-muted/40 focus-visible:bg-muted/60 sm:px-5">
											<span
												className={cn(
													"w-10 shrink-0 text-center text-2xl font-bold tabular-nums",
													shown === 0 && "text-muted-foreground",
												)}
												title={
													status === "alle"
														? "Ubetalte bøter"
														: statusLabel(status, withApproval)
												}
											>
												{shown}
											</span>
											<UserAvatar user={member.user} className="size-8" />
											<span className="grid min-w-0 flex-1 leading-snug">
												<span className="truncate font-semibold">
													{member.user.name}
												</span>
												<span className="truncate text-sm text-muted-foreground">
													{[
														withApproval && member.notApproved > 0
															? `${member.notApproved} ikke godkjent`
															: null,
														member.approvedNotPaid > 0
															? `${member.approvedNotPaid} ${withApproval ? "godkjent, ikke betalt" : "ikke betalt"}`
															: null,
														`${member.paid} betalt`,
														withApproval && member.rejected > 0
															? `${member.rejected} avvist`
															: null,
													]
														.filter(Boolean)
														.join(" · ")}
												</span>
											</span>
											<ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-data-[panel-open]:rotate-180" />
										</Accordion.Trigger>
									</Accordion.Header>
									<Accordion.Panel>
										<MemberFineList
											groupId={groupId}
											memberId={member.user.id}
											status={status}
											range={range}
											canSettle={canSettle}
										/>
									</Accordion.Panel>
								</Accordion.Item>
							);
						})}
					</Accordion.Root>
				);
			}}
		</PageState>
	);
}

/**
 * Bøtene til ett medlem, med statusfilteret som er valgt. Hentes først når trekkspillet åpnes
 * (panelet monteres da), og hver bot kan åpnes som under «Alle bøter».
 */
function MemberFineList({
	groupId,
	memberId,
	status,
	range,
	canSettle,
}: {
	groupId: string;
	memberId: string;
	status: FineStatus | "alle";
	range: DateRange;
	canSettle: boolean;
}) {
	const trpc = useTRPC();
	const fines = useInfiniteQuery(
		trpc.fines.page.infiniteQueryOptions(
			{
				groupId,
				userId: memberId,
				status: status === "alle" ? undefined : status,
				...range,
			},
			{ getNextPageParam: (last) => last.nextPage },
		),
	);
	const all = fines.data?.pages.flatMap((page) => page.fines) ?? [];

	return (
		<div className="grid gap-3 px-3 pb-4 sm:px-4">
			<PageState query={{ ...fines, data: fines.data ? all : undefined }}>
				{(list) =>
					list.length === 0 ? (
						<p className="px-1 text-sm text-muted-foreground">Ingen bøter.</p>
					) : (
						<Accordion.Root
							multiple
							className="overflow-hidden rounded-xl border bg-background"
						>
							{list.map((fine) => (
								<FineItem
									key={fine.id}
									fine={fine}
									canSettle={canSettle && fine.source === "tihlde"}
								/>
							))}
						</Accordion.Root>
					)
				}
			</PageState>
			{fines.hasNextPage && (
				<Button
					variant="outline"
					size="sm"
					disabled={fines.isFetchingNextPage}
					onClick={() => fines.fetchNextPage()}
				>
					{fines.isFetchingNextPage ? "Laster…" : "Last inn flere"}
				</Button>
			)}
		</div>
	);
}

const settled = (status: FineStatus) =>
	status === "paid" || status === "rejected";

const STATUS_STYLE: Record<FineStatus, string> = {
	pending: "border-signal/60 text-foreground",
	approved: "border-input text-foreground",
	paid: "border-transparent bg-muted text-muted-foreground",
	rejected: "border-transparent bg-muted text-muted-foreground line-through",
};

const fineDate = new Intl.DateTimeFormat("nb-NO", {
	weekday: "long",
	day: "numeric",
	month: "long",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

/**
 * Én bot som trekkspill. Lukket: antall, navn og paragraf. Åpen: status, dato, hvem som ga den,
 * bilde og begrunnelse, og (for botsjef og leder) godkjenning.
 */
function FineItem({ fine, canSettle }: { fine: Fine; canSettle: boolean }) {
	return (
		<Accordion.Item value={fine.id} className="border-b last:border-b-0">
			<Accordion.Header>
				<Accordion.Trigger
					aria-label={`${formatFineCount(fine.count)} til ${fine.user.name}: ${formatLaw(fine.law)}`}
					className="group flex w-full items-center gap-4 px-4 py-3.5 text-left outline-none hover:bg-muted/40 focus-visible:bg-muted/60 sm:px-5"
				>
					<span
						className={cn(
							"w-8 shrink-0 text-center text-2xl font-bold tabular-nums",
							settled(fine.status) && "text-muted-foreground",
						)}
					>
						{fine.count}
					</span>
					<span className="grid min-w-0 flex-1 leading-snug">
						<span className="truncate font-semibold">{fine.user.name}</span>
						<span className="truncate text-sm text-muted-foreground">
							{formatLaw(fine.law)}
						</span>
					</span>
					{fine.status === "pending" && (
						<span className="hidden shrink-0 rounded-md bg-signal px-2 py-0.5 text-[11px] font-bold tracking-wide text-signal-foreground uppercase sm:inline">
							{FINE_STATUS_LABEL[fine.status]}
						</span>
					)}
					<ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-data-[panel-open]:rotate-180" />
				</Accordion.Trigger>
			</Accordion.Header>
			<Accordion.Panel>
				<FineDetails fine={fine} canSettle={canSettle} />
			</Accordion.Panel>
		</Accordion.Item>
	);
}

function FineDetails({ fine, canSettle }: { fine: Fine; canSettle: boolean }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const setStatus = useMutation(
		trpc.fines.setStatus.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.fines.pathKey() });
				toast.success("Boten er oppdatert");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const change = (status: FineStatus) =>
		setStatus.mutate({ groupId: fine.groupId, fineId: fine.id, status });

	const actions: {
		label: string;
		status: FineStatus;
		variant: "default" | "outline" | "destructive";
	}[] =
		fine.status === "pending"
			? [
					{ label: "Godkjenn", status: "approved", variant: "default" },
					{ label: "Avvis", status: "rejected", variant: "destructive" },
				]
			: fine.status === "approved"
				? [
						{ label: "Marker som betalt", status: "paid", variant: "default" },
						{ label: "Avvis", status: "rejected", variant: "destructive" },
					]
				: [
						{
							label: "Sett tilbake til venter",
							status: "pending",
							variant: "outline",
						},
					];

	// tihlde.org-bilder er private: hentes via serveren, som legger på innloggingen. Sporty-bilder
	// ligger hos oss (/api/uploads/…).
	const imageSrc =
		fine.source === "tihlde"
			? `/api/fines/${encodeURIComponent(fine.id)}/image?groupId=${encodeURIComponent(fine.groupId)}`
			: fine.imageUrl;

	return (
		<div className="grid gap-4 px-4 pb-5 sm:px-5 sm:pl-[4.25rem]">
			<div className="flex flex-wrap items-center gap-2">
				<span
					className={cn(
						"rounded-md border px-2 py-0.5 text-xs font-semibold",
						STATUS_STYLE[fine.status],
					)}
				>
					{FINE_STATUS_LABEL[fine.status]}
				</span>
				<span className="text-sm text-muted-foreground first-letter:uppercase">
					{fineDate.format(new Date(fine.createdAt))}
				</span>
			</div>
			<p className="text-sm">
				<span className="text-muted-foreground">Fra </span>
				{fine.collective ? "Fellesbot" : fine.givenByName}
			</p>
			<div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
				{fine.imageUrl && imageSrc && (
					<img
						src={imageSrc}
						alt="Bildet til boten"
						loading="lazy"
						className="max-h-80 w-full rounded-xl border object-cover"
					/>
				)}
				<div className="grid content-start gap-3 text-sm">
					<div>
						<p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
							Begrunnelse
						</p>
						<p className="break-words whitespace-pre-wrap">{fine.reason}</p>
					</div>
					{fine.defense && (
						<div>
							<p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
								Forsvar
							</p>
							<p className="break-words whitespace-pre-wrap">{fine.defense}</p>
						</div>
					)}
				</div>
			</div>
			{canSettle && (
				<div className="flex flex-wrap gap-2">
					{actions.map((action) => (
						<Button
							key={action.status}
							size="sm"
							variant={action.variant}
							disabled={setStatus.isPending}
							onClick={() => change(action.status)}
						>
							{action.label}
						</Button>
					))}
				</div>
			)}
		</div>
	);
}

/** Gi bot: paragraf fra lovverket, hvem, antall og begrunnelse. Inaktive kan ikke få bøter. */
function GiveFineDialog({
	group,
	onClose,
}: {
	group: GroupDetails;
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const me = useQuery(trpc.me.queryOptions());
	const laws = useQuery(trpc.fines.laws.queryOptions({ groupId: group.id }));
	// Samme id for alle forsøk med dette skjemaet, så serveren ikke gir bøtene to ganger.
	const [requestId] = useState(() => crypto.randomUUID());
	const [lawId, setLawId] = useState<string | null>(null);
	const [selected, setSelected] = useState<string[]>([]);
	const [search, setSearch] = useState("");
	const [chosenCount, setCount] = useState<number | null>(null);
	const [reason, setReason] = useState("");
	const [image, setImage] = useState<File | null>(null);
	const [uploading, setUploading] = useState(false);

	const law = laws.data?.find((l) => l.id === lawId);
	const count =
		chosenCount ?? Math.min(Math.max(law?.defaultCount ?? 1, 1), MAX_COUNT);
	const members = group.members
		.filter((m) => m.user.id !== me.data?.id)
		.filter((m) =>
			m.user.name.toLowerCase().includes(search.trim().toLowerCase()),
		)
		.sort(
			(a, b) =>
				Number(Boolean(a.inactive)) - Number(Boolean(b.inactive)) ||
				a.user.name.localeCompare(b.user.name),
		);

	const give = useMutation(
		trpc.fines.give.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.fines.pathKey() });
				toast.success(
					group.fines.source === "tihlde"
						? "Boten er gitt og venter på godkjenning"
						: "Boten er gitt",
				);
				onClose();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const toggle = (id: string) =>
		setSelected((current) =>
			current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
		);
	const valid = lawId && selected.length > 0 && reason.trim();

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Gi bot</DialogTitle>
					<DialogDescription>
						{group.fines.source === "tihlde"
							? "Boten gis på tihlde.org og venter på godkjenning fra botsjefen."
							: group.name}
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-2">
					<Label>Paragraf</Label>
					<Select value={lawId} onValueChange={(value) => setLawId(value)}>
						<SelectTrigger className="w-full">
							<SelectValue>
								{law ? formatLaw(law) : "Velg paragraf"}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{(laws.data ?? []).map((l) => (
								<SelectItem key={l.id} value={l.id}>
									{formatLaw(l)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="grid gap-2">
					<Label>Hvem ({selected.length} valgt)</Label>
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Søk etter navn"
					/>
					<div className="max-h-56 divide-y overflow-y-auto rounded-md border">
						{members.map((member) =>
							member.inactive ? (
								<div
									key={member.user.id}
									className="flex items-center gap-3 px-3 py-2 opacity-50"
								>
									<span className="flex-1">{member.user.name}</span>
									<Badge variant="outline">Inaktiv</Badge>
								</div>
							) : (
								<div
									key={member.user.id}
									className="px-3 py-2 hover:bg-muted/50"
								>
									<CheckboxField
										checked={selected.includes(member.user.id)}
										onCheckedChange={() => toggle(member.user.id)}
									>
										{member.user.name}
									</CheckboxField>
								</div>
							),
						)}
					</div>
				</div>

				<div className="grid gap-2">
					<Label>Antall bøter</Label>
					<div className="flex items-center gap-3">
						<Button
							type="button"
							size="icon"
							variant="outline"
							disabled={count <= 1}
							onClick={() => setCount(count - 1)}
						>
							<MinusIcon />
						</Button>
						<span className="w-8 text-center text-xl font-semibold">
							{count}
						</span>
						<Button
							type="button"
							size="icon"
							variant="outline"
							disabled={count >= MAX_COUNT}
							onClick={() => setCount(count + 1)}
						>
							<PlusIcon />
						</Button>
					</div>
				</div>

				<div className="grid gap-2">
					<Label>Begrunnelse</Label>
					<Textarea
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder="Beskriv hvorfor boten gis…"
					/>
				</div>

				<div className="grid gap-2">
					<Label htmlFor="fine-image">Bilde (valgfritt)</Label>
					<Input
						id="fine-image"
						type="file"
						accept="image/*"
						onChange={(e) => setImage(e.target.files?.[0] ?? null)}
					/>
					{group.fines.source === "tihlde" && (
						<p className="text-xs text-muted-foreground">
							Bildet vises også på boten på tihlde.org.
						</p>
					)}
				</div>

				<DialogFooter>
					<Button
						disabled={!valid || give.isPending || uploading}
						onClick={async () => {
							if (!lawId) return;
							let imageUploadId: string | null = null;
							if (image) {
								setUploading(true);
								try {
									imageUploadId = (await uploadFile(image)).id;
								} catch (error) {
									toast.error(
										`Kunne ikke laste opp bildet: ${(error as Error).message}`,
									);
									return;
								} finally {
									setUploading(false);
								}
							}
							give.mutate({
								requestId,
								groupId: group.id,
								lawId,
								userIds: selected,
								count,
								reason: reason.trim(),
								imageUploadId,
							});
						}}
					>
						Gi {formatFineCount(count)}
						{selected.length > 1 ? ` til ${selected.length}` : ""}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
