import type { TripRoutePoint } from "../types/api";

const MIN_MOVE_METERS = 3;
const MAX_REASONABLE_SPEED_MPS = 55;
const MAX_REASONABLE_ACCURACY_METERS = 80;
const SPIKE_RETURN_DISTANCE_METERS = 35;
const SPIKE_LEG_DISTANCE_METERS = 22;

export function cleanRoutePoints(points: TripRoutePoint[]) {
  const normalized = normalizeRoutePoints(points);
  if (normalized.length <= 2) {
    return normalized;
  }

  const deDuplicated = dedupeNearbyPoints(normalized);
  if (deDuplicated.length <= 2) {
    return deDuplicated;
  }

  const deSpiked = removeGpsSpikes(deDuplicated);
  if (deSpiked.length <= 2) {
    return deSpiked;
  }

  return smoothRoute(deSpiked);
}

export function haversineKm(
  start: Pick<TripRoutePoint, "lat" | "lon">,
  end: Pick<TripRoutePoint, "lat" | "lon">
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(end.lat - start.lat);
  const dLon = toRadians(end.lon - start.lon);
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeRoutePoints(points: TripRoutePoint[]) {
  return [...points]
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))
    .sort((left, right) => toTime(left.ts) - toTime(right.ts));
}

function dedupeNearbyPoints(points: TripRoutePoint[]) {
  const deduped: TripRoutePoint[] = [];

  for (const point of points) {
    const previous = deduped[deduped.length - 1];
    if (!previous) {
      deduped.push(point);
      continue;
    }

    const seconds = elapsedSeconds(previous.ts, point.ts);
    const distanceMeters = haversineKm(previous, point) * 1000;

    if (distanceMeters < MIN_MOVE_METERS && seconds <= 3) {
      if (preferredAccuracy(point) < preferredAccuracy(previous)) {
        deduped[deduped.length - 1] = point;
      }
      continue;
    }

    deduped.push(point);
  }

  return deduped;
}

function removeGpsSpikes(points: TripRoutePoint[]) {
  const filtered: TripRoutePoint[] = [points[0]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = filtered[filtered.length - 1] ?? points[index - 1];
    const current = points[index];
    const next = points[index + 1];

    if (isObviousSpike(previous, current, next)) {
      continue;
    }

    filtered.push(current);
  }

  filtered.push(points[points.length - 1]);
  return filtered;
}

function smoothRoute(points: TripRoutePoint[]) {
  if (points.length <= 2) {
    return points;
  }

  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) {
      return point;
    }

    const previous = points[index - 1];
    const next = points[index + 1];
    const spanMeters = haversineKm(previous, next) * 1000;

    if (spanMeters > 180) {
      return point;
    }

    return {
      ...point,
      lat: (previous.lat + point.lat * 2 + next.lat) / 4,
      lon: (previous.lon + point.lon * 2 + next.lon) / 4,
    };
  });
}

function isObviousSpike(previous: TripRoutePoint, current: TripRoutePoint, next: TripRoutePoint) {
  const prevToCurrentMeters = haversineKm(previous, current) * 1000;
  const currentToNextMeters = haversineKm(current, next) * 1000;
  const prevToNextMeters = haversineKm(previous, next) * 1000;
  const prevToCurrentSeconds = Math.max(elapsedSeconds(previous.ts, current.ts), 1);
  const currentToNextSeconds = Math.max(elapsedSeconds(current.ts, next.ts), 1);
  const prevToCurrentSpeed = prevToCurrentMeters / prevToCurrentSeconds;
  const currentToNextSpeed = currentToNextMeters / currentToNextSeconds;
  const accuracyPenalty =
    preferredAccuracy(current) >= MAX_REASONABLE_ACCURACY_METERS ||
    preferredAccuracy(previous) >= MAX_REASONABLE_ACCURACY_METERS ||
    preferredAccuracy(next) >= MAX_REASONABLE_ACCURACY_METERS;

  const returnsNearPath = prevToNextMeters <= SPIKE_RETURN_DISTANCE_METERS;
  const longLegs = prevToCurrentMeters >= SPIKE_LEG_DISTANCE_METERS && currentToNextMeters >= SPIKE_LEG_DISTANCE_METERS;
  const impossibleJump =
    prevToCurrentSpeed > MAX_REASONABLE_SPEED_MPS || currentToNextSpeed > MAX_REASONABLE_SPEED_MPS;

  return (returnsNearPath && longLegs) || (accuracyPenalty && impossibleJump);
}

function preferredAccuracy(point: TripRoutePoint) {
  return typeof point.accuracy_m === "number" && Number.isFinite(point.accuracy_m)
    ? Math.abs(point.accuracy_m)
    : 0;
}

function elapsedSeconds(start: string, end: string) {
  return Math.max(0, Math.round((toTime(end) - toTime(start)) / 1000));
}

function toTime(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
