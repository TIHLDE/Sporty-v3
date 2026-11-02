import { canStillChange } from "../../../../../lib/messages";
import {
	HttpError,
	getUserId,
	handler,
	readJson,
} from "../../../../../server/http";
import {
	MAX_MESSAGE_LENGTH,
	messageInclude,
	requireConversation,
	toMessage,
} from "../../../../../server/messaging";
import { prisma } from "../../../../../server/prisma";
import type { Message } from "../../../../../types";

type Params = { conversationId: string; messageId: string };

/** Henter en av brukerens egne meldinger som fortsatt kan endres (15 minutter etter sending). */
async function requireChangeableMessage(
	request: Request,
	{ conversationId, messageId }: Params,
) {
	const userId = await getUserId(request);
	await requireConversation(userId, conversationId);
	const message = await prisma.message.findUnique({ where: { id: messageId } });
	if (!message || message.conversationId !== conversationId)
		throw new HttpError(404, "Fant ikke meldingen");
	if (message.senderId !== userId)
		throw new HttpError(403, "Du kan bare endre dine egne meldinger");
	if (message.deletedAt) throw new HttpError(400, "Meldingen er slettet");
	if (!canStillChange(message.sentAt))
		throw new HttpError(
			403,
			"Meldinger kan bare endres de første 15 minuttene etter at de ble sendt",
		);
	return { message, userId };
}

/** Rediger teksten i en av sine egne meldinger, innen 15 minutter etter at den ble sendt. */
export const PATCH = handler<Params>(
	async (request, params): Promise<Message> => {
		const { message, userId } = await requireChangeableMessage(request, params);
		const { body } = await readJson<{ body: string }>(request);
		const text = body?.trim();
		if (!text) throw new HttpError(400, "Meldingen er tom");
		if (text.length > MAX_MESSAGE_LENGTH)
			throw new HttpError(400, `Maks ${MAX_MESSAGE_LENGTH} tegn`);

		const edited = await prisma.message.update({
			where: { id: message.id },
			data: text === message.body ? {} : { body: text, editedAt: new Date() },
			include: messageInclude,
		});
		return toMessage(edited, userId);
	},
);

/**
 * Slett en av sine egne meldinger, innen 15 minutter etter at den ble sendt. Den blir liggende
 * som «Meldingen ble slettet», så svar på den fortsatt henger sammen, men teksten fjernes fra
 * databasen.
 */
export const DELETE = handler<Params>(
	async (request, params): Promise<Message> => {
		const { message, userId } = await requireChangeableMessage(request, params);
		const deleted = await prisma.message.update({
			where: { id: message.id },
			data: { body: "", deletedAt: new Date() },
			include: messageInclude,
		});
		return toMessage(deleted, userId);
	},
);
