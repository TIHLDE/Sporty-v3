import { GROUP_COLORS } from "@sporty/api/rest/lib/group-colors";
import type {
	GroupDetails,
	Member,
	OfficeHistory,
	OfficePeriod,
	OfficePeriodInput,
	Role,
} from "@sporty/api/rest/types";
import { Badge } from "@sporty/ui/components/badge";
import { Button, buttonVariants } from "@sporty/ui/components/button";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@sporty/ui/components/table";
import { Textarea } from "@sporty/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowDownIcon,
	ArrowLeftIcon,
	ArrowUpIcon,
	CheckIcon,
	FileSpreadsheetIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
	TrophyIcon,
} from "lucide-react";
import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import { CheckboxField } from "@/components/checkbox-field";
import { GroupAvatar } from "@/components/group-avatar";
import { formatPeriodDates, isCurrentPeriod } from "@/components/offices";
import { EmptyText, PageState } from "@/components/page-state";
import { uploadFile } from "@/lib/upload";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/grupper/$groupId/innstillinger")({
	component: SettingsComponent,
});

const ROLE_LABEL: Record<Role, string> = {
	admin: "Admin",
	subadmin: "Subadmin",
	botsjef: "Botsjef",
	member: "Medlem",
	index: "Index",
};
const NO_POSITION = "__none__";

/** Gruppeinnstillinger for sub-/admin. Admin endrer gruppen, roller, posisjoner og undergrupper. */
function SettingsComponent() {
	const { groupId } = Route.useParams();
	const trpc = useTRPC();
	const group = useQuery(trpc.groups.get.queryOptions({ groupId }));

	return (
		<PageState query={group}>
			{(data) =>
				data.canManage ? (
					<Settings group={data} />
				) : (
					<EmptyText>Bare sub-/admin har tilgang til innstillingene.</EmptyText>
				)
			}
		</PageState>
	);
}

/** Felles for alle endringene: oppdater gruppen etterpå, og vis feilen fra serveren. */
function useAdminMutationOptions(message?: string) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return {
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: trpc.groups.pathKey() });
			if (message) toast.success(message);
		},
		onError: (error: { message: string }) => toast.error(error.message),
	};
}

function Settings({ group }: { group: GroupDetails }) {
	const isAdmin = group.canAdmin;
	const isSubgroup = Boolean(group.parentId);
	// Samme vilkår som seksjonene under, så menyen bare viser det som finnes på siden.
	const sections = [
		{ id: "gruppe", title: "Gruppe", show: isAdmin },
		{ id: "medlemmer", title: "Medlemmer", show: true },
		{ id: "posisjoner", title: "Posisjoner", show: isAdmin },
		{ id: "kampfakta", title: "Kampfakta", show: isAdmin && !isSubgroup },
		{
			id: "vervhistorikk",
			title: "Vervhistorikk",
			show: isAdmin && !isSubgroup,
		},
		{ id: "undergrupper", title: "Undergrupper", show: isAdmin && !isSubgroup },
		{
			id: "undergruppe-medlemmer",
			title: "Medlemmer i undergruppen",
			show: isAdmin && isSubgroup,
		},
		{
			id: "slett-undergruppe",
			title: "Slett undergruppe",
			show: isAdmin && isSubgroup,
		},
		{ id: "eksport", title: "Eksport", show: true },
	].filter((section) => section.show);
	const { active, goTo } = useSectionNavigation(
		sections.map((section) => section.id),
	);

	return (
		<div className="flex w-full max-w-5xl gap-8">
			<aside className="hidden w-48 shrink-0 lg:block">
				<SectionNav
					sections={sections}
					active={active}
					onSelect={goTo}
					orientation="vertical"
					className="sticky top-20 grid gap-0.5"
				/>
			</aside>

			<div className="grid min-w-0 flex-1 grid-cols-1 gap-8">
				<Link
					to="/grupper/$groupId"
					params={{ groupId: group.id }}
					className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeftIcon className="size-4" />
					{group.name}
				</Link>
				<h1 className="text-2xl font-semibold">Innstillinger</h1>

				{/* På små skjermer er menyen en rad under toppmenyen i stedet for en kolonne. */}
				<SectionNav
					sections={sections}
					active={active}
					onSelect={goTo}
					orientation="horizontal"
					className="sticky top-14 z-[5] -mx-4 -my-4 flex gap-1 overflow-x-auto border-b bg-background/90 px-4 py-2 backdrop-blur lg:hidden"
				/>

				{isAdmin && <GroupDetailsSection group={group} />}
				<MembersSection group={group} />
				{isAdmin && <PositionsSection group={group} />}
				{isAdmin && !isSubgroup && <MatchFactsSection group={group} />}
				{isAdmin && !isSubgroup && <OfficesSection group={group} />}
				{isAdmin && !isSubgroup && <SubgroupsSection group={group} />}
				{isAdmin && isSubgroup && <SubgroupAdminSection group={group} />}
				<ExportSection group={group} />
			</div>
		</div>
	);
}

const prefersReducedMotion = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Menyen med seksjonene. Markeringen er ett felles element som glir til den aktive lenken, i stedet
 * for at hver lenke skifter bakgrunn. Liggende (små skjermer) rulles raden så den aktive er synlig.
 */
