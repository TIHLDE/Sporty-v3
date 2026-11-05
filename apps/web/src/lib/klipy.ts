// GIF-søk mot Klipy. Klipy krever at søk og lasting av bilder går direkte fra nettleseren, ikke via
// vår server, så nøkkelen er offentlig. Resultatene skal vises i den rekkefølgen Klipy gir dem.

import type { FavoriteGif } from "@sporty/api/rest/types";

const APP_KEY = import.meta.env.VITE_KLIPY_APP_KEY as string | undefined;
const PER_PAGE = 24;
/** Innholdsfilteret hos Klipy (off, low, medium eller high). */
const CONTENT_FILTER = "medium";

export type Gif = FavoriteGif;

export interface GifPage {
	gifs: Gif[];
	nextPage: number | null;
}

type KlipyFile = { url: string; width: number; height: number };
type KlipyItem = {
	slug: string;
	title?: string;
	file: Partial<Record<"hd" | "md" | "sm" | "xs", { webp?: KlipyFile }>>;
};

function baseUrl() {
	if (!APP_KEY)
		throw new Error("GIF-er er ikke satt opp (mangler VITE_KLIPY_APP_KEY)");
	return `https://api.klipy.com/api/v1/${APP_KEY}/gifs`;
}

function toGif(item: KlipyItem): Gif | null {
	// `sm` er skarp nok til både rutenettet og chatten, og er langt mindre enn `md` og `hd`.
	const file = item.file.sm?.webp ?? item.file.md?.webp ?? item.file.hd?.webp;
	if (!file) return null;
	return {
		slug: item.slug,
		title: item.title ?? "",
		url: file.url,
		width: file.width,
		height: file.height,
	};
}

/** Klipy vil ha en stabil id per bruker. De får en hash, ikke selve bruker-id-en. */
export async function klipyCustomerId(userId: string) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(userId),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

/** Trending uten søkeord, ellers søk. */
export async function fetchGifs(
	query: string,
	page: number,
	customerId: string,
): Promise<GifPage> {
	const params = new URLSearchParams({
		page: String(page),
		per_page: String(PER_PAGE),
		customer_id: customerId,
		locale: "no",
		content_filter: CONTENT_FILTER,
		format_filter: "webp",
	});
	if (query) params.set("q", query);

	const response = await fetch(
		`${baseUrl()}/${query ? "search" : "trending"}?${params}`,
	);
	if (!response.ok) throw new Error("Kunne ikke hente GIF-er");
	const { data } = (await response.json()) as {
		data: { data: KlipyItem[]; has_next: boolean; current_page: number };
	};
	return {
		gifs: data.data.flatMap((item) => toGif(item) ?? []),
		nextPage: data.has_next ? data.current_page + 1 : null,
	};
}

/** Forteller Klipy at en GIF ble sendt. Tom `query` betyr at den kom fra trending. */
export function reportGifShare(
	slug: string,
	customerId: string,
	query: string,
) {
	if (!APP_KEY) return;
	fetch(`${baseUrl()}/share/${encodeURIComponent(slug)}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ customer_id: customerId, q: query }),
	}).catch(() => {});
}
