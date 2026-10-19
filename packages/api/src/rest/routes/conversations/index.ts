import { getUserId, handler } from "../../server/http";
import {
	countUnread,
	describeConversation,
	getMyConversations,
} from "../../server/messaging";
import { prisma } from "../../server/prisma";
import type { Conversation } from "../../types";

/** Gruppechatter og direktemeldinger, sist aktive først. */
export const GET = handler(async (request): Promise<Conversation[]> => {
	const userId = await getUserId(request);
	const conversations = await getMyConversations(userId);

	const result = await Promise.all(
		conversations.map(async (c) => {
			const [last, unread] = await Promise.all([
				prisma.message.findFirst({
					where: { conversationId: c.id },
					orderBy: { sentAt: "desc" },
					include: { sender: { select: { name: true } } },
				}),
				countUnread(c, userId),
			]);
			return {
				id: c.id,
				...describeConversation(c, userId),
				lastMessage: last
					? {
							senderId: last.senderId,
							senderName: last.sender.name,
							body: last.body,
							sentAt: last.sentAt.toISOString(),
						}
					: null,
				unread,
				// Til sortering: tomme gruppechatter havner nederst.
				activity: (last?.sentAt ?? c.createdAt).toISOString(),
				hasMessages: Boolean(last),
			};
		}),
	);

	return result
		.sort(
			(a, b) =>
				Number(b.hasMessages) - Number(a.hasMessages) ||
				b.activity.localeCompare(a.activity),
		)
		.map(({ activity: _activity, hasMessages: _hasMessages, ...c }) => c);
});
