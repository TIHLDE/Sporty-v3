import { z } from "zod";

import { protectedProcedure, router } from "../index";
import type * as Dto from "../rest/types";
import { restCall } from "./rest-call";

const id = z.string().min(1);
const fineStatus = z.enum(["pending", "approved", "paid", "rejected"]);

/** Bygger ?a=b, uten tomme verdier. */
function query(params: Record<string, string | number | undefined>) {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== "") search.set(key, String(value));
	}
	const text = search.toString();
	return text ? `?${text}` : "";
}

const enc = encodeURIComponent;

const groupsRouter = router({
	list: protectedProcedure.query(({ ctx }) =>
		restCall<Dto.Group[]>(ctx, "GET", "/groups"),
	),
	get: protectedProcedure
		.input(z.object({ groupId: id }))
		.query(({ ctx, input }) =>
			restCall<Dto.GroupDetails>(ctx, "GET", `/groups/${enc(input.groupId)}`),
		),
	files: protectedProcedure
		.input(z.object({ groupId: id }))
		.query(({ ctx, input }) =>
			restCall<Dto.GroupFile[]>(
				ctx,
				"GET",
				`/groups/${enc(input.groupId)}/files`,
			),
		),
	/** Hovedgrupper der brukeren kan gi bøter. */
	finesGroups: protectedProcedure.query(({ ctx }) =>
		restCall<Dto.Group[]>(ctx, "GET", "/groups/managed"),
	),
});

const eventInput = z.object({
	title: z.string(),
	type: z.enum(["trening", "kamp", "sosialt", "annet"]),
	opponent: z.string().nullable(),
	start: z.string(),
	end: z.string().nullable(),
	location: z.object({
		name: z.string(),
		latitude: z.number(),
		longitude: z.number(),
	}),
	description: z.string(),
	signupDeadline: z.string().nullable(),
});
const score = z.number().int().min(0).max(99).nullable();

const eventsRouter = router({
	upcoming: protectedProcedure.query(({ ctx }) =>
		restCall<Dto.Event[]>(ctx, "GET", "/events"),
	),
	byGroup: protectedProcedure
		.input(z.object({ groupId: id, when: z.enum(["upcoming", "past"]) }))
		.query(({ ctx, input }) =>
			restCall<Dto.Event[]>(
				ctx,
				"GET",
				`/groups/${enc(input.groupId)}/events${query({ when: input.when })}`,
			),
		),
	get: protectedProcedure
		.input(z.object({ eventId: id }))
		.query(({ ctx, input }) =>
			restCall<Dto.Event>(ctx, "GET", `/events/${enc(input.eventId)}`),
		),
	create: protectedProcedure
		.input(
			z.object({
				groupId: id,
				event: eventInput,
			}),
		)
		.mutation(({ ctx, input }) =>
			restCall<Dto.Event>(
				ctx,
				"POST",
				`/groups/${enc(input.groupId)}/events`,
				input.event,
			),
		),
	update: protectedProcedure
		.input(z.object({ eventId: id, event: eventInput }))
		.mutation(({ ctx, input }) =>
			restCall<Dto.Event>(
				ctx,
				"PUT",
				`/events/${enc(input.eventId)}`,
				input.event,
			),
		),
	delete: protectedProcedure
		.input(z.object({ eventId: id }))
		.mutation(({ ctx, input }) =>
			restCall(ctx, "DELETE", `/events/${enc(input.eventId)}`),
		),
	/** Send null for begge for å fjerne resultatet. */
	setResult: protectedProcedure
		.input(z.object({ eventId: id, ourScore: score, theirScore: score }))
		.mutation(({ ctx, input }) =>
			restCall<Dto.Event>(ctx, "PUT", `/events/${enc(input.eventId)}/result`, {
				ourScore: input.ourScore,
				theirScore: input.theirScore,
			}),
		),
	collectiveFine: protectedProcedure
		.input(z.object({ eventId: id }))
		.mutation(({ ctx, input }) =>
			restCall<{ count: number }>(
				ctx,
				"POST",
				`/events/${enc(input.eventId)}/collective-fine`,
			),
		),
	respond: protectedProcedure
		.input(z.object({ eventId: id, status: z.enum(["kommer", "kommer_ikke"]) }))
		.mutation(({ ctx, input }) =>
			restCall<Dto.Event>(
				ctx,
				"PUT",
				`/events/${enc(input.eventId)}/attendance`,
				{
					status: input.status,
				},
			),
		),
});

