import {
	getUserId,
	handler,
	readJson,
	requireAdminOrParent,
} from "../../../../server/http";
import {
	parsePeriodInput,
	requireOfficeGroup,
} from "../../../../server/offices";
import { prisma } from "../../../../server/prisma";
import type { OfficePeriodInput } from "../../../../types";

/** (Admin i hovedgruppen) Lag en ny periode i vervhistorikken. Vervene fordeles etterpå. */
export const POST = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, groupId);
		await requireOfficeGroup(groupId);
		const input = await readJson<OfficePeriodInput>(request);
		const period = await prisma.officePeriod.create({
			data: { groupId, ...parsePeriodInput(input) },
			select: { id: true },
		});
		return period;
	},
);
