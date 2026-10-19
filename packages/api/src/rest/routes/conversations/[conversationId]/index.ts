import { getUserId, handler } from "../../../server/http";
import {
	describeConversation,
	requireConversation,
} from "../../../server/messaging";
import { prisma } from "../../../server/prisma";
import type { ConversationDetails } from "../../../types";

export const GET = handler<{ conversationId: string }>(
	async (request, { conversationId }): Promise<ConversationDetails> => {
		const userId = await getUserId(request);
		const conversation = await requireConversation(userId, conversationId);
		const memberCount = conversation.groupId
			? await prisma.membership.count({
					where: { groupId: conversation.groupId },
				})
			: conversation.members.length;
		return {
			id: conversation.id,
			...describeConversation(conversation, userId),
			memberCount,
		};
	},
);
