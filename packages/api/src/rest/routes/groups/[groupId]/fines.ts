import { fineInclude, toFine } from "../../../server/dto";
import {
	countByStatus,
	fineDateRange,
	getAllPhotonFines,
	getFinesGroup,
	hasDateRange,
	inDateRange,
	isTihldeFines,
	toFinesFromPhoton,
	type FineDateRange,
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
import type { FineStatus, FinesPage } from "../../../types";

const PAGE_SIZE = 25;
const STATUSES: FineStatus[] = ["pending", "approved", "paid", "rejected"];

/**
 * Én side med bøter i gruppen (`?page=0` er den nyeste), summen av ubetalte bøter og tall per
 * status. For lag fra tihlde.org hentes de derfra, og alle medlemmer ser alle bøtene, som på
 * tihlde.org. I Sporty-grupper ser sub-/admin alle, medlemmer bare sine egne.
 *
 * Valgfrie filtre: `?status=`, `?userId=` (Sporty-id-en til ett medlem), og `?from=`/`?to=`
 * (ISO-tidspunkter). Tallene per status følger tidsrommet, men ikke status eller medlem.
 */
export const GET = handler<{ groupId: string }>(
	async (request, { groupId }): Promise<FinesPage> => {
		const userId = await getUserId(request);
		await requireAccess(userId, groupId);
		const group = await getFinesGroup(groupId);
		const params = new URL(request.url).searchParams;
		const page = Math.max(0, Number(params.get("page")) || 0);
		const status = STATUSES.find((s) => s === params.get("status"));
		const memberId = params.get("userId") || undefined;
		const range = fineDateRange(params);

		if (isTihldeFines(group)) {
			if (!group.photonFinesActivated)
				return { fines: [], nextPage: null, unpaidCount: 0 };
			const accessToken = await getAccessToken(request);
			const members = prisma.membership.count({ where: { groupId: group.id } });

			// Uten filtre kan siden hentes direkte fra tihlde.org; ellers filtreres hele listen.
			if (!status && !memberId && !hasDateRange(range)) {
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
					statistics: { ...statistics, members: await members },
				};
			}

			const all = await getAllPhotonFines(accessToken, group);
			const inRange = all.filter((fine) => inDateRange(fine.createdAt, range));
			const statistics = hasDateRange(range)
				? countByStatus(inRange)
				: await getPhotonFineStatistics(accessToken, group.photonSlug);
			const matching = inRange.filter(
				(fine) =>
					(!status || fine.status === status) &&
					(!memberId || fine.user.id === memberId),
			);
			const start = page * PAGE_SIZE;
			return {
				fines: matching.slice(start, start + PAGE_SIZE),
				nextPage: matching.length > start + PAGE_SIZE ? page + 1 : null,
				unpaidCount: statistics.notApproved + statistics.approvedNotPaid,
				statistics: { ...statistics, members: await members },
			};
		}

		const { role } = await requireAccess(userId, group.id);
		// Medlemmer ser bare sine egne bøter, også når de ber om et annet medlem.
		const where = {
			groupId: group.id,
			...(isManager(role) ? {} : { userId }),
			...createdAtWhere(range),
		};
		const listWhere = {
			...where,
			...(isManager(role) && memberId ? { userId: memberId } : {}),
			// Sporty-bøter er enten godkjent eller betalt; venter og avvist finnes ikke her.
			...(status === "paid"
				? { paid: true }
				: status === "approved"
					? { paid: false }
					: status
						? { id: { in: [] } }
						: {}),
		};
		const [fines, unpaid, paid, members] = await Promise.all([
			prisma.fine.findMany({
				where: listWhere,
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
			prisma.fine.aggregate({
				where: { ...where, paid: true },
				_sum: { count: true },
			}),
			isManager(role)
				? prisma.membership.count({ where: { groupId: group.id } })
				: 1,
		]);
		return {
			fines: fines.slice(0, PAGE_SIZE).map(toFine),
			nextPage: fines.length > PAGE_SIZE ? page + 1 : null,
			unpaidCount: unpaid._sum.count ?? 0,
			statistics: {
				notApproved: 0,
				approvedNotPaid: unpaid._sum.count ?? 0,
				paid: paid._sum.count ?? 0,
				members,
			},
		};
	},
);

function createdAtWhere(range: FineDateRange) {
	if (!hasDateRange(range)) return {};
	return {
		createdAt: {
			...(range.from ? { gte: range.from } : {}),
			...(range.to ? { lte: range.to } : {}),
		},
	};
}
