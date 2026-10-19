import { getUserId, handler } from "../server/http";
import { countUnread, getMyConversations } from "../server/messaging";
import { prisma } from "../server/prisma";
import type { UnreadCounts } from "../types";

export const GET = handler(async (request): Promise<UnreadCounts> => {
	const userId = await getUserId(request);
	const [notifications, conversations] = await Promise.all([
		prisma.notification.count({ where: { userId, read: false } }),
		getMyConversations(userId),
	]);
	const counts = await Promise.all(
		conversations.map((c) => countUnread(c, userId)),
	);
	return { notifications, messages: counts.reduce((sum, n) => sum + n, 0) };
});
