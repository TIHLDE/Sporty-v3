import { HttpError, getUserId, handler, readJson } from "../../../server/http";
import {
	messageInclude,
	requireConversation,
	toMessage,
} from "../../../server/messaging";
import { prisma } from "../../../server/prisma";
import type { MessagePage } from "../../../types";

const PAGE_SIZE = 30;
const MAX_LENGTH = 4000;

/**
 * Meldinger i samtalen, nyeste først, 30 om gangen. `?cursor=<meldings-id>` henter meldingene
 * som er eldre enn den. Hele historikken ligger i databasen.
 */
export const GET = handler<{ conversationId: string }>(
	async (request, { conversationId }): Promise<MessagePage> => {
		const userId = await getUserId(request);
		await requireConversation(userId, conversationId);
		const cursor = new URL(request.url).searchParams.get("cursor");

		const messages = await prisma.message.findMany({
			where: { conversationId },
			include: messageInclude,
			orderBy: [{ sentAt: "desc" }, { id: "desc" }],
			take: PAGE_SIZE + 1,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		});

		const hasMore = messages.length > PAGE_SIZE;
		const page = messages.slice(0, PAGE_SIZE);
		return {
			messages: page.map(toMessage),
			nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
		};
	},
);

/** Send en melding. Avsenderen har dermed lest samtalen. */
export const POST = handler<{ conversationId: string }>(
	async (request, { conversationId }) => {
		const userId = await getUserId(request);
		await requireConversation(userId, conversationId);
		const { body } = await readJson<{ body: string }>(request);
		const text = body?.trim();
		if (!text) throw new HttpError(400, "Meldingen er tom");
		if (text.length > MAX_LENGTH)
			throw new HttpError(400, `Maks ${MAX_LENGTH} tegn`);

		const message = await prisma.message.create({
			data: { conversationId, senderId: userId, body: text },
			include: messageInclude,
		});
		await prisma.conversationMember.upsert({
			where: { conversationId_userId: { conversationId, userId } },
			create: { conversationId, userId, lastReadAt: message.sentAt },
			update: { lastReadAt: message.sentAt },
		});

		return Response.json(toMessage(message), { status: 201 });
	},
);
