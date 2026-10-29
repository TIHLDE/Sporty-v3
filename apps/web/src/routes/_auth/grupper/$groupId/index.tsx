import { formatRelative } from "@sporty/api/rest/lib/dates";
import type { GroupDetails, Member } from "@sporty/api/rest/types";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@sporty/ui/components/avatar";
import { Badge } from "@sporty/ui/components/badge";
import { Button } from "@sporty/ui/components/button";
import { Input } from "@sporty/ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@sporty/ui/components/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@sporty/ui/components/tabs";
import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	CircleDollarSignIcon,
	FileImageIcon,
	FileTextIcon,
	PlusIcon,
	SettingsIcon,
} from "lucide-react";
import { useState } from "react";

import { AnnouncementsTab } from "@/components/announcements";
import { EventCard } from "@/components/event-card";
import { GroupAvatar } from "@/components/group-avatar";
import { Markdown } from "@/components/markdown";
import { MemberDialog } from "@/components/member-dialog";
import { NotificationList } from "@/components/notifications";
import { EmptyText, PageState } from "@/components/page-state";
import { PaymentsTab } from "@/components/payments";
import { PollsTab } from "@/components/polls";
import { StatsTab } from "@/components/stats";
import { eventTargets } from "@/lib/events";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/grupper/$groupId/")({
	component: GroupComponent,
});

const ROLE_LABEL = {
	admin: "Admin",
	subadmin: "Subadmin",
	botsjef: "Botsjef",
	member: "Medlem",
	index: "Index",
} as const;
// Index sorteres og vises som et vanlig medlem, siden rollen ikke skal fremheves.
const ROLE_ORDER = {
	admin: 0,
	subadmin: 1,
	botsjef: 2,
	member: 3,
	index: 3,
} as const;

function GroupComponent() {
	const { groupId } = Route.useParams();
	const trpc = useTRPC();
	const group = useQuery(trpc.groups.get.queryOptions({ groupId }));

	return (
		<PageState query={group}>{(data) => <GroupView group={data} />}</PageState>
	);
}

