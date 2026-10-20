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
	address?: {
		road?: string;
		pedestrian?: string;
		house_number?: string;
		postcode?: string;
		city?: string;
		town?: string;
		village?: string;
		municipality?: string;
	};
}

/** «Skansegata 20, 7014 Trondheim». Det som mangler, utelates. */
function formatAddress(address: NonNullable<NominatimResult["address"]>) {
	const street = [address.road ?? address.pedestrian, address.house_number]
		.filter(Boolean)
		.join(" ");
	const place = [
		address.postcode,
		address.city ?? address.town ?? address.village ?? address.municipality,
	]
		.filter(Boolean)
		.join(" ");
	return { street, full: [street, place].filter(Boolean).join(", ") };
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
		addressdetails: "1",
		"accept-language": "nb",
	}).toString();

	const response = await fetch(url, {
		headers: { "User-Agent": "Sporty/0.1 (TIHLDE, utviklingsversjon)" },
	});
	if (!response.ok) throw new HttpError(502, "Stedssøket svarte ikke");

	const results = (await response.json()) as NominatimResult[];
	return results.map((r) => {
		const { street, full } = formatAddress(r.address ?? {});
		return {
			id: null,
			// Rene adresser har ikke navn: da er gateadressen navnet, ikke bare husnummeret.
			name: r.name || street || r.display_name.split(", ")[0] || r.display_name,
			address: full,
			latitude: Number(r.lat),
			longitude: Number(r.lon),
		};
	});
});
