import { getUserId, handler } from "../server/http";
import { countUnread, getMyConversations } from "../server/messaging";
import { blockedIds } from "../server/moderation";
import { prisma } from "../server/prisma";
import type { UnreadCounts } from "../types";

export const GET = handler(async (request): Promise<UnreadCounts> => {
	const userId = await getUserId(request);
	const [notifications, conversations, blocked] = await Promise.all([
		prisma.notification.count({ where: { userId, read: false } }),
		getMyConversations(userId),
		blockedIds(userId),
	]);
	const counts = await Promise.all(
		conversations.map((c) => countUnread(c, userId, blocked)),
	);
	return { notifications, messages: counts.reduce((sum, n) => sum + n, 0) };
});