function SectionNav({
	sections,
	active,
	onSelect,
	orientation,
	className,
}: {
	sections: { id: string; title: string }[];
	active: string;
	onSelect: (id: string) => void;
	orientation: "vertical" | "horizontal";
	className: string;
}) {
	const navRef = useRef<HTMLElement>(null);
	const links = useRef(new Map<string, HTMLAnchorElement>());
	const [indicator, setIndicator] = useState<{
		x: number;
		y: number;
		width: number;
		height: number;
	} | null>(null);
	// Første plassering skal ikke animeres inn fra hjørnet.
	const [animate, setAnimate] = useState(false);

	useLayoutEffect(() => {
		const measure = () => {
			const link = links.current.get(active);
			// Skjult meny (feil skjermstørrelse) har ingen mål.
			if (!link || link.offsetWidth === 0) return;
			setIndicator({
				x: link.offsetLeft,
				y: link.offsetTop,
				width: link.offsetWidth,
				height: link.offsetHeight,
			});
			const nav = navRef.current;
			if (orientation === "horizontal" && nav) {
				nav.scrollTo({
					left: link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2,
					behavior: prefersReducedMotion() ? "auto" : "smooth",
				});
			}
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, [active, orientation, sections.length]);

	useEffect(() => {
		if (!indicator || animate) return;
		const frame = requestAnimationFrame(() => setAnimate(true));
		return () => cancelAnimationFrame(frame);
	}, [indicator, animate]);

	const vertical = orientation === "vertical";
	return (
		<nav ref={navRef} aria-label="Seksjoner" className={`${className} text-sm`}>
			{indicator && (
				<span
					aria-hidden
					className={`pointer-events-none absolute top-0 left-0 bg-muted ${vertical ? "rounded-md" : "rounded-full"} ${animate ? "transition-[transform,width,height] duration-300 ease-out motion-reduce:transition-none" : ""}`}
					style={{
						transform: `translate(${indicator.x}px, ${indicator.y}px)`,
						width: indicator.width,
						height: indicator.height,
					}}
				/>
			)}
			{sections.map((section) => (
				<a
					key={section.id}
					ref={(el) => {
						if (el) links.current.set(section.id, el);
						else links.current.delete(section.id);
					}}
					href={`#${section.id}`}
					aria-current={active === section.id ? "location" : undefined}
					onClick={(e) => {
						e.preventDefault();
						onSelect(section.id);
					}}
					className={`relative ${vertical ? "rounded-md px-3 py-1.5" : "shrink-0 rounded-full px-3 py-1"} text-muted-foreground transition-colors duration-300 hover:text-foreground aria-[current=location]:text-foreground`}
				>
					{section.title}
				</a>
			))}
		</nav>
	);
}

/**
 * Hvilken seksjon man er i, og `goTo` for å rulle til en. Under scrollingen følger markeringen
 * siden: den siste seksjonen som har nådd toppen av skjermen (under toppmenyen), eller den siste
 * helt nederst. Etter et klikk står markeringen på målet hele veien, i stedet for å hoppe gjennom
 * seksjonene i mellom, og målet lyser kort opp når siden er fremme.
 */
function useSectionNavigation(ids: string[]) {
	const [active, setActive] = useState(ids[0]);
	// Satt mens siden ruller til en seksjon man har klikket på.
	const target = useRef<string | null>(null);
	const key = ids.join(",");

	useEffect(() => {
		const sectionIds = key.split(",");
		const update = () => {
			if (target.current) return;
			let current = sectionIds[0];
			for (const id of sectionIds) {
				const top = document.getElementById(id)?.getBoundingClientRect().top;
				if (top !== undefined && top <= 140) current = id;
			}
			const atBottom =
				window.innerHeight + window.scrollY >=
				document.documentElement.scrollHeight - 4;
			setActive(atBottom ? sectionIds[sectionIds.length - 1] : current);
		};
		update();
		window.addEventListener("scroll", update, { passive: true });
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
		};
	}, [key]);

	const goTo = (id: string) => {
		const section = document.getElementById(id);
		if (!section) return;
		const reduceMotion = prefersReducedMotion();
		target.current = id;
		setActive(id);
		window.history.replaceState(null, "", `#${id}`);
		section.scrollIntoView({
			behavior: reduceMotion ? "auto" : "smooth",
			block: "start",
		});

		// Fremme når det ikke har kommet scroll-hendelser på en stund. `scrollend` finnes ikke i
		// alle nettlesere, og kommer ikke i det hele tatt hvis siden allerede står der.
		let idle = 0;
		const arrived = () => {
			window.removeEventListener("scroll", wait);
			// Et nyere klikk har tatt over.
			if (target.current !== id) return;
			target.current = null;
			if (!reduceMotion) {
				section.animate(
					[
						{ boxShadow: "0 0 0 0 transparent" },
						{ boxShadow: "0 0 0 3px var(--ring)", offset: 0.2 },
						{ boxShadow: "0 0 0 0 transparent" },
					],
					{ duration: 1200, easing: "ease-out" },
				);
			}
		};
		const wait = () => {
			window.clearTimeout(idle);
			idle = window.setTimeout(arrived, 120);
		};
		window.addEventListener("scroll", wait, { passive: true });
		wait();
	};

	return { active, goTo };
}

function Section({
	id,
	title,
	description,
	children,
}: {
	/** Ankeret menyen til venstre (eller øverst på små skjermer) hopper til. */
	id: string;
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<section
			id={id}
			// Plass til toppmenyen, og til seksjonsraden på små skjermer, når man hopper hit.
			className="grid scroll-mt-32 gap-4 rounded-xl border p-5 lg:scroll-mt-20"
		>
			<div>
				<h2 className="text-lg font-medium">{title}</h2>
				{description && (
					<p className="text-sm text-muted-foreground">{description}</p>
				)}
			</div>
			{children}
		</section>
	);
}

function ColorPicker({
	value,
	onChange,
}: {
	value: string;
	onChange: (color: string) => void;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			{GROUP_COLORS.map((color) => (
				<button
					key={color}
					type="button"
					aria-label={`Farge ${color}`}
					aria-pressed={value === color}
					onClick={() => onChange(color)}
					className="flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background aria-pressed:ring-2 aria-pressed:ring-foreground"
					style={{ backgroundColor: color }}
				>
					{value === color && <CheckIcon className="size-4 text-white" />}
				</button>
			))}
		</div>
	);
}

/**
 * (Admin i hovedgruppen) Vervhistorikken: vervene laget har, periodene, og hvem som hadde hvert
 * verv i hver periode. Endres bare her på nettsiden; appen viser den.
 */
function OfficesSection({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const history = useQuery(
		trpc.groups.offices.queryOptions({ groupId: group.id }),
	);

	return (
		<Section
			id="vervhistorikk"
			title="Vervhistorikk"
			description="Hvem som hadde hvilke verv i laget, periode for periode. Medlemmene ser historikken i appen og på nettsiden."
		>
			<PageState query={history}>
				{(data) => (
					<>
						<OfficeList group={group} history={data} />
						<OfficePeriods group={group} history={data} />
					</>
				)}
			</PageState>
		</Section>
	);
}

/** Vervene i laget. De brukes i alle periodene. */
function OfficeList({
	group,
	history,
}: {
	group: GroupDetails;
	history: OfficeHistory;
}) {
	const trpc = useTRPC();
	const options = useAdminMutationOptions();
	const create = useMutation(
		trpc.groupAdmin.createOffice.mutationOptions(options),
	);
	const rename = useMutation(
		trpc.groupAdmin.renameOffice.mutationOptions(options),
	);
	const remove = useMutation(
		trpc.groupAdmin.deleteOffice.mutationOptions(options),
	);
	const [newName, setNewName] = useState("");
	const [editing, setEditing] = useState<{ id: string; name: string } | null>(
		null,
	);
	const busy = create.isPending || rename.isPending || remove.isPending;

	return (
		<div className="grid gap-2">
			<div>
				<h3 className="font-medium">Vervene i laget</h3>
				<p className="text-sm text-muted-foreground">
					Lag de vervene dere faktisk har. De brukes i alle periodene.
				</p>
			</div>
			<div className="divide-y rounded-lg border">
				{history.offices.length === 0 && (
					<p className="p-3 text-sm text-muted-foreground">Ingen verv ennå.</p>
				)}
				{history.offices.map((office) => (
					<div key={office.id} className="flex items-center gap-2 p-2">
						{editing?.id === office.id ? (
							<>
								<Input
									aria-label="Nytt navn"
									value={editing.name}
									onChange={(e) =>
										setEditing({ id: office.id, name: e.target.value })
									}
									className="h-8"
									maxLength={40}
								/>
								<Button
									size="sm"
									disabled={!editing.name.trim() || busy}
									onClick={() =>
										rename.mutate(
											{
												groupId: group.id,
												officeId: office.id,
												name: editing.name.trim(),
											},
											{ onSuccess: () => setEditing(null) },
										)
									}
								>
									Lagre
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => setEditing(null)}
								>
									Avbryt
								</Button>
							</>
						) : (
							<>
								<span className="flex-1 px-1">{office.name}</span>
								<Button
									size="icon"
									variant="ghost"
									aria-label={`Gi ${office.name} nytt navn`}
									onClick={() =>
										setEditing({ id: office.id, name: office.name })
									}
								>
									<PencilIcon />
								</Button>
								<Button
									size="icon"
									variant="ghost"
									aria-label={`Slett ${office.name}`}
									disabled={busy}
									onClick={() =>
										window.confirm(
											`Slette ${office.name}? Vervet fjernes også fra alle periodene i historikken.`,
										) &&
										remove.mutate({ groupId: group.id, officeId: office.id })
									}
								>
									<Trash2Icon className="text-destructive" />
								</Button>
							</>
						)}
					</div>
				))}
			</div>
			<form
				className="flex gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					if (newName.trim())
						create.mutate(
							{ groupId: group.id, name: newName.trim() },
							{ onSuccess: () => setNewName("") },
						);
				}}
			>
				<Input
					aria-label="Nytt verv"
					value={newName}
					onChange={(e) => setNewName(e.target.value)}
					placeholder="Nytt verv, f.eks. Botsjef"
					maxLength={40}
				/>
				<Button type="submit" disabled={!newName.trim() || busy}>
					Legg til
				</Button>
			</form>
		</div>
	);
}

