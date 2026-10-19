import { formatRelative } from "@sporty/api/rest/lib/dates";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";

import { AnnouncementMedia } from "@/components/announcements";
import { Comments } from "@/components/comments";
import { PageState } from "@/components/page-state";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/kunngjoringer/$announcementId")({
	component: AnnouncementComponent,
});

function AnnouncementComponent() {
	const { announcementId } = Route.useParams();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const announcement = useQuery(
		trpc.announcements.get.queryOptions({ announcementId }),
	);
	const comment = useMutation(
		trpc.announcements.comment.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: trpc.announcements.pathKey(),
				}),
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<PageState query={announcement}>
			{(a) => (
				<article className="grid gap-5">
					<Link
						to="/grupper/$groupId"
						params={{ groupId: a.groupId }}
						className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
					>
						<ArrowLeftIcon className="size-4" />
						{a.groupName}
					</Link>
					<div>
						<h1 className="text-2xl font-semibold">{a.title}</h1>
						<p className="text-sm text-muted-foreground">
							{a.authorName} · {formatRelative(a.createdAt)}
						</p>
					</div>
					<p className="whitespace-pre-wrap">{a.body}</p>
					<AnnouncementMedia media={a.media} attachments={a.attachments} />
					<Comments
						comments={a.comments}
						allowComments={a.allowComments}
						sending={comment.isPending}
						onSend={(body, done) =>
							comment.mutate(
								{ announcementId: a.id, body },
								{ onSuccess: done },
							)
						}
					/>
				</article>
			)}
		</PageState>
	);
}
