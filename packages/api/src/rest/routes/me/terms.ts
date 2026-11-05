import { TERMS_VERSION } from "../../lib/terms";
import { getUserId, handler } from "../../server/http";
import { prisma } from "../../server/prisma";

/** Brukeren godtar gjeldende versjon av vilkårene. */
export const POST = handler(async (request) => {
	const userId = await getUserId(request);
	await prisma.person.update({
		where: { id: userId },
		data: { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION },
	});
	return { ok: true };
});
