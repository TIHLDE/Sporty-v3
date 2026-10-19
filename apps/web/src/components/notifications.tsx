import { formatRelative } from "@sporty/api/rest/lib/dates";
import type { Notification, NotificationType } from "@sporty/api/rest/types";
import { Button } from "@sporty/ui/components/button";
import {
	useInfiniteQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
	BarChart3Icon,
	BellIcon,
	CalendarDaysIcon,
	CircleDollarSignIcon,
	MegaphoneIcon,
	UserCheckIcon,
	WalletIcon,
} from "lucide-react";

import { EmptyText, PageState } from "@/components/page-state";
import { useTRPC } from "@/utils/trpc";

const ICONS: Record<NotificationType, typeof BellIcon> = {
	event: CalendarDaysIcon,
	attendance: UserCheckIcon,
	fine: CircleDollarSignIcon,
	announcement: MegaphoneIcon,
	poll: BarChart3Icon,
	payment: WalletIcon,
};

/**
 * Varslene lenker til appens skjermer (f.eks. /grupper/g/arrangement/e). Her blir de til
 * tilsvarende side på nettsiden.
 */
export function webHref(href: string) {
	const match = href.match(
		/^\/grupper\/([^/]+)\/(arrangement|kunngjoring|avstemning|bot)\/([^/]+)$/,
	);
	if (!match) return href;
	const [, groupId, kind, id] = match;
	if (kind === "arrangement") return `/arrangementer/${id}`;
	if (kind === "kunngjoring") return `/kunngjoringer/${id}`;
	if (kind === "avstemning") return `/avstemninger/${id}`;
	return `/boter?gruppe=${groupId}`;
}

/** Så mange varsler gir API-et om gangen. En full side betyr at det kan finnes eldre. */
const PAGE_SIZE = 100;

/**
 * Varslene, alle eller bare fra én gruppe, nyeste først. Leste varsler blir liggende, så hele
 * historikken kan blas gjennom med «Last inn eldre varsler».
 */
export function NotificationList({ groupId }: { groupId?: string }) {
	const trpc = useTRPC();
	const notifications = useInfiniteQuery(
		trpc.notifications.list.infiniteQueryOptions(
			{ groupId },
			{
				getNextPageParam: (page) =>
					page.length === PAGE_SIZE ? page.at(-1)?.id : undefined,
			},
		),
	);
	const all = {
		...notifications,
		data: notifications.data?.pages.flat(),
	};

	return (
		<PageState query={all}>
			{(data) =>
				data.length === 0 ? (
					<EmptyText>
						{groupId ? "Ingen varsler fra gruppen." : "Ingen varsler ennå."}
					</EmptyText>
				) : (
					<div className="grid gap-3">
						<div className="divide-y rounded-xl border">
							{data.map((notification) => (
								<NotificationRow
									key={notification.id}
									notification={notification}
								/>
							))}
						</div>
						{notifications.hasNextPage && (
							<Button
								variant="outline"
								className="justify-self-center"
								disabled={notifications.isFetchingNextPage}
								onClick={() => notifications.fetchNextPage()}
							>
								{notifications.isFetchingNextPage
									? "Laster…"
									: "Last inn eldre varsler"}
							</Button>
						)}
					</div>
				)
			}
		</PageState>
	);
}

function NotificationRow({ notification }: { notification: Notification }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const router = useRouter();
	const Icon = ICONS[notification.type] ?? BellIcon;
	const markRead = useMutation(
		trpc.notifications.read.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: trpc.notifications.pathKey(),
				}),
		}),
	);

	const open = () => {
		if (!notification.read)
			markRead.mutate({ notificationId: notification.id });
		if (notification.href)
			router.navigate({ href: webHref(notification.href) });
	};

	return (
		<button
			type="button"
			onClick={open}
			className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted"
		>
			<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
				<Icon className="size-4" />
			</span>
			<span className="grid min-w-0 flex-1 gap-0.5">
				<span className={notification.read ? undefined : "font-semibold"}>
					{notification.text}
				</span>
				<span className="text-xs text-muted-foreground">
					{formatRelative(notification.createdAt)}
				</span>
			</span>
			{!notification.read && (
				<span
					className="size-2.5 shrink-0 rounded-full bg-primary"
					aria-label="Ulest"
				/>
			)}
		</button>
	);
}
