// GIF-er i meldinger. Kun serverkode.
//
// Klipy krever at søk og visning går direkte fra klienten, så serveren lagrer bare lenken klienten
// fikk av Klipy, aldri selve bildet.

import type { MessageGif } from "../types";
import { HttpError } from "./http";

const MAX_SIDE = 4096;

const isSide = (value: unknown): value is number =>
	Number.isInteger(value) &&
	(value as number) > 0 &&
	(value as number) <= MAX_SIDE;

/**
 * Normalisert lenke hvis den går til Klipy, ellers null. Det er den normaliserte lenken som skal
 * lagres: iOS tolker f.eks. omvendt skråstrek annerledes enn `URL`, og kunne ellers ha lastet
 * bildet fra en annen vert enn den som ble sjekket her.
 */
function klipyUrl(value: unknown): string | null {
	if (typeof value !== "string") return null;
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return null;
	}
	const isKlipy =
		url.protocol === "https:" &&
		!url.username &&
		!url.password &&
		!url.port &&
		/^static\d*\.klipy\.com$/.test(url.hostname);
	return isKlipy ? url.href : null;
}

/** Sjekker en GIF fra klienten. */
export function parseGif(input: Partial<MessageGif> | null): MessageGif {
	const { slug, width, height } = input ?? {};
	const url = klipyUrl(input?.url);
	if (
		typeof slug !== "string" ||
		!slug ||
		slug.length > 200 ||
		!url ||
		!isSide(width) ||
		!isSide(height)
	)
		throw new HttpError(400, "Ugyldig GIF");
	return { slug, url, width, height };
}
