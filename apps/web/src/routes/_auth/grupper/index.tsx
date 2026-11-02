import type { Group } from "@sporty/api/rest/types";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";

import { GroupAvatar } from "@/components/group-avatar";
import { GroupBadge } from "@/components/group-badge";
import { EmptyText, PageState } from "@/components/page-state";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/grupper/")({
	component: GroupsComponent,
});

const ROLE_LABEL = {
	admin: "Admin",
	subadmin: "Subadmin",
	botsjef: "Botsjef",
	member: "Medlem",
	index: "Index",
} as const;

/** Lagene du er med i, holdt lett. Arrangementer og resten ligger inne i hver gruppe. */
function GroupsComponent() {
	const trpc = useTRPC();
	const groups = useQuery(trpc.groups.list.queryOptions());

	return (
		<div className="grid w-full max-w-5xl gap-6">
			<h1 className="flex items-baseline gap-3 text-3xl font-bold tracking-tight">
				Grupper
				{groups.data && groups.data.length > 0 && (
					<span className="text-sm font-normal text-muted-foreground">
						{groups.data.length} lag
					</span>
				)}
			</h1>
			<PageState query={groups}>
				{(data) =>
					data.length === 0 ? (
						<EmptyText>
							Du er ikke med i noen grupper. Idrettslagene dine på tihlde.org
							dukker opp her.
						</EmptyText>
					) : (
						<div className="grid gap-4 md:grid-cols-2">
							{data.map((group) => (
								<GroupCard key={group.id} group={group} all={data} />
							))}
						</div>
					)
				}
			</PageState>
		</div>
	);
}

function GroupCard({ group, all }: { group: Group; all: Group[] }) {
	const parent = all.find((g) => g.id === group.parentId);
	const subgroups = all.filter((g) => g.parentId === group.id);

	return (
		<div className="overflow-hidden rounded-2xl border bg-card transition-colors hover:border-input">
			<div
				aria-hidden
				className="h-2"
				style={{ backgroundColor: group.color }}
			/>
			<Link
				to="/grupper/$groupId"
				params={{ groupId: group.id }}
				className="flex items-center gap-4 p-5 outline-none focus-visible:bg-muted"
			>
				<GroupAvatar group={group} size={52} />
				<span className="grid min-w-0 flex-1 gap-1.5">
					<span className="truncate text-lg font-bold">{group.name}</span>
					<span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
						{group.myRole && group.myRole !== "index" && (
							<span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
								{ROLE_LABEL[group.myRole]}
							</span>
						)}
						{group.parentId
							? `Undergruppe av ${parent?.name ?? "en annen gruppe"}`
							: "Hovedgruppe"}
					</span>
				</span>
				<ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
			</Link>
			{subgroups.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 border-t px-5 py-3 text-sm text-muted-foreground">
					Undergrupper
					{subgroups.map((sub) => (
						<Link
							key={sub.id}
							to="/grupper/$groupId"
							params={{ groupId: sub.id }}
							className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-semibold text-foreground hover:bg-muted"
						>
							<GroupBadge group={sub} className="h-4 px-1 text-[10px]" />
							{sub.name}
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
