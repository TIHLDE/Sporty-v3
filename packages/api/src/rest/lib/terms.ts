// Brukervilkårene. Samme tekst i appen (src/lib/terms.ts) og på nettsiden.
//
// UTKAST: teksten må godkjennes av de ansvarlige i TIHLDE før lansering. Øk TERMS_VERSION når
// innholdet endres, så må alle godta på nytt.

export const TERMS_VERSION = 1;

/** Personvernerklæringen ligger hos TIHLDE. */
export const PRIVACY_URL = "https://tihlde.org/personvern";

/** Kontoen eies av TIHLDE, så Sporty har ingen egen kontosletting. */
export const TIHLDE_ACCOUNT_URL = "https://tihlde.org/profil/me/innstillinger";

export const TERMS_SECTIONS = [
	{
		title: "Hva Sporty er",
		body: "Sporty er TIHLDEs app og nettside for idrettslagene, med arrangementer, oppmøte, bøter, kunngjøringer og meldinger.",
	},
	{
		title: "Ingen toleranse for krenkende innhold",
		body: "Du er selv ansvarlig for det du deler. Det er ikke lov å dele innhold som er trakasserende, truende, hatefullt, seksuelt, ulovlig eller på andre måter krenkende. Det samme gjelder å plage andre brukere. GIF-er og bilder regnes også som innhold du deler.",
	},
	{
		title: "Rapportering og blokkering",
		body: "Du kan rapportere meldinger og kommentarer, og blokkere andre brukere. Rapporter behandles av lagets ledere, og direktemeldinger av Index. De som behandler en rapport ser det rapporterte innholdet, og vi tar sikte på å behandle rapporter innen 24 timer.",
	},
	{
		title: "Konsekvenser",
		body: "Innhold som bryter vilkårene kan bli slettet, og brukere som bryter dem kan bli fjernet fra lag eller miste tilgangen til Sporty.",
	},
	{
		title: "Spørsmål",
		body: "Har du spørsmål om vilkårene eller om innhold i Sporty, ta kontakt med lederen for laget ditt eller Index.",
	},
] as const;
