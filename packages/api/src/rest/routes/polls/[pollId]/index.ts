import { pollInclude, toPoll, toUser } from "../../../server/dto";
import {
	HttpError,
	getUserId,
	handler,
	requireAccess,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";
import type { PollDetails } from "../../../types";

export const GET = handler<{ pollId: string }>(
	async (request, { pollId }): Promise<PollDetails> => {
		const userId = await getUserId(request);
		const poll = await prisma.poll.findUnique({
			where: { id: pollId },
			include: {
				...pollInclude,
				comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
			},
		});
		if (!poll) throw new HttpError(404, "Fant ikke avstemningen");
		const { role } = await requireAccess(userId, poll.groupId);

		return {
			...toPoll(poll, userId, role),
			comments: poll.comments.map((c) => ({
				id: c.id,
				author: toUser(c.author),
				body: c.body,
				createdAt: c.createdAt.toISOString(),
			})),
		};
	},
);
