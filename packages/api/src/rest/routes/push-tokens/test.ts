import { fineContent } from "../../lib/notification-content";
import { HttpError, getUserId, handler } from "../../server/http";
import { prisma } from "../../server/prisma";
import { sendPush } from "../../server/push";

/** Kun i utvikling: sender et eksempel på bot-varselet som ekte push til egne enheter. */
export const POST = handler(async (request) => {
	if (process.env.NODE_ENV === "production")
		throw new HttpError(404, "Finnes ikke");
	const userId = await getUserId(request);
	const devices = await prisma.pushToken.count({ where: { userId } });
	if (devices === 0) {
		throw new HttpError(
			400,
			"Denne enheten har ikke registrert en push-token. Push krever en development build og et EAS-prosjekt.",
		);
	}

	const settings = await prisma.notificationSettings.findUnique({
		where: { userId },
	});
	if (settings && !(settings.pushEnabled && settings.pushFines)) {
		throw new HttpError(
			400,
			"Push for bøter er skrudd av i Profil → Innstillinger.",
		);
	}

	await sendPush(
		[userId],
		"fine",
		fineContent({
			count: 2,
			groupId: "herrer",
			groupName: "Pythons Herrer",
			paragraph: "1.00",
			lawTitle: "Oppmøte",
			reason: "Kom 10 minutter for sent på trening (test)",
		}),
	);
	return { devices };
});
