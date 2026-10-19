import {
	eventInclude,
	notify,
	pastEventsWhere,
	toEvent,
	upcomingEventsWhere,
} from "../../../server/dto";
import { parseEventInput, rememberPlace } from "../../../server/events";
import {
	getUserId,
	handler,
	readJson,
	requireAccess,
	requireManagerOrParent,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";
import type { CreateEventInput } from "../../../types";

/** ?when=upcoming (standard) eller ?when=past */
export const GET = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireAccess(userId, groupId);
		const past = new URL(request.url).searchParams.get("when") === "past";

		const events = await prisma.event.findMany({
			where: { groupId, ...(past ? pastEventsWhere() : upcomingEventsWhere()) },
			include: eventInclude,
			orderBy: { startsAt: past ? "desc" : "asc" },
		});
		return events.map((e) => toEvent(e, userId));
	},
);

/** (Sub-/admin) Lag et arrangement. Alle medlemmer i gruppen får et varsel. */
export const POST = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireManagerOrParent(userId, groupId);
		const data = parseEventInput(await readJson<CreateEventInput>(request));

		const group = await prisma.group.findUniqueOrThrow({
			where: { id: groupId },
		});
		const event = await prisma.event.create({
			data: { ...data, groupId, createdById: userId },
			include: eventInclude,
		});
		await rememberPlace(group, data);

		await notify(
			event.group.memberships
				.map((m) => m.userId)
				.filter((id) => id !== userId),
			{
				groupId,
				type: "event",
				text: `Nytt arrangement i ${group.name}: ${data.title}`,
				href: `/grupper/${groupId}/arrangement/${event.id}`,
			},
		);

		return Response.json(toEvent(event, userId), { status: 201 });
	},
);
