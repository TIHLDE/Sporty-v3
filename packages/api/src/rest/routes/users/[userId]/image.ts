import {
	getAccessToken,
	getUserId,
	handler,
	HttpError,
} from "../../../server/http";
import { isPhotonAsset } from "../../../server/photon";
import { prisma } from "../../../server/prisma";

/**
 * Profilbildet til en bruker. Bilder lastet opp på tihlde.org er private der og må hentes med
 * Photon-tokenet. Appen har tokenet selv, men nettleseren har det ikke, så nettsiden henter
 * bildet her, der serveren legger på tokenet. Andre bilder (f.eks. fra Feide) videresendes.
 */
export const GET = handler<{ userId: string }>(async (request, { userId }) => {
	await getUserId(request);
	const person = await prisma.person.findUnique({
		where: { id: userId },
		select: { imageUrl: true },
	});
	if (!person?.imageUrl) throw new HttpError(404, "Fant ikke bildet");
	if (!isPhotonAsset(person.imageUrl)) {
		return Response.redirect(person.imageUrl, 302);
	}

	// Photon lager en mindre WebP-versjon, så en avatar ikke laster ned originalen.
	const url = new URL(person.imageUrl);
	url.searchParams.set("w", "320");
	const response = await fetch(url, {
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
