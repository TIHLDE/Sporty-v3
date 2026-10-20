import {
	formatDayOfMonth,
	formatEventRange,
	formatMonthShort,
} from "@sporty/api/rest/lib/dates";
import type { Event } from "@sporty/api/rest/types";
import { Badge } from "@sporty/ui/components/badge";
import { Button } from "@sporty/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon, MapPinIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import {
	answeringClosed,
	EVENT_TYPE_LABEL,
	locationLabel,
	summarize,
} from "@/lib/events";
import { useTRPC } from "@/utils/trpc";

/** Et arrangement i en liste: dato, tittel, tid, sted, hvor mange som kommer, og ditt svar. */
export function EventCard({
	event,
	showGroup = false,
}: {
	event: Event;
	showGroup?: boolean;
}) {
	const trpc = useTRPC();
	const me = useQuery(trpc.me.queryOptions());
	const myId = me.data?.id;
	const { kommer, kommerIkke } = summarize(event);
	const myStatus = myId ? event.attendance[myId] : undefined;
	const canAnswer =
		Boolean(myId && event.memberIds.includes(myId)) && !answeringClosed(event);

	return (
		<div className="flex gap-4 rounded-xl border p-4">
			<div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-muted py-1.5">
				<span className="text-xs font-medium text-muted-foreground">
					{formatMonthShort(event.start)}
				</span>
				<span className="text-xl leading-tight font-semibold">
					{formatDayOfMonth(event.start)}
				</span>
			</div>
			<div className="grid min-w-0 flex-1 gap-1">
				<div className="flex flex-wrap items-center gap-2">
					<Link
						to="/arrangementer/$eventId"
						params={{ eventId: event.id }}
						className="font-medium hover:underline"
					>
						{event.title}
						{event.opponent ? ` mot ${event.opponent}` : ""}
					</Link>
					<Badge variant="outline">{EVENT_TYPE_LABEL[event.type]}</Badge>
				</div>
				<p className="text-sm text-muted-foreground">
					{showGroup ? `${event.groupName} · ` : ""}
					{formatEventRange(event.start, event.end)}
				</p>
				<p className="flex items-center gap-1 text-sm text-muted-foreground">
					<MapPinIcon className="size-3.5" />
					{locationLabel(event.location)}
				</p>
				<p className="text-xs text-muted-foreground">
					{kommer.length} kommer · {kommerIkke.length} kommer ikke
				</p>
			</div>
			{canAnswer && <AnswerButtons eventId={event.id} myStatus={myStatus} />}
		</div>
	);
}

/** Kommer / Kommer ikke. Det valgte svaret er fylt ut. */
export function AnswerButtons({
	eventId,
	myStatus,
}: {
	eventId: string;
	myStatus: "kommer" | "kommer_ikke" | undefined;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const respond = useMutation(
		trpc.events.respond.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: trpc.events.pathKey() }),
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">
			<Button
				size="sm"
				variant={myStatus === "kommer" ? "default" : "outline"}
				disabled={respond.isPending}
				onClick={() => respond.mutate({ eventId, status: "kommer" })}
			>
				<CheckIcon />
				Kommer
			</Button>
			<Button
				size="sm"
				variant={myStatus === "kommer_ikke" ? "destructive" : "outline"}
				disabled={respond.isPending}
				onClick={() => respond.mutate({ eventId, status: "kommer_ikke" })}
			>
				<XIcon />
				Kommer ikke
			</Button>
		</div>
	);
}
