import { fineInclude, toFine } from "../../server/dto";
import {
	getFinesGroup,
	isTihldeFines,
	toFinesFromPhoton,
} from "../../server/fines";
import {
	HttpError,
	getAccessToken,
	getUserId,
	handler,
	isManager,
	readJson,
	requireAccess,
} from "../../server/http";
import { getPhotonFine, updatePhotonFineStatus } from "../../server/photon";
import { prisma } from "../../server/prisma";
import type { Fine, FineStatus } from "../../types";

const STATUSES: FineStatus[] = ["pending", "approved", "paid", "rejected"];

/** Én bot (`?groupId=`), med forsvar og bilde. Samme tilgang som bøtelisten. */
export const GET = handler<{ fineId: string }>(
	async (request, { fineId }): Promise<Fine> => {
		const userId = await getUserId(request);
		const groupId = new URL(request.url).searchParams.get("groupId") ?? "";
		await requireAccess(userId, groupId);
		const group = await getFinesGroup(groupId);

		if (isTihldeFines(group)) {
			const fine = await getPhotonFine(
				await getAccessToken(request),
				group.photonSlug,
				fineId,
			);
			const [mapped] = await toFinesFromPhoton([fine], group);
			if (!mapped) throw new HttpError(404, "Fant ikke boten");
			return mapped;
		}

		const fine = await prisma.fine.findUnique({
			where: { id: fineId },
			include: fineInclude,
		});
		const { role } = await requireAccess(userId, group.id);
		if (
			!fine ||
			fine.groupId !== group.id ||
			(!isManager(role) && fine.userId !== userId)
		) {
			throw new HttpError(404, "Fant ikke boten");
		}
		return toFine(fine);
	},
);

/**
 * Godkjenn, marker som betalt, avvis eller sett tilbake til venter, for bøter på tihlde.org.
 * tihlde.org avgjør selv hvem som får lov (botsjefen og lederne), og svarer 403 ellers.
 */
export const PATCH = handler<{ fineId: string }>(
	async (request, { fineId }) => {
		const userId = await getUserId(request);
		const { groupId, status } = await readJson<{
			groupId: string;
			status: FineStatus;
		}>(request);
		if (!STATUSES.includes(status)) throw new HttpError(400, "Ugyldig status");
		await requireAccess(userId, groupId);

		const group = await getFinesGroup(groupId);
		if (!isTihldeFines(group)) {
			throw new HttpError(400, "Bare bøter fra tihlde.org kan godkjennes her");
		}
		await updatePhotonFineStatus(
			await getAccessToken(request),
			group.photonSlug,
			fineId,
			status,
		);
		return { ok: true };
	},
);
