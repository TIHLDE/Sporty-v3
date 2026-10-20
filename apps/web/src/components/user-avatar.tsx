import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@sporty/ui/components/avatar";
import { cn } from "@sporty/ui/lib/utils";

export function initials(name: string) {
	return name
		.split(" ")
		.map((part) => part[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

/**
 * Rund avatar med profilbildet fra tihlde.org, eller initialene til personen. Bildet er privat
 * der, så det hentes via serveren, som legger på innloggingen.
 */
export function UserAvatar({
	user,
	className,
}: {
	user: { id?: string; name: string; imageUrl?: string | null };
	className?: string;
}) {
	return (
		<Avatar className={cn("size-9", className)}>
			{user.id && user.imageUrl && (
				<AvatarImage
					src={`/api/users/${encodeURIComponent(user.id)}/image`}
					alt={user.name}
				/>
			)}
			<AvatarFallback>{initials(user.name)}</AvatarFallback>
		</Avatar>
	);
}
