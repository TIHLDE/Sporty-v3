// Push-varsler via Expo Push Service, som leverer videre til Apple (APNs) og Google (FCM).
// https://docs.expo.dev/push-notifications/sending-notifications/

import type { NotificationContent } from "../lib/notification-content";
import { prisma } from "./prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Expo tar imot maks 100 varsler per forespørsel. */
const CHUNK_SIZE = 100;

interface PushTicket {
	status: "ok" | "error";
	message?: string;
	details?: { error?: string };
}

/** Varseltypene som sendes som push, og innstillingen som styrer hver av dem. */
const SETTING = { fine: "pushFines" } as const;

/**
 * Sender et push-varsel til alle enhetene til brukerne som har slått på denne typen varsel.
 * Feil logges, men stopper aldri forespørselen som utløste varselet: varselet ligger uansett i
 * Varsler-fanen.
 */
export async function sendPush(
	userIds: string[],
	kind: keyof typeof SETTING,
	content: NotificationContent,
) {
	if (userIds.length === 0) return;
	try {
		const tokens = await prisma.pushToken.findMany({
			where: {
				userId: { in: userIds },
				// Uten lagrede innstillinger gjelder standarden: alt er på.
				user: {
					OR: [
						{ notificationSettings: null },
						{
							notificationSettings: {
								pushEnabled: true,
								[SETTING[kind]]: true,
							},
						},
					],
				},
			},
		});
		for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
			const chunk = tokens.slice(i, i + CHUNK_SIZE);
			const response = await fetch(EXPO_PUSH_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify(
					chunk.map(({ token }) => ({
						to: token,
						title: content.title,
						body: content.body,
						data: { url: content.url },
						sound: "default",
					})),
				),
			});
			if (!response.ok) {
				console.warn(
					"[push] Expo svarte",
					response.status,
					await response.text(),
				);
				continue;
			}
			const { data } = (await response.json()) as { data: PushTicket[] };
			// Fjern tokens for enheter som har slettet appen eller skrudd av varsler.
			const stale = chunk.filter(
				(_, j) => data[j]?.details?.error === "DeviceNotRegistered",
			);
			if (stale.length > 0) {
				await prisma.pushToken.deleteMany({
					where: { token: { in: stale.map((t) => t.token) } },
				});
			}
			data
				.filter((ticket) => ticket.status === "error")
				.forEach((ticket) => console.warn("[push]", ticket.message));
		}
	} catch (error) {
		console.warn("[push] Kunne ikke sende", error);
	}
}
