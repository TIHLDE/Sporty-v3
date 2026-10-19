import { getFinesGroup, isTihldeFines } from "../../../server/fines";
import {
	getAccessToken,
	getUserId,
	handler,
	HttpError,
	requireAccess,
} from "../../../server/http";
import { photonFineImageUrl } from "../../../server/photon";

/**
 * Bildet til en bot på tihlde.org (`?groupId=`). Bildet er privat der og må hentes med
 * Photon-tokenet. Appen har tokenet selv, men nettleseren har det ikke, så nettsiden henter
 * bildet her, der serveren legger på tokenet.
 */
export const GET = handler<{ fineId: string }>(async (request, { fineId }) => {
	const userId = await getUserId(request);
	const groupId = new URL(request.url).searchParams.get("groupId") ?? "";
	await requireAccess(userId, groupId);
	const group = await getFinesGroup(groupId);
	if (!isTihldeFines(group)) throw new HttpError(404, "Fant ikke bildet");

	const response = await fetch(photonFineImageUrl(group.photonSlug, fineId), {
		headers: { authorization: `Bearer ${await getAccessToken(request)}` },
	});
	if (!response.ok) throw new HttpError(404, "Fant ikke bildet");
	return new Response(response.body, {
		headers: {
			"content-type":
				response.headers.get("content-type") ?? "application/octet-stream",
			"cache-control": "private, max-age=3600",
		},
	});
});
