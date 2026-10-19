import { Avatar, AvatarFallback } from "@sporty/ui/components/avatar";
import { cn } from "@sporty/ui/lib/utils";

export function initials(name: string) {
	return name
		.split(" ")
		.map((part) => part[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

/** Rund avatar med initialene til personen. */
export function UserAvatar({
	user,
	className,
}: {
	user: { name: string };
	className?: string;
}) {
	return (
		<Avatar className={cn("size-9", className)}>
			<AvatarFallback>{initials(user.name)}</AvatarFallback>
		</Avatar>
	);
}
