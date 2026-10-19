import { getUserId, handler } from "../../../server/http";
import { requireConversation } from "../../../server/messaging";
import { prisma } from "../../../server/prisma";

/** Marker samtalen som lest frem til nå. */
export const POST = handler<{ conversationId: string }>(
	async (request, { conversationId }) => {
		const userId = await getUserId(request);
		await requireConversation(userId, conversationId);
		const now = new Date();
		await prisma.conversationMember.upsert({
			where: { conversationId_userId: { conversationId, userId } },
			create: { conversationId, userId, lastReadAt: now },
			update: { lastReadAt: now },
		});
		return { ok: true };
	},
);
