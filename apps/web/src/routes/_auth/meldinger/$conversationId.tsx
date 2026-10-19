import { formatTime } from "@sporty/api/rest/lib/dates";
import type {
	ConversationDetails,
	Message as MessageDto,
} from "@sporty/api/rest/types";
import { Bubble, BubbleContent } from "@sporty/ui/components/bubble";
import { Button } from "@sporty/ui/components/button";
import { Textarea } from "@sporty/ui/components/textarea";
import { cn } from "@sporty/ui/lib/utils";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon, Loader2, SendIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageState } from "@/components/page-state";
import { UserAvatar } from "@/components/user-avatar";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/meldinger/$conversationId")({
	component: ConversationComponent,
});

/** Meldinger fra samme person innenfor dette vinduet slås sammen (navn og bilde vises én gang). */
const GROUP_WINDOW_MS = 5 * 60 * 1000;
/** Hvor ofte nye meldinger hentes mens samtalen er åpen. */
const POLL_MS = 5000;

const dayLabel = new Intl.DateTimeFormat("nb-NO", {
	weekday: "long",
	day: "numeric",
	month: "long",
});
const sameDay = (a: string, b: string) =>
	new Date(a).toDateString() === new Date(b).toDateString();

function formatDay(iso: string) {
	const date = new Date(iso).toDateString();
	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	if (date === new Date().toDateString()) return "I dag";
	if (date === yesterday.toDateString()) return "I går";
	return dayLabel.format(new Date(iso));
}

function ConversationComponent() {
	const { conversationId } = Route.useParams();
	const trpc = useTRPC();
	const conversation = useQuery(
		trpc.messages.conversation.queryOptions({ conversationId }),
	);

	return (
		<PageState query={conversation}>
			{(data) => <Chat conversation={data} />}
		</PageState>
	);
}

function Chat({ conversation }: { conversation: ConversationDetails }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const me = useQuery(trpc.me.queryOptions());
	const messages = useInfiniteQuery({
		...trpc.messages.page.infiniteQueryOptions(
			{ conversationId: conversation.id },
			{ getNextPageParam: (page) => page.nextCursor },
		),
		refetchInterval: POLL_MS,
	});
	const isGroup = conversation.group !== null;
	// Nyeste først, som API-et gir dem.
	const all = messages.data?.pages.flatMap((p) => p.messages) ?? [];
	const newestId = all[0]?.id;

	// Marker som lest når samtalen åpnes og hver gang det kommer en ny melding.
	const { mutate: markRead } = useMutation(
		trpc.messages.markRead.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.messages.conversations.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.notifications.unread.queryKey(),
				});
			},
		}),
	);
	useEffect(() => {
		if (newestId) markRead({ conversationId: conversation.id });
	}, [newestId, conversation.id, markRead]);

	return (
		<div className="flex h-[calc(100svh-8rem)] flex-col gap-3">
			<div className="flex items-center gap-3">
				<Link
					to="/meldinger"
					aria-label="Til meldinger"
					className="text-muted-foreground hover:text-foreground"
				>
					<ArrowLeftIcon className="size-5" />
				</Link>
				<div>
					<h1 className="text-lg font-semibold">{conversation.title}</h1>
					{isGroup && (
						<p className="text-xs text-muted-foreground">
							{conversation.memberCount} medlemmer
						</p>
					)}
				</div>
			</div>

			{/* Snudd liste: står nederst (nyeste) fra start, og eldre meldinger lastes inn over. */}
			<div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto rounded-xl border p-3">
				{messages.isPending ? (
					<Loader2 className="m-auto animate-spin text-muted-foreground" />
				) : all.length === 0 ? (
					<p className="m-auto text-sm text-muted-foreground">
						Ingen meldinger ennå. Si hei! 👋
					</p>
				) : (
					<>
						{all.map((message, index) => (
							<MessageItem
								key={message.id}
								message={message}
								older={all[index + 1]}
								isMine={message.sender.id === me.data?.id}
								showSender={isGroup}
							/>
						))}
						{messages.hasNextPage && (
							<Button
								variant="ghost"
								size="sm"
								className="self-center"
								disabled={messages.isFetchingNextPage}
								onClick={() => messages.fetchNextPage()}
							>
								{messages.isFetchingNextPage
									? "Laster…"
									: "Vis eldre meldinger"}
							</Button>
						)}
					</>
				)}
			</div>

			<Composer conversationId={conversation.id} />
		</div>
	);
}

function MessageItem({
	message,
	older,
	isMine,
	showSender,
}: {
	message: MessageDto;
	older: MessageDto | undefined;
	isMine: boolean;
	showSender: boolean;
}) {
	const newDay = !older || !sameDay(older.sentAt, message.sentAt);
	// Første melding i en rekke fra samme person: vis navn og bilde.
	const startsRun =
		newDay ||
		older.sender.id !== message.sender.id ||
		new Date(message.sentAt).getTime() - new Date(older.sentAt).getTime() >
			GROUP_WINDOW_MS;
	const showOther = !isMine && showSender;

	return (
		<div>
			{newDay && (
				<p className="py-3 text-center text-xs font-medium text-muted-foreground">
					{formatDay(message.sentAt)}
				</p>
			)}
			<div
				className={cn(
					"flex items-end gap-2",
					isMine ? "justify-end" : "justify-start",
					startsRun ? "mt-2" : "mt-0.5",
				)}
			>
				{showOther && (
					<div className="w-8 shrink-0">
						{startsRun && (
							<UserAvatar user={message.sender} className="size-8" />
						)}
					</div>
				)}
				<div
					className={cn(
						"flex max-w-[78%] flex-col gap-0.5",
						isMine ? "items-end" : "items-start",
					)}
				>
					{showOther && startsRun && (
						<span className="px-1 text-xs text-muted-foreground">
							{message.sender.name}
						</span>
					)}
					<Bubble
						variant={isMine ? "default" : "muted"}
						align={isMine ? "end" : "start"}
						className="max-w-full"
					>
						<BubbleContent className="text-sm whitespace-pre-wrap">
							{message.body}
							<span
								className={cn(
									"mt-0.5 block text-right text-[10px]",
									isMine ? "opacity-70" : "text-muted-foreground",
								)}
							>
								{formatTime(message.sentAt)}
							</span>
						</BubbleContent>
					</Bubble>
				</div>
			</div>
		</div>
	);
}

function Composer({ conversationId }: { conversationId: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [text, setText] = useState("");
	const send = useMutation(
		trpc.messages.send.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.messages.page.pathKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.messages.conversations.queryKey(),
				});
			},
		}),
	);

	const submit = () => {
		const body = text.trim();
		if (!body || send.isPending) return;
		setText("");
		send.mutate(
			{ conversationId, body },
			{
				onError: (error) => {
					setText(body);
					toast.error(`Meldingen ble ikke sendt: ${error.message}`);
				},
			},
		);
	};

	return (
		<form
			className="flex items-end gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				submit();
			}}
		>
			<Textarea
				aria-label="Melding"
				className="max-h-32 min-h-10 flex-1 resize-none"
				rows={1}
				maxLength={4000}
				placeholder="Skriv en melding"
				value={text}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => {
					// Enter sender, Shift+Enter gir ny linje.
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						submit();
					}
				}}
			/>
			<Button
				type="submit"
				size="icon"
				aria-label="Send"
				disabled={!text.trim() || send.isPending}
			>
				<SendIcon />
			</Button>
		</form>
	);
}
