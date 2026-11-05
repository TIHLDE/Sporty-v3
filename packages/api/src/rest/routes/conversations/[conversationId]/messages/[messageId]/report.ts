import {
	HttpError,
	getUserId,
	handler,
	readJson,
} from "../../../../../server/http";
import { requireConversation } from "../../../../../server/messaging";
import { fileReport, parseReason } from "../../../../../server/moderation";
import { prisma } from "../../../../../server/prisma";

type Params = { conversationId: string; messageId: string };

/** Rapporter en melding. */
export const POST = handler<Params>(
	async (request, { conversationId, messageId }) => {
		const userId = await getUserId(request);
		const conversation = await requireConversation(userId, conversationId);
		const { reason } = await readJson<{ reason?: unknown }>(request);

		const message = await prisma.message.findUnique({
			where: { id: messageId },
		});
		if (!message || message.conversationId !== conversationId)
			throw new HttpError(404, "Fant ikke meldingen");
		if (message.deletedAt) throw new HttpError(400, "Meldingen er slettet");

		await fileReport({
			target: { messageId },
			reporterId: userId,
			senderId: message.senderId,
			groupId: conversation.group?.id ?? null,
			groupName: conversation.group?.name ?? null,
			reason: parseReason(reason),
			body: message.body,
			gifUrl: message.gifUrl,
		});
		return Response.json({ ok: true }, { status: 201 });
	},
);
