import { HttpError, getUserId, handler } from "../../server/http";
import type { Place } from "../../types";

// Søk etter steder i OpenStreetMap via Photon. Laget for søk mens man skriver: treffer på
// starten av ord og tåler små skrivefeil, så «Tempe kunstgress» finner «Tempe kunstgressbane».
// (Nominatim, som ble brukt før, krever hele ord.) Gratis og uten nøkkel, men den offentlige
// serveren skal brukes med måte, så appen venter til brukeren har sluttet å skrive. Bytt til en
// egen Photon-server eller en betalt geokoder om bruken blir stor.
// https://photon.komoot.io
const PHOTON_URL = "https://photon.komoot.io/api/";

// Foretrekker treff rundt Trondheim, men utelukker ikke andre steder i Norge.
const TRONDHEIM = { lat: "63.43", lon: "10.39" };
// Omtrent Norge (vest, sør, øst, nord). Tar også med litt av nabolandene, de filtreres bort under.
const NORWAY_BBOX = "4.0,57.9,31.5,71.3";
const LIMIT = 8;

interface PhotonFeature {
	geometry: { coordinates: [lon: number, lat: number] };
	properties: {
		name?: string;
		street?: string;
		housenumber?: string;
		postcode?: string;
		city?: string;
		town?: string;
		village?: string;
		county?: string;
		countrycode?: string;
	};
}

/** «Skansegata 20, 7014 Trondheim». Det som mangler, utelates. */
function formatAddress(p: PhotonFeature["properties"]) {
	const street = [p.street, p.housenumber].filter(Boolean).join(" ");
	const place = [p.postcode, p.city ?? p.town ?? p.village ?? p.county]
		.filter(Boolean)
		.join(" ");
	return { street, full: [street, place].filter(Boolean).join(", ") };
}

export const GET = handler(async (request): Promise<Place[]> => {
	await getUserId(request);
	const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
	if (q.length < 3) return [];

	const url = new URL(PHOTON_URL);
	url.search = new URLSearchParams({
		q,
		// Ber om flere enn vi viser, siden treff utenfor Norge fjernes.
		limit: String(LIMIT * 2),
		...TRONDHEIM,
		bbox: NORWAY_BBOX,
	}).toString();

	const response = await fetch(url, {
		headers: { "User-Agent": "Sporty/0.1 (TIHLDE, utviklingsversjon)" },
	});
	if (!response.ok) throw new HttpError(502, "Stedssøket svarte ikke");

	const { features } = (await response.json()) as {
		features: PhotonFeature[];
	};
	return features
		.filter((f) => f.properties.countrycode === "NO")
		.slice(0, LIMIT)
		.map(({ properties, geometry }) => {
			const { street, full } = formatAddress(properties);
			const [longitude, latitude] = geometry.coordinates;
			return {
				id: null,
				// Rene adresser har ikke navn: da er gateadressen navnet.
				name: properties.name || street || full || q,
				address: full,
				latitude,
				longitude,
			};
		});
});