/** Periodene, nyeste først, med hvem som har hvert verv. */
function OfficePeriods({
	group,
	history,
}: {
	group: GroupDetails;
	history: OfficeHistory;
}) {
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<OfficePeriod | null>(null);

	return (
		<div className="grid gap-2">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="font-medium">Perioder</h3>
				<Button size="sm" onClick={() => setCreating(true)}>
					<PlusIcon />
					Ny periode
				</Button>
			</div>
			{history.periods.length === 0 && (
				<EmptyText>
					Ingen perioder ennå. Lag f.eks. «Sesongen 2026» og velg hvem som har
					hvert verv.
				</EmptyText>
			)}
			{history.periods.map((period) => (
				<PeriodCard
					key={period.id}
					group={group}
					history={history}
					period={period}
					onEdit={() => setEditing(period)}
				/>
			))}
			{creating && (
				<PeriodDialog groupId={group.id} onClose={() => setCreating(false)} />
			)}
			{editing && (
				<PeriodDialog
					groupId={group.id}
					period={editing}
					onClose={() => setEditing(null)}
				/>
			)}
		</div>
	);
}

function PeriodCard({
	group,
	history,
	period,
	onEdit,
}: {
	group: GroupDetails;
	history: OfficeHistory;
	period: OfficePeriod;
	onEdit: () => void;
}) {
	const trpc = useTRPC();
	const remove = useMutation(
		trpc.groupAdmin.deleteOfficePeriod.mutationOptions(
			useAdminMutationOptions("Perioden er slettet"),
		),
	);
	const [choosingFor, setChoosingFor] = useState<string | null>(null);
	const label = period.name || formatPeriodDates(period);
	const office = history.offices.find((o) => o.id === choosingFor);

	return (
		<div className="grid gap-2 rounded-lg border p-3">
			<div className="flex items-center gap-2">
				<div className="min-w-0 flex-1">
					<p className="font-medium">
						{label}
						{isCurrentPeriod(period) && (
							<Badge variant="secondary" className="ml-2">
								Nå
							</Badge>
						)}
					</p>
					{period.name && (
						<p className="text-sm text-muted-foreground">
							{formatPeriodDates(period)}
						</p>
					)}
				</div>
				<Button
					size="icon"
					variant="ghost"
					aria-label={`Endre ${label}`}
					onClick={onEdit}
				>
					<PencilIcon />
				</Button>
				<Button
					size="icon"
					variant="ghost"
					aria-label={`Slett ${label}`}
					disabled={remove.isPending}
					onClick={() =>
						window.confirm(
							`Slette ${label}? Hvem som hadde vervene i perioden, slettes også.`,
						) && remove.mutate({ groupId: group.id, periodId: period.id })
					}
				>
					<Trash2Icon className="text-destructive" />
				</Button>
			</div>
			{history.offices.length === 0 ? (
				<p className="text-sm text-muted-foreground">Lag vervene over først.</p>
			) : (
				<div className="divide-y rounded-md border">
					{history.offices.map((o) => {
						const users =
							period.holders.find((h) => h.office.id === o.id)?.users ?? [];
						return (
							<div key={o.id} className="flex items-center gap-2 px-3 py-2">
								<span className="w-40 shrink-0 text-sm">{o.name}</span>
								<span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
									{users.map((u) => u.name).join(", ") || "–"}
								</span>
								<Button
									size="xs"
									variant="ghost"
									onClick={() => setChoosingFor(o.id)}
								>
									Velg
								</Button>
							</div>
						);
					})}
				</div>
			)}
			{office && (
				<HoldersDialog
					group={group}
					period={period}
					office={office}
					holderIds={
						period.holders
							.find((h) => h.office.id === office.id)
							?.users.map((u) => u.id) ?? []
					}
					onClose={() => setChoosingFor(null)}
				/>
			)}
		</div>
	);
}