function GroupView({ group }: { group: GroupDetails }) {
	// Bøter gjelder hovedgruppen.
	const finesHere = !group.parentId && group.fines.activated;

	return (
		<div className="grid max-w-4xl grid-cols-1 gap-6">
			{group.parentId && (
				<Link
					to="/grupper/$groupId"
					params={{ groupId: group.parentId }}
					className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeftIcon className="size-4" />
					Til hovedgruppen
				</Link>
			)}

			{group.coverUrl && (
				<img
					src={group.coverUrl}
					alt=""
					className="aspect-16/5 w-full rounded-xl object-cover"
				/>
			)}

			<div className="flex flex-wrap items-center gap-4">
				<GroupAvatar group={group} size={64} />
				<div className="min-w-0 flex-1">
					<h1 className="text-2xl font-semibold">{group.name}</h1>
					{group.description && (
						<Markdown className="text-muted-foreground">
							{group.description}
						</Markdown>
					)}
				</div>
				<div className="flex flex-wrap gap-2">
					{finesHere && (
						<Button
							variant="outline"
							nativeButton={false}
							render={<Link to="/boter" search={{ gruppe: group.id }} />}
						>
							<CircleDollarSignIcon />
							Bøter
						</Button>
					)}
					{group.canManage && (
						<Button
							variant="outline"
							nativeButton={false}
							render={
								<Link
									to="/grupper/$groupId/innstillinger"
									params={{ groupId: group.id }}
								/>
							}
						>
							<SettingsIcon />
							Innstillinger
						</Button>
					)}
					{eventTargets(group).length > 0 && (
						<Button
							nativeButton={false}
							render={
								<Link
									to="/grupper/$groupId/nytt-arrangement"
									params={{ groupId: group.id }}
								/>
							}
						>
							<PlusIcon />
							Nytt arrangement
						</Button>
					)}
				</div>
			</div>

			<Tabs defaultValue="arrangementer">
				<TabsList className="max-w-full justify-start overflow-x-auto">
					<TabsTrigger value="arrangementer">Arrangementer</TabsTrigger>
					<TabsTrigger value="kunngjoringer">Kunngjøringer</TabsTrigger>
					<TabsTrigger value="avstemninger">Avstemninger</TabsTrigger>
					<TabsTrigger value="betalinger">Betalinger</TabsTrigger>
					<TabsTrigger value="filer">Filer</TabsTrigger>
					<TabsTrigger value="statistikk">Statistikk</TabsTrigger>
					<TabsTrigger value="varsler">Varsler</TabsTrigger>
					<TabsTrigger value="medlemmer">
						Medlemmer ({group.members.length})
					</TabsTrigger>
					{!group.parentId && (
						<TabsTrigger value="undergrupper">
							Undergrupper ({group.subgroups.length})
						</TabsTrigger>
					)}
				</TabsList>
				<TabsContent value="arrangementer" className="pt-4">
					<GroupEvents group={group} />
				</TabsContent>
				<TabsContent value="kunngjoringer" className="pt-4">
					<AnnouncementsTab group={group} />
				</TabsContent>
				<TabsContent value="avstemninger" className="pt-4">
					<PollsTab group={group} />
				</TabsContent>
				<TabsContent value="betalinger" className="pt-4">
					<PaymentsTab group={group} />
				</TabsContent>
				<TabsContent value="filer" className="pt-4">
					<FilesTab groupId={group.id} />
				</TabsContent>
				<TabsContent value="statistikk" className="pt-4">
					<StatsTab group={group} />
				</TabsContent>
				<TabsContent value="varsler" className="pt-4">
					<NotificationList groupId={group.id} />
				</TabsContent>
				<TabsContent value="medlemmer" className="pt-4">
					<Members group={group} />
				</TabsContent>
				<TabsContent value="undergrupper" className="grid gap-3 pt-4">
					{group.subgroups.length === 0 && (
						<EmptyText>
							{group.canAdmin
								? "Ingen undergrupper ennå. Lag f.eks. et 11'er- eller 7'er-lag med medlemmer fra laget."
								: "Laget har ingen undergrupper."}
						</EmptyText>
					)}
					{group.subgroups.length > 0 && (
						<div className="grid gap-3 sm:grid-cols-2">
							{group.subgroups.map((subgroup) => (
								<Link
									key={subgroup.id}
									to="/grupper/$groupId"
									params={{ groupId: subgroup.id }}
									className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted"
								>
									<GroupAvatar group={subgroup} size={40} />
									<span className="font-medium">{subgroup.name}</span>
								</Link>
							))}
						</div>
					)}
					{group.canAdmin && (
						<Button
							variant="outline"
							className="justify-self-start"
							nativeButton={false}
							render={
								<Link
									to="/grupper/$groupId/innstillinger"
									params={{ groupId: group.id }}
								/>
							}
						>
							<PlusIcon />
							Ny undergruppe
						</Button>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}

/**
 * Kommende eller tidligere arrangementer i gruppen. På en hovedgruppe er undergruppenes
 * arrangementer med, merket med navnet på undergruppen.
 */
function GroupEvents({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
	const groupIds = [group.id, ...group.subgroups.map((s) => s.id)];
	const results = useQueries({
		queries: groupIds.map((groupId) =>
			trpc.events.byGroup.queryOptions({ groupId, when }),
		),
	});
	const failed = results.find((r) => r.isError);
	const events = {
		isPending: results.some((r) => r.isPending),
		isError: Boolean(failed),
		error: failed?.error ?? null,
		data: results.every((r) => r.data)
			? results
					.flatMap((r) => r.data ?? [])
					.sort((a, b) =>
						when === "upcoming"
							? a.start.localeCompare(b.start)
							: b.start.localeCompare(a.start),
					)
			: undefined,
	};

	return (
		<div className="grid gap-3">
			<div className="flex gap-2">
				<Button
					size="sm"
					variant={when === "upcoming" ? "secondary" : "ghost"}
					onClick={() => setWhen("upcoming")}
				>
					Kommende
				</Button>
				<Button
					size="sm"
					variant={when === "past" ? "secondary" : "ghost"}
					onClick={() => setWhen("past")}
				>
					Tidligere
				</Button>
			</div>
			<PageState query={events}>
				{(data) =>
					data.length === 0 ? (
						<EmptyText>
							{when === "upcoming"
								? "Ingen kommende arrangementer."
								: "Ingen tidligere arrangementer."}
						</EmptyText>
					) : (
						data.map((event) => (
							<EventCard
								key={event.id}
								event={event}
								showGroup={event.groupId !== group.id}
							/>
						))
					)
				}
			</PageState>
		</div>
	);
}

/** Filene i gruppen. Som i appen vises de bare i listen foreløpig. */
function FilesTab({ groupId }: { groupId: string }) {
	const trpc = useTRPC();
	const files = useQuery(trpc.groups.files.queryOptions({ groupId }));

	return (
		<PageState query={files}>
			{(data) =>
				data.length === 0 ? (
					<EmptyText>Ingen filer.</EmptyText>
				) : (
					<div className="divide-y rounded-xl border">
						{data.map((file) => (
							<div key={file.id} className="flex items-center gap-3 px-4 py-3">
								<span className="flex size-9 items-center justify-center rounded-lg bg-muted">
									{file.kind === "image" ? (
										<FileImageIcon className="size-4" />
									) : (
										<FileTextIcon className="size-4" />
									)}
								</span>
								<div className="grid">
									<span className="font-medium">{file.name}</span>
									<span className="text-xs text-muted-foreground">
										{file.sizeKb >= 1000
											? `${(file.sizeKb / 1000).toFixed(1)} MB`
											: `${file.sizeKb} kB`}{" "}
										· {formatRelative(file.uploadedAt)}
									</span>
								</div>
							</div>
						))}
					</div>
				)
			}
		</PageState>
	);
}

/**
 * Medlemmene med rolle, posisjon og om de er inaktive. Sub-/admin klikker på et medlem for å endre
 * rolle, posisjon, undergrupper og status.
 */
function Members({ group }: { group: GroupDetails }) {
	const [query, setQuery] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const q = query.trim().toLowerCase();
	const members = [...group.members]
		.filter((m) => !q || m.user.name.toLowerCase().includes(q))
		.sort(
			(a: Member, b: Member) =>
				ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
				a.user.name.localeCompare(b.user.name),
		);
	const showPositions = group.usesPositions;
	// Hentes fra gruppen hver gang, så dialogen viser endringene når de er lagret.
	const editing = group.members.find((m) => m.user.id === editingId);
	return (
		<div className="grid gap-3">
			<Input
				aria-label="Søk etter medlem"
				placeholder="Søk etter medlem"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				className="max-w-xs"
			/>
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
						<TableRow
							key={member.user.id}
							{...(group.canManage && {
								className: "cursor-pointer",
								tabIndex: 0,
								"aria-label": `Endre ${member.user.name}`,
								onClick: () => setEditingId(member.user.id),
								onKeyDown: (e: React.KeyboardEvent) => {
									if (e.key === "Enter") setEditingId(member.user.id);
								},
							})}
						>
							<TableCell className="inline-flex items-center gap-2">
								<Avatar>
									<AvatarImage />
									<AvatarFallback>
										{member.user.name
											.split(" ")
											.slice(0, 2)
											.map((n) => n[0].toUpperCase())
											.join("")}
									</AvatarFallback>
								</Avatar>
								<div className="font-medium">{member.user.name}</div>
								{member.subgroupNames.length > 0 && (
									<div className="text-xs text-muted-foreground">
										{member.subgroupNames.join(" · ")}
									</div>
								)}
							</TableCell>
							<TableCell>
								{member.role === "member" || member.role === "index" ? (
									<span className="text-muted-foreground">Medlem</span>
								) : (
									<Badge
										variant={member.role === "admin" ? "default" : "secondary"}
									>
										{ROLE_LABEL[member.role]}
									</Badge>
								)}
							</TableCell>
							{showPositions && (
								<TableCell className="text-muted-foreground">
									{member.position?.name ?? "–"}
								</TableCell>
							)}
							<TableCell>
								{member.inactive ? (
									<Badge
										variant="outline"
										title={member.inactive.reason ?? undefined}
									>
										Inaktiv
									</Badge>
								) : (
									<span className="text-muted-foreground">Aktiv</span>
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			{group.canManage && editing && (
				<MemberDialog
					group={group}
					member={editing}
					onClose={() => setEditingId(null)}
				/>
			)}
		</div>
	);
}
