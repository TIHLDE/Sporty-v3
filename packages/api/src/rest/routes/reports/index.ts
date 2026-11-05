import { toUser } from "../../server/dto";
import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAccess,
} from "../../server/http";
import {
	fileReport,
	moderatedReports,
	parseReason,
} from "../../server/moderation";
import { prisma } from "../../server/prisma";
import type { MessageReport } from "../../types";

/** Åpne rapporter brukeren kan behandle, eldste først. Tom liste for alle andre. */
export const GET = handler(async (request): Promise<MessageReport[]> => {
	const userId = await getUserId(request);
	const rows = await prisma.messageReport.findMany({
		where: { status: "open", ...(await moderatedReports(userId)) },
		include: {
			reporter: true,
			sender: true,
			group: { select: { name: true } },
		},
		orderBy: { createdAt: "asc" },
	});
	return rows.map((row) => ({
		id: row.id,
		kind: row.messageId ? "message" : "comment",
		reason: row.reason,
		body: row.body,
		gifUrl: row.gifUrl,
		createdAt: row.createdAt.toISOString(),
		reporter: toUser(row.reporter),
		sender: toUser(row.sender),
		groupName: row.group?.name ?? null,
	}));
});

/** Finner kommentaren som rapporteres, med gruppen den hører til. */
async function findComment(type: unknown, commentId: string) {
	const group = { select: { id: true, name: true } };
	if (type === "announcement") {
		const comment = await prisma.announcementComment.findUnique({
			where: { id: commentId },
			include: { announcement: { select: { group } } },
		});
		return (
			comment && {
				target: { announcementCommentId: comment.id },
				authorId: comment.authorId,
				body: comment.body,
				group: comment.announcement.group,
			}
		);
	}
	if (type === "poll") {
		const comment = await prisma.pollComment.findUnique({
			where: { id: commentId },
			include: { poll: { select: { group } } },
		});
		return (
			comment && {
				target: { pollCommentId: comment.id },
				authorId: comment.authorId,
				body: comment.body,
				group: comment.poll.group,
			}
		);
	}
	throw new HttpError(400, "Ukjent type");
}

/** Rapporter en kommentar på en kunngjøring eller avstemning. Meldinger har en egen rute. */
export const POST = handler(async (request) => {
	const userId = await getUserId(request);
	const { type, commentId, reason } = await readJson<{
		type?: unknown;
		commentId?: string;
		reason?: unknown;
	}>(request);
	if (!commentId) throw new HttpError(400, "Mangler kommentar");

	const comment = await findComment(type, commentId);
	if (!comment) throw new HttpError(404, "Fant ikke kommentaren");
	await requireAccess(userId, comment.group.id);

	await fileReport({
		target: comment.target,
		reporterId: userId,
		senderId: comment.authorId,
		groupId: comment.group.id,
		groupName: comment.group.name,
		reason: parseReason(reason),
		body: comment.body,
	});
	return Response.json({ ok: true }, { status: 201 });
});