const placesRouter = router({
	/** Steder som er brukt før i gruppen, nyeste først. */
	recent: protectedProcedure
		.input(z.object({ groupId: id }))
		.query(({ ctx, input }) =>
			restCall<Dto.Place[]>(
				ctx,
				"GET",
				`/places${query({ groupId: input.groupId })}`,
			),
		),
	search: protectedProcedure
		.input(z.object({ q: z.string() }))
		.query(({ ctx, input }) =>
			restCall<Dto.Place[]>(
				ctx,
				"GET",
				`/places/search${query({ q: input.q })}`,
			),
		),
});

const finesRouter = router({
	/** Én side med bøter. `cursor` er sidenummeret (0 = nyeste), så useInfiniteQuery kan bruke den. */
	page: protectedProcedure
		.input(z.object({ groupId: id, cursor: z.number().int().min(0).nullish() }))
		.query(({ ctx, input }) =>
			restCall<Dto.FinesPage>(
				ctx,
				"GET",
				`/groups/${enc(input.groupId)}/fines${query({ page: input.cursor ?? 0 })}`,
			),
		),
	get: protectedProcedure
		.input(z.object({ groupId: id, fineId: id }))
		.query(({ ctx, input }) =>
			restCall<Dto.Fine>(
				ctx,
				"GET",
				`/fines/${enc(input.fineId)}${query({ groupId: input.groupId })}`,
			),
		),
	mine: protectedProcedure.query(({ ctx }) =>
		restCall<Dto.Fine[]>(ctx, "GET", "/fines/mine"),
	),
	laws: protectedProcedure
		.input(z.object({ groupId: id }))
		.query(({ ctx, input }) =>
			restCall<Dto.Law[]>(ctx, "GET", `/groups/${enc(input.groupId)}/laws`),
		),
	give: protectedProcedure
		.input(
			z.object({
				requestId: id,
				groupId: id,
				lawId: id,
				userIds: z.array(id).min(1),
				count: z.number().int(),
				reason: z.string(),
			}),
		)
		.mutation(({ ctx, input }) =>
			restCall<{ count: number; duplicate?: boolean }>(ctx, "POST", "/fines", {
				...input,
				imageUri: null,
			}),
		),
	setStatus: protectedProcedure
		.input(z.object({ groupId: id, fineId: id, status: fineStatus }))
		.mutation(({ ctx, input }) =>
			restCall<{ ok: true }>(ctx, "PATCH", `/fines/${enc(input.fineId)}`, {
				groupId: input.groupId,
				status: input.status,
			}),
		),
});

const announcementsRouter = router({
	byGroup: protectedProcedure
		.input(z.object({ groupId: id }))
		.query(({ ctx, input }) =>
			restCall<Dto.Announcement[]>(
				ctx,
				"GET",
				`/groups/${enc(input.groupId)}/announcements`,
			),
		),
	get: protectedProcedure
		.input(z.object({ announcementId: id }))
		.query(({ ctx, input }) =>
			restCall<Dto.AnnouncementDetails>(
				ctx,
				"GET",
				`/announcements/${enc(input.announcementId)}`,
			),
		),
	create: protectedProcedure
		.input(
			z.object({
				groupId: id,
				title: z.string(),
				body: z.string(),
				allowComments: z.boolean(),
				/** Fra POST /api/uploads. */
				uploadIds: z.array(id),
			}),
		)
		.mutation(({ ctx, input: { groupId, ...announcement } }) =>
			restCall<Dto.Announcement>(
				ctx,
				"POST",
				`/groups/${enc(groupId)}/announcements`,
				announcement,
			),
		),
	comment: protectedProcedure
		.input(z.object({ announcementId: id, body: z.string() }))
		.mutation(({ ctx, input }) =>
			restCall(
				ctx,
				"POST",
				`/announcements/${enc(input.announcementId)}/comments`,
				{
					body: input.body,
				},
			),
		),
});

