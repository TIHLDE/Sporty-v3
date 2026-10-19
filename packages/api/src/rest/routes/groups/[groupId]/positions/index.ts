import {
	HttpError,
	getUserId,
	handler,
	readJson,
	requireAdminOrParent,
} from "../../../../server/http";
import {
	isDuplicateName,
	parsePositionName,
} from "../../../../server/positions";
import { prisma } from "../../../../server/prisma";

/** (Admin) Legg til en posisjon nederst i gruppens posisjonsliste. */
export const POST = handler<{ groupId: string }>(
	async (request, { groupId }) => {
		const userId = await getUserId(request);
		await requireAdminOrParent(userId, groupId);
		const { name } = await readJson<{ name: string }>(request);

		const last = await prisma.groupPosition.findFirst({
			where: { groupId },
			orderBy: { sortOrder: "desc" },
		});
		try {
			const position = await prisma.groupPosition.create({
				data: {
					groupId,
					name: parsePositionName(name),
					sortOrder: (last?.sortOrder ?? -1) + 1,
				},
				select: { id: true, name: true },
			});
			return position;
		} catch (error) {
			if (isDuplicateName(error))
				throw new HttpError(400, "Posisjonen finnes allerede");
			throw error;
		}
	},
);
