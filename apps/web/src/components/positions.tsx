import type { GroupDetails } from "@sporty/api/rest/types";
import { Button } from "@sporty/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

/**
 * «Kommer» delt inn etter posisjon i gruppen, i gruppens rekkefølge (f.eks. Keeper, Forsvar …),
 * så man ser om det mangler noen på en posisjon. De uten posisjon kommer sist.
 */
export function ParticipantsByPosition({
	title,
	ids,
	group,
}: {
	title: string;
	ids: string[];
	group: GroupDetails;
}) {
	const people = group.members
		.filter((m) => ids.includes(m.user.id))
		.sort((a, b) => a.user.name.localeCompare(b.user.name));
	const sections = [
		...group.positions.map((p) => ({
			key: p.id,
			title: p.name,
			names: people
				.filter((m) => m.position?.id === p.id)
				.map((m) => m.user.name),
		})),
		{
			key: "none",
			title: "Uten posisjon",
			names: people.filter((m) => !m.position).map((m) => m.user.name),
		},
	].filter((section) => section.names.length > 0);

	return (
		<section className="rounded-xl border p-4">
			<h2 className="mb-2 font-medium">
				{title} <span className="text-muted-foreground">({ids.length})</span>
			</h2>
			{sections.length === 0 ? (
				<p className="text-sm text-muted-foreground">Ingen</p>
			) : (
				<div className="grid gap-3">
					{sections.map((section) => (
						<div key={section.key}>
							<h3 className="text-xs font-medium text-muted-foreground uppercase">
								{section.title} ({section.names.length})
							</h3>
							<ul className="grid gap-1 text-sm">
								{section.names.map((name, index) => (
									<li key={`${name}-${index}`}>{name}</li>
								))}
							</ul>
						</div>
					))}
				</div>
			)}
		</section>
	);
}

/** Vises på arrangementet når gruppen bruker posisjoner og man ikke har valgt sin egen. */
export function ChoosePositionPrompt({
	group,
	myId,
}: {
	group: GroupDetails;
	myId: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const setPosition = useMutation(
		trpc.groupAdmin.setPosition.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.groups.pathKey() });
				toast.success("Posisjonen er lagret");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<div className="grid gap-2 rounded-xl border p-4">
			<div>
				<p className="font-medium">Velg posisjonen din</p>
				<p className="text-sm text-muted-foreground">
					Så ser alle hvor du spiller når du kommer.
				</p>
			</div>
			<div className="flex flex-wrap gap-2">
				{group.positions.map((position) => (
					<Button
						key={position.id}
						size="sm"
						variant="outline"
						disabled={setPosition.isPending}
						onClick={() =>
							setPosition.mutate({
								groupId: group.id,
								userId: myId,
								positionId: position.id,
							})
						}
					>
						{position.name}
					</Button>
				))}
			</div>
		</div>
	);
}