const pollsRouter = router({
	byGroup: protectedProcedure
		.input(z.object({ groupId: id }))
		.query(({ ctx, input }) =>
			restCall<Dto.Poll[]>(ctx, "GET", `/groups/${enc(input.groupId)}/polls`),
		),
	get: protectedProcedure
		.input(z.object({ pollId: id }))
		.query(({ ctx, input }) =>
			restCall<Dto.PollDetails>(ctx, "GET", `/polls/${enc(input.pollId)}`),
		),
	create: protectedProcedure
		.input(
			z.object({
				groupId: id,
				question: z.string(),
				description: z.string(),
				options: z.array(z.string()),
				allowMultiple: z.boolean(),
				hideVotes: z.boolean(),
				allowComments: z.boolean(),
				closesAt: z.string(),
			}),
		)
		.mutation(({ ctx, input: { groupId, ...poll } }) =>
			restCall<Dto.Poll>(ctx, "POST", `/groups/${enc(groupId)}/polls`, poll),
		),
	/** Erstatter stemmen. Tom liste fjerner den. */
	vote: protectedProcedure
		.input(z.object({ pollId: id, optionIds: z.array(id) }))
		.mutation(({ ctx, input }) =>
			restCall(ctx, "PUT", `/polls/${enc(input.pollId)}/vote`, {
				optionIds: input.optionIds,
			}),
		),
	comment: protectedProcedure
		.input(z.object({ pollId: id, body: z.string() }))
		.mutation(({ ctx, input }) =>
			restCall(ctx, "POST", `/polls/${enc(input.pollId)}/comments`, {
				body: input.body,
			}),
		),
});

const paymentsRouter = router({
	byGroup: protectedProcedure
		.input(z.object({ groupId: id }))
		.query(({ ctx, input }) =>
			restCall<Dto.PaymentRequest[]>(
				ctx,
				"GET",
				`/groups/${enc(input.groupId)}/payments`,
			),
		),
	create: protectedProcedure
		.input(
			z.object({
				groupId: id,
				title: z.string(),
				description: z.string(),
				amount: z.number(),
				vippsNumber: z.string(),
				dueDate: z.string(),
			}),
		)
		.mutation(({ ctx, input: { groupId, ...payment } }) =>
			restCall<Dto.PaymentRequest>(
				ctx,
				"POST",
				`/groups/${enc(groupId)}/payments`,
				payment,
			),
		),
	/** Medlemmet markerer selv at det har betalt (eller angrer). */
	setPaid: protectedProcedure
		.input(z.object({ paymentId: id, paid: z.boolean() }))
		.mutation(({ ctx, input }) =>
			restCall<Dto.PaymentRequest>(
				ctx,
				"PUT",
				`/payments/${enc(input.paymentId)}/paid`,
				{
					paid: input.paid,
				},
			),
		),
});

