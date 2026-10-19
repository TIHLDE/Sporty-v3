// Feil med HTTP-statuskode, som handler() i http.ts gjør om til et svar. Ligger i en egen fil så
// moduler http.ts selv importerer (f.eks. photon.ts) kan bruke den uten en importsirkel.

export class HttpError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
	}
}
