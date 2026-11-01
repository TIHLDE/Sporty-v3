import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAccess,
	requireAdminOrParent,
} from "../../../../server/http";
import {
	getOfficeHistory,
	parseOfficeName,
	requireOfficeGroup,
} from "../../../../server/offices";
import { isDuplicateName } from "../../../../server/positions";
import { prisma } from "../../../../server/prisma";
import type { Office, OfficeHistory } from "../../../../types";

/** Vervhistorikken til laget. Alle medlemmer kan se den, også fra undergruppene. */
export const GET = handler<{ groupId: string }>(
	async (request, { groupId }): Promise<OfficeHistory> => {
		const userId = await getUserId(request);
		await requireAccess(userId, groupId);
		return getOfficeHistory(groupId, userId);
	},
);

/** (Admin i hovedgruppen) Legg til et verv. Det kan brukes i alle periodene. */
export const POST = handler<{ groupId: string }>(
	async (request, { groupId }): Promise<Office> => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, groupId);
		await requireOfficeGroup(groupId);
		const { name } = await readJson<{ name: string }>(request);
		try {
			return await prisma.groupOffice.create({
				data: { groupId, name: parseOfficeName(name) },
				select: { id: true, name: true },
			});
		} catch (error) {
			if (isDuplicateName(error))
				throw new HttpError(400, "Vervet finnes allerede");
			throw error;
		}
	},
);
