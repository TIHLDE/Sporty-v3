import { reportContent } from "../../../../../lib/notification-content";
import {
	HttpError,
	getUserId,
	handler,
	readJson,
} from "../../../../../server/http";
import { requireConversation } from "../../../../../server/messaging";
import { moderatorIds } from "../../../../../server/moderation";
import { prisma } from "../../../../../server/prisma";
import { sendPush } from "../../../../../server/push";
import type { ReportReason } from "../../../../../types";

const REASONS: ReportReason[] = [
	"harassment",
	"inappropriate",
	"spam",
	"other",
];

type Params = { conversationId: string; messageId: string };

/**
 * Rapporter en melding. Teksten kopieres inn i rapporten, så den kan vurderes selv om avsenderen
 * sletter meldingen etterpå. Å rapportere samme melding to ganger gjør ingenting.
 */
export const POST = handler<Params>(
	async (request, { conversationId, messageId }) => {
		const userId = await getUserId(request);
		const conversation = await requireConversation(userId, conversationId);
		const { reason } = await readJson<{ reason?: ReportReason }>(request);
		if (!reason || !REASONS.includes(reason))
			throw new HttpError(400, "Velg en grunn");

		const message = await prisma.message.findUnique({
			where: { id: messageId },
		});
		if (!message || message.conversationId !== conversationId)
			throw new HttpError(404, "Fant ikke meldingen");
		if (message.senderId === userId)
			throw new HttpError(400, "Du kan ikke rapportere din egen melding");
		if (message.deletedAt) throw new HttpError(400, "Meldingen er slettet");

		const groupId = conversation.group?.id ?? null;
		const key = { messageId_reporterId: { messageId, reporterId: userId } };
		if (await prisma.messageReport.findUnique({ where: key }))
			return { ok: true };

		await prisma.messageReport.create({
			data: {
				messageId,
				reporterId: userId,
				groupId,
				reason,
				body: message.body,
				gifUrl: message.gifUrl,
			},
		});

		const content = reportContent(conversation.group?.name ?? null);
		// Den som er rapportert skal ikke varsles, selv om vedkommende er sub-/admin.
		const moderators = (await moderatorIds(groupId)).filter(
			(id) => id !== message.senderId && id !== userId,
		);
		await prisma.notification.createMany({
			data: moderators.map((id) => ({
				userId: id,
				groupId,
				type: "report" as const,
				text: content.body,
				href: content.url,
			})),
		});
		void sendPush(moderators, "message", content);

		return Response.json({ ok: true }, { status: 201 });
	},
);
