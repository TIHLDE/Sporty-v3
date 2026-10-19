import { getUserId, handler, requireAccess } from "../../../server/http";
import { prisma } from "../../../server/prisma";

export const GET = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireAccess(userId, groupId);
		const files = await prisma.groupFile.findMany({
			where: { groupId },
			orderBy: { uploadedAt: "desc" },
		});
		return files.map((f) => ({ ...f, uploadedAt: f.uploadedAt.toISOString() }));
	},
);
