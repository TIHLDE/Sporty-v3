// Formen på dataene API-et sender til appen (DTO-er). Datamodellen i databasen ligger i
// prisma/schema.prisma. Datoer er ISO-strenger, slik de kommer over nettverket.

/**
 * `index` har full admin-tilgang (for Index, som drifter Sporty), men vises ikke som eget merke.
 * `botsjef` er et vanlig medlem som i tillegg kan gi fellesbot (settes i hovedgruppen).
 */
export type Role = "admin" | "index" | "subadmin" | "botsjef" | "member";

/** En posisjon i en gruppe, f.eks. Keeper eller Kant. Hver gruppe har sin egen liste. */
export interface GroupPosition {
	id: string;
	name: string;
}

export type Answer = "kommer" | "kommer_ikke";
export type AttendanceStatus = Answer | "ubesvart";

export interface User {
	id: string;
	name: string;
	/** Null for medlemmer hentet fra en medlemsliste på tihlde.org som ikke har logget inn ennå. */
	email: string | null;
	/**
	 * Profilbildet fra tihlde.org (full lenke), eller null. Bilder lastet opp der er private og må
	 * hentes med innloggingen (Bearer-tokenet).
	 */
	imageUrl: string | null;
}

/** At et medlem er satt som inaktivt i en gruppe, og hvorfor. */
export interface Inactivity {
	since: string;
	/** Begrunnelsen. Bare med for sub-/admin og medlemmet selv, ellers null. */
	reason: string | null;
}

/** Den innloggede brukeren, med gruppene der hen er satt som inaktiv. */
export interface Me extends User {
	inactiveIn: (Inactivity & {
		groupId: string;
		groupName: string;
		reason: string;
	})[];
}

/** Hvilke push-varsler og påminnelser brukeren vil ha. Lagres på brukeren i databasen. */
export interface NotificationSettings {
	/** Hovedbryteren. Når den er av, sendes ingen varsler uansett de andre valgene. */
	pushEnabled: boolean;
	pushFines: boolean;
	pushEventReminders: boolean;
	pushSignupReminders: boolean;
	/** Nye meldinger i gruppechatter og direktemeldinger. */
	pushMessages: boolean;
}

export interface Group {
	id: string;
	name: string;
	/** Hex-farge som brukes til logo og banner. */
	color: string;
	description: string;
	parentId: string | null;
	/** Om medlemmene har posisjoner. Listen lager admin selv (GroupDetails.positions). */
	usesPositions: boolean;
	/** Relativ URL til forsidebildet, eller null (da brukes gruppefargen). */
	coverUrl: string | null;
	/** Logoen fra tihlde.org (full lenke), eller null. Vises som gruppebilde. */
	logoUrl: string | null;
	/** Den innloggede brukerens rolle i gruppen. */
	myRole: Role | null;
}

export interface Member {
	user: User;
	role: Role;
	/** Bare satt i grupper med usesPositions. */
	position: GroupPosition | null;
	/** Satt hvis sub-/admin har gjort medlemmet inaktivt i gruppen. */
	inactive: Inactivity | null;
	/** Undergruppene medlemmet er med i, f.eks. ["Herrer 11'er"]. Tom i undergrupper. */
	subgroupNames: string[];
	/** Id-ene til de samme undergruppene, til redigering. */
	subgroupIds: string[];
}

export interface GroupDetails extends Group {
	subgroups: Group[];
	members: Member[];
	/** Gruppens posisjoner i rekkefølge. Vises bare når usesPositions er på. */
	positions: GroupPosition[];
	/** Sub-/admin i gruppen, eller i hovedgruppen hvis det er en undergruppe. */
	canManage: boolean;
	/** Admin i gruppen, eller i hovedgruppen hvis det er en undergruppe. */
	canAdmin: boolean;
	/** Bøtene til (hoved)gruppen. */
	fines: GroupFinesInfo;
	/** Kampfakta for laget. Styres av hovedgruppen og gjelder også undergruppene. */
	matchFacts: GroupMatchFacts;
}

export interface GroupMatchFacts {
	/** Om kampfakta vises på kampene til laget. */
	enabled: boolean;
	/** Hendelsestypene admin har laget, i rekkefølge. */
	types: MatchStatType[];
	/** Id-en til hovedgruppen, der bryteren og typene endres. */
	groupId: string;
}

