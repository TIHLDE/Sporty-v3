import type { Event } from "@sporty/api/rest/types";
import { Button } from "@sporty/ui/components/button";
import { cn } from "@sporty/ui/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GavelIcon } from "lucide-react";
import { toast } from "sonner";

import { answeringClosed } from "@/lib/events";
import { useTRPC } from "@/utils/trpc";

/**
 * Om sub-/admin kan gi fellesbot nå: etter at man ikke lenger kan svare, til noen som ikke har
 * svart, og bare én gang.
 */
export function canGiveCollectiveFine(event: Event, unansweredCount: number) {
	return (
		event.canGiveFines &&
		answeringClosed(event) &&
		unansweredCount > 0 &&
		!event.collectiveFineGiven
	);
}

/** (Sub-/admin) Én bot til alle som ikke har svart. Brukes på arrangementet og på kortet. */
export function CollectiveFineButton({
	eventId,
	count,
	className,
}: {
	eventId: string;
	count: number;
	className?: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const collectiveFine = useMutation(
		trpc.events.collectiveFine.mutationOptions({
			onSuccess: ({ count: given }) => {
				queryClient.invalidateQueries({ queryKey: trpc.events.pathKey() });
				queryClient.invalidateQueries({ queryKey: trpc.fines.pathKey() });
				toast.success(
					`Fellesbot gitt: ${given} ${given === 1 ? "medlem" : "medlemmer"} fikk 1 bot.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Button
			variant="outline"
			className={cn(
				"justify-self-start border-destructive text-destructive dark:border-destructive",
				className,
			)}
			disabled={collectiveFine.isPending}
			onClick={() =>
				window.confirm(
					`Gi fellesbot? ${count} medlemmer som ikke har svart får 1 bot hver.`,
				) && collectiveFine.mutate({ eventId })
			}
		>
			<GavelIcon />
			Gi fellesbot ({count})
		</Button>
	);
}
