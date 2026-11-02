import { Button } from "@sporty/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@sporty/ui/components/dialog";
import { Textarea } from "@sporty/ui/components/textarea";
import { cn } from "@sporty/ui/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

const TONE = {
	// Lyse flater (arrangementssiden, arrangementspanelet).
	surface: {
		chosen: "bg-primary text-primary-foreground hover:bg-primary/85",
		primary: "bg-primary text-primary-foreground hover:bg-primary/85",
		other: "border-input bg-transparent text-foreground hover:bg-muted",
	},
	// Den mørke delen av billetten på Hjem.
	board: {
		chosen: "bg-signal text-signal-foreground hover:bg-signal/90",
		primary: "bg-signal text-signal-foreground hover:bg-signal/90",
		other:
			"border-board-foreground/35 bg-transparent text-board-foreground hover:bg-board-foreground/10",
	},
};

/**
 * Kommer / Kommer ikke. Det valgte svaret er fylt ut, med hake. «Kommer ikke» krever en
 * begrunnelse, som skrives i en dialog (og kan endres ved å klikke på knappen igjen).
 * Uten svar er «Kommer» hovedknappen.
 */
export function AnswerButtons({
	eventId,
	myStatus,
	myReason,
	tone = "surface",
	className,
}: {
	eventId: string;
	myStatus: "kommer" | "kommer_ikke" | undefined;
	myReason: string | undefined;
	tone?: keyof typeof TONE;
	className?: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [askingReason, setAskingReason] = useState(false);
	const respond = useMutation(
		trpc.events.respond.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.events.pathKey() });
				setAskingReason(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const styles = TONE[tone];
	const look = (answer: "kommer" | "kommer_ikke") => {
		if (myStatus === answer) return styles.chosen;
		if (!myStatus && answer === "kommer") return styles.primary;
		return styles.other;
	};

	return (
		<div className={cn("grid grid-cols-2 gap-2", className)}>
			<Button
				size="lg"
				aria-pressed={myStatus === "kommer"}
				className={cn("font-semibold", look("kommer"))}
				disabled={respond.isPending}
				onClick={() => respond.mutate({ eventId, status: "kommer" })}
			>
				{myStatus === "kommer" && <CheckIcon />}
				Kommer
			</Button>
			<Button
				size="lg"
				variant="outline"
				aria-pressed={myStatus === "kommer_ikke"}
				className={cn("font-semibold", look("kommer_ikke"))}
				disabled={respond.isPending}
				onClick={() => setAskingReason(true)}
			>
				{myStatus === "kommer_ikke" && <CheckIcon />}
				Kommer ikke
			</Button>
			{askingReason && (
				<AbsenceDialog
					initialReason={myReason ?? ""}
					pending={respond.isPending}
					onSubmit={(reason) =>
						respond.mutate({ eventId, status: "kommer_ikke", reason })
					}
					onClose={() => setAskingReason(false)}
				/>
			)}
		</div>
	);
}

function AbsenceDialog({
	initialReason,
	pending,
	onSubmit,
	onClose,
}: {
	initialReason: string;
	pending: boolean;
	onSubmit: (reason: string) => void;
	onClose: () => void;
}) {
	const [reason, setReason] = useState(initialReason);
	const valid = reason.trim().length > 0;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<form
					className="grid gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						if (valid) onSubmit(reason.trim());
					}}
				>
					<DialogHeader>
						<DialogTitle>Hvorfor kan du ikke komme?</DialogTitle>
						<DialogDescription>
							Begrunnelsen vises for alle som ser arrangementet.
						</DialogDescription>
					</DialogHeader>
					<Textarea
						aria-label="Begrunnelse"
						rows={3}
						maxLength={300}
						placeholder="F.eks. syk, eksamen, jobb …"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
					/>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							Avbryt
						</Button>
						<Button
							type="submit"
							variant="destructive"
							disabled={!valid || pending}
						>
							Meld avbud
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
