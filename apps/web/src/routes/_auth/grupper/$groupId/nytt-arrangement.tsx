import type { GroupDetails } from "@sporty/api/rest/types";
import { Label } from "@sporty/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@sporty/ui/components/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { EventForm } from "@/components/event-form";
import { EmptyText, PageState } from "@/components/page-state";
import { eventTargets } from "@/lib/events";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute(
	"/_auth/grupper/$groupId/nytt-arrangement",
)({
	component: NewEventComponent,
});

/** (Sub-/admin) Lag et arrangement i gruppen eller en av undergruppene. */
function NewEventComponent() {
	const { groupId } = Route.useParams();
	const trpc = useTRPC();
	const group = useQuery(trpc.groups.get.queryOptions({ groupId }));

	return (
		<PageState query={group}>{(data) => <NewEvent group={data} />}</PageState>
	);
}

function NewEvent({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const targets = eventTargets(group);
	const [targetId, setTargetId] = useState(targets[0]?.id ?? group.id);

	const create = useMutation(
		trpc.events.create.mutationOptions({
			onSuccess: (event) => {
				queryClient.invalidateQueries({ queryKey: trpc.events.pathKey() });
				toast.success("Arrangementet er laget");
				navigate({
					to: "/arrangementer/$eventId",
					params: { eventId: event.id },
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (targets.length === 0) {
		return (
			<EmptyText>Du kan ikke lage arrangementer i denne gruppen.</EmptyText>
		);
	}

	const target = targets.find((t) => t.id === targetId) ?? targets[0];
	return (
		<div className="mx-auto grid max-w-xl gap-5">
			<div>
				<h1 className="text-2xl font-semibold">Nytt arrangement</h1>
				<p className="text-muted-foreground">{group.name}</p>
			</div>
			<EventForm
				groupId={group.id}
				busy={create.isPending}
				submitLabel="Lag arrangement"
				onSubmit={(event) => create.mutate({ groupId: targetId, event })}
				extra={
					targets.length > 1 && (
						<div className="grid gap-2">
							<Label>Hvem er det for?</Label>
							<Select
								value={targetId}
								onValueChange={(value) => value && setTargetId(value)}
							>
								<SelectTrigger className="w-full" aria-label="Hvem er det for?">
									<SelectValue>{target?.label}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{targets.map((t) => (
										<SelectItem key={t.id} value={t.id}>
											{t.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-sm text-muted-foreground">
								Alle i gruppen du velger får varsel.
							</p>
						</div>
					)
				}
			/>
		</div>
	);
}
