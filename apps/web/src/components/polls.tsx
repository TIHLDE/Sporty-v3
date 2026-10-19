import { formatEventStart, formatRelative } from "@sporty/api/rest/lib/dates";
import type { GroupDetails, Poll } from "@sporty/api/rest/types";
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
import { Link } from "@tanstack/react-router";
import { MessageSquareIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CheckboxField } from "@/components/checkbox-field";
import { EmptyText, PageState } from "@/components/page-state";
import { deadlineInDays, isPastInput } from "@/lib/datetime";
import { useTRPC } from "@/utils/trpc";

/** Avstemningene i gruppen. Sub-/admin kan lage nye. */
export function PollsTab({ group }: { group: GroupDetails }) {
	const trpc = useTRPC();
	const polls = useQuery(
		trpc.polls.byGroup.queryOptions({ groupId: group.id }),
	);
	const [creating, setCreating] = useState(false);

	return (
		<div className="grid gap-3">
			{group.canManage && (
				<Button
					className="justify-self-start"
					onClick={() => setCreating(true)}
				>
					<PlusIcon />
					Ny avstemning
				</Button>
			)}
			<PageState query={polls}>
				{(data) =>
					data.length === 0 ? (
						<EmptyText>Ingen avstemninger.</EmptyText>
					) : (
						data.map((poll) => <PollCard key={poll.id} poll={poll} />)
					)
				}
			</PageState>
			{creating && (
				<NewPollDialog group={group} onClose={() => setCreating(false)} />
			)}
		</div>
	);
}

/** Spørsmålet med alternativene. Man stemmer ved å trykke; resultatet vises når det er synlig. */
export function PollCard({
	poll,
	linkToDetails = true,
}: {
	poll: Poll;
	linkToDetails?: boolean;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const vote = useMutation(
		trpc.polls.vote.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: trpc.polls.pathKey() }),
			onError: (error) => toast.error(error.message),
		}),
	);
	const total = poll.options.reduce((sum, o) => sum + (o.voteCount ?? 0), 0);

	const toggle = (optionId: string) => {
		const chosen = poll.myOptionIds.includes(optionId);
		const optionIds = poll.allowMultiple
			? chosen
				? poll.myOptionIds.filter((id) => id !== optionId)
				: [...poll.myOptionIds, optionId]
			: chosen
				? []
				: [optionId];
		vote.mutate({ pollId: poll.id, optionIds });
	};

	return (
		<div className="grid gap-3 rounded-xl border p-4">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					{linkToDetails ? (
						<Link
							to="/avstemninger/$pollId"
							params={{ pollId: poll.id }}
							className="font-medium hover:underline"
						>
							{poll.question}
						</Link>
					) : (
						<h1 className="text-xl font-semibold">{poll.question}</h1>
					)}
					{poll.description && (
						<p className="text-sm text-muted-foreground">{poll.description}</p>
					)}
				</div>
				<Badge variant={poll.closed ? "secondary" : "outline"}>
					{poll.closed
						? "Avsluttet"
						: `Frist ${formatEventStart(poll.closesAt)}`}
				</Badge>
			</div>

			<div className="grid gap-2">
				{poll.options.map((option) => {
					const chosen = poll.myOptionIds.includes(option.id);
					const share =
						poll.resultsVisible && total > 0
							? Math.round(((option.voteCount ?? 0) / total) * 100)
							: 0;
					return (
						<button
							key={option.id}
							type="button"
							disabled={poll.closed || vote.isPending}
							onClick={() => toggle(option.id)}
							aria-pressed={chosen}
							className={`relative overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-default ${chosen ? "border-primary" : "hover:bg-muted/50"}`}
						>
							{poll.resultsVisible && (
								<span
									className="absolute inset-y-0 left-0 bg-muted"
									style={{ width: `${share}%` }}
									aria-hidden
								/>
							)}
							<span className="relative flex items-center justify-between gap-3">
								<span className={chosen ? "font-medium" : undefined}>
									{option.label}
								</span>
								{poll.resultsVisible && (
									<span className="text-sm text-muted-foreground">
										{option.voteCount} ({share}%)
									</span>
								)}
							</span>
						</button>
					);
				})}
			</div>

			<p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
				<span>
					{poll.createdByName ?? "Ukjent"} · {formatRelative(poll.createdAt)}
				</span>
				<span>{poll.allowMultiple ? "Flere valg" : "Ett valg"}</span>
				{poll.voterCount !== null && <span>{poll.voterCount} har stemt</span>}
				{!poll.resultsVisible && (
					<span>Resultatet vises når fristen har gått ut</span>
				)}
				{poll.allowComments && (
					<span className="flex items-center gap-1">
						<MessageSquareIcon className="size-3.5" />
						{poll.commentCount}
					</span>
				)}
			</p>
		</div>
	);
}

