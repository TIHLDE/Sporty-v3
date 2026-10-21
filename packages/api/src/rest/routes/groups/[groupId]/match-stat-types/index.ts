import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAdminOrParent,
} from "../../../../server/http";
import {
	parseMatchStatTypeName,
	requireMainGroup,
} from "../../../../server/match-facts";
import { isDuplicateName } from "../../../../server/positions";
import { prisma } from "../../../../server/prisma";
import type { MatchStatType } from "../../../../types";

/** (Admin i hovedgruppen) Legg til en hendelsestype nederst i kampfakta, f.eks. Redning. */
export const POST = handler<{ groupId: string }>(
	async (request, { groupId }): Promise<MatchStatType> => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, groupId);
		await requireMainGroup(groupId);
		const { name } = await readJson<{ name: string }>(request);

		const last = await prisma.matchStatType.findFirst({
			where: { groupId },
			orderBy: { sortOrder: "desc" },
		});
		try {
			return await prisma.matchStatType.create({
				data: {
					groupId,
					name: parseMatchStatTypeName(name),
					sortOrder: (last?.sortOrder ?? -1) + 1,
				},
				select: { id: true, name: true },
			});
		} catch (error) {
			if (isDuplicateName(error))
				throw new HttpError(400, "Hendelsen finnes allerede");
			throw error;
		}
	},
);
