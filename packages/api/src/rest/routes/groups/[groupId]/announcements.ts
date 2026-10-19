import {
	announcementInclude,
	notify,
	toAnnouncement,
} from "../../../server/dto";
import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAccess,
	requireManagerOrParent,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";
import type { CreateAnnouncementInput } from "../../../types";

export const GET = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireAccess(userId, groupId);
		const announcements = await prisma.announcement.findMany({
			where: { groupId },
			include: announcementInclude,
			orderBy: { createdAt: "desc" },
		});
		return announcements.map(toAnnouncement);
	},
);

/** (Sub-/admin) Publiser en kunngjøring til alle i gruppen, med bilder/video og vedlegg. */
export const POST = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireManagerOrParent(userId, groupId);
		const input = await readJson<CreateAnnouncementInput>(request);

		const title = input.title?.trim();
		const body = input.body?.trim() ?? "";
		if (!title) throw new HttpError(400, "Kunngjøringen må ha en tittel");
		const uploadIds = input.uploadIds ?? [];

		// Bare egne opplastinger som ikke allerede hører til en annen kunngjøring.
		const uploads = await prisma.upload.findMany({
			where: {
				id: { in: uploadIds },
				uploadedById: userId,
				announcementId: null,
			},
		});
		if (uploads.length !== uploadIds.length)
			throw new HttpError(400, "Ugyldige vedlegg");

		const announcement = await prisma.$transaction(async (tx) => {
			const created = await tx.announcement.create({
				data: {
					groupId,
					authorId: userId,
					title,
					body,
					allowComments: input.allowComments !== false,
				},
			});
			await Promise.all(
				uploadIds.map((id, position) =>
					tx.upload.update({
						where: { id },
						data: { announcementId: created.id, position },
					}),
				),
			);
			return tx.announcement.findUniqueOrThrow({
				where: { id: created.id },
				include: announcementInclude,
			});
		});

		const members = await prisma.membership.findMany({
			where: { groupId, userId: { not: userId } },
		});
		await notify(
			members.map((m) => m.userId),
			{
				groupId,
				type: "announcement",
				text: `Ny kunngjøring i ${announcement.group.name}: ${title}`,
				href: `/grupper/${groupId}/kunngjoring/${announcement.id}`,
			},
		);

		return Response.json(toAnnouncement(announcement), { status: 201 });
	},
);
