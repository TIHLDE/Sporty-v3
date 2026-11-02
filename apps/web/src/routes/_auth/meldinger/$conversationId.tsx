import { formatTime } from "@sporty/api/rest/lib/dates";
import { REACTION_EMOJIS, canStillChange } from "@sporty/api/rest/lib/messages";
import type {
	ConversationDetails,
	Message as MessageDto,
} from "@sporty/api/rest/types";
import { Bubble, BubbleContent } from "@sporty/ui/components/bubble";
import { Button } from "@sporty/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@sporty/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@sporty/ui/components/dropdown-menu";
import { Textarea } from "@sporty/ui/components/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@sporty/ui/components/tooltip";
import { cn } from "@sporty/ui/lib/utils";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	CheckCheckIcon,
	CheckIcon,
	CopyIcon,
	Loader2,
	MoreHorizontalIcon,
	PencilIcon,
	PlusIcon,
	ReplyIcon,
	SendIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EmojiPicker } from "@/components/emoji-picker";
import { PageState } from "@/components/page-state";
import { UserAvatar } from "@/components/user-avatar";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/meldinger/$conversationId")({
	component: ConversationComponent,
});

/** Hva skrivefeltet gjør i tillegg til å sende en ny melding. */
type ComposerTarget = { mode: "reply" | "edit"; message: MessageDto } | null;

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
	const [text, setText] = useState("");
	const [target, setTarget] = useState<ComposerTarget>(null);
	const { mutate: react } = useMutation(
		trpc.messages.react.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: trpc.messages.page.pathKey(),
				}),
			onError: (error) =>
				toast.error(`Reaksjonen ble ikke lagret: ${error.message}`),
		}),
	);
	const remove = useMutation(
		trpc.messages.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.messages.page.pathKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.messages.conversations.queryKey(),
				});
			},
			onError: (error) =>
				toast.error(`Meldingen ble ikke slettet: ${error.message}`),
		}),
	);
	// Nyeste først, som API-et gir dem.
	const all = messages.data?.pages.flatMap((p) => p.messages) ?? [];
	const newestId = all[0]?.id;
	// Lest-status vises bare når den nyeste meldingen i samtalen er min egen.
	const myId = me.data?.id;
	const readAt = messages.data?.pages[0]?.readAt ?? null;

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
		<div className="flex h-[calc(100svh-8rem)] w-4xl flex-col gap-3">
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
								isMine={message.sender.id === myId}
								myId={myId}
								showSender={isGroup}
								status={
									index === 0 && message.sender.id === myId
										? readAt && readAt >= message.sentAt
											? "read"
											: "delivered"
										: null
								}
								onReply={() => setTarget({ mode: "reply", message })}
								onReact={(emoji) =>
									react({
										conversationId: conversation.id,
										messageId: message.id,
										emoji,
									})
								}
								onEdit={() => {
									setTarget({ mode: "edit", message });
									setText(message.body);
								}}
								onDelete={() => {
									if (window.confirm("Slette meldingen for alle i samtalen?"))
										remove.mutate({
											conversationId: conversation.id,
											messageId: message.id,
										});
								}}
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

			<Composer
				conversationId={conversation.id}
				text={text}
				setText={setText}
				target={target}
				isMyMessage={target?.message.sender.id === myId}
				onCancel={() => {
					// Avbrutt redigering skal ikke la teksten bli liggende i feltet.
					if (target?.mode === "edit") setText("");
					setTarget(null);
				}}
			/>
		</div>
	);
}

