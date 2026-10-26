// Felles validering for å lage og redigere arrangementer. Kun serverkode.

import type { CreateEventInput, EventType } from "../types";
import { HttpError } from "./http";
import { prisma } from "./prisma";

const EVENT_TYPES: EventType[] = ["trening", "kamp", "sosialt", "annet"];
const MAX_ATTENDEES_LIMIT = 10_000;

function parseDate(value: string | null | undefined, field: string) {
	if (value == null) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime()))
		throw new HttpError(400, `Ugyldig dato i ${field}`);
	return date;
}

/** Sjekker skjemaet og gjør det om til feltene i Event-tabellen. */
export function parseEventInput(input: CreateEventInput) {
	const title = input.title?.trim();
	if (!title) throw new HttpError(400, "Arrangementet må ha et navn");
	if (!EVENT_TYPES.includes(input.type))
		throw new HttpError(400, "Ugyldig type arrangement");
	// Motstander gir bare mening for kamper.
	const opponent =
		input.type === "kamp" ? input.opponent?.trim() || null : null;
	if (opponent && opponent.length > 80)
		throw new HttpError(400, "Motstanderen kan ha maks 80 tegn");

	const { location } = input;
	if (
		!location?.name?.trim() ||
		!Number.isFinite(location.latitude) ||
		!Number.isFinite(location.longitude)
	) {
		throw new HttpError(400, "Velg et sted");
	}

	const startsAt = parseDate(input.start, "starttid");
	if (!startsAt) throw new HttpError(400, "Velg starttid");
	const endsAt = parseDate(input.end, "sluttid");
	const signupDeadline = parseDate(input.signupDeadline, "påmeldingsfrist");
	if (endsAt && endsAt <= startsAt)
		throw new HttpError(400, "Sluttid må være etter starttid");
	if (signupDeadline && signupDeadline > startsAt) {
		throw new HttpError(
			400,
			"Påmeldingsfristen må være før arrangementet starter",
		);
	}

	// undefined: feltet ble ikke sendt (eldre apper), så en eksisterende grense beholdes.
	const { maxAttendees } = input;
	if (
		maxAttendees != null &&
		(!Number.isInteger(maxAttendees) ||
			maxAttendees < 1 ||
			maxAttendees > MAX_ATTENDEES_LIMIT)
	) {
		throw new HttpError(
			400,
			"Maks antall deltakere må være et helt tall over 0",
		);
	}

	return {
		title,
		type: input.type,
		opponent,
		description: input.description?.trim() ?? "",
		locationName: location.name.trim(),
		// Eldre versjoner av appen sender ikke adressen.
		locationAddress: location.address?.trim() ?? "",
		latitude: location.latitude,
		longitude: location.longitude,
		startsAt,
		endsAt,
		signupDeadline,
		maxAttendees,
	};
}

/** Husker stedet for hovedgruppen, så det foreslås neste gang noen lager et arrangement. */
export async function rememberPlace(
	group: { id: string; parentId: string | null },
	place: {
		locationName: string;
		locationAddress: string;
		latitude: number;
		longitude: number;
	},
) {
	const placeGroupId = group.parentId ?? group.id;
	const existing = await prisma.place.findFirst({
		where: { groupId: placeGroupId, name: place.locationName },
	});
	if (existing) {
		await prisma.place.update({
			where: { id: existing.id },
			data: {
				latitude: place.latitude,
				longitude: place.longitude,
				// Behold adressen vi har hvis arrangementet ikke kom med en.
				...(place.locationAddress ? { address: place.locationAddress } : {}),
				lastUsedAt: new Date(),
			},
		});
	} else {
		await prisma.place.create({
			data: {
				groupId: placeGroupId,
				name: place.locationName,
				address: place.locationAddress,
				latitude: place.latitude,
				longitude: place.longitude,
			},
		});
	}
}
