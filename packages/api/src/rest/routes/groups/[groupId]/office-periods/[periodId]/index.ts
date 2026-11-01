import {
	getUserId,
	handler,
	readJson,
	requireAdminOrParent,
} from "../../../../../server/http";
import { findPeriod, parsePeriodInput } from "../../../../../server/offices";
import { prisma } from "../../../../../server/prisma";
import type { OfficePeriodInput } from "../../../../../types";

type Params = { groupId: string; periodId: string };

/** (Admin i hovedgruppen) Endre navnet og datoene til perioden. */
export const PATCH = handler<Params>(async (request, { groupId, periodId }) => {
	const userId = await getUserId(request);
	await requireAdminOrParent(userId, groupId);
	await findPeriod(groupId, periodId);
	const input = await readJson<OfficePeriodInput>(request);
	await prisma.officePeriod.update({
		where: { id: periodId },
		data: parsePeriodInput(input),
	});
	return { ok: true };
});

/** (Admin i hovedgruppen) Slett perioden og hvem som hadde vervene i den. */
export const DELETE = handler<Params>(
	async (request, { groupId, periodId }) => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, groupId);
		await findPeriod(groupId, periodId);
		await prisma.officePeriod.delete({ where: { id: periodId } });
		return { ok: true };
	},
);
