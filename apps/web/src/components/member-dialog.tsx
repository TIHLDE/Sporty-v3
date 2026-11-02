import type { GroupDetails, Member, Role } from "@sporty/api/rest/types";
import { Button } from "@sporty/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@sporty/ui/components/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@sporty/ui/components/select";
import { Textarea } from "@sporty/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { CheckboxField } from "@/components/checkbox-field";
import { useTRPC } from "@/utils/trpc";

const ROLE_LABEL: Record<Role, string> = {
	admin: "Admin",
	subadmin: "Subadmin",
	botsjef: "Botsjef",
	member: "Medlem",
	index: "Index",
};
const NO_POSITION = "__none__";

/**
 * (Sub-/admin) Alt om ett medlem på ett sted: rolle, posisjon, undergrupper og status. Endringer
 * lagres med en gang. Rolle og undergrupper er for admin, posisjon og status for sub-/admin, som
 * på serveren.
 */
export function MemberDialog({
	group,
	member,
	onClose,
}: {
	group: GroupDetails;
	member: Member;
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const options = {
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: trpc.groups.pathKey() }),
		onError: (error: { message: string }) => toast.error(error.message),
	};
	const setRole = useMutation(trpc.groupAdmin.setRole.mutationOptions(options));
	const setPosition = useMutation(
		trpc.groupAdmin.setPosition.mutationOptions(options),
	);
	const setSubgroups = useMutation(
		trpc.groupAdmin.setSubgroups.mutationOptions(options),
	);
	const setInactive = useMutation(
		trpc.groupAdmin.setInactive.mutationOptions(options),
	);
	const [reason, setReason] = useState(member.inactive?.reason ?? "");
	const isMainGroup = group.parentId === null;
	const ids = { groupId: group.id, userId: member.user.id };

	const toggleSubgroup = (subgroupId: string, name: string, on: boolean) => {
		if (
			!on &&
			!window.confirm(
				`Ta ${member.user.name} ut av ${name}? Medlemmet fjernes fra alt i undergruppen.`,
			)
		)
			return;
		setSubgroups.mutate({
			...ids,
			subgroupIds: on
				? [...member.subgroupIds, subgroupId]
				: member.subgroupIds.filter((id) => id !== subgroupId),
		});
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[85svh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{member.user.name}</DialogTitle>
					{member.user.email && (
						<DialogDescription>{member.user.email}</DialogDescription>
					)}
				</DialogHeader>

				<Field label="Rolle">
					{group.canAdmin ? (
						<Select
							value={member.role}
							onValueChange={(role) =>
								role &&
								role !== member.role &&
								setRole.mutate({ ...ids, role: role as Role })
							}
						>
							<SelectTrigger aria-label="Rolle" className="w-48">
								<SelectValue>{ROLE_LABEL[member.role]}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{(Object.keys(ROLE_LABEL) as Role[])
									// Botsjef gir fellesbot, og bøtene hører til hovedgruppen.
									.filter((role) => role !== "botsjef" || isMainGroup)
									.map((role) => (
										<SelectItem key={role} value={role}>
											{ROLE_LABEL[role]}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					) : (
						<p className="text-sm">
							{ROLE_LABEL[member.role]}{" "}
							<span className="text-muted-foreground">
								· bare admin kan endre roller
							</span>
						</p>
					)}
				</Field>

				{group.usesPositions && group.positions.length > 0 && (
					<Field label="Posisjon">
						<Select
							value={member.position?.id ?? NO_POSITION}
							onValueChange={(value) =>
								value &&
								setPosition.mutate({
									...ids,
									positionId: value === NO_POSITION ? null : value,
								})
							}
						>
							<SelectTrigger aria-label="Posisjon" className="w-48">
								<SelectValue>{member.position?.name ?? "Ingen"}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_POSITION}>Ingen</SelectItem>
								{group.positions.map((position) => (
									<SelectItem key={position.id} value={position.id}>
										{position.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}

				{group.canAdmin && isMainGroup && group.subgroups.length > 0 && (
					<Field label="Undergrupper">
						<div className="grid gap-2">
							{group.subgroups.map((subgroup) => (
								<CheckboxField
									key={subgroup.id}
									checked={member.subgroupIds.includes(subgroup.id)}
									disabled={setSubgroups.isPending}
									onCheckedChange={(on) =>
										toggleSubgroup(subgroup.id, subgroup.name, on)
									}
								>
									{subgroup.name}
								</CheckboxField>
							))}
						</div>
					</Field>
				)}

				<Field label="Status">
					{member.inactive ? (
						<div className="grid gap-2">
							<p className="text-sm">
								Inaktiv
								{member.inactive.reason && (
									<span className="text-muted-foreground">
										: {member.inactive.reason}
									</span>
								)}
							</p>
							<Button
								variant="outline"
								size="sm"
								className="justify-self-start"
								disabled={setInactive.isPending}
								onClick={() => setInactive.mutate({ ...ids, reason: null })}
							>
								Gjør aktiv
							</Button>
						</div>
					) : (
						<div className="grid gap-2">
							<Textarea
								aria-label="Begrunnelse for inaktiv"
								rows={2}
								maxLength={500}
								placeholder="Begrunnelse, f.eks. skadet ut sesongen"
								value={reason}
								onChange={(e) => setReason(e.target.value)}
							/>
							<Button
								variant="outline"
								size="sm"
								className="justify-self-start"
								disabled={!reason.trim() || setInactive.isPending}
								onClick={() =>
									setInactive.mutate({ ...ids, reason: reason.trim() })
								}
							>
								Gjør inaktiv
							</Button>
						</div>
					)}
				</Field>
			</DialogContent>
		</Dialog>
	);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<section className="grid gap-2">
			<h3 className="text-xs font-medium text-muted-foreground uppercase">
				{label}
			</h3>
			{children}
		</section>
	);
}
