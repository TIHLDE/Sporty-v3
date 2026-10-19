import { GROUP_COLORS } from "../../../lib/group-colors";
import { toGroup } from "../../../server/dto";
import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAdminOrParent,
} from "../../../server/http";
import { prisma } from "../../../server/prisma";
import type { CreateSubgroupInput } from "../../../types";

/**
 * (Admin) Lag en undergruppe, f.eks. et 11'er-lag, med medlemmer fra hovedgruppen. Undergrupper
 * kan ikke ha egne undergrupper.
 */
export const POST = handler<{ groupId: string }>(
	async (request, { groupId: parentId }) => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, parentId);
		const input = await readJson<CreateSubgroupInput>(request);

		const parent = await prisma.group.findUniqueOrThrow({
			where: { id: parentId },
		});
		if (parent.parentId)
			throw new HttpError(400, "Undergrupper kan ikke ha egne undergrupper");

		const name = input.name?.trim() ?? "";
		if (!name) throw new HttpError(400, "Undergruppen må ha et navn");
		if (name.length > 60)
			throw new HttpError(400, "Navnet kan ha maks 60 tegn");
		if (!GROUP_COLORS.includes(input.color))
			throw new HttpError(400, "Ugyldig farge");
		const description = input.description?.trim() ?? "";
		if (description.length > 1000)
			throw new HttpError(400, "Beskrivelsen kan ha maks 1000 tegn");

		const memberIds = [...new Set(input.memberIds ?? [])];
		const parentMembers = await prisma.membership.count({
			where: { groupId: parentId, userId: { in: memberIds } },
		});
		if (parentMembers !== memberIds.length) {
			throw new HttpError(400, "Alle må være medlemmer av hovedgruppen");
		}

		const group = await prisma.group.create({
			data: {
				name,
				description,
				color: input.color,
				usesPositions: Boolean(input.usesPositions),
				parentId,
				memberships: { create: memberIds.map((id) => ({ userId: id })) },
			},
		});
		return toGroup(group, null);
	},
);
