import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { GroupAvatar } from "@/components/group-avatar";
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
} as const;

/** Lagene du er med i. Idrettslagene hentes fra tihlde.org. */
function GroupsComponent() {
	const trpc = useTRPC();
	const groups = useQuery(trpc.groups.list.queryOptions());

	return (
		<div className="grid w-4xl gap-4">
			<h1 className="text-2xl font-semibold">Grupper</h1>
			<PageState query={groups}>
				{(data) =>
					data.length === 0 ? (
						<EmptyText>
							Du er ikke med i noen grupper. Idrettslagene dine på tihlde.org
							dukker opp her.
						</EmptyText>
					) : (
						<div className="grid gap-3 sm:grid-cols-2">
							{data.map((group) => (
								<Link
									key={group.id}
									to="/grupper/$groupId"
									params={{ groupId: group.id }}
									className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-muted"
								>
									<GroupAvatar group={group} size={48} />
									<div className="min-w-0">
										<p className="truncate font-medium">{group.name}</p>
										{group.myRole && (
											<p className="text-sm text-muted-foreground">
												{ROLE_LABEL[group.myRole]}
											</p>
										)}
									</div>
								</Link>
							))}
						</div>
					)
				}
			</PageState>
		</div>
	);
}
