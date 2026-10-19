// Eksempeldata som `bun run db:seed` skriver inn i databasen (flyttet fra Sporty Native).
// Brukerne her er Person-rader uten innlogging, til testing med «Bytt bruker» i appen.
// Datoer regnes ut fra tidspunktet seed kjøres, så kjør `bun run db:reset` for å få ferske datoer.

// Datohjelpere (samme som i appen), her så databasepakken ikke trenger API-pakken.
/** Lager en ISO-dato relativt til i dag, slik at eksempeldataene alltid ligger rundt "nå". */
function daysFromNow(days: number, hour = 18, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

type Role = "admin" | "subadmin" | "member";
type Answer = "kommer" | "kommer_ikke";

interface User {
  id: string;
  name: string;
  email: string;
}
interface GroupPosition {
  id: string;
  groupId: string;
  name: string;
  sortOrder: number;
}
interface Group {
  id: string;
  name: string;
  color: string;
  description: string;
  parentId: string | null;
  usesPositions?: boolean;
}
interface Membership {
  userId: string;
  groupId: string;
  role: Role;
  positionId?: string;
}
interface Law {
  id: string;
  groupId: string;
  paragraph: string;
  title: string;
  description: string;
}
interface Location {
  name: string;
  latitude: number;
  longitude: number;
}
interface Event {
  id: string;
  groupId: string;
  title: string;
  description: string;
  location: Location;
  start: string;
  end: string;
  attendance: Record<string, Answer>;
}
interface Announcement {
  id: string;
  groupId: string;
  authorId: string;
  title: string;
  body: string;
  createdAt: string;
}
interface Poll {
  id: string;
  groupId: string;
  question: string;
  closesAt: string;
  options: { id: string; label: string; voterIds: string[] }[];
}
interface Fine {
  id: string;
  groupId: string;
  lawId: string;
  userId: string;
  givenById: string;
  reason: string;
  imageUri: string | null;
  count: number;
  createdAt: string;
  paid: boolean;
  collective: boolean;
  eventId: string | null;
}
interface PaymentRequest {
  id: string;
  groupId: string;
  createdById: string;
  title: string;
  description: string;
  amount: number;
  vippsNumber: string;
  dueDate: string;
  createdAt: string;
  paidUserIds: string[];
}
interface GroupFile {
  id: string;
  groupId: string;
  name: string;
  kind: "pdf" | "image" | "document";
  sizeKb: number;
  uploadedAt: string;
}
interface Notification {
  id: string;
  groupId: string | null;
  type: "event" | "attendance" | "fine" | "announcement" | "poll" | "payment";
  text: string;
  createdAt: string;
  read: boolean;
  href: string | null;
}
interface Conversation {
  id: string;
  title: string;
  groupId: string | null;
  memberIds: string[];
  unread: number;
  messages: { id: string; senderId: string; body: string; sentAt: string }[];
}

/** Brukeren appen logger inn som i utvikling. */
export const DEFAULT_USER_ID = "u1";

export const users: User[] = [
  { id: "u1", name: "Ola Nordmann", email: "ola@tihlde.org" },
  { id: "u2", name: "Kari Hansen", email: "kari@tihlde.org" },
  { id: "u3", name: "Jonas Berg", email: "jonas@tihlde.org" },
  { id: "u4", name: "Emma Johansen", email: "emma@tihlde.org" },
  { id: "u5", name: "Sander Lie", email: "sander@tihlde.org" },
  { id: "u6", name: "Ingrid Dahl", email: "ingrid@tihlde.org" },
  { id: "u7", name: "Henrik Moen", email: "henrik@tihlde.org" },
  { id: "u8", name: "Nora Bakken", email: "nora@tihlde.org" },
  { id: "u9", name: "Mathias Strand", email: "mathias@tihlde.org" },
  { id: "u10", name: "Sofie Lund", email: "sofie@tihlde.org" },
  { id: "u11", name: "Elias Haugen", email: "elias@tihlde.org" },
  { id: "u12", name: "Thea Solberg", email: "thea@tihlde.org" },
];

export const groups: Group[] = [
  {
    id: "herrer",
    name: "Pythons Herrer",
    color: "#5B2D90",
    description:
      "Fotballaget til TIHLDE Pythons, herrer. Trening tirsdager og torsdager.",
    parentId: null,
  },
  {
    id: "herrer-11",
    name: "Herrer 11'er",
    color: "#6D3BAA",
    description: "11er-laget i seriespill.",
    parentId: "herrer",
    usesPositions: true,
  },
  {
    id: "herrer-7",
    name: "Herrer 7'er",
    color: "#8352C4",
    description: "7er-laget i seriespill.",
    parentId: "herrer",
  },
  {
    id: "damer",
    name: "Pythons Damer",
    color: "#9D3F8F",
    description: "Fotballaget til TIHLDE Pythons, damer.",
    parentId: null,
  },
  {
    id: "handball",
    name: "Pythons Håndball",
    color: "#2E5AAC",
    description:
      "Håndball for alle nivåer. Trening onsdager i Dragvoll-hallen.",
    parentId: null,
  },
  {
    id: "volley",
    name: "Pythons Volley",
    color: "#C2410C",
    description: "Volleyball, inne om vinteren og sand om våren.",
    parentId: null,
  },
];

// 11'er har fotballposisjoner. Andre grupper kan få sine egne i appen.
export const positions: GroupPosition[] = [
  "Keeper",
  "Back",
  "Midtstopper",
  "Midtbane",
  "Ving",
  "Spiss",
].map((name, sortOrder) => ({
  id: `herrer-11-${name.toLowerCase()}`,
  groupId: "herrer-11",
  name,
  sortOrder,
}));

const member = (userId: string, groupId: string): Membership => ({
  userId,
  groupId,
  role: "member",
});

export const memberships: Membership[] = [
  { userId: "u1", groupId: "herrer", role: "admin" },
  { userId: "u3", groupId: "herrer", role: "subadmin" },
  ...["u5", "u7", "u9", "u11"].map((id) => member(id, "herrer")),

  // 11'er har posisjoner.
  { userId: "u1", groupId: "herrer-11", role: "admin", positionId: "herrer-11-midtbane" },
  { userId: "u3", groupId: "herrer-11", role: "member", positionId: "herrer-11-midtstopper" },
  { userId: "u5", groupId: "herrer-11", role: "member", positionId: "herrer-11-spiss" },
  { userId: "u7", groupId: "herrer-11", role: "member", positionId: "herrer-11-keeper" },
  { userId: "u9", groupId: "herrer-7", role: "admin" },
  member("u11", "herrer-7"),

  { userId: "u2", groupId: "damer", role: "admin" },
  ...["u1", "u4", "u6", "u8", "u10", "u12"].map((id) => member(id, "damer")),

  { userId: "u4", groupId: "handball", role: "admin" },
  { userId: "u1", groupId: "handball", role: "subadmin" },
  ...["u2", "u6", "u7", "u10"].map((id) => member(id, "handball")),

  { userId: "u6", groupId: "volley", role: "admin" },
  ...["u1", "u3", "u8", "u12"].map((id) => member(id, "volley")),
];

const LAW_TEMPLATES: Omit<Law, "id" | "groupId">[] = [
  {
    paragraph: "1.00",
    title: "Oppmøte",
    description: "Kom for sent eller møtte ikke opp uten å gi beskjed.",
  },
  {
    paragraph: "1.01",
    title: "Svarfrist",
    description: "Svarte ikke på arrangement innen fristen.",
  },
  {
    paragraph: "2.00",
    title: "Utstyr",
    description: "Glemte utstyr, f.eks. leggskinn eller sko.",
  },
  {
    paragraph: "2.01",
    title: "Drakt",
    description: "Stilte ikke i riktig drakt på kamp.",
  },
  {
    paragraph: "3.00",
    title: "Oppførsel",
    description: "Dårlig oppførsel mot lagkamerater, dommer eller motstandere.",
  },
  {
    paragraph: "3.01",
    title: "Mobil",
    description: "Brukte mobilen under trening.",
  },
  {
    paragraph: "4.00",
    title: "Sosialt",
    description: "Brudd på regler under sosiale arrangementer.",
  },
  {
    paragraph: "9.00",
    title: "Annet",
    description: "Alt annet styret mener fortjener en bot.",
  },
];

/** Hver hovedgruppe har sine egne botregler. Undergrupper bruker reglene til hovedgruppen. */
export const laws: Law[] = groups
  .filter((group) => group.parentId === null)
  .flatMap((group) =>
    LAW_TEMPLATES.map((law) => ({
      ...law,
      id: `${group.id}-${law.paragraph}`,
      groupId: group.id,
    })),
  );

// Omtrentlige koordinater i Trondheim.
const PLACES = {
  dragvollKunstgress: {
    name: "Dragvoll kunstgress",
    latitude: 63.4077,
    longitude: 10.4719,
  },
  dragvollHallen: {
    name: "Dragvoll-hallen",
    latitude: 63.4069,
    longitude: 10.4697,
  },
  dragvollA4: {
    name: "Dragvoll, rom A4-112",
    latitude: 63.4088,
    longitude: 10.4706,
  },
  oyaStadion: { name: "Øya stadion", latitude: 63.4227, longitude: 10.3938 },
  idrettsbygget: {
    name: "Idrettsbygget Gløshaugen",
    latitude: 63.4146,
    longitude: 10.4058,
  },
  tihldeKontoret: {
    name: "TIHLDE-kontoret, Gløshaugen",
    latitude: 63.4178,
    longitude: 10.4036,
  },
  lerkendal: {
    name: "Lerkendal stadion",
    latitude: 63.4128,
    longitude: 10.4045,
  },
  leangen: {
    name: "Leangen idrettsanlegg",
    latitude: 63.4337,
    longitude: 10.4737,
  },
  moholt: { name: "Moholt studentby", latitude: 63.4115, longitude: 10.4335 },
  samfundet: {
    name: "Studentersamfundet",
    latitude: 63.4222,
    longitude: 10.395,
  },
} satisfies Record<string, Location>;

/** Felles stedsforslag når man lager arrangementer. Grupper får i tillegg sine egne nylig brukte steder. */
export const places: Location[] = Object.values(PLACES);

/** Ingen arrangementer i eksempeldataene: de lages i appen av sub-/admin. */
export const events: Event[] = [];

export const announcements: Announcement[] = [
  {
    id: "a1",
    groupId: "herrer",
    authorId: "u1",
    title: "Nye drakter er kommet",
    body: "Draktene kan hentes på kontoret etter trening torsdag. Betalingen ligger under Betalinger.",
    createdAt: hoursFromNow(-5),
  },
  {
    id: "a2",
    groupId: "handball",
    authorId: "u4",
    title: "Ny treningstid",
    body: "Fra neste uke flyttes onsdagstreningen til 19:00.",
    createdAt: hoursFromNow(-30),
  },
  {
    id: "a3",
    groupId: "damer",
    authorId: "u2",
    title: "Velkommen til nye spillere!",
    body: "Vi har fått fire nye spillere denne høsten. Ta godt imot dem på trening.",
    createdAt: hoursFromNow(-72),
  },
];

export const polls: Poll[] = [
  {
    id: "p1",
    groupId: "herrer",
    question: "Hvilken dag passer best for lagfest?",
    closesAt: daysFromNow(3, 23, 59),
    options: [
      { id: "p1o1", label: "Fredag", voterIds: ["u1", "u3", "u5"] },
      { id: "p1o2", label: "Lørdag", voterIds: ["u7", "u9"] },
      { id: "p1o3", label: "Søndag", voterIds: [] },
    ],
  },
  {
    id: "p2",
    groupId: "volley",
    question: "Skal vi melde oss på NM for studenter?",
    closesAt: daysFromNow(7, 12),
    options: [
      { id: "p2o1", label: "Ja", voterIds: ["u3", "u6", "u8"] },
      { id: "p2o2", label: "Nei", voterIds: ["u12"] },
    ],
  },
];

export const fines: Fine[] = [
  {
    id: "f1",
    groupId: "herrer",
    userId: "u7",
    givenById: "u1",
    lawId: "herrer-1.00",
    reason: "Kom for sent til trening",
    imageUri: null,
    count: 2,
    createdAt: hoursFromNow(-48),
    paid: false,
    collective: false,
    eventId: null,
  },
  {
    id: "f2",
    groupId: "herrer",
    userId: "u1",
    givenById: "u3",
    lawId: "herrer-2.00",
    reason: "Glemte drikkeflaske",
    imageUri: null,
    count: 1,
    createdAt: hoursFromNow(-100),
    paid: false,
    collective: false,
    eventId: null,
  },
  {
    id: "f3",
    groupId: "herrer",
    userId: "u11",
    givenById: "u1",
    lawId: "herrer-1.01",
    reason: "Svarte ikke på arrangement",
    imageUri: null,
    count: 1,
    createdAt: hoursFromNow(-140),
    paid: true,
    collective: true,
    eventId: null,
  },
  {
    id: "f4",
    groupId: "volley",
    userId: "u1",
    givenById: "u6",
    lawId: "volley-3.01",
    reason: "Mobil på trening",
    imageUri: null,
    count: 1,
    createdAt: hoursFromNow(-20),
    paid: false,
    collective: false,
    eventId: null,
  },
];

export const paymentRequests: PaymentRequest[] = [
  {
    id: "pay1",
    groupId: "herrer",
    createdById: "u1",
    title: "Nye drakter",
    description: "Betal for drakten din før du henter den på kontoret.",
    amount: 350,
    vippsNumber: "123 45 678",
    dueDate: daysFromNow(10, 23, 59),
    createdAt: hoursFromNow(-5),
    paidUserIds: ["u3", "u5"],
  },
  {
    id: "pay2",
    groupId: "herrer",
    createdById: "u3",
    title: "Botfest",
    description: "Bøtene fra høsten gjøres opp før botfesten. 25 kr per bot.",
    amount: 75,
    vippsNumber: "123 45 678",
    dueDate: daysFromNow(8, 23, 59),
    createdAt: hoursFromNow(-30),
    paidUserIds: ["u7"],
  },
  {
    id: "pay3",
    groupId: "volley",
    createdById: "u6",
    title: "Halleie høst",
    description: "Andel av hallleie for høstsemesteret.",
    amount: 200,
    vippsNumber: "987 65 432",
    dueDate: daysFromNow(14, 23, 59),
    createdAt: hoursFromNow(-60),
    paidUserIds: ["u3", "u8", "u12"],
  },
];

export const files: GroupFile[] = [
  {
    id: "fi1",
    groupId: "herrer",
    name: "Botregler 2026.pdf",
    kind: "pdf",
    sizeKb: 182,
    uploadedAt: hoursFromNow(-400),
  },
  {
    id: "fi2",
    groupId: "herrer",
    name: "Lagbilde høst.jpg",
    kind: "image",
    sizeKb: 2340,
    uploadedAt: hoursFromNow(-200),
  },
  {
    id: "fi3",
    groupId: "handball",
    name: "Treningsplan.docx",
    kind: "document",
    sizeKb: 56,
    uploadedAt: hoursFromNow(-90),
  },
];

export const notifications: Notification[] = [
  {
    id: "n3",
    groupId: "volley",
    type: "fine",
    text: "Du har fått 1 bot i Pythons Volley",
    createdAt: hoursFromNow(-20),
    read: false,
    href: "/grupper/volley",
  },
  {
    id: "n6",
    groupId: "herrer",
    type: "payment",
    text: "Ny betaling i Pythons Herrer: Nye drakter (350 kr)",
    createdAt: hoursFromNow(-5),
    read: false,
    href: "/grupper/herrer",
  },
  {
    id: "n4",
    groupId: "handball",
    type: "announcement",
    text: "Ny kunngjøring i Pythons Håndball: Ny treningstid",
    createdAt: hoursFromNow(-30),
    read: true,
    href: "/grupper/handball",
  },
  {
    id: "n5",
    groupId: "herrer",
    type: "poll",
    text: "Ny avstemning: Hvilken dag passer best for lagfest?",
    createdAt: hoursFromNow(-50),
    read: true,
    href: "/grupper/herrer",
  },
];

export const conversations: Conversation[] = [
  {
    id: "c1",
    title: "Pythons Herrer",
    groupId: "herrer",
    memberIds: ["u1", "u3", "u5", "u7", "u9", "u11"],
    unread: 2,
    messages: [
      {
        id: "m1",
        senderId: "u5",
        body: "Noen som har ekstra leggskinn?",
        sentAt: hoursFromNow(-2),
      },
      {
        id: "m2",
        senderId: "u3",
        body: "Jeg tar med et par 👍",
        sentAt: hoursFromNow(-1),
      },
    ],
  },
  {
    id: "c2",
    title: "Kari Hansen",
    groupId: null,
    memberIds: ["u1", "u2"],
    unread: 0,
    messages: [
      {
        id: "m3",
        senderId: "u1",
        body: "Takk for i dag!",
        sentAt: hoursFromNow(-26),
      },
    ],
  },
  {
    id: "c3",
    title: "Pythons Volley",
    groupId: "volley",
    memberIds: ["u1", "u3", "u6", "u8", "u12"],
    unread: 1,
    messages: [
      {
        id: "m4",
        senderId: "u6",
        body: "Husk å stemme på NM-avstemningen!",
        sentAt: hoursFromNow(-6),
      },
    ],
  },
];
