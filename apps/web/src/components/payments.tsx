import { formatEventStart } from "@sporty/api/rest/lib/dates";
import type {
	GroupDetails,
	PaymentRequest,
	PaymentStatus,
	User,
} from "@sporty/api/rest/types";
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
import { CheckIcon, ClockIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyText, PageState } from "@/components/page-state";
import { UserAvatar } from "@/components/user-avatar";
import { deadlineInDays, isPastInput } from "@/lib/datetime";
import { useTRPC } from "@/utils/trpc";

const kroner = new Intl.NumberFormat("nb-NO", {
	style: "currency",
	currency: "NOK",
	maximumFractionDigits: 0,
});

/**
 * Betalingene i gruppen. Selve betalingen skjer i Vipps; medlemmene markerer selv at de har betalt,
 * og sub-/admin sjekker Vipps og godkjenner eller avviser.
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
	const [reviewing, setReviewing] = useState(false);
	const { myStatus } = payment;
	// Tidspunktet tas én gang når kortet vises (ikke ved hver tegning).
	const [now] = useState(() => Date.now());
	const overdue =
		myStatus !== "approved" && new Date(payment.dueDate).getTime() < now;
	const setPaid = useMutation(
		trpc.payments.setPaid.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: trpc.payments.pathKey() }),
			onError: (error) => toast.error(error.message),
		}),
	);

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
					{payment.approvedCount} av {payment.memberCount} har betalt
					{payment.canManage &&
						payment.pendingCount > 0 &&
						` · ${payment.pendingCount} venter`}
				</span>
			</div>
			<div className="flex flex-wrap items-center gap-3">
				{myStatus === "approved" ? (
					<Badge className="bg-green-600 text-white">
						<CheckIcon />
						Betalt
					</Badge>
				) : myStatus === "pending" ? (
					<Button
						size="sm"
						className="bg-amber-500 text-white hover:bg-amber-500/90"
						disabled={setPaid.isPending}
						title="Klikk for å angre"
						onClick={() => {
							if (window.confirm("Angre «Jeg har betalt»?"))
								setPaid.mutate({ paymentId: payment.id, paid: false });
						}}
					>
						<ClockIcon />
						Venter på godkjenning
					</Button>
				) : (
					<Button
						size="sm"
						disabled={setPaid.isPending}
						onClick={() =>
							setPaid.mutate({ paymentId: payment.id, paid: true })
						}
					>
						Jeg har betalt
					</Button>
				)}
				{payment.canManage && (
					<Button
						size="sm"
						variant="outline"
						onClick={() => setReviewing(true)}
					>
						Se og godkjenn
						{payment.pendingCount > 0 && ` (${payment.pendingCount} venter)`}
					</Button>
				)}
			</div>
			{myStatus === "rejected" && (
				<p className="text-sm text-destructive">
					Betalingen ble avvist. Sjekk at du har betalt riktig beløp.
				</p>
			)}
			{reviewing && (
				<ReviewDialog
					payment={payment}
					group={group}
					onClose={() => setReviewing(false)}
				/>
			)}
		</div>
	);
}

/** (Sub-/admin) Alle medlemmene og statusen deres. Godkjenn eller avvis dem som venter. */
function ReviewDialog({
	payment,
	group,
	onClose,
}: {
	payment: PaymentRequest;
	group: GroupDetails;
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const review = useMutation(
		trpc.payments.review.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: trpc.payments.pathKey() }),
			onError: (error) => toast.error(error.message),
		}),
	);
	const confirmations = payment.confirmations ?? [];
	const byStatus = (status: PaymentStatus) =>
		confirmations.filter((c) => c.status === status).map((c) => c.user);
	const confirmed = new Set(confirmations.map((c) => c.user.id));
	const unpaid = group.members
		.map((m) => m.user)
		.filter((u) => !confirmed.has(u.id))
		.sort((a, b) => a.name.localeCompare(b.name));

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[85svh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{payment.title}</DialogTitle>
					<DialogDescription>
						Sjekk Vipps før du godkjenner. {payment.approvedCount} av{" "}
						{payment.memberCount} har betalt.
					</DialogDescription>
				</DialogHeader>
				<ReviewSection
					title="Venter på godkjenning"
					users={byStatus("pending")}
				>
					{(user) => (
						<div className="flex gap-2">
							<Button
								size="sm"
								disabled={review.isPending}
								onClick={() =>
									review.mutate({
										paymentId: payment.id,
										userId: user.id,
										status: "approved",
									})
								}
							>
								Godkjenn
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="text-destructive"
								disabled={review.isPending}
								onClick={() =>
									review.mutate({
										paymentId: payment.id,
										userId: user.id,
										status: "rejected",
									})
								}
							>
								Avvis
							</Button>
						</div>
					)}
				</ReviewSection>
				<ReviewSection title="Betalt" users={byStatus("approved")} />
				<ReviewSection title="Avvist" users={byStatus("rejected")} />
				<ReviewSection title="Ikke betalt" users={unpaid} />
			</DialogContent>
		</Dialog>
	);
}

function ReviewSection({
	title,
	users,
	children,
}: {
	title: string;
	users: User[];
	children?: (user: User) => React.ReactNode;
}) {
	if (users.length === 0) return null;
	return (
		<section className="grid gap-2">
			<h3 className="text-sm font-medium text-muted-foreground">
				{title} ({users.length})
			</h3>
			{users.map((user) => (
				<div key={user.id} className="flex items-center gap-3">
					<UserAvatar user={user} className="size-8" />
					<span className="flex-1 truncate text-sm">{user.name}</span>
					{children?.(user)}
				</div>
			))}
		</section>
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