const toIso = (value: string) => new Date(value).toISOString();
const MAX_OPTIONS = 20;

function NewPollDialog({
	group,
	onClose,
}: {
	group: GroupDetails;
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [question, setQuestion] = useState("");
	const [description, setDescription] = useState("");
	const [options, setOptions] = useState(["", ""]);
	const [closesAt, setClosesAt] = useState(() => deadlineInDays(3));
	const [allowMultiple, setAllowMultiple] = useState(false);
	const [hideVotes, setHideVotes] = useState(false);
	const [allowComments, setAllowComments] = useState(true);

	const create = useMutation(
		trpc.polls.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.polls.pathKey() });
				toast.success("Avstemningen er lagt ut");
				onClose();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const filled = options.map((o) => o.trim()).filter(Boolean);
	const hasDuplicates =
		new Set(filled.map((o) => o.toLowerCase())).size !== filled.length;
	const deadlineInPast = isPastInput(closesAt);
	const valid =
		question.trim() &&
		filled.length >= 2 &&
		!hasDuplicates &&
		closesAt &&
		!deadlineInPast;

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Ny avstemning</DialogTitle>
					<DialogDescription>
						{group.name}. Alle medlemmene får varsel.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<Label htmlFor="poll-question">Spørsmål</Label>
					<Input
						id="poll-question"
						value={question}
						onChange={(e) => setQuestion(e.target.value)}
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="poll-description">Beskrivelse (valgfritt)</Label>
					<Textarea
						id="poll-description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
				</div>
				<div className="grid gap-2">
					<Label>Alternativer</Label>
					{options.map((option, index) => (
						<div key={index} className="flex gap-2">
							<Input
								aria-label={`Alternativ ${index + 1}`}
								value={option}
								onChange={(e) =>
									setOptions(
										options.map((o, i) => (i === index ? e.target.value : o)),
									)
								}
								placeholder={`Alternativ ${index + 1}`}
							/>
							{options.length > 2 && (
								<Button
									type="button"
									size="icon"
									variant="ghost"
									aria-label={`Fjern alternativ ${index + 1}`}
									onClick={() =>
										setOptions(options.filter((_, i) => i !== index))
									}
								>
									<XIcon />
								</Button>
							)}
						</div>
					))}
					{hasDuplicates && (
						<p className="text-sm text-destructive">To alternativer er like</p>
					)}
					{options.length < MAX_OPTIONS && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="justify-self-start"
							onClick={() => setOptions([...options, ""])}
						>
							<PlusIcon />
							Legg til alternativ
						</Button>
					)}
				</div>
				<div className="grid gap-2">
					<Label htmlFor="poll-closes">Frist</Label>
					<Input
						id="poll-closes"
						type="datetime-local"
						value={closesAt}
						onChange={(e) => setClosesAt(e.target.value)}
					/>
					{deadlineInPast && (
						<p className="text-sm text-destructive">
							Fristen må være frem i tid
						</p>
					)}
				</div>
				<div className="grid gap-2 text-sm">
					<CheckboxField
						checked={allowMultiple}
						onCheckedChange={(c) => setAllowMultiple(c)}
					>
						Tillat flere valg
					</CheckboxField>
					<CheckboxField
						checked={hideVotes}
						onCheckedChange={(c) => setHideVotes(c)}
					>
						Skjul stemmene til fristen har gått ut (sub-/admin ser dem hele
						tiden)
					</CheckboxField>
					<CheckboxField
						checked={allowComments}
						onCheckedChange={(c) => setAllowComments(c)}
					>
						Tillat kommentarer
					</CheckboxField>
				</div>
				<DialogFooter>
					<Button
						disabled={!valid || create.isPending}
						onClick={() =>
							create.mutate({
								groupId: group.id,
								question: question.trim(),
								description: description.trim(),
								options: filled,
								allowMultiple,
								hideVotes,
								allowComments,
								closesAt: toIso(closesAt),
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
