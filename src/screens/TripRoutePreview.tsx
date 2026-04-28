import React, { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";

import { cleanRoutePoints } from "../lib/route";
import type { DrivingEvent, TripRoutePoint } from "../types/api";
import { radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type LeafletBundle = {
  MapContainer: any;
  Marker: any;
  Polyline: any;
  TileLayer: any;
  Tooltip: any;
  L: any;
};

type Props = {
  points: TripRoutePoint[];
  events?: DrivingEvent[];
  height?: number;
  showLegend?: boolean;
};

type EventMarker = {
  event: DrivingEvent;
  point: TripRoutePoint;
};

export function RoutePreview({ points, events = [], height = 220, showLegend = true }: Props) {
  const colors = useThemeColors();
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [leafletBundle, setLeafletBundle] = useState<LeafletBundle | null>(null);
  const [leafletError, setLeafletError] = useState<string | null>(null);
  const canvasHeight = height;
  const padding = 18;
  const cleanedPoints = useMemo(() => cleanRoutePoints(points), [points]);
  const projected = useMemo(() => projectRoute(cleanedPoints, canvasWidth, canvasHeight, padding), [canvasHeight, canvasWidth, cleanedPoints, padding]);
  const routeCoordinates = useMemo(() => cleanedPoints.map((point) => [point.lat, point.lon] as [number, number]), [cleanedPoints]);
  const eventMarkers = useMemo(() => mapEventsToRoutePoints(cleanedPoints, events), [cleanedPoints, events]);
  const projectedEvents = useMemo(
    () => projectEventMarkers(eventMarkers, cleanedPoints, projected.points),
    [cleanedPoints, eventMarkers, projected.points]
  );

  useEffect(() => {
    let active = true;

    async function loadLeaflet() {
      try {
        ensureLeafletCss();
        const leafletModule = await import("leaflet");
        const reactLeafletModule = await import("react-leaflet");
        if (!active) {
          return;
        }

        const L = leafletModule.default || leafletModule;
        setLeafletBundle({
          MapContainer: reactLeafletModule.MapContainer,
          Marker: reactLeafletModule.Marker,
          Polyline: reactLeafletModule.Polyline,
          TileLayer: reactLeafletModule.TileLayer,
          Tooltip: reactLeafletModule.Tooltip,
          L,
        });
        setLeafletError(null);
      } catch (error) {
        if (!active) {
          return;
        }
        setLeafletBundle(null);
        setLeafletError(error instanceof Error ? error.message : "Unknown Leaflet load failure");
      }
    }

    void loadLeaflet();

    return () => {
      active = false;
    };
  }, []);

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = Math.max(0, Math.round(event.nativeEvent.layout.width));
    if (nextWidth !== canvasWidth) {
      setCanvasWidth(nextWidth);
    }
  }

  if (leafletBundle) {
    return (
      <LeafletRouteMap
        bundle={leafletBundle}
        points={cleanedPoints}
        routeCoordinates={routeCoordinates}
        eventMarkers={eventMarkers}
        height={height}
        showLegend={showLegend}
      />
    );
  }

  return (
    <View style={[styles.routeCanvasShell, { backgroundColor: colors.panelRaised, borderColor: colors.line }]} onLayout={handleLayout}>
      <View style={[styles.statusBanner, { backgroundColor: "#FFF4E5", borderColor: "#F2D1A3" }]}>
        <Text style={[styles.statusTitle, { color: "#8A4B08" }]}>
          {leafletError ? "Free map failed to load" : "Loading free map tiles"}
        </Text>
        <Text style={[styles.statusText, { color: "#8A4B08" }]}>
          {leafletError
            ? `OpenStreetMap web renderer could not load (${leafletError}). Showing fallback preview instead.`
            : "Trying the free OpenStreetMap route view. If it takes too long, the fallback preview stays visible."}
        </Text>
      </View>
      <View style={[styles.routeCanvas, { height: canvasHeight }]}>
        {projected.segments.map((segment) => (
          <View
            key={segment.key}
            style={[
              styles.routeSegment,
              {
                left: segment.left,
                top: segment.top,
                width: segment.length,
                backgroundColor: colors.accentStrong,
                transform: [{ rotate: `${segment.angle}deg` }],
              },
            ]}
          />
        ))}
        {projected.points.map((point, index) => (
          <View
            key={`${point.x}-${point.y}-${index}`}
            style={[
              styles.routePoint,
              {
                left: point.x - 4,
                top: point.y - 4,
                backgroundColor:
                  index === 0 ? "#2E9E5B" : index === projected.points.length - 1 ? "#D3505D" : colors.accent,
                borderColor: colors.panel,
              },
            ]}
          />
        ))}
        {projectedEvents.map((marker) => (
          <View
            key={`event-${marker.event.id}`}
            style={[
              styles.eventBadge,
              {
                left: marker.x - 8,
                top: marker.y - 8,
                backgroundColor: eventToneColor(marker.event.event_type),
                borderColor: colors.panel,
              },
            ]}
          />
        ))}
      </View>
      {showLegend ? (
        <View style={styles.routeLegend}>
          <Text style={[styles.routeLegendText, { color: colors.text }]}>Fallback route preview is active until the free map loads.</Text>
          <Text style={[styles.routeLegendText, { color: colors.text }]}>Green = start</Text>
          <Text style={[styles.routeLegendText, { color: colors.text }]}>Red = finish</Text>
          {eventMarkers.length ? <Text style={[styles.routeLegendText, { color: colors.text }]}>Amber = event marker</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function LeafletRouteMap({
  bundle,
  points,
  routeCoordinates,
  eventMarkers,
  height,
  showLegend,
}: {
  bundle: LeafletBundle;
  points: TripRoutePoint[];
  routeCoordinates: [number, number][];
  eventMarkers: EventMarker[];
  height: number;
  showLegend: boolean;
}) {
  const colors = useThemeColors();
  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  const startIcon = useMemo(() => createDivIcon(bundle.L, "#2E9E5B", "S"), [bundle.L]);
  const endIcon = useMemo(() => createDivIcon(bundle.L, "#D3505D", "E"), [bundle.L]);

  return (
    <View style={[styles.routeCanvasShell, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
      <View style={[styles.statusBanner, { backgroundColor: "#E7F6EC", borderColor: "#B7DEC4" }]}>
        <Text style={[styles.statusTitle, { color: "#1B6B37" }]}>Free OpenStreetMap view enabled</Text>
        <Text style={[styles.statusText, { color: "#1B6B37" }]}>
          Using free OpenStreetMap tiles for historical route tracking on web.
        </Text>
      </View>
      <View style={styles.leafletHost}>
        <bundle.MapContainer
          bounds={routeCoordinates}
          boundsOptions={{ padding: [24, 24] }}
          scrollWheelZoom
          style={{ height: Math.max(height, 280), width: "100%", borderRadius: 16 }}
        >
          <bundle.TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <bundle.Polyline positions={routeCoordinates} pathOptions={{ color: "#1677FF", weight: 4 }} />
          {startPoint ? (
            <bundle.Marker position={[startPoint.lat, startPoint.lon]} icon={startIcon}>
              <bundle.Tooltip direction="top" offset={[0, -12]} permanent={false}>
                Trip start
              </bundle.Tooltip>
            </bundle.Marker>
          ) : null}
          {endPoint && (endPoint.lat !== startPoint?.lat || endPoint.lon !== startPoint?.lon) ? (
            <bundle.Marker position={[endPoint.lat, endPoint.lon]} icon={endIcon}>
              <bundle.Tooltip direction="top" offset={[0, -12]} permanent={false}>
                Trip end
              </bundle.Tooltip>
            </bundle.Marker>
          ) : null}
          {eventMarkers.map(({ event, point }) => (
            <bundle.Marker
              key={`event-${event.id}`}
              position={[point.lat, point.lon]}
              icon={createEventIcon(bundle.L, eventToneColor(event.event_type), eventShortLabel(event.event_type))}
            >
              <bundle.Tooltip direction="top" offset={[0, -12]} permanent={false}>
                {eventTooltip(event)}
              </bundle.Tooltip>
            </bundle.Marker>
          ))}
        </bundle.MapContainer>
      </View>
      {showLegend ? (
        <View style={styles.routeLegend}>
          <Text style={[styles.routeLegendText, { color: colors.text }]}>Blue line = route</Text>
          <Text style={[styles.routeLegendText, { color: colors.text }]}>Green = start</Text>
          <Text style={[styles.routeLegendText, { color: colors.text }]}>Red = finish</Text>
          {eventMarkers.length ? <Text style={[styles.routeLegendText, { color: colors.text }]}>Amber = detected event</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function ensureLeafletCss() {
  if (typeof document === "undefined") {
    return;
  }
  const existing = document.getElementById("leaflet-stylesheet");
  if (existing) {
    return;
  }
  const link = document.createElement("link");
  link.id = "leaflet-stylesheet";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

function createDivIcon(L: any, color: string, label: string) {
  return L.divIcon({
    className: "safe-driving-route-marker",
    html: `<div style="width:24px;height:24px;border-radius:999px;background:${color};border:3px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:11px;box-shadow:0 2px 8px rgba(0,0,0,0.25);">${label}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createEventIcon(L: any, color: string, label: string) {
  return L.divIcon({
    className: "safe-driving-route-event-marker",
    html: `<div style="width:18px;height:18px;border-radius:999px;background:${color};border:2px solid white;display:flex;align-items:center;justify-content:center;color:#08111C;font-weight:800;font-size:9px;box-shadow:0 2px 8px rgba(0,0,0,0.25);">${label}</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function mapEventsToRoutePoints(points: TripRoutePoint[], events: DrivingEvent[]): EventMarker[] {
  if (!points.length || !events.length) {
    return [];
  }

  return events.map((event) => ({
    event,
    point: findClosestPointByTimestamp(points, event.created_at),
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

function projectRoute(points: TripRoutePoint[], width: number, height: number, padding: number) {
  if (!points.length || width <= 0) {
    return {
      points: [],
      segments: [] as Array<{ key: string; left: number; top: number; length: number; angle: number }>,
    };
  }

  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const lonSpan = Math.max(maxLon - minLon, 0.0001);
  const usableWidth = Math.max(width - padding * 2, 1);
  const usableHeight = Math.max(height - padding * 2, 1);

  const mappedPoints = points.map((point) => ({
    x: padding + ((point.lon - minLon) / lonSpan) * usableWidth,
    y: padding + (1 - (point.lat - minLat) / latSpan) * usableHeight,
  }));

  const segments = mappedPoints.slice(1).map((point, index) => {
    const previous = mappedPoints[index];
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const length = Math.max(Math.sqrt(dx * dx + dy * dy), 2);
    return {
      key: `${index}-${index + 1}`,
      left: previous.x + dx / 2 - length / 2,
      top: previous.y + dy / 2 - 1.5,
      length,
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  });

  return { points: mappedPoints, segments };
}

function projectEventMarkers(eventMarkers: EventMarker[], points: TripRoutePoint[], mappedPoints: Array<{ x: number; y: number }>) {
  return eventMarkers.map(({ event, point }) => {
    const index = points.findIndex(
      (candidate) => candidate.ts === point.ts && candidate.lat === point.lat && candidate.lon === point.lon
    );
    const mappedPoint = mappedPoints[Math.max(index, 0)] ?? mappedPoints[0] ?? { x: 0, y: 0 };
    return { event, ...mappedPoint };
  });
}

function humanizeEventType(eventType: string) {
  return eventType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function eventShortLabel(eventType: string) {
  return humanizeEventType(eventType).slice(0, 1).toUpperCase();
}

function eventTooltip(event: DrivingEvent) {
  return `${humanizeEventType(event.event_type)} - value ${Math.round(event.value)}`;
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

const styles = StyleSheet.create({
  routeCanvasShell: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  statusBanner: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  statusTitle: {
    fontSize: type.caption,
    fontWeight: "800",
  },
  statusText: {
    fontSize: type.caption,
    lineHeight: 18,
  },
  routeCanvas: {
    position: "relative",
    overflow: "hidden",
    borderRadius: radius.sm,
    backgroundColor: "rgba(26, 62, 103, 0.08)",
  },
  routeSegment: {
    position: "absolute",
    height: 3,
    borderRadius: 999,
  },
  routePoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 999,
    borderWidth: 2,
  },
  eventBadge: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
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
  leafletHost: {
    overflow: "hidden",
    borderRadius: radius.md,
  },
});
