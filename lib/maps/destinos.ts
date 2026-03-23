export const normalizeDestination = (s: string) => {
  const str = String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return str;
};

// Mapa direto (maps.app.goo.gl) por rodoviária/destino.
// A UI vai normalizar o texto e tentar casar pelo nome.
export const DESTINO_TO_MAPS_URL_RAW: Record<string, string> = {
  "ACREÚNA": "https://maps.app.goo.gl/QVBJ8hsxu2AHQaPf8",
  "ALTO ARAGUAIA": "https://maps.app.goo.gl/pwHftytWp6HS8RQZ9",
  "ANAPOLIS": "https://maps.app.goo.gl/rJoigKNx1KFkyurf9",
  "CHAPADAO DO CEU": "https://maps.app.goo.gl/qBGX8Br9dXybrMxHA",
  "INDIARA": "https://maps.app.goo.gl/jNjwemoXkEWsHwHC7",
  "JATAI": "https://maps.app.goo.gl/o7h7HcgNYacH8Eeq8",
  "MINEIROS": "https://maps.app.goo.gl/1Czg4MaAw1L64R8a9",
  "QUIRINOPOLIS": "https://maps.app.goo.gl/ob63nCotHRWnAyrg9",
  "SANTA RITA DO ARAGUAIA": "https://maps.app.goo.gl/pwHftytWp6HS8RQZ9",
  "ALTA FLORESTA": "https://maps.app.goo.gl/6nqwhXZB6aka3QrT9",
  "ARACAJU": "https://maps.app.goo.gl/1JVSfRJPNrttJGxw7",
  "BARREIRAS": "https://maps.app.goo.gl/E9hZkkKzNfw78HBR9",
  "CARUARU": "https://maps.app.goo.gl/LtmwRtaAGSnqVgky7",
  "CUIABÁ": "https://maps.app.goo.gl/kMEvHdJpheF2vuPh8",
  "FEIRA DE SANTANA": "https://maps.app.goo.gl/hLRNcDex4fNPoSQA8",
  "LUIS EDUARDO MAGALHÃES": "https://maps.app.goo.gl/pSxpNHG5nYwBFBnH6",
  "RONDONOPOLIS": "https://maps.app.goo.gl/f1Q4N66uuTFhgTZ57",
  "SALVADOR": "https://maps.app.goo.gl/ZZMDWitMGt8WrSWY8",
  "SANTA HELENA DE GOIAS": "https://maps.app.goo.gl/cPCvCHaPzF5c7uHq5",
  "BRASILIA": "https://maps.app.goo.gl/vbtvUVVLKbueTDbr8",
  "ALTO GARÇAS": "https://maps.app.goo.gl/CSEHWGwjyga88SFt7",
  "ARAPIRACA": "https://maps.app.goo.gl/hjNzqrQyNyAXMy8h6",
  "COLIDER": "https://maps.app.goo.gl/cjHpvDrGjgzLg67QA",
  "LUCAS DO RIO VERDE": "https://maps.app.goo.gl/JQ9RCeg7Aow7ghjj7",
  "MACEIO": "https://maps.app.goo.gl/pQzpoAmZnZrLk1gw5",
  "NOVA MUTUM": "https://maps.app.goo.gl/Sm2E23hpvVot6tbP7",
  "RECIFE": "https://maps.app.goo.gl/1P9we4CuwamfG8w3A",
  "SINOP": "https://maps.app.goo.gl/qW7VF5fFNXDUEZ6Y6",
  "SORRISO": "https://maps.app.goo.gl/EY2vEG5JoNtXBUQw6",
  "RIO VERDE": "https://maps.app.goo.gl/yfmaaTA4X8RQHn8Z7",
  "JOAO PESSOA": "https://maps.app.goo.gl/aVSnAFVQvJ51xFbS7",

  // Complementos que aparecem no seu envio
  "GOIÂNIA (GARAGEM)": "https://maps.app.goo.gl/kMEvHdJpheF2vuPh8",
};

export const DESTINO_OPTIONS: string[] = Object.keys(DESTINO_TO_MAPS_URL_RAW).sort((a, b) =>
  a.localeCompare(b, "pt-BR", { sensitivity: "base" })
);

export const DESTINO_TO_MAPS_URL_BY_NORMALIZED: Record<string, string> = Object.entries(DESTINO_TO_MAPS_URL_RAW).reduce(
  (acc, [label, url]) => {
    acc[normalizeDestination(label)] = url;
    return acc;
  },
  {} as Record<string, string>
);

