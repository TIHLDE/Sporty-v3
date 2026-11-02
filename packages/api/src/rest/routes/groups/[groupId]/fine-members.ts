import { fineInclude, toFine } from "../../../server/dto";
import {
	fineDateRange,
	getAllPhotonFines,
	getFinesGroup,
	inDateRange,
	isTihldeFines,
} from "../../../server/fines";
import {
	getAccessToken,
	getUserId,
	handler,
	isManager,
	requireAccess,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";
import type { Fine, MemberFines } from "../../../types";

/** Summerer bøtene per medlem, flest ubetalte først. */
function summarize(fines: Fine[]): MemberFines[] {
	const byUser = new Map<string, MemberFines>();
	for (const fine of fines) {
		const entry = byUser.get(fine.user.id) ?? {
			user: fine.user,
			notApproved: 0,
			approvedNotPaid: 0,
			paid: 0,
			rejected: 0,
		};
		if (fine.status === "pending") entry.notApproved += fine.count;
		else if (fine.status === "approved") entry.approvedNotPaid += fine.count;
		else if (fine.status === "paid") entry.paid += fine.count;
		else entry.rejected += fine.count;
		byUser.set(fine.user.id, entry);
	}
	return [...byUser.values()].sort(
		(a, b) =>
			b.notApproved + b.approvedNotPaid - (a.notApproved + a.approvedNotPaid) ||
			b.paid - a.paid ||
			a.user.name.localeCompare(b.user.name, "nb"),
	);
}

/**
 * Bøtene i gruppen summert per medlem, til «Per medlem» på Bøter. For lag fra tihlde.org ser
 * alle medlemmer alle, som der. I Sporty-grupper ser sub-/admin alle, medlemmer bare seg selv.
 */
export const GET = handler<{ groupId: string }>(
	async (request, { groupId }): Promise<MemberFines[]> => {
		const userId = await getUserId(request);
		await requireAccess(userId, groupId);
		const group = await getFinesGroup(groupId);
		// Valgfritt tidsrom (`?from=`/`?to=`, ISO-tidspunkter), som på bøtelisten.
		const range = fineDateRange(new URL(request.url).searchParams);

		if (isTihldeFines(group)) {
			if (!group.photonFinesActivated) return [];
			const accessToken = await getAccessToken(request);
			const fines = await getAllPhotonFines(accessToken, group);
			return summarize(fines.filter((f) => inDateRange(f.createdAt, range)));
		}

		const { role } = await requireAccess(userId, group.id);
		const fines = await prisma.fine.findMany({
			where: { groupId: group.id, ...(isManager(role) ? {} : { userId }) },
			include: fineInclude,
		});
		return summarize(
			fines.map(toFine).filter((f) => inDateRange(f.createdAt, range)),
		);
	},
);
