import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import type { TripRoutePoint } from "../types/api";
import { radius, spacing, type } from "../theme/tokens";

type Props = {
  points: TripRoutePoint[];
  height?: number;
  showLegend?: boolean;
};

export function RoutePreview({ points, height = 280, showLegend = true }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const routeCoordinates = useMemo(
    () => points.map((point) => ({ latitude: point.lat, longitude: point.lon })),
    [points]
  );

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
        initialRegion={buildRouteRegion(points)}
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
      </MapView>
      {showLegend ? (
        <View style={styles.routeLegend}>
          <Text style={styles.routeLegendText}>Blue line = route</Text>
          <Text style={styles.routeLegendText}>Green = start</Text>
          <Text style={styles.routeLegendText}>Red = finish</Text>
        </View>
      ) : null}
    </View>
  );
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
