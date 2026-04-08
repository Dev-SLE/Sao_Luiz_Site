import raw from "./agency_stops.json";

export type AgencyStop = { key: string; label: string; lat: number; lng: number };

export const AGENCY_STOPS: AgencyStop[] = raw as AgencyStop[];

const BY_KEY = new Map(AGENCY_STOPS.map((s) => [s.key.toUpperCase(), s]));

export function getAgencyStopByKey(key: string): AgencyStop | undefined {
  return BY_KEY.get(key.trim().toUpperCase());
}
