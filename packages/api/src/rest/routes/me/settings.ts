import { HttpError, getUserId, handler, readJson } from "../../server/http";
import { prisma } from "../../server/prisma";
import type { NotificationSettings } from "../../types";

const DEFAULTS: NotificationSettings = {
	pushEnabled: true,
	pushFines: true,
	pushEventReminders: true,
	pushSignupReminders: true,
};
const KEYS = Object.keys(DEFAULTS) as (keyof NotificationSettings)[];
const select = {
	pushEnabled: true,
	pushFines: true,
	pushEventReminders: true,
	pushSignupReminders: true,
};

/** Den innloggede brukerens varselinnstillinger. */
export const GET = handler(async (request) => {
	const userId = await getUserId(request);
	const settings = await prisma.notificationSettings.findUnique({
		where: { userId },
		select,
	});
	return settings ?? DEFAULTS;
});

/** Endrer én eller flere av varselinnstillingene. */
export const PATCH = handler(async (request) => {
	const userId = await getUserId(request);
	const input = await readJson<Partial<NotificationSettings>>(request);
	const data: Partial<NotificationSettings> = {};
	for (const key of KEYS) {
		if (input[key] === undefined) continue;
		if (typeof input[key] !== "boolean")
			throw new HttpError(400, `${key} må være true eller false`);
		data[key] = input[key];
	}
	return prisma.notificationSettings.upsert({
		where: { userId },
		create: { userId, ...data },
		update: data,
		select,
	});
});
