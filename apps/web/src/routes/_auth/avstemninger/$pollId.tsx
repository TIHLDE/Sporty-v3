import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";

import { Comments } from "@/components/comments";
import { PageState } from "@/components/page-state";
import { PollCard } from "@/components/polls";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/avstemninger/$pollId")({
	component: PollComponent,
});

function PollComponent() {
	const { pollId } = Route.useParams();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const poll = useQuery(trpc.polls.get.queryOptions({ pollId }));
	const comment = useMutation(
		trpc.polls.comment.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: trpc.polls.pathKey() }),
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<PageState query={poll}>
			{(p) => (
				<div className="grid gap-5">
					<Link
						to="/grupper/$groupId"
						params={{ groupId: p.groupId }}
						className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
					>
						<ArrowLeftIcon className="size-4" />
						Til gruppen
					</Link>
					<PollCard poll={p} linkToDetails={false} />
					<Comments
						comments={p.comments}
						allowComments={p.allowComments}
						sending={comment.isPending}
						onSend={(body, done) =>
							comment.mutate({ pollId: p.id, body }, { onSuccess: done })
						}
					/>
				</div>
			)}
		</PageState>
	);
}