/** Gruppeinnstillinger: admin endrer gruppen, roller, posisjonslisten og undergrupper. */
const groupAdminRouter = router({
	update: protectedProcedure
		.input(
			z.object({
				groupId: id,
				name: z.string().optional(),
				description: z.string().optional(),
				color: z.string().optional(),
				usesPositions: z.boolean().optional(),
				/** Opplastet bilde fra /api/uploads, eller null for å fjerne forsidebildet. */
				coverUploadId: z.string().nullable().optional(),
			}),
		)
		.mutation(({ ctx, input: { groupId, ...changes } }) =>
			restCall<Dto.Group>(ctx, "PATCH", `/groups/${enc(groupId)}`, changes),
		),
	/** Bare undergrupper kan slettes. */
	delete: protectedProcedure
		.input(z.object({ groupId: id }))
		.mutation(({ ctx, input }) =>
			restCall(ctx, "DELETE", `/groups/${enc(input.groupId)}`),
		),
	createSubgroup: protectedProcedure
		.input(
			z.object({
				parentId: id,
				name: z.string(),
				color: z.string(),
				description: z.string().optional(),
				usesPositions: z.boolean(),
				memberIds: z.array(id),
			}),
		)
		.mutation(({ ctx, input: { parentId, ...subgroup } }) =>
			restCall<Dto.Group>(
				ctx,
				"POST",
				`/groups/${enc(parentId)}/subgroups`,
				subgroup,
			),
		),
	setSubgroupMembers: protectedProcedure
		.input(z.object({ groupId: id, userIds: z.array(id) }))
		.mutation(({ ctx, input }) =>
			restCall(ctx, "PUT", `/groups/${enc(input.groupId)}/members`, {
				userIds: input.userIds,
			}),
		),
	setRole: protectedProcedure
		.input(
			z.object({
				groupId: id,
				userId: id,
				role: z.enum(["admin", "subadmin", "member"]),
			}),
		)
		.mutation(({ ctx, input }) =>
			restCall(
				ctx,
				"PUT",
				`/groups/${enc(input.groupId)}/members/${enc(input.userId)}/role`,
				{
					role: input.role,
				},
			),
		),
	setPosition: protectedProcedure
		.input(z.object({ groupId: id, userId: id, positionId: id.nullable() }))
		.mutation(({ ctx, input }) =>
			restCall(
				ctx,
				"PUT",
				`/groups/${enc(input.groupId)}/members/${enc(input.userId)}/position`,
				{
					positionId: input.positionId,
				},
			),
		),
	/** Gjør inaktiv med begrunnelse, eller aktiv igjen med null. */
	setInactive: protectedProcedure
		.input(z.object({ groupId: id, userId: id, reason: z.string().nullable() }))
		.mutation(({ ctx, input }) =>
			restCall(
				ctx,
				"PUT",
				`/groups/${enc(input.groupId)}/members/${enc(input.userId)}/inactive`,
				{
					reason: input.reason,
				},
			),
		),
	createPosition: protectedProcedure
		.input(z.object({ groupId: id, name: z.string() }))
		.mutation(({ ctx, input }) =>
			restCall(ctx, "POST", `/groups/${enc(input.groupId)}/positions`, {
				name: input.name,
			}),
		),
	updatePosition: protectedProcedure
		.input(
			z.object({
				groupId: id,
				positionId: id,
				name: z.string().optional(),
				move: z.enum(["up", "down"]).optional(),
			}),
		)
		.mutation(({ ctx, input: { groupId, positionId, ...changes } }) =>
			restCall(
				ctx,
				"PATCH",
				`/groups/${enc(groupId)}/positions/${enc(positionId)}`,
				changes,
			),
		),
	deletePosition: protectedProcedure
		.input(z.object({ groupId: id, positionId: id }))
		.mutation(({ ctx, input }) =>
			restCall(
				ctx,
				"DELETE",
				`/groups/${enc(input.groupId)}/positions/${enc(input.positionId)}`,
			),
		),
});

const settingsInput = z.object({
	pushEnabled: z.boolean().optional(),
	pushFines: z.boolean().optional(),
	pushEventReminders: z.boolean().optional(),
	pushSignupReminders: z.boolean().optional(),
	pushMessages: z.boolean().optional(),
});

