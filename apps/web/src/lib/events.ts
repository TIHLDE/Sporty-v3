import type {
	Event,
	EventType,
	Group,
	GroupDetails,
	Location,
} from "@sporty/api/rest/types";

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
	trening: "Trening",
	kamp: "Kamp",
	sosialt: "Sosialt",
	annet: "Annet",
};

/**
 * Stedet med adresse: «Skansegata 20, 7014 Trondheim», eller «Dragvoll idrettssenter, Loholt allé
 * 81, 7049 Trondheim» når stedet har et eget navn. Eldre arrangementer har bare navnet.
 */
export function locationLabel(location: Location) {
	if (!location.address) return location.name;
	if (location.address.startsWith(location.name)) return location.address;
	return `${location.name}, ${location.address}`;
}

/**
 * Linjen under navnet når man velger sted: adressen uten gatenavnet hvis navnet er gateadressen
 * («Skansegata 20» over «7014 Trondheim»), ellers hele adressen.
 */
export function placeDetail(location: Location) {
	if (!location.address.startsWith(location.name)) return location.address;
	return location.address.slice(location.name.length).replace(/^,\s*/, "");
}

/** Svarfristen (eller starten, uten frist) har gått ut, så man kan ikke lenger svare. */
export function answeringClosed(event: Event, now = new Date()) {
	return new Date(event.signupDeadline ?? event.start) <= now;
}

/** Hvem som kommer, ikke kommer og ikke har svart, blant medlemmene som forventes å svare. */
export function summarize(event: Event) {
	const kommer: string[] = [];
	const kommerIkke: string[] = [];
	const ubesvart: string[] = [];
	for (const id of event.memberIds) {
		const status = event.attendance[id];
		if (status === "kommer") kommer.push(id);
		else if (status === "kommer_ikke") kommerIkke.push(id);
		else ubesvart.push(id);
	}
	return { kommer, kommerIkke, ubesvart };
}

const isManager = (group: Pick<Group, "myRole">) =>
	group.myRole === "admin" || group.myRole === "subadmin";

/**
 * Gruppene man kan lage arrangement for fra gruppesiden. Sub-/admin i hovedgruppen kan lage for
 * hele gruppen og alle undergrupper, ellers bare for undergruppene der man selv er sub-/admin.
 */
export function eventTargets(group: GroupDetails) {
	const subgroups = group.canManage
		? group.subgroups
		: group.subgroups.filter(isManager);
	return [
		...(group.canManage
			? [
					{
						id: group.id,
						label: group.parentId ? group.name : `Alle i ${group.name}`,
					},
				]
			: []),
		...subgroups.map((s) => ({ id: s.id, label: s.name })),
	];
}
