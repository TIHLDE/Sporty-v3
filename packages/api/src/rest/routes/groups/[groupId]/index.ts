import { GROUP_COLORS } from "../../../lib/group-colors";
import { toGroup, toUser } from "../../../server/dto";
import { getFinesInfo } from "../../../server/fines";
import {
	HttpError,
	getRole,
	getUserId,
	handler,
	isManager,
	readJson,
	requireAccess,
	requireAdminOrParent,
} from "../../../server/http";
import {
	getGroupMatchFacts,
	requireMainGroup,
} from "../../../server/match-facts";
import { prisma } from "../../../server/prisma";
import type { GroupDetails, UpdateGroupInput } from "../../../types";

const ROLE_ORDER = { admin: 0, subadmin: 1, member: 2 };

export const GET = handler<{ groupId: string }>(
	async (request, { groupId }): Promise<GroupDetails> => {
		const userId = await getUserId(request);
		const { role, parentId } = await requireAccess(userId, groupId);

		const group = await prisma.group.findUniqueOrThrow({
			where: { id: groupId },
			include: {
				subgroups: {
					include: { memberships: { select: { userId: true, role: true } } },
					orderBy: { name: "asc" },
				},
				memberships: {
					include: {
						user: true,
						position: { select: { id: true, name: true } },
					},
				},
				positions: {
					select: { id: true, name: true },
					orderBy: { sortOrder: "asc" },
				},
			},
		});

		// Sub-/admin i hovedgruppen styrer også undergruppene.
		const parentRole = parentId ? await getRole(userId, parentId) : null;
		const canManage = isManager(role) || isManager(parentRole);
		const canAdmin = role === "admin" || parentRole === "admin";

		return {
			...toGroup(group, role),
			canManage,
			canAdmin,
			fines: await getFinesInfo(userId, groupId),
			matchFacts: await getGroupMatchFacts(groupId),
			positions: group.positions,
			subgroups: group.subgroups.map((s) =>
				toGroup(
					s,
					s.memberships.find((m) => m.userId === userId)?.role ?? null,
				),
			),
			members: group.memberships
				.map((m) => ({
					user: toUser(m.user),
					role: m.role,
					position: group.usesPositions ? m.position : null,
					// Begrunnelsen er bare for sub-/admin og medlemmet selv.
					inactive: m.inactiveSince
						? {
								since: m.inactiveSince.toISOString(),
								reason:
									canManage || m.userId === userId ? m.inactiveReason : null,
							}
						: null,
					subgroupNames: group.subgroups
						.filter((s) => s.memberships.some((sm) => sm.userId === m.userId))
						.map((s) => s.name),
				}))
				.sort(
					(a, b) =>
						ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
						a.user.name.localeCompare(b.user.name),
				),
		};
	},
);

/**
 * (Admin) Endre navn, beskrivelse, forsidebilde, farge og om gruppen bruker posisjoner. Admin i
 * hovedgruppen kan også endre undergruppene. Felt som ikke sendes, endres ikke.
 */
export const PATCH = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, groupId);
		const input = await readJson<UpdateGroupInput>(request);

		const data: {
			name?: string;
			description?: string;
			coverUploadId?: string | null;
			color?: string;
			usesPositions?: boolean;
			usesMatchFacts?: boolean;
		} = {};
		if (input.name !== undefined) {
			const name = input.name.trim();
			if (!name) throw new HttpError(400, "Gruppen må ha et navn");
			if (name.length > 60)
				throw new HttpError(400, "Gruppenavnet kan ha maks 60 tegn");
			data.name = name;
		}
		if (input.description !== undefined) {
			if (input.description.length > 1000)
				throw new HttpError(400, "Beskrivelsen kan ha maks 1000 tegn");
			data.description = input.description.trim();
		}
		if (input.coverUploadId !== undefined) {
			if (input.coverUploadId !== null) {
				const upload = await prisma.upload.findUnique({
					where: { id: input.coverUploadId },
				});
				if (
					!upload ||
					upload.uploadedById !== userId ||
					upload.kind !== "image"
				) {
					throw new HttpError(400, "Ugyldig bilde");
				}
			}
			data.coverUploadId = input.coverUploadId;
		}
		if (input.color !== undefined) {
			if (!GROUP_COLORS.includes(input.color))
				throw new HttpError(400, "Ugyldig farge");
			data.color = input.color;
		}
		if (input.usesPositions !== undefined)
			data.usesPositions = Boolean(input.usesPositions);
		if (input.usesMatchFacts !== undefined) {
			await requireMainGroup(groupId);
			data.usesMatchFacts = Boolean(input.usesMatchFacts);
		}

		const { role } = await requireAccess(userId, groupId);
		const group = await prisma.group.update({ where: { id: groupId }, data });
		return toGroup(group, role);
	},
);

/**
 * (Admin) Slett en undergruppe med alt i den (arrangementer, kunngjøringer, avstemninger, chat).
 * Hovedgrupper kan ikke slettes her.
 */
export const DELETE = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, groupId);
		const group = await prisma.group.findUniqueOrThrow({
			where: { id: groupId },
		});
		if (!group.parentId)
			throw new HttpError(400, "Bare undergrupper kan slettes");
		await prisma.$transaction([
			// Varslene beholdes i loggen: de flyttes til hovedgruppen og mister lenken, siden sidene
			// i undergruppen forsvinner.
			prisma.notification.updateMany({
				where: { groupId },
				data: { groupId: group.parentId, href: null },
			}),
			prisma.group.delete({ where: { id: groupId } }),
		]);
		return { ok: true };
	},
);