/** En type hendelse i kampfakta, f.eks. Mål eller Gult kort. */
export interface MatchStatType {
	id: string;
	name: string;
}

/** Én hendelse i en kamp: hvem som scoret, fikk kort osv. */
export interface MatchStat {
	id: string;
	type: MatchStatType;
	user: User;
}

/** Kampfakta for én kamp: resultatet står på arrangementet, hendelsene her. */
export interface MatchFacts {
	/** Av når admin har skrudd av kampfakta for laget. Da vises verken resultat eller hendelser. */
	enabled: boolean;
	types: MatchStatType[];
	/** I rekkefølgen de ble registrert. */
	stats: MatchStat[];
	/** Sub-/admin kan registrere og fjerne hendelser. */
	canEdit: boolean;
}

export interface GroupFinesInfo {
	/** tihlde.org for lag derfra (da er tihlde.org kilden), ellers Sporty sitt eget botsystem. */
	source: "tihlde" | "sporty";
	/** For lag fra tihlde.org: om bøter er slått på der. Alltid true for Sporty-grupper. */
	activated: boolean;
	/** Kan gi bøter: alle medlemmer på tihlde.org, sub-/admin i Sporty-grupper. */
	canGive: boolean;
	/** Kan godkjenne, markere som betalt og avvise (botsjef og leder på tihlde.org). */
	canSettle: boolean;
	/** Kan bruke snitches (gi massebot til alle som ikke har snitchet): botsjef og sub-/admin. */
	canSnitch: boolean;
}

export interface Location {
	name: string;
	/** Gateadresse med postnummer og sted, f.eks. «Skansegata 20, 7014 Trondheim», eller "". */
	address: string;
	latitude: number;
	longitude: number;
}

export type EventType = "trening" | "kamp" | "sosialt" | "annet";

export interface Event {
	id: string;
	groupId: string;
	groupName: string;
	/** Gruppens farge og logo, så man ser hvilken gruppe arrangementet hører til. */
	groupColor: string;
	groupLogoUrl: string | null;
	title: string;
	type: EventType;
	/** Laget man spiller mot. Bare for kamper. */
	opponent: string | null;
	/** Notat med ekstra informasjon. */
	description: string;
	location: Location;
	start: string;
	end: string | null;
	/** Etter fristen kan man ikke lenger svare. */
	signupDeadline: string | null;
	/** Maks antall som kan svare «kommer». Null betyr ingen grense. */
	maxAttendees: number | null;
	/** Resultat for kamper (egne mål og motstanderens), eller null hvis ikke registrert. */
	ourScore: number | null;
	theirScore: number | null;
	/** Svar per bruker. Medlemmer som mangler her har ikke svart. */
	attendance: Record<string, Answer>;
	/** Begrunnelsen til hver som har svart «kommer ikke». Synlig for alle som ser arrangementet. */
	absenceReasons: Record<string, string>;
	/** Når hver person sist åpnet arrangementet (ISO-tid). Bare med for sub-/admin, ellers tom. */
	seenAt: Record<string, string>;
	/** Alle medlemmer i gruppen, for å regne ut hvem som ikke har svart. */
	memberIds: string[];
	/** Om den innloggede brukeren kan redigere og slette (sub-/admin her eller i hovedgruppen). */
	canManage: boolean;
	/** Om den innloggede brukeren kan gi fellesbot (sub-/admin i hovedgruppen). */
	canGiveFines: boolean;
	/** Fellesbot er allerede gitt for arrangementet (kan bare gis én gang). */
	collectiveFineGiven: boolean;
}

export interface UploadedFile {
	id: string;
	kind: "image" | "video" | "file";
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	/** Relativ API-sti, gjøres om til full URL med `fileUrl()` i appen. */
	url: string;
}

export interface Announcement {
	id: string;
	groupId: string;
	groupName: string;
	groupColor: string;
	authorName: string;
	title: string;
	body: string;
	createdAt: string;
	allowComments: boolean;
	commentCount: number;
	/** Bilder og video. */
	media: UploadedFile[];
	/** Andre vedlegg (PDF, dokumenter osv.). */
	attachments: UploadedFile[];
}

