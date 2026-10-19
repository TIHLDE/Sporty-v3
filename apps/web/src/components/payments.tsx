import { formatEventStart } from "@sporty/api/rest/lib/dates";
import type { GroupDetails, PaymentRequest } from "@sporty/api/rest/types";
import { Badge } from "@sporty/ui/components/badge";
import { Button } from "@sporty/ui/components/button";
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
import { Textarea } from "@sporty/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyText, PageState } from "@/components/page-state";
import { deadlineInDays, isPastInput } from "@/lib/datetime";
import { useTRPC } from "@/utils/trpc";

const kroner = new Intl.NumberFormat("nb-NO", {
	style: "currency",
	currency: "NOK",
	maximumFractionDigits: 0,
});

/**
 * Betalingene i gruppen. Selve betalingen skjer i Vipps; medlemmene markerer selv at de har betalt,
 * og sub-/admin ser hvem som mangler.
 */
export function PaymentsTab({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const payments = useQuery(
		trpc.payments.byGroup.queryOptions({ groupId: group.id }),
	);
	const [creating, setCreating] = useState(false);

	return (
		<div className="grid gap-3">
			<p className="text-sm text-muted-foreground">
				Betaling skjer i Vipps, ikke på nettsiden. Marker selv når du har
				betalt.
			</p>
			{group.canManage && (
				<Button
					className="justify-self-start"
					onClick={() => setCreating(true)}
				>
					<PlusIcon />
					Ny betaling
				</Button>
			)}
			<PageState query={payments}>
				{(data) =>
					data.length === 0 ? (
						<EmptyText>Ingen betalinger.</EmptyText>
					) : (
						data.map((payment) => (
							<PaymentCard key={payment.id} payment={payment} group={group} />
						))
					)
				}
			</PageState>
			{creating && (
				<NewPaymentDialog group={group} onClose={() => setCreating(false)} />
			)}
		</div>
	);
}

function PaymentCard({
	payment,
	group,
}: {
	payment: PaymentRequest;
	group: GroupDetails;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const me = useQuery(trpc.me.queryOptions());
	const paid = Boolean(me.data && payment.paidUserIds.includes(me.data.id));
	// Tidspunktet tas én gang når kortet vises (ikke ved hver tegning).
	const [now] = useState(() => Date.now());
	const overdue = !paid && new Date(payment.dueDate).getTime() < now;
	const setPaid = useMutation(
		trpc.payments.setPaid.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: trpc.payments.pathKey() }),
			onError: (error) => toast.error(error.message),
		}),
	);
	const unpaidNames = group.members
		.filter((m) => !payment.paidUserIds.includes(m.user.id))
		.map((m) => m.user.name)
		.sort((a, b) => a.localeCompare(b));

	return (
		<div className="grid gap-3 rounded-xl border p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p className="font-medium">{payment.title}</p>
					{payment.description && (
						<p className="text-sm text-muted-foreground">
							{payment.description}
						</p>
					)}
				</div>
				<p className="text-xl font-semibold">{kroner.format(payment.amount)}</p>
			</div>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
				<span>
					Vipps: <span className="font-medium">{payment.vippsNumber}</span>
				</span>
				<span
					className={overdue ? "text-destructive" : "text-muted-foreground"}
				>
					Frist {formatEventStart(payment.dueDate)}
				</span>
				<span className="text-muted-foreground">
					{payment.paidUserIds.length} av {payment.memberCount} har betalt
				</span>
			</div>
			<div className="flex flex-wrap items-center gap-3">
				<Button
					size="sm"
					variant={paid ? "secondary" : "default"}
					disabled={setPaid.isPending}
					onClick={() => setPaid.mutate({ paymentId: payment.id, paid: !paid })}
				>
					{paid && <CheckIcon />}
					{paid ? "Du har betalt (angre)" : "Jeg har betalt"}
				</Button>
				{paid && <Badge variant="secondary">Betalt</Badge>}
			</div>
			{payment.canManage && unpaidNames.length > 0 && (
				<details className="text-sm">
					<summary className="cursor-pointer text-muted-foreground">
						Ikke betalt ({unpaidNames.length})
					</summary>
					<p className="mt-2">{unpaidNames.join(", ")}</p>
				</details>
			)}
		</div>
	);
}

function NewPaymentDialog({
	group,
	onClose,
}: {
	group: GroupDetails;
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [amount, setAmount] = useState("");
	const [vippsNumber, setVippsNumber] = useState("");
	const [dueDate, setDueDate] = useState(() => deadlineInDays(14));
	const create = useMutation(
		trpc.payments.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.payments.pathKey() });
				toast.success("Betalingen er lagt ut");
				onClose();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const amountNumber = Number(amount);
	const dueDateInPast = isPastInput(dueDate);
	const valid =
		title.trim() &&
		amountNumber > 0 &&
		vippsNumber.trim() &&
		dueDate &&
		!dueDateInPast;

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Ny betaling</DialogTitle>
					<DialogDescription>
						{group.name}. Alle medlemmene får varsel.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<Label htmlFor="payment-title">Tittel</Label>
					<Input
						id="payment-title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="F.eks. Kontingent høst"
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="payment-description">Beskrivelse (valgfritt)</Label>
					<Textarea
						id="payment-description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
				</div>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="grid gap-2">
						<Label htmlFor="payment-amount">Beløp (kr)</Label>
						<Input
							id="payment-amount"
							inputMode="numeric"
							placeholder="350"
							value={amount}
							onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="payment-vipps">Vipps-nummer</Label>
						<Input
							id="payment-vipps"
							inputMode="tel"
							placeholder="123 45 678"
							value={vippsNumber}
							onChange={(e) => setVippsNumber(e.target.value)}
						/>
					</div>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="payment-due">Frist</Label>
					<Input
						id="payment-due"
						type="datetime-local"
						value={dueDate}
						onChange={(e) => setDueDate(e.target.value)}
					/>
					{dueDateInPast && (
						<p className="text-sm text-destructive">
							Fristen må være frem i tid
						</p>
					)}
				</div>
				<DialogFooter>
					<Button
						disabled={!valid || create.isPending}
						onClick={() =>
							create.mutate({
								groupId: group.id,
								title: title.trim(),
								description: description.trim(),
								amount: amountNumber,
								vippsNumber: vippsNumber.trim(),
								dueDate: new Date(dueDate).toISOString(),
							})
						}
					>
						Legg ut
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
