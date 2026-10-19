// Felles for API-rutene som endrer posisjonslisten til en gruppe. Kun serverkode.

import { HttpError } from "./http";

export function parsePositionName(name: unknown) {
	const trimmed = typeof name === "string" ? name.trim() : "";
	if (!trimmed) throw new HttpError(400, "Posisjonen må ha et navn");
	if (trimmed.length > 40)
		throw new HttpError(400, "Navnet kan ha maks 40 tegn");
	return trimmed;
}

/** Unik-feil fra Prisma (P2002): navnet finnes allerede i gruppen. */
export function isDuplicateName(error: unknown) {
	return (error as { code?: string })?.code === "P2002";
}