const settingsRouter = router({
	get: protectedProcedure.query(({ ctx }) =>
		restCall<Dto.NotificationSettings>(ctx, "GET", "/me/settings"),
	),
	update: protectedProcedure
		.input(settingsInput)
		.mutation(({ ctx, input }) =>
			restCall<Dto.NotificationSettings>(ctx, "PATCH", "/me/settings", input),
		),
});

const notificationsRouter = router({
	/**
	 * Alle varslene, eller bare fra én gruppe, 100 om gangen. `cursor` (id-en til det eldste
	 * varselet man har) henter de neste.
	 */
	list: protectedProcedure
		.input(z.object({ groupId: id.optional(), cursor: z.string().nullish() }))
		.query(({ ctx, input }) =>
			restCall<Dto.Notification[]>(
				ctx,
				"GET",
				`/notifications${query({ groupId: input.groupId, cursor: input.cursor ?? undefined })}`,
			),
		),
	read: protectedProcedure
		.input(z.object({ notificationId: id }))
		.mutation(({ ctx, input }) =>
			restCall(ctx, "POST", `/notifications/${enc(input.notificationId)}/read`),
		),
	readAll: protectedProcedure.mutation(({ ctx }) =>
		restCall(ctx, "POST", "/notifications/read-all"),
	),
	/** Uleste varsler og meldinger, til tallene i menyen. */
	unread: protectedProcedure.query(({ ctx }) =>
		restCall<Dto.UnreadCounts>(ctx, "GET", "/unread"),
	),
});

const messagesRouter = router({
	conversations: protectedProcedure.query(({ ctx }) =>
		restCall<Dto.Conversation[]>(ctx, "GET", "/conversations"),
	),
	conversation: protectedProcedure
		.input(z.object({ conversationId: id }))
		.query(({ ctx, input }) =>
			restCall<Dto.ConversationDetails>(
				ctx,
				"GET",
				`/conversations/${enc(input.conversationId)}`,
			),
		),
	/** Én side med meldinger, nyeste først. `cursor` henter eldre. */
	page: protectedProcedure
		.input(z.object({ conversationId: id, cursor: z.string().nullish() }))
		.query(({ ctx, input }) =>
			restCall<Dto.MessagePage>(
				ctx,
				"GET",
				`/conversations/${enc(input.conversationId)}/messages${query({ cursor: input.cursor ?? undefined })}`,
			),
		),
	send: protectedProcedure
		.input(z.object({ conversationId: id, body: z.string() }))
		.mutation(({ ctx, input }) =>
			restCall<Dto.Message>(
				ctx,
				"POST",
				`/conversations/${enc(input.conversationId)}/messages`,
				{ body: input.body },
			),
		),
	markRead: protectedProcedure
		.input(z.object({ conversationId: id }))
		.mutation(({ ctx, input }) =>
			restCall(ctx, "POST", `/conversations/${enc(input.conversationId)}/read`),
		),
	/** Personer man deler en gruppe med. */
	contacts: protectedProcedure.query(({ ctx }) =>
		restCall<Dto.User[]>(ctx, "GET", "/contacts"),
	),
	/** Finner eller lager en samtale mellom deg og `userId`. */
	direct: protectedProcedure
		.input(z.object({ userId: id }))
		.mutation(({ ctx, input }) =>
			restCall<{ id: string }>(ctx, "POST", "/conversations/direct", {
				userId: input.userId,
			}),
		),
});

export const appRouter = router({
	me: protectedProcedure.query(({ ctx }) =>
		restCall<Dto.Me>(ctx, "GET", "/me"),
	),
	settings: settingsRouter,
	notifications: notificationsRouter,
	messages: messagesRouter,
	groups: groupsRouter,
	events: eventsRouter,
	places: placesRouter,
	fines: finesRouter,
	announcements: announcementsRouter,
	polls: pollsRouter,
	payments: paymentsRouter,
	groupAdmin: groupAdminRouter,
});
export type AppRouter = typeof appRouter;
