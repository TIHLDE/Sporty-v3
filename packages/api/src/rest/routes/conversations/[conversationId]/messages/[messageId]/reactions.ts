import {
	HttpError,
	getUserId,
	handler,
	readJson,
} from "../../../../../server/http";
import {
	messageInclude,
	requireConversation,
	toMessage,
} from "../../../../../server/messaging";
import { prisma } from "../../../../../server/prisma";
import type { Message } from "../../../../../types";

/** Nøyaktig én emoji, også sammensatte (hudfarge, flagg, familier, 1️⃣ osv.). */
// Konstruktør i stedet for /…/v: nettsiden typesjekker denne filen med eldre target.
const EMOJI = new RegExp("^\\p{RGI_Emoji}$", "v");

/**
 * Reager på en melding med en emoji, eller fjern reaksjonen hvis man allerede har den. Man kan
 * ha flere ulike emojier på samme melding.
 */
export const POST = handler<{ conversationId: string; messageId: string }>(
	async (request, { conversationId, messageId }): Promise<Message> => {
		const userId = await getUserId(request);
		await requireConversation(userId, conversationId);
		const { emoji } = await readJson<{ emoji: string }>(request);
		if (!emoji || emoji.length > 32 || !EMOJI.test(emoji))
			throw new HttpError(400, "Ugyldig emoji");

		const message = await prisma.message.findUnique({
			where: { id: messageId },
		});
		if (!message || message.conversationId !== conversationId)
			throw new HttpError(404, "Fant ikke meldingen");
		if (message.deletedAt) throw new HttpError(400, "Meldingen er slettet");

		const key = { messageId_userId_emoji: { messageId, userId, emoji } };
		const existing = await prisma.messageReaction.findUnique({ where: key });
		if (existing) await prisma.messageReaction.delete({ where: key });
		else
			await prisma.messageReaction.create({
				data: { messageId, userId, emoji },
			});

		const updated = await prisma.message.findUniqueOrThrow({
			where: { id: messageId },
			include: messageInclude,
		});
		return toMessage(updated, userId);
	},
);
