import { HttpError, getUserId, handler, readJson } from "../../server/http";
import { prisma } from "../../server/prisma";

/** Registrerer enhetens push-token på den innloggede brukeren (flyttes hvis en annen hadde den). */
export const POST = handler(async (request) => {
	const userId = await getUserId(request);
	const { token, platform } = await readJson<{
		token: string;
		platform: string;
	}>(request);
	if (!token?.startsWith("ExponentPushToken["))
		throw new HttpError(400, "Ugyldig push-token");

	await prisma.pushToken.upsert({
		where: { token },
		create: { token, userId, platform },
		update: { userId, platform },
	});
	return { ok: true };
});

/** Fjerner enhetens push-token ved utlogging, så telefonen slutter å få varsler for brukeren. */
export const DELETE = handler(async (request) => {
	const userId = await getUserId(request);
	const { token } = await readJson<{ token: string }>(request);
	await prisma.pushToken.deleteMany({ where: { token, userId } });
	return { ok: true };
});
