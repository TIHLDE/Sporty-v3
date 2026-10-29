import {
	canManageGroup,
	getUserId,
	handler,
	requireAccess,
} from "../../../server/http";
import { getGroupStats } from "../../../server/stats";
import type { GroupStats } from "../../../types";

/**
 * Statistikk for gruppen. `?period=2026-H` (høst), `2026-V` (vår) eller `all`; uten gjeldende
 * semester. Admin-delen (svar-disiplin og betalinger) er bare med for sub-/admin.
 */
export const GET = handler<{ groupId: string }>(
	async (request, { groupId }): Promise<GroupStats> => {
		const userId = await getUserId(request);
		await requireAccess(userId, groupId);
		const period = new URL(request.url).searchParams.get("period");
		return getGroupStats(
			groupId,
			userId,
			period,
			await canManageGroup(userId, groupId),
		);
	},
);