/** Ny periode, eller endre navnet og datoene til en som finnes. */
function PeriodDialog({
	groupId,
	period,
	onClose,
}: {
	groupId: string;
	period?: OfficePeriod;
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const options = useAdminMutationOptions(
		period ? "Perioden er lagret" : "Perioden er laget",
	);
	const done = {
		...options,
		onSuccess: () => {
			options.onSuccess();
			onClose();
		},
	};
	const create = useMutation(
		trpc.groupAdmin.createOfficePeriod.mutationOptions(done),
	);
	const update = useMutation(
		trpc.groupAdmin.updateOfficePeriod.mutationOptions(done),
	);
	const [input, setInput] = useState<OfficePeriodInput>({
		name: period?.name ?? "",
		from: period?.from ?? "",
		to: period?.to ?? "",
	});
	const valid = input.from && input.to && input.from <= input.to;
	const busy = create.isPending || update.isPending;

	const save = () => {
		const data = { ...input, name: input.name.trim(), groupId };
		if (period) update.mutate({ ...data, periodId: period.id });
		else create.mutate(data);
	};

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{period ? "Endre periode" : "Ny periode"}</DialogTitle>
				</DialogHeader>
				<div className="grid gap-2">
					<Label htmlFor="period-name">Navn (valgfritt)</Label>
					<Input
						id="period-name"
						value={input.name}
						onChange={(e) => setInput({ ...input, name: e.target.value })}
						placeholder="F.eks. Sesongen 2026"
						maxLength={60}
					/>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="grid gap-2">
						<Label htmlFor="period-from">Fra</Label>
						<Input
							id="period-from"
							type="date"
							value={input.from}
							onChange={(e) => setInput({ ...input, from: e.target.value })}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="period-to">Til</Label>
						<Input
							id="period-to"
							type="date"
							value={input.to}
							min={input.from || undefined}
							onChange={(e) => setInput({ ...input, to: e.target.value })}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button disabled={!valid || busy} onClick={save}>
						{period ? "Lagre" : "Lag periode"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Hvem som har ett verv i en periode. Velges blant medlemmene i laget. */
function HoldersDialog({
	group,
	period,
	office,
	holderIds,
	onClose,
}: {
	group: GroupDetails;
	period: OfficePeriod;
	office: { id: string; name: string };
	holderIds: string[];
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const options = useAdminMutationOptions();
	const save = useMutation(
		trpc.groupAdmin.setOfficeHolders.mutationOptions({
			...options,
			onSuccess: () => {
				options.onSuccess();
				onClose();
			},
		}),
	);
	// Tidligere medlemmer som allerede har vervet, beholdes selv om de ikke står i listen.
	const [selected, setSelected] = useState(holderIds);

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{office.name}</DialogTitle>
					<DialogDescription>
						{period.name || formatPeriodDates(period)}
					</DialogDescription>
				</DialogHeader>
				<MemberPicker
					members={group.members}
					selected={selected}
					onChange={setSelected}
				/>
				<DialogFooter>
					<Button
						disabled={save.isPending}
						onClick={() =>
							save.mutate({
								groupId: group.id,
								periodId: period.id,
								officeId: office.id,
								userIds: selected,
							})
						}
					>
						Lagre
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** (Admin) Navn, beskrivelse og farge. */
function GroupDetailsSection({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const [name, setName] = useState(group.name);
	const [description, setDescription] = useState(group.description);
	const [color, setColor] = useState(group.color);
	const update = useMutation(
		trpc.groupAdmin.update.mutationOptions(useAdminMutationOptions("Lagret")),
	);
	const changed =
		name.trim() !== group.name ||
		description.trim() !== group.description ||
		color !== group.color;

	return (
		<Section
			id="gruppe"
			title="Gruppe"
			description={
				group.logoUrl
					? "Lag fra tihlde.org får navnet sitt derfra, så endringer i navnet kan bli overskrevet."
					: undefined
			}
		>
			<div className="grid gap-2">
				<Label htmlFor="group-name">Navn</Label>
				<Input
					id="group-name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					maxLength={60}
				/>
			</div>
			<div className="grid gap-2">
				<Label htmlFor="group-description">Beskrivelse</Label>
				<Textarea
					id="group-description"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>
			</div>
			<div className="grid gap-2">
				<Label>Farge</Label>
				<ColorPicker value={color} onChange={setColor} />
			</div>
			<CoverPicker group={group} />
			<Button
				className="justify-self-start"
				disabled={!changed || !name.trim() || update.isPending}
				onClick={() =>
					update.mutate({
						groupId: group.id,
						name: name.trim(),
						description: description.trim(),
						// Eldre grupper kan ha en farge som ikke er i velgeren, så den sendes bare når den endres.
						...(color !== group.color ? { color } : {}),
					})
				}
			>
				Lagre endringer
			</Button>
		</Section>
	);
}

/** Roller (admin), posisjoner og inaktive (sub-/admin). */
function MembersSection({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const options = useAdminMutationOptions();
	const setRole = useMutation(trpc.groupAdmin.setRole.mutationOptions(options));
	const setPosition = useMutation(
		trpc.groupAdmin.setPosition.mutationOptions(options),
	);
	const setInactive = useMutation(
		trpc.groupAdmin.setInactive.mutationOptions(options),
	);
	const [makingInactive, setMakingInactive] = useState<Member | null>(null);
	const members = [...group.members].sort((a, b) =>
		a.user.name.localeCompare(b.user.name),
	);
	const showPositions = group.usesPositions && group.positions.length > 0;

	return (
		<Section
			id="medlemmer"
			title="Medlemmer"
			description={group.canAdmin ? undefined : "Bare admin kan endre roller."}
		>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Navn</TableHead>
						<TableHead>Rolle</TableHead>
						{showPositions && <TableHead>Posisjon</TableHead>}
						<TableHead>Status</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{members.map((member) => (
						<TableRow key={member.user.id}>
							<TableCell className="font-medium">{member.user.name}</TableCell>
							<TableCell>
								{group.canAdmin ? (
									<Select
										value={member.role}
										onValueChange={(role) =>
											role &&
											role !== member.role &&
											setRole.mutate({
												groupId: group.id,
												userId: member.user.id,
												role: role as Role,
											})
										}
									>
										<SelectTrigger
											size="sm"
											className="w-32"
											aria-label={`Rolle for ${member.user.name}`}
										>
											<SelectValue>{ROLE_LABEL[member.role]}</SelectValue>
										</SelectTrigger>
										<SelectContent>
											{(Object.keys(ROLE_LABEL) as Role[])
												// Botsjef gir fellesbot, og bøtene hører til hovedgruppen.
												.filter((role) => role !== "botsjef" || !group.parentId)
												.map((role) => (
													<SelectItem key={role} value={role}>
														{ROLE_LABEL[role]}
													</SelectItem>
												))}
										</SelectContent>
									</Select>
								) : (
									ROLE_LABEL[member.role]
								)}
							</TableCell>
							{showPositions && (
								<TableCell>
									<Select
										value={member.position?.id ?? NO_POSITION}
										onValueChange={(value) =>
											value &&
											setPosition.mutate({
												groupId: group.id,
												userId: member.user.id,
												positionId: value === NO_POSITION ? null : value,
											})
										}
									>
										<SelectTrigger
											size="sm"
											className="w-36"
											aria-label={`Posisjon for ${member.user.name}`}
										>
											<SelectValue>
												{member.position?.name ?? "Ingen"}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NO_POSITION}>Ingen</SelectItem>
											{group.positions.map((position) => (
												<SelectItem key={position.id} value={position.id}>
													{position.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</TableCell>
							)}
							<TableCell>
								{member.inactive ? (
									<div className="flex items-center gap-2">
										<Badge
											variant="outline"
											title={member.inactive.reason ?? undefined}
										>
											Inaktiv
										</Badge>
										<Button
											size="xs"
											variant="ghost"
											onClick={() =>
												setInactive.mutate({
													groupId: group.id,
													userId: member.user.id,
													reason: null,
												})
											}
										>
											Gjør aktiv
										</Button>
									</div>
								) : (
									<Button
										size="xs"
										variant="ghost"
										onClick={() => setMakingInactive(member)}
									>
										Gjør inaktiv
									</Button>
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			{makingInactive && (
				<InactiveDialog
					member={makingInactive}
					onClose={() => setMakingInactive(null)}
					onSave={(reason) =>
						setInactive.mutate(
							{ groupId: group.id, userId: makingInactive.user.id, reason },
							{ onSuccess: () => setMakingInactive(null) },
						)
					}
					saving={setInactive.isPending}
				/>
			)}
		</Section>
	);
}

function InactiveDialog({
	member,
	onClose,
	onSave,
	saving,
}: {
	member: Member;
	onClose: () => void;
	onSave: (reason: string) => void;
	saving: boolean;
}) {
	const [reason, setReason] = useState("");
	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Gjør {member.user.name} inaktiv</DialogTitle>
					<DialogDescription>
						Inaktive får ikke bøter og forventes ikke å svare på arrangementer.
						Begrunnelsen vises bare for medlemmet og sub-/admin.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<Label htmlFor="inactive-reason">Begrunnelse</Label>
					<Textarea
						id="inactive-reason"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder="F.eks. skadet ut sesongen, permisjon, flyttet"
						maxLength={500}
					/>
				</div>
				<DialogFooter>
					<Button
						disabled={!reason.trim() || saving}
						onClick={() => onSave(reason.trim())}
					>
						Gjør inaktiv
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** (Admin) Slå posisjoner av og på, og lag posisjonslisten. */
function PositionsSection({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const options = useAdminMutationOptions();
	const update = useMutation(trpc.groupAdmin.update.mutationOptions(options));
	const create = useMutation(
		trpc.groupAdmin.createPosition.mutationOptions(options),
	);
	const rename = useMutation(
		trpc.groupAdmin.updatePosition.mutationOptions(options),
	);
	const remove = useMutation(
		trpc.groupAdmin.deletePosition.mutationOptions(options),
	);
	const [newName, setNewName] = useState("");
	const [editing, setEditing] = useState<{ id: string; name: string } | null>(
		null,
	);
	const busy = create.isPending || rename.isPending || remove.isPending;

	return (
		<Section
			id="posisjoner"
			title="Posisjoner"
			description="Lag posisjonene selv, f.eks. Keeper og Spiss eller Kant og Linje."
		>
			<CheckboxField
				checked={group.usesPositions}
				disabled={update.isPending}
				onCheckedChange={(checked) =>
					update.mutate({ groupId: group.id, usesPositions: checked })
				}
			>
				Bruk posisjoner i denne gruppen
			</CheckboxField>
			{group.usesPositions && (
				<>
					<div className="divide-y rounded-lg border">
						{group.positions.length === 0 && (
							<p className="p-3 text-sm text-muted-foreground">
								Ingen posisjoner ennå.
							</p>
						)}
						{group.positions.map((position, index) => (
							<div key={position.id} className="flex items-center gap-2 p-2">
								{editing?.id === position.id ? (
									<>
										<Input
											aria-label="Nytt navn"
											value={editing.name}
											onChange={(e) =>
												setEditing({ id: position.id, name: e.target.value })
											}
											className="h-8"
										/>
										<Button
											size="sm"
											disabled={!editing.name.trim() || busy}
											onClick={() =>
												rename.mutate(
													{
														groupId: group.id,
														positionId: position.id,
														name: editing.name.trim(),
													},
													{ onSuccess: () => setEditing(null) },
												)
											}
										>
											Lagre
										</Button>
										<Button
											size="sm"
											variant="ghost"
											onClick={() => setEditing(null)}
										>
											Avbryt
										</Button>
									</>
								) : (
									<>
										<span className="flex-1 px-1">{position.name}</span>
										<Button
											size="icon"
											variant="ghost"
											aria-label={`Flytt ${position.name} opp`}
											disabled={busy || index === 0}
											onClick={() =>
												rename.mutate({
													groupId: group.id,
													positionId: position.id,
													move: "up",
												})
											}
										>
											<ArrowUpIcon />
										</Button>
										<Button
											size="icon"
											variant="ghost"
											aria-label={`Flytt ${position.name} ned`}
											disabled={busy || index === group.positions.length - 1}
											onClick={() =>
												rename.mutate({
													groupId: group.id,
													positionId: position.id,
													move: "down",
												})
											}
										>
											<ArrowDownIcon />
										</Button>
										<Button
											size="icon"
											variant="ghost"
											aria-label={`Gi ${position.name} nytt navn`}
											onClick={() =>
												setEditing({ id: position.id, name: position.name })
											}
										>
											<PencilIcon />
										</Button>
										<Button
											size="icon"
											variant="ghost"
											aria-label={`Slett ${position.name}`}
											disabled={busy}
											onClick={() =>
												window.confirm(
													`Slette ${position.name}? Spillerne med denne posisjonen står uten etterpå.`,
												) &&
												remove.mutate({
													groupId: group.id,
													positionId: position.id,
												})
											}
										>
											<Trash2Icon className="text-destructive" />
										</Button>
									</>
								)}
							</div>
						))}
					</div>
					<form
						className="flex gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							if (newName.trim())
								create.mutate(
									{ groupId: group.id, name: newName.trim() },
									{ onSuccess: () => setNewName("") },
								);
						}}
					>
						<Input
							aria-label="Ny posisjon"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="Ny posisjon, f.eks. Keeper"
							maxLength={40}
						/>
						<Button type="submit" disabled={!newName.trim() || busy}>
							Legg til
						</Button>
					</form>
				</>
			)}
		</Section>
	);
}

/** (Admin i hovedgruppen) Slå kampfakta av og på for hele laget, og lag listen over hendelser. */
function MatchFactsSection({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const options = useAdminMutationOptions();
	const update = useMutation(trpc.groupAdmin.update.mutationOptions(options));
	const create = useMutation(
		trpc.groupAdmin.addMatchStatType.mutationOptions(options),
	);
	const rename = useMutation(
		trpc.groupAdmin.updateMatchStatType.mutationOptions(options),
	);
	const remove = useMutation(
		trpc.groupAdmin.removeMatchStatType.mutationOptions(options),
	);
	const [newName, setNewName] = useState("");
	const [editing, setEditing] = useState<{ id: string; name: string } | null>(
		null,
	);
	const busy = create.isPending || rename.isPending || remove.isPending;

	return (
		<Section
			id="kampfakta"
			title="Kampfakta"
			description="Resultat og hendelser som mål og kort på kampene, også i undergruppene. Sub-/admin registrerer dem på hver kamp."
		>
			<CheckboxField
				checked={group.matchFacts.enabled}
				disabled={update.isPending}
				onCheckedChange={(checked) =>
					update.mutate({ groupId: group.id, usesMatchFacts: checked })
				}
			>
				Vis kampfakta
			</CheckboxField>
			{group.matchFacts.enabled && (
				<>
					<div className="divide-y rounded-lg border">
						{group.matchFacts.types.length === 0 && (
							<p className="p-3 text-sm text-muted-foreground">
								Ingen hendelser ennå.
							</p>
						)}
						{group.matchFacts.types.map((type, index) => (
							<div key={type.id} className="flex items-center gap-2 p-2">
								{editing?.id === type.id ? (
									<>
										<Input
											aria-label="Nytt navn"
											value={editing.name}
											onChange={(e) =>
												setEditing({ id: type.id, name: e.target.value })
											}
											className="h-8"
										/>
										<Button
											size="sm"
											disabled={!editing.name.trim() || busy}
											onClick={() =>
												rename.mutate(
													{
														groupId: group.id,
														typeId: type.id,
														name: editing.name.trim(),
													},
													{ onSuccess: () => setEditing(null) },
												)
											}
										>
											Lagre
										</Button>
										<Button
											size="sm"
											variant="ghost"
											onClick={() => setEditing(null)}
										>
											Avbryt
										</Button>
									</>
								) : (
									<>
										<span className="flex-1 px-1">{type.name}</span>
										<Button
											size="icon"
											variant="ghost"
											aria-label={`Flytt ${type.name} opp`}
											disabled={busy || index === 0}
											onClick={() =>
												rename.mutate({
													groupId: group.id,
													typeId: type.id,
													move: "up",
												})
											}
										>
											<ArrowUpIcon />
										</Button>
										<Button
											size="icon"
											variant="ghost"
											aria-label={`Flytt ${type.name} ned`}
											disabled={
												busy || index === group.matchFacts.types.length - 1
											}
											onClick={() =>
												rename.mutate({
													groupId: group.id,
													typeId: type.id,
													move: "down",
												})
											}
										>
											<ArrowDownIcon />
										</Button>
										<Button
											size="icon"
											variant="ghost"
											aria-label={`Gi ${type.name} nytt navn`}
											onClick={() =>
												setEditing({ id: type.id, name: type.name })
											}
										>
											<PencilIcon />
										</Button>
										<Button
											size="icon"
											variant="ghost"
											aria-label={`Slett ${type.name}`}
											disabled={busy}
											onClick={() =>
												window.confirm(
													`Slette ${type.name}? Alle hendelser av denne typen som er registrert på kamper, slettes også.`,
												) &&
												remove.mutate({
													groupId: group.id,
													typeId: type.id,
												})
											}
										>
											<Trash2Icon className="text-destructive" />
										</Button>
									</>
								)}
							</div>
						))}
					</div>
					<form
						className="flex gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							if (newName.trim())
								create.mutate(
									{ groupId: group.id, name: newName.trim() },
									{ onSuccess: () => setNewName("") },
								);
						}}
					>
						<Input
							aria-label="Ny hendelse"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="Ny hendelse, f.eks. Redning"
							maxLength={40}
						/>
						<Button type="submit" disabled={!newName.trim() || busy}>
							Legg til
						</Button>
					</form>
				</>
			)}
		</Section>
	);
}

/** (Admin i hovedgruppen) Undergruppene, og ny undergruppe med medlemmer fra hovedgruppen. */
function SubgroupsSection({ group }: { group: GroupDetails }) {
	const [creating, setCreating] = useState(false);
	return (
		<Section
			id="undergrupper"
			title="Undergrupper"
			description="F.eks. 11'er og 7'er, med medlemmer fra hovedgruppen."
		>
			{group.subgroups.length > 0 && (
				<div className="grid gap-2 sm:grid-cols-2">
					{group.subgroups.map((subgroup) => (
						<Link
							key={subgroup.id}
							to="/grupper/$groupId/innstillinger"
							params={{ groupId: subgroup.id }}
							className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
						>
							<GroupAvatar group={subgroup} size={32} />
							<span className="font-medium">{subgroup.name}</span>
						</Link>
					))}
				</div>
			)}
			<Button className="justify-self-start" onClick={() => setCreating(true)}>
				<PlusIcon />
				Ny undergruppe
			</Button>
			{creating && (
				<NewSubgroupDialog parent={group} onClose={() => setCreating(false)} />
			)}
		</Section>
	);
}

function MemberPicker({
	members,
	selected,
	onChange,
}: {
	members: Member[];
	selected: string[];
	onChange: (ids: string[]) => void;
}) {
	const [search, setSearch] = useState("");
	const visible = [...members]
		.sort((a, b) => a.user.name.localeCompare(b.user.name))
		.filter((m) =>
			m.user.name.toLowerCase().includes(search.trim().toLowerCase()),
		);
	const toggle = (id: string) =>
		onChange(
			selected.includes(id)
				? selected.filter((x) => x !== id)
				: [...selected, id],
		);
	const allSelected =
		members.length > 0 && members.every((m) => selected.includes(m.user.id));

	return (
		<div className="grid gap-2">
			<div className="flex items-center gap-2">
				<Input
					aria-label="Søk etter navn"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Søk etter navn"
				/>
				<Button
					type="button"
					variant="outline"
					onClick={() =>
						onChange(allSelected ? [] : members.map((m) => m.user.id))
					}
				>
					{allSelected ? "Fjern alle" : "Velg alle"}
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">
				{selected.length} av {members.length} valgt
			</p>
			<div className="max-h-64 divide-y overflow-y-auto rounded-md border">
				{visible.map((member) => (
					<div key={member.user.id} className="px-3 py-2 hover:bg-muted/50">
						<CheckboxField
							checked={selected.includes(member.user.id)}
							onCheckedChange={() => toggle(member.user.id)}
						>
							{member.user.name}
						</CheckboxField>
					</div>
				))}
			</div>
		</div>
	);
}

function NewSubgroupDialog({
	parent,
	onClose,
}: {
	parent: GroupDetails;
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const navigate = useNavigate();
	const options = useAdminMutationOptions("Undergruppen er laget");
	const [name, setName] = useState("");
	const [color, setColor] = useState(GROUP_COLORS[0]!);
	const [usesPositions, setUsesPositions] = useState(false);
	const [memberIds, setMemberIds] = useState<string[]>([]);
	const create = useMutation(
		trpc.groupAdmin.createSubgroup.mutationOptions({
			...options,
			onSuccess: (subgroup) => {
				options.onSuccess();
				onClose();
				navigate({
					to: "/grupper/$groupId/innstillinger",
					params: { groupId: subgroup.id },
				});
			},
		}),
	);

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Ny undergruppe</DialogTitle>
					<DialogDescription>
						Medlemmene velges fra {parent.name}.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<Label htmlFor="subgroup-name">Navn</Label>
					<Input
						id="subgroup-name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="F.eks. 11'er"
					/>
				</div>
				<div className="grid gap-2">
					<Label>Farge</Label>
					<ColorPicker value={color} onChange={setColor} />
				</div>
				<CheckboxField
					checked={usesPositions}
					onCheckedChange={(c) => setUsesPositions(c)}
				>
					Bruk posisjoner (du lager listen etterpå)
				</CheckboxField>
				<div className="grid gap-2">
					<Label>Medlemmer</Label>
					<MemberPicker
						members={parent.members}
						selected={memberIds}
						onChange={setMemberIds}
					/>
				</div>
				<DialogFooter>
					<Button
						disabled={!name.trim() || create.isPending}
						onClick={() =>
							create.mutate({
								parentId: parent.id,
								name: name.trim(),
								color,
								usesPositions,
								memberIds,
							})
						}
					>
						Lag undergruppe
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** (Admin i hovedgruppen) Velg medlemmer i undergruppen, eller slett den. */
function SubgroupAdminSection({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const navigate = useNavigate();
	const parent = useQuery(
		trpc.groups.get.queryOptions({ groupId: group.parentId! }),
	);
	const options = useAdminMutationOptions();
	const [selected, setSelected] = useState(group.members.map((m) => m.user.id));
	const setMembers = useMutation(
		trpc.groupAdmin.setSubgroupMembers.mutationOptions(
			useAdminMutationOptions("Medlemmene er lagret"),
		),
	);
	const remove = useMutation(
		trpc.groupAdmin.delete.mutationOptions({
			...options,
			onSuccess: () => {
				options.onSuccess();
				toast.success("Undergruppen er slettet");
				navigate({
					to: "/grupper/$groupId",
					params: { groupId: group.parentId! },
				});
			},
		}),
	);
	const removed = group.members.filter((m) => !selected.includes(m.user.id));

	return (
		<>
			<Section
				id="undergruppe-medlemmer"
				title="Medlemmer i undergruppen"
				description="De som tas ut, mister tilgangen til alt i undergruppen."
			>
				<PageState query={parent}>
					{(data) => (
						<MemberPicker
							members={data.members}
							selected={selected}
							onChange={setSelected}
						/>
					)}
				</PageState>
				<Button
					className="justify-self-start"
					disabled={setMembers.isPending}
					onClick={() => {
						if (
							removed.length > 0 &&
							!window.confirm(
								`Fjerne ${removed.map((m) => m.user.name).join(", ")}? Svarene deres på kommende arrangementer i undergruppen slettes.`,
							)
						)
							return;
						setMembers.mutate({ groupId: group.id, userIds: selected });
					}}
				>
					Lagre medlemmer
				</Button>
			</Section>
			<Section
				id="slett-undergruppe"
				title="Slett undergruppe"
				description="Arrangementer, kunngjøringer, avstemninger og chatten i undergruppen slettes for godt."
			>
				<Button
					variant="destructive"
					className="justify-self-start"
					disabled={remove.isPending}
					onClick={() =>
						window.confirm(`Slette ${group.name} med alt i den?`) &&
						remove.mutate({ groupId: group.id })
					}
				>
					<Trash2Icon />
					Slett {group.name}
				</Button>
			</Section>
		</>
	);
}

/** (Admin) Forsidebildet øverst på gruppesiden. Lagres med en gang det er valgt. */
function CoverPicker({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const [uploading, setUploading] = useState(false);
	const update = useMutation(
		trpc.groupAdmin.update.mutationOptions(useAdminMutationOptions()),
	);
	const busy = uploading || update.isPending;

	const pick = async (file: File | undefined) => {
		if (!file) return;
		setUploading(true);
		try {
			const uploaded = await uploadFile(file);
			await update.mutateAsync({
				groupId: group.id,
				coverUploadId: uploaded.id,
			});
		} catch (error) {
			toast.error(`Kunne ikke lagre bildet: ${(error as Error).message}`);
		} finally {
			setUploading(false);
		}
	};

	return (
		<div className="grid gap-2">
			<Label htmlFor="group-cover">Forsidebilde</Label>
			<div
				className="aspect-16/5 overflow-hidden rounded-xl"
				style={{ backgroundColor: group.color }}
			>
				{group.coverUrl && (
					<img src={group.coverUrl} alt="" className="size-full object-cover" />
				)}
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Input
					id="group-cover"
					type="file"
					accept="image/*"
					className="max-w-xs"
					disabled={busy}
					onChange={(e) => {
						void pick(e.target.files?.[0]);
						e.target.value = "";
					}}
				/>
				{group.coverUrl && (
					<Button
						variant="ghost"
						className="text-destructive"
						disabled={busy}
						onClick={() =>
							update.mutate({ groupId: group.id, coverUploadId: null })
						}
					>
						Fjern bilde
					</Button>
				)}
				{uploading && (
					<span className="text-sm text-muted-foreground">Laster opp…</span>
				)}
			</div>
		</div>
	);
}

/** Oppmøte og resultater som CSV, som kan åpnes i Excel eller Numbers. */
function ExportSection({ group }: { group: GroupDetails }) {
	const base = `/api/groups/${encodeURIComponent(group.id)}/export`;
	return (
		<Section
			id="eksport"
			title="Eksport"
			description="Lastes ned som CSV, som kan åpnes i Excel, Numbers eller Google Regneark."
		>
			<div className="flex flex-wrap gap-2">
				<a
					href={`${base}/attendance`}
					download
					className={buttonVariants({ variant: "outline" })}
				>
					<FileSpreadsheetIcon />
					Oppmøtehistorikk
				</a>
				<a
					href={`${base}/results`}
					download
					className={buttonVariants({ variant: "outline" })}
				>
					<TrophyIcon />
					Resultater
				</a>
			</div>
		</Section>
	);
}
