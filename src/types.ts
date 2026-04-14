export interface SurveyResponse {
  id?: string;
  timestamp: string;
  date: string;
  time: string;
  ip: string;
  city: string;
  region: string;
  country: string;
  ip_lat: string;
  ip_lon: string;
  isp: string;
  gps_lat: string;
  gps_lon: string;
  gps_accuracy_m: string;
  device: string;
  browser: string;
  age_group: string;
  name: string;
  gender: string;
  role: string;
  social_type: string;
  fear_types: string;
  fear_age: string;
  childhood_fear: string;
  physical_reactions: string;
  missed_opportunity: string;
  behaviour_change: string;
  fear_meter: string;
  fear_profile: string;
  confident_also_fear: string;
  self_identity: string;
  scenario_speech: string;
  scenario_competition: string;
  scenario_criticism: string;
  overcome_fear: string;
  overcome_method: string;
  confidence_gained: string;
  belief_conquer: string;
  confession: string;
  agree_statement: string;
  douglas_response: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
