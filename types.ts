export interface HealthDataPoint {
  timestamp: string;
  systolic: number;
  diastolic: number;
  glucose: number;
  heartRate: number;
}

export interface HealthAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  message: string;
  timestamp: string;
}

export enum AppTab {
  DASHBOARD = 'dashboard',
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
}