export interface Comment {
	id: string;
	author: User;
	body: string;
	createdAt: string;
}

export interface AnnouncementDetails extends Announcement {
	comments: Comment[];
}

export interface PollOption {
	id: string;
	label: string;
	/** null når resultatet er skjult for den innloggede brukeren. */
	voteCount: number | null;
}

export interface Poll {
	id: string;
	groupId: string;
	question: string;
	description: string;
	createdByName: string | null;
	createdAt: string;
	closesAt: string;
	closed: boolean;
	allowMultiple: boolean;
	hideVotes: boolean;
	allowComments: boolean;
	commentCount: number;
	options: PollOption[];
	/** Alternativene den innloggede brukeren har stemt på. */
	myOptionIds: string[];
	/** Hvor mange som har stemt. null når resultatet er skjult. */
	voterCount: number | null;
	/** Skjulte stemmer vises for sub-/admin, og for alle etter fristen. */
	resultsVisible: boolean;
}

export interface PollDetails extends Poll {
	comments: Comment[];
}

/** En paragraf i gruppens botregler, f.eks. "§1.00 Oppmøte". */
export interface Law {
	id: string;
	groupId: string;
	paragraph: string;
	title: string;
	description: string;
	/** Foreslått antall bøter for paragrafen (fra lovverket på tihlde.org), eller null. */
	defaultCount: number | null;
}

/**
 * Status på en bot. Bøter fra tihlde.org går venter → godkjent → betalt (eller avvist). Sporty sine
 * egne bøter er enten godkjent eller betalt.
 */
export type FineStatus = "pending" | "approved" | "paid" | "rejected";

export interface Fine {
	id: string;
	groupId: string;
	/** Hvor boten ligger: tihlde.org for lag derfra, ellers Sporty. */
	source: "tihlde" | "sporty";
	status: FineStatus;
	/** Null for bøter fra tihlde.org som er gitt uten paragraf. */
	law: Pick<Law, "paragraph" | "title"> | null;
	user: User;
	givenByName: string;
	reason: string;
	/** Antall bøter. Bøter telles, de har ikke et kronebeløp. */
	count: number;
	/**
	 * Bildet til boten. For tihlde.org er det privat og må hentes med innloggingen
	 * (Authorization-header). For Sporty er det foreløpig bare en lokal fil på giverens telefon.
	 */
	imageUrl: string | null;
	/** Forsvaret til den som fikk boten (tihlde.org), eller null. */
	defense: string | null;
	paid: boolean;
	/** Fellesbot gitt til alle som ikke svarte på et arrangement. */
	collective: boolean;
	createdAt: string;
}

/** Én side med bøter i en gruppe, nyeste først. */
export interface FinesPage {
	fines: Fine[];
	/** Neste side, eller null når alt er hentet. */
	nextPage: number | null;
	/** Ubetalte bøter (venter + godkjent) i hele gruppen, eller mine i Sporty-grupper for medlemmer. */
	unpaidCount: number;
}

/**
 * Betalingsoppfordring som sub-/admin poster. Selve betalingen skjer utenfor appen (Vipps e.l.),
 * medlemmene markerer bare selv at de har betalt.
 */
export interface PaymentRequest {
	id: string;
	groupId: string;
	createdByName: string;
	title: string;
	description: string;
	amount: number;
	vippsNumber: string;
	dueDate: string;
	createdAt: string;
	/** Brukerens egen status. `rejected` betyr at sub/admin avviste forrige «Jeg har betalt». */
	myStatus: PaymentStatus | "unpaid";
	/** Godkjent av sub/admin. Det er bare disse som teller som betalt. */
	approvedCount: number;
	pendingCount: number;
	memberCount: number;
	canManage: boolean;
	/** Alle som har trykket «Jeg har betalt». Bare for sub/admin, ellers null. */
	confirmations: PaymentConfirmation[] | null;
}

export type PaymentStatus = "pending" | "approved" | "rejected";

export interface PaymentConfirmation {
	user: User;
	status: PaymentStatus;
	createdAt: string;
}

