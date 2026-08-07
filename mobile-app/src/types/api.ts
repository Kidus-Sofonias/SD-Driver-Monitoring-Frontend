export type ApiEnvelope<T> = {
  message_key: string;
  data: T;
  errors?: Array<Record<string, unknown>> | null;
  request_id?: string | null;
};

export type User = {
  id: string;
  email: string;
  role: string;
  is_admin: boolean;
};

export type AdminDriver = {
  id: string;
  email: string;
  role: string;
  trip_count: number;
  latest_trip_at?: string | null;
};

export type DriverTrendPoint = {
  period_start: string;
  period_end: string;
  label: string;
  average_score: number | null;
  trip_count: number;
  high_risk_trip_count: number;
};

export type DriverTrendSnapshot = {
  label: string;
  average_score: number | null;
  trip_count: number;
  high_risk_trip_count: number;
};

export type DriverTrendWindow = {
  current: DriverTrendSnapshot;
  previous: DriverTrendSnapshot;
  delta_score: number | null;
  direction: "up" | "down" | "flat";
  points: DriverTrendPoint[];
};

export type DriverInsights = {
  driver_id: string;
  driver_email: string;
  overall_average_score: number | null;
  scored_trip_count: number;
  high_risk_trip_count: number;
  weekly: DriverTrendWindow;
  monthly: DriverTrendWindow;
};

export type TokenData = {
  access_token: string;
  token_type: string;
  expires_in_seconds: number;
};

export type AuthPayload = {
  user: User;
  token: TokenData;
};

export type HealthPayload = {
  service: string;
  env: string;
  version: string;
};

export type DrivingEvent = {
  id: number;
  trip_id: string;
  event_type: string;
  value: number;
  occurred_at?: string | null;
  lat?: number | null;
  lon?: number | null;
  created_at: string;
};

export type Trip = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  score?: number | null;
  risk_level?: string | null;
  risk_probability?: number | null;
  confidence?: number | null;
  confidence_band?: string | null;
  confidence_display?: string | null;
  feature_version?: string | null;
  model_version?: string | null;
  processed_at?: string | null;
};

export type TripDetail = Trip & {
  decision_source?: string | null;
  raw_deleted?: boolean | null;
  already_processed?: boolean | null;
  ml_blend_weight?: number | null;
  reasons: string[];
  events: DrivingEvent[];
  breakdown: Record<string, unknown>;
  trip_features: Record<string, unknown>;
  events_generated?: number | null;
};

export type FinalizeTrip = {
  trip_id: string;
  score: number | null;
  risk_level?: string | null;
  risk_probability?: number | null;
  ml_blend_weight?: number | null;
  confidence?: number | null;
  confidence_band?: string | null;
  confidence_display?: string | null;
  model_version?: string | null;
  feature_version?: string | null;
  decision_source?: string | null;
  processing_timestamp?: string | null;
  raw_deleted?: boolean | null;
  already_processed?: boolean | null;
  reasons: string[];
  events: DrivingEvent[];
  breakdown: Record<string, unknown>;
  trip_features: Record<string, unknown>;
  events_generated?: number | null;
};

export type ReviewDashboardItem = {
  trip_id: string;
  driver_user_id?: string | null;
  driver_email?: string | null;
  score?: number | null;
  risk_level?: string | null;
  risk_probability?: number | null;
  ml_blend_weight?: number | null;
  confidence?: number | null;
  confidence_band?: string | null;
  confidence_display?: string | null;
  rule_score?: number | null;
  predicted_label?: number | null;
  reasons: string[];
  generated_events: DrivingEvent[];
  trip_events: DrivingEvent[];
  generated_event_count: number;
  trip_event_count: number;
  review_label?: number | null;
  review_label_source?: string | null;
  review_disagrees_with_prediction?: boolean | null;
  model_version?: string | null;
  feature_version?: string | null;
  processed_at?: string | null;
  reviewed_at?: string | null;
};

export type ReviewTrip = {
  trip_id: string;
  driver_user_id?: string | null;
  driver_email?: string | null;
  score?: number | null;
  risk_level?: string | null;
  risk_probability?: number | null;
  ml_blend_weight?: number | null;
  confidence?: number | null;
  confidence_band?: string | null;
  confidence_display?: string | null;
  feature_version?: string | null;
  model_version?: string | null;
  processed_at?: string | null;
  trip_features: Record<string, unknown>;
  rule_score?: number | null;
  ml_prediction?: number | null;
  predicted_label?: number | null;
  reasons: string[];
  events: DrivingEvent[];
  reviewed_label?: number | null;
  reviewed_label_source?: string | null;
  review_disagrees_with_prediction?: boolean | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
};

export type TripRoutePoint = {
  ts: string;
  lat: number;
  lon: number;
  speed_mps?: number | null;
  accuracy_m?: number | null;
};

export type TripRoute = {
  trip_id: string;
  driver_user_id: string;
  point_count: number;
  points: TripRoutePoint[];
  snapped_points?: TripRoutePoint[];
  snapped_source?: string | null;
  snapped_status?: string | null;
};

export type SensorSample = {
  timestamp: string;
  speed: number | null;
  lat: number;
  lon: number;
  accuracy_m: number;
  altitude_m?: number | null;
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
};

export type TripSampleCount = {
  trip_id: string;
  count: number;
};

export type LiveAlertEvent = {
  event_type: string;
  value: number;
  occurred_at?: string | null;
  lat?: number | null;
  lon?: number | null;
};

export type LiveAlertMessage = {
  type: "connected" | "event_alert" | "ping";
  trip_id?: string | null;
  event?: LiveAlertEvent | null;
  sent_at?: string | null;
};

export type Session = {
  user: User;
  token: TokenData;
};
