import { fineInclude, toFine } from "../../../server/dto";
import {
	getFinesGroup,
	isTihldeFines,
	toFinesFromPhoton,
} from "../../../server/fines";
import {
	getAccessToken,
	getUserId,
	handler,
	isManager,
	requireAccess,
} from "../../../server/http";
import {
	getPhotonFineStatistics,
	listPhotonFinesPage,
} from "../../../server/photon";
import { prisma } from "../../../server/prisma";
import type { FinesPage } from "../../../types";

const PAGE_SIZE = 25;

/**
 * Én side med bøter i gruppen (`?page=0` er den nyeste), og summen av ubetalte bøter. For lag fra
 * tihlde.org hentes de derfra, og alle medlemmer ser alle bøtene, som på tihlde.org. I
 * Sporty-grupper ser sub-/admin alle, medlemmer bare sine egne.
 */
export const GET = handler<{ groupId: string }>(
	async (request, { groupId }): Promise<FinesPage> => {
		const userId = await getUserId(request);
		await requireAccess(userId, groupId);
		const group = await getFinesGroup(groupId);
		const page = Math.max(
			0,
			Number(new URL(request.url).searchParams.get("page")) || 0,
		);

		if (isTihldeFines(group)) {
			if (!group.photonFinesActivated)
				return { fines: [], nextPage: null, unpaidCount: 0 };
			const accessToken = await getAccessToken(request);
			const [result, statistics] = await Promise.all([
				listPhotonFinesPage(accessToken, group.photonSlug, {
					page,
					pageSize: PAGE_SIZE,
				}),
				getPhotonFineStatistics(accessToken, group.photonSlug),
			]);
			return {
				fines: await toFinesFromPhoton(result.fines, group),
				nextPage: result.nextPage,
				unpaidCount: statistics.notApproved + statistics.approvedNotPaid,
			};
		}

		const { role } = await requireAccess(userId, group.id);
		const where = { groupId: group.id, ...(isManager(role) ? {} : { userId }) };
		const [fines, unpaid] = await Promise.all([
			prisma.fine.findMany({
				where,
				include: fineInclude,
				orderBy: { createdAt: "desc" },
				skip: page * PAGE_SIZE,
				// Én ekstra for å vite om det finnes en side til.
				take: PAGE_SIZE + 1,
			}),
			prisma.fine.aggregate({
				where: { ...where, paid: false },
				_sum: { count: true },
			}),
		]);
		return {
			fines: fines.slice(0, PAGE_SIZE).map(toFine),
			nextPage: fines.length > PAGE_SIZE ? page + 1 : null,
			unpaidCount: unpaid._sum.count ?? 0,
		};
	},
);
