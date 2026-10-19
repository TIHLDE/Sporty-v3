import { formatRelative } from "@sporty/api/rest/lib/dates";
import type { Comment } from "@sporty/api/rest/types";
import { Button } from "@sporty/ui/components/button";
import { Textarea } from "@sporty/ui/components/textarea";
import { useState } from "react";

/** Kommentarene under en kunngjøring eller avstemning, med felt for å skrive en ny. */
export function Comments({
	comments,
	allowComments,
	onSend,
	sending,
}: {
	comments: Comment[];
	allowComments: boolean;
	onSend: (body: string, done: () => void) => void;
	sending: boolean;
}) {
	const [body, setBody] = useState("");

	return (
		<section className="grid gap-3">
			<h2 className="font-medium">Kommentarer ({comments.length})</h2>
			{comments.length === 0 && (
				<p className="text-sm text-muted-foreground">Ingen kommentarer ennå.</p>
			)}
			<div className="grid gap-3">
				{comments.map((comment) => (
					<div key={comment.id} className="rounded-lg bg-muted/50 p-3">
						<p className="text-sm">
							<span className="font-medium">{comment.author.name}</span>{" "}
							<span className="text-muted-foreground">
								· {formatRelative(comment.createdAt)}
							</span>
						</p>
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