export interface GroupFile {
	id: string;
	groupId: string;
	name: string;
	kind: "pdf" | "image" | "document";
	sizeKb: number;
	uploadedAt: string;
}

export type NotificationType =
	| "event"
	| "attendance"
	| "fine"
	| "announcement"
	| "poll"
	| "payment";

export interface Notification {
	id: string;
	groupId: string | null;
	type: NotificationType;
	text: string;
	createdAt: string;
	read: boolean;
	href: string | null;
}

export interface Conversation {
	id: string;
	title: string;
	group: Pick<Group, "id" | "name" | "color"> | null;
	/** Den andre personen i en samtale mellom to. */
	otherUser: User | null;
	lastMessage: {
		senderId: string;
		senderName: string;
		body: string;
		sentAt: string;
	} | null;
	unread: number;
}

export interface Message {
	id: string;
	conversationId: string;
	sender: User;
	/** Tom hvis meldingen er slettet. */
	body: string;
	sentAt: string;
	deleted: boolean;
	/** Teksten er endret etter at meldingen ble sendt. */
	edited: boolean;
	/** Meldingen dette er et svar på. */
	replyTo: MessageQuote | null;
	/** Én per emoji, i rekkefølgen de først ble brukt. */
	reactions: MessageReaction[];
}

export interface MessageReaction {
	emoji: string;
	count: number;
	/** Brukeren selv har reagert med denne. */
	mine: boolean;
	/** Alle som har reagert med denne, i rekkefølgen de reagerte. */
	users: User[];
}

/** Den korte versjonen av en melding som vises over et svar. */
export interface MessageQuote {
	id: string;
	senderName: string;
	body: string;
	deleted: boolean;
}

/** Én side med meldinger, nyeste først. `nextCursor` henter eldre meldinger. */
export interface MessagePage {
	messages: Message[];
	nextCursor: string | null;
	/** Tidspunktet alle de andre i samtalen har lest frem til. Null hvis noen ikke har lest den. */
	readAt: string | null;
}

export interface ConversationDetails {
	id: string;
	title: string;
	group: Pick<Group, "id" | "name" | "color"> | null;
	otherUser: User | null;
	memberCount: number;
}

export interface UnreadCounts {
	notifications: number;
	messages: number;
}

// Forespørsler (request bodies)

export interface GiveFinesInput {
	/** Unik per utfylte skjema, så samme innsending ikke gir bøtene to ganger. */
	requestId: string;
	groupId: string;
	lawId: string;
	userIds: string[];
	count: number;
	reason: string;
	/** Bilde lastet opp med POST /uploads først. Vises på boten, også på tihlde.org. */
	imageUploadId?: string | null;
}

export interface Place extends Location {
	id: string | null;
}

export interface CreateEventInput {
	title: string;
	type: EventType;
	opponent: string | null;
	start: string;
	end: string | null;
	location: Location;
	description: string;
	signupDeadline: string | null;
	/** Null fjerner grensen. Mangler feltet (eldre apper), beholdes den som er satt. */
	maxAttendees?: number | null;
}

export interface CreateAnnouncementInput {
	title: string;
	body: string;
	allowComments: boolean;
	/** Opplastinger fra POST /api/uploads, i den rekkefølgen de skal vises. */
	uploadIds: string[];
}

export interface CreatePollInput {
	question: string;
	description: string;
	options: string[];
	allowMultiple: boolean;
	hideVotes: boolean;
	allowComments: boolean;
	closesAt: string;
}

export interface UpdateGroupInput {
	name?: string;
	description?: string;
	/** Id fra POST /api/uploads, eller null for å fjerne forsidebildet. */
	coverUploadId?: string | null;
	/** Hex-farge, en av GROUP_COLORS. */
	color?: string;
	usesPositions?: boolean;
	/** Bare på hovedgrupper: kampfakta gjelder hele laget. */
	usesMatchFacts?: boolean;
}

export interface CreateSubgroupInput {
	name: string;
	color: string;
	description?: string;
	usesPositions: boolean;
	/** Medlemmer av hovedgruppen som skal være med i undergruppen. */
	memberIds: string[];
}

export interface CreatePaymentInput {
	title: string;
	description: string;
	amount: number;
	vippsNumber: string;
	dueDate: string;
}

