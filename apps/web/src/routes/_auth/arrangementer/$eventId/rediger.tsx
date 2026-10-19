import type { Event } from "@sporty/api/rest/types";
import { Button } from "@sporty/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EventForm } from "@/components/event-form";
import { EmptyText, PageState } from "@/components/page-state";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/arrangementer/$eventId/rediger")({
	component: EditEventComponent,
});

/** (Sub-/admin) Rediger eller slett et arrangement som ikke er ferdig. */
function EditEventComponent() {
	const { eventId } = Route.useParams();
	const trpc = useTRPC();
	const event = useQuery(trpc.events.get.queryOptions({ eventId }));

	return (
		<PageState query={event}>{(data) => <EditEvent event={data} />}</PageState>
	);
}

function EditEvent({ event }: { event: Event }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [now] = useState(() => Date.now());

	const update = useMutation(
		trpc.events.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.events.pathKey() });
				toast.success("Endringene er lagret");
				navigate({
					to: "/arrangementer/$eventId",
					params: { eventId: event.id },
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const remove = useMutation(
		trpc.events.delete.mutationOptions({
			onSuccess: async () => {
				// Gå først, så siden ikke prøver å hente arrangementet som ikke finnes lenger.
				await navigate({
					to: "/grupper/$groupId",
					params: { groupId: event.groupId },
				});
				queryClient.invalidateQueries({ queryKey: trpc.events.pathKey() });
				toast.success("Arrangementet er slettet");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!event.canManage) {
		return <EmptyText>Du kan ikke redigere dette arrangementet.</EmptyText>;
	}
	if (new Date(event.end ?? event.start).getTime() < now) {
		return <EmptyText>Arrangementet er ferdig og kan ikke endres.</EmptyText>;
	}

	return (
		<div className="mx-auto grid max-w-xl gap-5">
			<div>
				<h1 className="text-2xl font-semibold">Rediger arrangement</h1>
				<p className="text-muted-foreground">{event.groupName}</p>
			</div>
			<EventForm
				groupId={event.groupId}
				editing={event}
				busy={update.isPending}
				submitLabel="Lagre endringer"
				onSubmit={(changes) =>
					update.mutate({ eventId: event.id, event: changes })
				}
			/>
			<Button
				variant="ghost"
				className="text-destructive"
				disabled={remove.isPending}
				onClick={() =>
					window.confirm(
						`Slette «${event.title}»? Arrangementet og alle svarene slettes, og medlemmene får beskjed om at det er avlyst. Bøter som er gitt for det beholdes. Dette kan ikke angres.`,
					) && remove.mutate({ eventId: event.id })
				}
			>
				<Trash2Icon />
				Slett arrangement
			</Button>
		</div>
	);
}
