import { HttpError, getUserId, handler } from "../../server/http";
import type { Place } from "../../types";

// Søk etter steder i OpenStreetMap (Nominatim). Gratis og uten nøkkel, men med bruksregler:
// maks ett kall i sekundet og en User-Agent som identifiserer appen. Appen venter derfor til
// brukeren har sluttet å skrive. Bytt til en betalt geokoder om bruken blir stor.
// https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Foretrekker treff rundt Trondheim, men utelukker ikke andre steder.
const TRONDHEIM_VIEWBOX = "10.0,63.6,10.8,63.25";

interface NominatimResult {
	name?: string;
	display_name: string;
	lat: string;
	lon: string;
}

export const GET = handler(async (request): Promise<Place[]> => {
	await getUserId(request);
	const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
	if (q.length < 3) return [];

	const url = new URL(NOMINATIM_URL);
	url.search = new URLSearchParams({
		q,
		format: "jsonv2",
		limit: "8",
		countrycodes: "no",
		viewbox: TRONDHEIM_VIEWBOX,
		"accept-language": "nb",
	}).toString();

	const response = await fetch(url, {
		headers: { "User-Agent": "Sporty/0.1 (TIHLDE, utviklingsversjon)" },
	});
	if (!response.ok) throw new HttpError(502, "Stedssøket svarte ikke");

	const results = (await response.json()) as NominatimResult[];
	return results.map((r) => {
		const [first, ...rest] = r.display_name.split(", ");
		return {
			id: null,
			name: r.name || first || r.display_name,
			address: (r.name ? r.display_name.split(", ").slice(1) : rest)
				.slice(0, 3)
				.join(", "),
			latitude: Number(r.lat),
			longitude: Number(r.lon),
		};
	});
});
