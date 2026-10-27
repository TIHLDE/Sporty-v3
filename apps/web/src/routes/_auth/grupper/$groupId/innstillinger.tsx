import { GROUP_COLORS } from "@sporty/api/rest/lib/group-colors";
import type { GroupDetails, Member, Role } from "@sporty/api/rest/types";
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
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { CheckboxField } from "@/components/checkbox-field";
import { GroupAvatar } from "@/components/group-avatar";
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
	return (
		<div className="grid grid-cols-1 gap-8">
			<Link
				to="/grupper/$groupId"
				params={{ groupId: group.id }}
				className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ArrowLeftIcon className="size-4" />
				{group.name}
			</Link>
			<h1 className="text-2xl font-semibold">Innstillinger</h1>

			{group.canAdmin && <GroupDetailsSection group={group} />}
			<MembersSection group={group} />
			{group.canAdmin && <PositionsSection group={group} />}
			{group.canAdmin && !group.parentId && <MatchFactsSection group={group} />}
			{group.canAdmin && !group.parentId && <SubgroupsSection group={group} />}
			{group.canAdmin && group.parentId && (
				<SubgroupAdminSection group={group} />
			)}
			<ExportSection group={group} />
		</div>
	);
}

function Section({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<section className="grid gap-4 rounded-xl border p-5">
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
