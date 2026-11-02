import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAdminOrParent,
} from "../../../../server/http";
import { parseOfficeName } from "../../../../server/offices";
import { isDuplicateName } from "../../../../server/positions";
import { prisma } from "../../../../server/prisma";

type Params = { groupId: string; officeId: string };

async function findOffice(groupId: string, officeId: string) {
	const office = await prisma.groupOffice.findUnique({
		where: { id: officeId },
	});
	if (!office || office.groupId !== groupId)
		throw new HttpError(404, "Fant ikke vervet");
	return office;
}

/** (Admin i hovedgruppen) Gi vervet nytt navn. Det endres i alle periodene. */
export const PATCH = handler<Params>(async (request, { groupId, officeId }) => {
	const userId = await getUserId(request);
	await requireAdminOrParent(userId, groupId);
	await findOffice(groupId, officeId);
	const { name } = await readJson<{ name: string }>(request);
	try {
		await prisma.groupOffice.update({
			where: { id: officeId },
			data: { name: parseOfficeName(name) },
		});
	} catch (error) {
		if (isDuplicateName(error))
			throw new HttpError(400, "Vervet finnes allerede");
		throw error;
	}
	return { ok: true };
});

/** (Admin i hovedgruppen) Slett vervet. Det forsvinner også fra alle periodene. */
export const DELETE = handler<Params>(
	async (request, { groupId, officeId }) => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, groupId);
		await findOffice(groupId, officeId);
		await prisma.groupOffice.delete({ where: { id: officeId } });
		return { ok: true };
	},
);
