import { messageContent } from "../../../lib/notification-content";
import { parseGif } from "../../../server/gifs";
import { HttpError, getUserId, handler, readJson } from "../../../server/http";
import {
	MAX_MESSAGE_LENGTH,
	messageInclude,
	othersReadAt,
	requireConversation,
	toMessage,
} from "../../../server/messaging";
import {
	blockedIds,
	blockersOf,
	isBlockedEitherWay,
} from "../../../server/moderation";
import { prisma } from "../../../server/prisma";
import { sendPush } from "../../../server/push";
import type { MessageGif, MessagePage } from "../../../types";

const PAGE_SIZE = 30;

/**
 * Meldinger i samtalen, nyeste først, 30 om gangen. `?cursor=<meldings-id>` henter meldingene
 * som er eldre enn den. Hele historikken ligger i databasen. Meldinger fra personer brukeren har
 * blokkert er skjult.
 */
export const GET = handler<{ conversationId: string }>(
	async (request, { conversationId }): Promise<MessagePage> => {
		const userId = await getUserId(request);
		const conversation = await requireConversation(userId, conversationId);
		const cursor = new URL(request.url).searchParams.get("cursor");

		const messages = await prisma.message.findMany({
			where: { conversationId, senderId: { notIn: await blockedIds(userId) } },
			include: messageInclude,
			orderBy: [{ sentAt: "desc" }, { id: "desc" }],
			take: PAGE_SIZE + 1,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		});

		const hasMore = messages.length > PAGE_SIZE;
		const page = messages.slice(0, PAGE_SIZE);
		return {
			messages: page.map((m) => toMessage(m, userId)),
			nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
			readAt: await othersReadAt(conversation, userId),
		};
	},
);

/**
 * Send en melding, eventuelt som svar på en annen (`replyToId`). Med `gif` består meldingen av en
 * GIF, og teksten settes til «GIF» for varsler, svar og samtalelisten. Avsenderen har dermed lest samtalen. De andre i samtalen får push-varsel: alle
 * medlemmene av gruppen i en gruppechat, den andre personen i en direktemelding.
 */
export const POST = handler<{ conversationId: string }>(
	async (request, { conversationId }) => {
		const userId = await getUserId(request);
		const conversation = await requireConversation(userId, conversationId);
		const input = await readJson<{
			body?: string;
			replyToId?: string | null;
			gif?: Partial<MessageGif> | null;
		}>(request);
		const { replyToId } = input;
		const other = conversation.group
			? null
			: conversation.members.find((m) => m.userId !== userId);
		if (other && (await isBlockedEitherWay(userId, other.userId)))
			throw new HttpError(403, "Du kan ikke sende melding til denne personen");
		const gif = input.gif ? parseGif(input.gif) : null;
		const text = gif ? "GIF" : input.body?.trim();
		if (!text) throw new HttpError(400, "Meldingen er tom");
		if (text.length > MAX_MESSAGE_LENGTH)
			throw new HttpError(400, `Maks ${MAX_MESSAGE_LENGTH} tegn`);
		if (replyToId) {
			const original = await prisma.message.findUnique({
				where: { id: replyToId },
			});
			if (!original || original.conversationId !== conversationId)
				throw new HttpError(400, "Fant ikke meldingen du svarer på");
		}

		const message = await prisma.message.create({
			data: {
				conversationId,
				senderId: userId,
				body: text,
				replyToId: replyToId || null,
				...(gif && {
					gifSlug: gif.slug,
					gifUrl: gif.url,
					gifWidth: gif.width,
					gifHeight: gif.height,
				}),
			},
			include: messageInclude,
		});
		await prisma.conversationMember.upsert({
			where: { conversationId_userId: { conversationId, userId } },
			create: { conversationId, userId, lastReadAt: message.sentAt },
			update: { lastReadAt: message.sentAt },
		});

		const recipients = conversation.group
			? (
					await prisma.membership.findMany({
						where: { groupId: conversation.group.id },
						select: { userId: true },
					})
				).map((m) => m.userId)
			: conversation.members.map((m) => m.userId);
		const blockers = await blockersOf(userId, recipients);
		// Ikke vent på Expo: meldingen skal vises med en gang. sendPush logger feil selv.
		void sendPush(
			recipients.filter((id) => id !== userId && !blockers.has(id)),
			"message",
			messageContent({
				conversationId,
				senderName: message.sender.name,
				groupName: conversation.group?.name ?? null,
				body: text,
			}),
		);

		return Response.json(toMessage(message, userId), { status: 201 });
	},
);