// Statistikk (GET /groups/:groupId/stats?period=…)

/** Et semester («2026-H» høst, «2026-V» vår) eller «all» for alle år. */
export interface StatsPeriod {
	id: string;
	label: string;
}

/** Del av en helhet, f.eks. 18 av 22 treninger. */
export interface StatsCount {
	count: number;
	total: number;
}

export interface StatsPerson {
	user: User;
	value: number;
	/** F.eks. antall treninger i perioden, når verdien er «av» noe. */
	total: number | null;
}

export interface GroupStats {
	period: StatsPeriod;
	/** Nyeste først, «Alle år» sist. */
	periods: StatsPeriod[];
	/** Null hvis brukeren ikke er medlem av gruppen (f.eks. admin i hovedgruppen). */
	me: MyStats | null;
	team: TeamStats;
	/** Bare for sub-/admin. */
	admin: AdminStats | null;
}

/**
 * Oppmøte er påmelding: svart «kommer» på arrangementer som har vært. Det regnes ut fra dagens
 * medlemmer og deres siste svar.
 */
export interface MyStats {
	attendance: StatsCount;
	trainings: StatsCount;
	matches: StatsCount;
	goals: number;
	/** Bøter gitt i Sporty i perioden (ikke bøter som bare finnes på tihlde.org). */
	fines: number;
	absences: StatsCount & { withReason: number };
	/** «2026-09» … i rekkefølge. */
	monthly: (StatsCount & { month: string })[];
	/** Plass i oppmøte blant medlemmene (1 = flest). Null hvis ingen arrangementer. */
	rank: number | null;
	/** Ukedagen (0 = mandag) man har vært på flest arrangementer. */
	favoriteWeekday: (StatsCount & { weekday: number }) | null;
}

export interface TeamStats {
	/** Andel «kommer» av alle som var ventet. Null uten arrangementer. */
	attendanceRate: number | null;
	/** Samme for semesteret før, til sammenligning. Null for «Alle år». */
	previousAttendanceRate: number | null;
	events: {
		total: number;
		trening: number;
		kamp: number;
		sosialt: number;
		annet: number;
	};
	matches: {
		wins: number;
		draws: number;
		losses: number;
		goalsFor: number;
		goalsAgainst: number;
		/** Siste fem kamper med resultat, eldste først. S = seier, U = uavgjort, T = tap. */
		form: MatchResult[];
		/** Alle kampene med resultat, nyeste først. */
		games: StatsMatch[];
		/** Resultatene samlet per motstander, flest kamper først. */
		opponents: StatsOpponent[];
	};
	/** Alle som har scoret i perioden, flest mål først. Kortet viser de tre første. */
	scorers: StatsPerson[];
	/** Alle aktive medlemmer etter antall treninger, også de med null. */
	trainings: StatsPerson[];
	/** Ukedag (0 = mandag) og klokkeslett med best oppmøte, minst to arrangementer. */
	bestSlot: { weekday: number; hour: number; rate: number } | null;
}

export type MatchResult = "S" | "U" | "T";

export interface StatsMatch {
	eventId: string;
	title: string;
	opponent: string | null;
	start: string;
	ourScore: number;
	theirScore: number;
	result: MatchResult;
}

export interface StatsOpponent {
	/** Motstanderen slik den er skrevet på kampen, eller «Ukjent motstander». */
	name: string;
	wins: number;
	draws: number;
	losses: number;
	goalsFor: number;
	goalsAgainst: number;
}

export interface AdminStats {
	/** Andel av de ventede som ikke svarte før arrangementet stengte. */
	unansweredRate: number | null;
	/** Arrangementer der fellesbot ble gitt, og hvor mange bøter det ble. */
	collectiveFines: { events: number; fines: number };
	leastResponsive: StatsPerson[];
	payments: {
		/** Andel godkjente betalinger der «Jeg har betalt» kom før fristen. */
		onTimeRate: number | null;
		/** Snitt tid fra «Jeg har betalt» til godkjent. */
		avgApprovalHours: number | null;
		open: {
			id: string;
			title: string;
			approved: number;
			pending: number;
			memberCount: number;
		}[];
	};
}
