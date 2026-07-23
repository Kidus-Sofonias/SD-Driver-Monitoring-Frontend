import type { TripRoutePoint } from "../types/api";

const MIN_MOVE_METERS = 3;
const MAX_REASONABLE_SPEED_MPS = 55;
const MAX_REASONABLE_ACCURACY_METERS = 80;
const SPIKE_RETURN_DISTANCE_METERS = 35;
const SPIKE_LEG_DISTANCE_METERS = 22;
const MAX_ZIGZAG_LEG_METERS = 55;
const MIN_ZIGZAG_ANGLE_DEGREES = 140;
const ZIGZAG_RECOVERY_DISTANCE_METERS = 45;
const SMOOTHING_PASSES = 2;
const WANDER_LEG_DISTANCE_METERS = 26;
const WANDER_RECOVERY_DISTANCE_METERS = 30;
const WANDER_MIN_ACCURACY_METERS = 45;

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

  const deZigZagged = removeSharpZigZags(deSpiked);
  if (deZigZagged.length <= 2) {
    return deZigZagged;
  }

  const deWandered = removeLowAccuracyWander(deZigZagged);
  if (deWandered.length <= 2) {
    return deWandered;
  }

  return smoothRoute(deWandered);
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

  let smoothed = points.slice();
  for (let pass = 0; pass < SMOOTHING_PASSES; pass += 1) {
    smoothed = smoothed.map((point, index) => {
      if (index === 0 || index === smoothed.length - 1) {
        return point;
      }

      const previous = smoothed[index - 1];
      const next = smoothed[index + 1];
      const spanMeters = haversineKm(previous, next) * 1000;

      if (spanMeters > 180) {
        return point;
      }

      const pointAccuracy = preferredAccuracy(point);
      const centerWeight = pointAccuracy > MAX_REASONABLE_ACCURACY_METERS ? 1 : 2;
      const totalWeight = 1 + centerWeight + 1;

      return {
        ...point,
        lat: (previous.lat + point.lat * centerWeight + next.lat) / totalWeight,
        lon: (previous.lon + point.lon * centerWeight + next.lon) / totalWeight,
      };
    });
  }

  return smoothed;
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

function removeSharpZigZags(points: TripRoutePoint[]) {
  const filtered: TripRoutePoint[] = [points[0]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = filtered[filtered.length - 1] ?? points[index - 1];
    const current = points[index];
    const next = points[index + 1];

    if (isSharpZigZag(previous, current, next)) {
      continue;
    }

    filtered.push(current);
  }

  filtered.push(points[points.length - 1]);
  return filtered;
}

function removeLowAccuracyWander(points: TripRoutePoint[]) {
  const filtered: TripRoutePoint[] = [points[0]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = filtered[filtered.length - 1] ?? points[index - 1];
    const current = points[index];
    const next = points[index + 1];

    if (isLowAccuracyWander(previous, current, next)) {
      continue;
    }

    filtered.push(current);
  }

  filtered.push(points[points.length - 1]);
  return filtered;
}

function isSharpZigZag(previous: TripRoutePoint, current: TripRoutePoint, next: TripRoutePoint) {
  const prevToCurrentMeters = haversineKm(previous, current) * 1000;
  const currentToNextMeters = haversineKm(current, next) * 1000;
  const prevToNextMeters = haversineKm(previous, next) * 1000;

  if (prevToCurrentMeters > MAX_ZIGZAG_LEG_METERS || currentToNextMeters > MAX_ZIGZAG_LEG_METERS) {
    return false;
  }

  if (prevToNextMeters > ZIGZAG_RECOVERY_DISTANCE_METERS) {
    return false;
  }

  const angle = turnAngleDegrees(previous, current, next);
  const highAccuracyPoints =
    preferredAccuracy(previous) <= MAX_REASONABLE_ACCURACY_METERS &&
    preferredAccuracy(current) <= MAX_REASONABLE_ACCURACY_METERS &&
    preferredAccuracy(next) <= MAX_REASONABLE_ACCURACY_METERS;

  return angle >= MIN_ZIGZAG_ANGLE_DEGREES && !highAccuracyPoints;
}

function isLowAccuracyWander(previous: TripRoutePoint, current: TripRoutePoint, next: TripRoutePoint) {
  const currentAccuracy = preferredAccuracy(current);
  if (currentAccuracy < WANDER_MIN_ACCURACY_METERS) {
    return false;
  }

  const prevToCurrentMeters = haversineKm(previous, current) * 1000;
  const currentToNextMeters = haversineKm(current, next) * 1000;
  const prevToNextMeters = haversineKm(previous, next) * 1000;
  const currentToNextSeconds = Math.max(elapsedSeconds(current.ts, next.ts), 1);
  const impliedSpeed = currentToNextMeters / currentToNextSeconds;

  const longOutAndBack =
    prevToCurrentMeters >= WANDER_LEG_DISTANCE_METERS &&
    currentToNextMeters >= WANDER_LEG_DISTANCE_METERS &&
    prevToNextMeters <= WANDER_RECOVERY_DISTANCE_METERS;

  const unlikelyMovement = impliedSpeed > MAX_REASONABLE_SPEED_MPS || currentAccuracy > MAX_REASONABLE_ACCURACY_METERS;
  return longOutAndBack && unlikelyMovement;
}

function turnAngleDegrees(previous: TripRoutePoint, current: TripRoutePoint, next: TripRoutePoint) {
  const inBearing = bearingDegrees(previous, current);
  const outBearing = bearingDegrees(current, next);
  const rawDelta = Math.abs(outBearing - inBearing);
  return Math.min(rawDelta, 360 - rawDelta);
}

function bearingDegrees(start: Pick<TripRoutePoint, "lat" | "lon">, end: Pick<TripRoutePoint, "lat" | "lon">) {
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const dLon = toRadians(end.lon - start.lon);
  const y = Math.sin(dLon) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
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