function MessageItem({
	message,
	older,
	isMine,
	myId,
	showSender,
	status,
	onReply,
	onEdit,
	onDelete,
	onReact,
}: {
	message: MessageDto;
	older: MessageDto | undefined;
	isMine: boolean;
	myId: string | undefined;
	showSender: boolean;
	status: "delivered" | "read" | null;
	onReply: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onReact: (emoji: string) => void;
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
					"group/message flex items-end gap-2",
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
				{isMine && !message.deleted && (
					<MessageActions
						message={message}
						isMine={isMine}
						onReply={onReply}
						onEdit={onEdit}
						onDelete={onDelete}
						onReact={onReact}
					/>
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
						variant={message.deleted ? "outline" : isMine ? "default" : "muted"}
						align={isMine ? "end" : "start"}
						className="max-w-full"
					>
						<BubbleContent
							className={cn(
								"rounded-lg text-sm whitespace-pre-wrap",
								message.deleted && "border text-muted-foreground italic",
							)}
						>
							{message.replyTo && !message.deleted && (
								<span
									className={cn(
										"mb-1.5 block rounded-md border-l-2 px-2 py-1 not-italic",
										isMine
											? "border-current/70 bg-white/15"
											: "border-primary bg-background/60",
									)}
								>
									<span className="block truncate text-xs font-semibold">
										{message.replyTo.senderName}
									</span>
									<span
										className={cn(
											"line-clamp-2 text-xs opacity-80",
											message.replyTo.deleted && "italic",
										)}
									>
										{message.replyTo.deleted
											? "Meldingen ble slettet"
											: message.replyTo.body}
									</span>
								</span>
							)}
							{message.deleted ? "Meldingen ble slettet" : message.body}
							<span
								className={cn(
									"mt-0.5 flex items-center justify-end gap-1 text-[10px]",
									isMine ? "opacity-70" : "text-muted-foreground",
								)}
							>
								{message.edited && !message.deleted && "redigert · "}
								{formatTime(message.sentAt)}
								{status === "read" && (
									<CheckCheckIcon className="size-3.5" aria-label="Lest" />
								)}
								{status === "delivered" && (
									<CheckIcon className="size-3.5" aria-label="Levert" />
								)}
							</span>
						</BubbleContent>
					</Bubble>
					<MessageReactions
						reactions={message.reactions}
						myId={myId}
						onToggle={onReact}
					/>
				</div>
				{!isMine && !message.deleted && (
					<MessageActions
						message={message}
						isMine={isMine}
						onReply={onReply}
						onEdit={onEdit}
						onDelete={onDelete}
						onReact={onReact}
					/>
				)}
			</div>
		</div>
	);
}

/**
 * Reaksjoner, Svar og Kopier for alle meldinger, Rediger og Slett for egne de første 15
 * minuttene. Vises når man holder musen over.
 */
/**
 * Reaksjonene som én pille med skillestrek mellom hver emoji, over nedre høyre hjørne av boblen.
 * Hold musen over for å se hvem som har reagert, klikk for å legge til eller fjerne sin egen.
 */
function MessageReactions({
	reactions,
	myId,
	onToggle,
}: {
	reactions: MessageDto["reactions"];
	myId: string | undefined;
	onToggle: (emoji: string) => void;
}) {
	if (reactions.length === 0) return null;
	return (
		<div className="relative z-10 -mt-2.5 mr-2 flex self-end overflow-hidden rounded-full border bg-background shadow-sm">
			{reactions.map((reaction) => (
				<Tooltip key={reaction.emoji}>
					<TooltipTrigger
						onClick={() => onToggle(reaction.emoji)}
						aria-pressed={reaction.mine}
						aria-label={`${reaction.emoji} ${reaction.count}`}
						className={cn(
							"flex items-center gap-1 px-2.5 py-0.5 text-sm not-first:border-l hover:bg-muted",
							reaction.mine && "bg-muted",
						)}
					>
						<span>{reaction.emoji}</span>
						<span className="text-muted-foreground">{reaction.count}</span>
					</TooltipTrigger>
					<TooltipContent>
						{reaction.emoji}{" "}
						{listNames(
							reaction.users.map((u) => (u.id === myId ? "deg" : u.name)),
						)}
					</TooltipContent>
				</Tooltip>
			))}
		</div>
	);
}

/** «Ola», «Ola og Kari», «Ola, Kari og deg». */
const listNames = (names: string[]) =>
	new Intl.ListFormat("nb", { type: "conjunction" }).format(names);

function MessageActions({
	message,
	isMine,
	onReply,
	onEdit,
	onDelete,
	onReact,
}: {
	message: MessageDto;
	isMine: boolean;
	onReply: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onReact: (emoji: string) => void;
}) {
	const [pickerOpen, setPickerOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					aria-label="Valg for meldingen"
					className="mb-4 rounded-full p-1 text-muted-foreground outline-none group-hover/message:opacity-100 hover:bg-muted focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring data-popup-open:opacity-100 md:opacity-0"
				>
					<MoreHorizontalIcon className="size-4" />
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align={isMine ? "end" : "start"}
					className="min-w-40"
				>
					<div className="flex gap-0.5 p-1">
						{REACTION_EMOJIS.map((emoji) => (
							<DropdownMenuItem
								key={emoji}
								aria-label={`Reager med ${emoji}`}
								className={cn(
									"size-8 justify-center p-0 text-lg",
									message.reactions.some((r) => r.emoji === emoji && r.mine) &&
										"bg-muted",
								)}
								onClick={() => onReact(emoji)}
							>
								{emoji}
							</DropdownMenuItem>
						))}
						<DropdownMenuItem
							aria-label="Flere emojier"
							className="size-8 justify-center p-0"
							onClick={() => setPickerOpen(true)}
						>
							<PlusIcon />
						</DropdownMenuItem>
					</div>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={onReply}>
						<ReplyIcon />
						Svar
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() =>
							navigator.clipboard
								.writeText(message.body)
								.then(() => toast.success("Kopiert"))
						}
					>
						<CopyIcon />
						Kopier
					</DropdownMenuItem>
					{isMine && canStillChange(message.sentAt) && (
						<>
							<DropdownMenuItem onClick={onEdit}>
								<PencilIcon />
								Rediger
							</DropdownMenuItem>
							<DropdownMenuItem variant="destructive" onClick={onDelete}>
								<Trash2Icon />
								Slett
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			<Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
				<DialogContent className="w-fit gap-3 p-3 pt-4">
					<DialogHeader>
						<DialogTitle className="px-2">Reager med emoji</DialogTitle>
					</DialogHeader>
					<EmojiPicker
						onSelect={(emoji) => {
							setPickerOpen(false);
							onReact(emoji);
						}}
					/>
				</DialogContent>
			</Dialog>
		</>
	);
}

function Composer({
	conversationId,
	text,
	setText,
	target,
	isMyMessage,
	onCancel,
}: {
	conversationId: string;
	text: string;
	setText: (text: string) => void;
	target: ComposerTarget;
	isMyMessage: boolean;
	onCancel: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const editing = target?.mode === "edit";
	// Hopp til skrivefeltet når man velger å svare på eller redigere en melding.
	useEffect(() => {
		if (target) textareaRef.current?.focus();
	}, [target]);

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: trpc.messages.page.pathKey() });
		queryClient.invalidateQueries({
			queryKey: trpc.messages.conversations.queryKey(),
		});
	};
	const send = useMutation(
		trpc.messages.send.mutationOptions({ onSuccess: invalidate }),
	);
	const edit = useMutation(
		trpc.messages.edit.mutationOptions({ onSuccess: invalidate }),
	);
	const pending = send.isPending || edit.isPending;

	const submit = () => {
		const body = text.trim();
		if (!body || pending) return;
		setText("");
		onCancel();
		if (editing) {
			edit.mutate(
				{ conversationId, messageId: target.message.id, body },
				{
					onError: (error) =>
						toast.error(`Meldingen ble ikke endret: ${error.message}`),
				},
			);
		} else {
			send.mutate(
				{
					conversationId,
					body,
					replyToId: target?.mode === "reply" ? target.message.id : null,
				},
				{
					onError: (error) => {
						setText(body);
						toast.error(`Meldingen ble ikke sendt: ${error.message}`);
					},
				},
			);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			{target && (
				<div className="flex items-center gap-2 border-l-2 border-primary pl-2">
					<div className="min-w-0 flex-1">
						<p className="text-xs font-semibold text-primary">
							{editing
								? "Redigerer meldingen"
								: `Svarer ${isMyMessage ? "deg selv" : target.message.sender.name}`}
						</p>
						<p className="truncate text-sm text-muted-foreground">
							{target.message.body}
						</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						aria-label={editing ? "Avbryt redigering" : "Avbryt svar"}
						onClick={onCancel}
					>
						<XIcon />
					</Button>
				</div>
			)}
			<form
				className="flex items-end gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				<Textarea
					ref={textareaRef}
					aria-label="Melding"
					className="max-h-32 min-h-10 flex-1 resize-none"
					rows={1}
					maxLength={4000}
					placeholder="Skriv en melding"
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						// Enter sender, Shift+Enter gir ny linje. Escape avbryter svar/redigering.
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							submit();
						} else if (e.key === "Escape" && target) {
							onCancel();
						}
					}}
				/>
				<Button
					type="submit"
					size="icon"
					aria-label={editing ? "Lagre" : "Send"}
					disabled={!text.trim() || pending}
				>
					{editing ? <CheckIcon /> : <SendIcon />}
				</Button>
			</form>
		</div>
	);
}
