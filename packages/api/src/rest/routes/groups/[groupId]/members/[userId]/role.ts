import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAdminOrParent,
} from "../../../../../server/http";
import { prisma } from "../../../../../server/prisma";
import type { Role } from "../../../../../types";

const ROLES: Role[] = ["admin", "subadmin", "member"];

/**
 * (Admin) Endre rollen til et medlem. Subadmin kan se roller, men ikke endre dem.
 * Gruppen må alltid ha minst én admin.
 */
export const PUT = handler<{ groupId: string; userId: string }>(
	async (request, { groupId, userId: memberId }) => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, groupId);
		const { role } = await readJson<{ role: Role }>(request);
		if (!ROLES.includes(role)) throw new HttpError(400, "Ugyldig rolle");

		const membership = await prisma.membership.findUnique({
			where: { userId_groupId: { userId: memberId, groupId } },
		});
		if (!membership)
			throw new HttpError(404, "Brukeren er ikke medlem av gruppen");

		if (membership.role === "admin" && role !== "admin") {
			const admins = await prisma.membership.count({
				where: { groupId, role: "admin" },
			});
			if (admins <= 1) throw new HttpError(400, "Gruppen må ha minst én admin");
		}

		await prisma.membership.update({
			where: { userId_groupId: { userId: memberId, groupId } },
			data: { role },
		});
		return { role };
	},
);
