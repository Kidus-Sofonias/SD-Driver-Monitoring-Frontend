import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import { cleanRoutePoints } from "../lib/route";
import type { DrivingEvent, TripRoutePoint } from "../types/api";
import { radius, spacing, type } from "../theme/tokens";

type Props = {
  points: TripRoutePoint[];
  events?: DrivingEvent[];
  height?: number;
  showLegend?: boolean;
};

export function RoutePreview({ points, events = [], height = 280, showLegend = true }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const cleanedPoints = useMemo(() => cleanRoutePoints(points), [points]);
  const routeCoordinates = useMemo(
    () => cleanedPoints.map((point) => ({ latitude: point.lat, longitude: point.lon })),
    [cleanedPoints]
  );
  const eventMarkers = useMemo(() => mapEventsToRoutePoints(cleanedPoints, events), [cleanedPoints, events]);

  useEffect(() => {
    if (!mapRef.current || routeCoordinates.length < 2) {
      return;
    }

    const timeoutId = setTimeout(() => {
      mapRef.current?.fitToCoordinates(routeCoordinates, {
        edgePadding: {
          top: 48,
          right: 48,
          bottom: 48,
          left: 48
        },
        animated: false
      });
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [routeCoordinates]);

  const startPoint = routeCoordinates[0];
  const endPoint = routeCoordinates[routeCoordinates.length - 1];

  return (
    <View style={styles.mapShell}>
      <MapView
        ref={mapRef}
        style={[styles.map, { height }]}
        initialRegion={buildRouteRegion(cleanedPoints)}
        mapType="standard"
        showsCompass
        showsBuildings
        toolbarEnabled={false}
      >
        <Polyline
          coordinates={routeCoordinates}
          strokeColor="#1677FF"
          strokeWidth={4}
          lineCap="round"
          lineJoin="round"
        />
        {startPoint ? (
          <Marker coordinate={startPoint} title="Trip start" pinColor="#2E9E5B" />
        ) : null}
        {endPoint && (endPoint.latitude !== startPoint?.latitude || endPoint.longitude !== startPoint?.longitude) ? (
          <Marker coordinate={endPoint} title="Trip end" pinColor="#D3505D" />
        ) : null}
        {eventMarkers.map(({ event, point }) => (
          <Marker
            key={`event-${event.id}`}
            coordinate={{ latitude: point.lat, longitude: point.lon }}
            title={humanizeEventType(event.event_type)}
            description={`Value ${Math.round(event.value)} at ${new Date(event.occurred_at ?? event.created_at).toLocaleString()}`}
            pinColor={eventToneColor(event.event_type)}
          />
        ))}
      </MapView>
      {showLegend ? (
        <View style={styles.routeLegend}>
          <Text style={styles.routeLegendText}>Blue line = route</Text>
          <Text style={styles.routeLegendText}>Green = start</Text>
          <Text style={styles.routeLegendText}>Red = finish</Text>
          {eventMarkers.length ? <Text style={styles.routeLegendText}>Amber = detected event</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function mapEventsToRoutePoints(points: TripRoutePoint[], events: DrivingEvent[]) {
  if (!points.length || !events.length) {
    return [];
  }

  return events.map((event) => ({
    event,
    point:
      event.lat != null && event.lon != null
        ? {
            ts: event.occurred_at ?? event.created_at,
            lat: event.lat,
            lon: event.lon,
            speed_mps: null,
            accuracy_m: null,
          }
        : findClosestPointByTimestamp(points, event.occurred_at ?? event.created_at),
  }));
}

function findClosestPointByTimestamp(points: TripRoutePoint[], timestamp: string) {
  const targetTime = new Date(timestamp).getTime();
  return points.reduce((closest, current) => {
    const currentDelta = Math.abs(new Date(current.ts).getTime() - targetTime);
    const closestDelta = Math.abs(new Date(closest.ts).getTime() - targetTime);
    return currentDelta < closestDelta ? current : closest;
  }, points[0]);
}

function humanizeEventType(eventType: string) {
  return eventType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function eventToneColor(eventType: string) {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("brak")) {
    return "#FF9B7A";
  }
  if (normalized.includes("turn")) {
    return "#7DD3FC";
  }
  if (normalized.includes("unstable")) {
    return "#C7F36B";
  }
  return "#F7C873";
}

function buildRouteRegion(points: TripRoutePoint[]) {
  if (!points.length) {
    return {
      latitude: 0,
      longitude: 0,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05
    };
  }

  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.01),
    longitudeDelta: Math.max((maxLon - minLon) * 1.5, 0.01)
  };
}

const styles = StyleSheet.create({
  mapShell: {
    gap: spacing.sm,
  },
  map: {
    borderRadius: radius.md,
    overflow: "hidden",
  },
  routeLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  routeLegendText: {
    fontSize: type.caption,
    fontWeight: "700",
  },
});
