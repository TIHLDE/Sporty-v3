import { formatRelative } from "@sporty/api/rest/lib/dates";
import type { Conversation } from "@sporty/api/rest/types";
import { Button } from "@sporty/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@sporty/ui/components/dialog";
import { Input } from "@sporty/ui/components/input";
import { cn } from "@sporty/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SquarePenIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { GroupAvatar } from "@/components/group-avatar";
import { EmptyText, PageState } from "@/components/page-state";
import { UserAvatar } from "@/components/user-avatar";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/meldinger/")({
	component: ConversationsComponent,
});

/** Gruppechatter og direktemeldinger, sist aktive først. */
function ConversationsComponent() {
	const trpc = useTRPC();
	const conversations = useQuery({
		...trpc.messages.conversations.queryOptions(),
		refetchInterval: 15_000,
	});
	const me = useQuery(trpc.me.queryOptions());
	const [composing, setComposing] = useState(false);

	return (
		<div className="grid grid-cols-1 gap-6">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-2xl font-semibold">Meldinger</h1>
				<Button onClick={() => setComposing(true)}>
					<SquarePenIcon />
					Ny melding
				</Button>
			</div>
			<PageState query={conversations}>
				{(data) =>
					data.length === 0 ? (
						<EmptyText>Ingen samtaler ennå.</EmptyText>
					) : (
						<div className="divide-y rounded-xl border">
							{data.map((conversation) => (
								<ConversationRow
									key={conversation.id}
									conversation={conversation}
									myId={me.data?.id}
								/>
							))}
						</div>
					)
				}
			</PageState>
			{composing && <NewMessageDialog onClose={() => setComposing(false)} />}
		</div>
	);
}

function ConversationRow({
	conversation,
	myId,
}: {
	conversation: Conversation;
	myId: string | undefined;
}) {
	const last = conversation.lastMessage;
	const unread = conversation.unread > 0;

	return (
		<Link
			to="/meldinger/$conversationId"
			params={{ conversationId: conversation.id }}
			className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
		>
			{conversation.group ? (
				<GroupAvatar
					group={{ ...conversation.group, logoUrl: null }}
					size={40}
				/>
			) : (
				conversation.otherUser && (
					<UserAvatar user={conversation.otherUser} className="size-10" />
				)
			)}
			<div className="grid min-w-0 flex-1 grid-cols-1 gap-0.5">
				<div className="flex items-center justify-between gap-2">
					<span className="truncate font-semibold">{conversation.title}</span>
					{last && (
						<span className="shrink-0 text-xs text-muted-foreground">
							{formatRelative(last.sentAt)}
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					<span
						className={cn(
							"flex-1 truncate text-sm",
							unread ? "font-medium" : "text-muted-foreground",
						)}
					>
						{last
							? `${last.senderId === myId ? "Du" : last.senderName.split(" ")[0]}: ${last.body}`
							: "Ingen meldinger ennå"}
					</span>
					{unread && (
						<span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs font-semibold text-primary-foreground">
							{conversation.unread}
						</span>
					)}
				</div>
			</div>
		</Link>
	);
}

/** Ny direktemelding: velg en person du deler en gruppe med. */
function NewMessageDialog({ onClose }: { onClose: () => void }) {
	const trpc = useTRPC();
	const navigate = useNavigate();
	const contacts = useQuery(trpc.messages.contacts.queryOptions());
	const [search, setSearch] = useState("");
	const direct = useMutation(
		trpc.messages.direct.mutationOptions({
			onSuccess: ({ id }) =>
				navigate({
					to: "/meldinger/$conversationId",
					params: { conversationId: id },
				}),
			onError: (error) => toast.error(error.message),
		}),
	);
	const q = search.trim().toLowerCase();

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Ny melding</DialogTitle>
					<DialogDescription>
						Du kan skrive til alle du deler en gruppe med.
					</DialogDescription>
				</DialogHeader>
				<Input
					aria-label="Søk etter navn"
					placeholder="Søk etter navn"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
				<div className="max-h-80 overflow-y-auto">
					<PageState query={contacts}>
						{(data) => {
							const filtered = data.filter((u) =>
								u.name.toLowerCase().includes(q),
							);
							return filtered.length === 0 ? (
								<p className="py-6 text-center text-sm text-muted-foreground">
									Ingen treff
								</p>
							) : (
								<div className="divide-y">
									{filtered.map((user) => (
										<button
											key={user.id}
											type="button"
											disabled={direct.isPending}
											onClick={() => direct.mutate({ userId: user.id })}
											className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-muted"
										>
											<UserAvatar user={user} />
											<span className="grid">
												<span className="font-medium">{user.name}</span>
												{user.email && (
													<span className="text-xs text-muted-foreground">
														{user.email}
													</span>
												)}
											</span>
										</button>
									))}
								</div>
							);
						}}
					</PageState>
				</div>
			</DialogContent>
		</Dialog>
	);
}
