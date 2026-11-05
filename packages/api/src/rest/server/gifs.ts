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

/** Bare lenker til Klipy godtas, så en melding ikke kan laste bilder fra hvor som helst. */
function isKlipyUrl(value: unknown): value is string {
	if (typeof value !== "string") return false;
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" && /^static\d*\.klipy\.com$/.test(url.hostname)
		);
	} catch {
		return false;
	}
}

/** Sjekker en GIF fra klienten. */
export function parseGif(input: Partial<MessageGif> | null): MessageGif {
	const { slug, url, width, height } = input ?? {};
	if (
		typeof slug !== "string" ||
		!slug ||
		slug.length > 200 ||
		!isKlipyUrl(url) ||
		!isSide(width) ||
		!isSide(height)
	)
		throw new HttpError(400, "Ugyldig GIF");
	return { slug, url, width, height };
}
