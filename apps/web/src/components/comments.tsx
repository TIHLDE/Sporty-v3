import { formatRelative } from "@sporty/api/rest/lib/dates";
import type { Comment } from "@sporty/api/rest/types";
import { Button } from "@sporty/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@sporty/ui/components/dropdown-menu";
import { Textarea } from "@sporty/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BanIcon, FlagIcon, MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ReportDialog } from "@/components/report-dialog";
import { useTRPC } from "@/utils/trpc";

/** Kommentarene under en kunngjøring eller avstemning, med felt for å skrive en ny. */
export function Comments({
	comments,
	type,
	allowComments,
	onSend,
	sending,
}: {
	comments: Comment[];
	type: "announcement" | "poll";
	allowComments: boolean;
	onSend: (body: string, done: () => void) => void;
	sending: boolean;
}) {
	const [body, setBody] = useState("");
	const trpc = useTRPC();
	const myId = useQuery(trpc.me.queryOptions()).data?.id;

	return (
		<section className="grid gap-3">
			<h2 className="font-medium">Kommentarer ({comments.length})</h2>
			{comments.length === 0 && (
				<p className="text-sm text-muted-foreground">Ingen kommentarer ennå.</p>
			)}
			<div className="grid gap-3">
				{comments.map((comment) => (
					<div key={comment.id} className="rounded-lg bg-muted/50 p-3">
						<div className="flex items-start gap-2">
							<p className="min-w-0 flex-1 text-sm">
								<span className="font-medium">{comment.author.name}</span>{" "}
								<span className="text-muted-foreground">
									· {formatRelative(comment.createdAt)}
								</span>
							</p>
							{comment.author.id !== myId && (
								<CommentActions comment={comment} type={type} />
							)}
						</div>
						<p className="whitespace-pre-wrap">{comment.body}</p>
					</div>
				))}
			</div>
			{allowComments ? (
				<form
					className="grid gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						if (body.trim()) onSend(body.trim(), () => setBody(""));
					}}
				>
					<Textarea
						value={body}
						onChange={(e) => setBody(e.target.value)}
						placeholder="Skriv en kommentar…"
					/>
					<Button
						type="submit"
						className="justify-self-end"
						disabled={!body.trim() || sending}
					>
						Send
					</Button>
				</form>
			) : (
				<p className="text-sm text-muted-foreground">
					Kommentarer er slått av.
				</p>
			)}
		</section>
	);
}

/** Rapporter kommentaren eller blokker den som skrev den. */
function CommentActions({
	comment,
	type,
}: {
	comment: Comment;
	type: "announcement" | "poll";
}) {
	const [reportOpen, setReportOpen] = useState(false);
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const report = useMutation(
		trpc.messages.reportComment.mutationOptions({
			onSuccess: () => toast.success("Takk, kommentaren er rapportert"),
			onError: (error) =>
				toast.error(`Rapporten ble ikke sendt: ${error.message}`),
		}),
	);
	const block = useMutation(
		trpc.messages.block.mutationOptions({
			onSuccess: () => {
				toast.success(`${comment.author.name} er blokkert`);
				queryClient.invalidateQueries();
			},
			onError: (error) =>
				toast.error(`Personen ble ikke blokkert: ${error.message}`),
		}),
	);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					aria-label="Valg for kommentaren"
					className="rounded-full p-1 text-muted-foreground outline-none hover:text-foreground"
				>
					<MoreHorizontalIcon className="size-4" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={() => setReportOpen(true)}>
						<FlagIcon />
						Rapporter
					</DropdownMenuItem>
					<DropdownMenuItem
						variant="destructive"
						onClick={() => {
							if (
								window.confirm(
									`Blokkere ${comment.author.name}? Du ser ikke lenger meldingene og kommentarene deres.`,
								)
							)
								block.mutate({ userId: comment.author.id });
						}}
					>
						<BanIcon />
						Blokker {comment.author.name}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<ReportDialog
				open={reportOpen}
				onOpenChange={setReportOpen}
				title="Hvorfor rapporterer du kommentaren?"
				onSelect={(reason) =>
					report.mutate({ type, commentId: comment.id, reason })
				}
			/>
		</>
	);
}
