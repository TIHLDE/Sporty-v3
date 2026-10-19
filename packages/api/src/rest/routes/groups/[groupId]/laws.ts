import { getLaws } from "../../../server/fines";
import {
	getAccessToken,
	getUserId,
	handler,
	requireAccess,
} from "../../../server/http";

/** Lovverket: fra tihlde.org for lag derfra, ellers Sporty sine botregler. Undergrupper bruker
 * hovedgruppens. */
export const GET = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireAccess(userId, groupId);
		return getLaws(groupId, () => getAccessToken(request));
	},
);
