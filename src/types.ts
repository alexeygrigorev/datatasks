// --- Task ---

export interface Task {
  id: string;
  description: string;
  date: string;
  status: string;
  source?: string;
  comment?: string | null;
  projectId?: string;
  templateTaskRef?: string;
  recurringConfigId?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Project ---

export interface ProjectLink {
  name: string;
  url: string;
}

export interface Project {
  id: string;
  title?: string;
  name?: string;
  description?: string | null;
  anchorDate?: string;
  templateId?: string;
  links?: ProjectLink[];
  status?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Template ---

export interface TaskDefinition {
  refId: string;
  description: string;
  offsetDays: number;
  instructionsUrl?: string;
}

export interface Template {
  id: string;
  name: string;
  type?: string;
  category?: string;
  taskDefinitions?: TaskDefinition[];
  createdAt: string;
  updatedAt: string;
}

// --- Recurring ---

export interface RecurringConfig {
  id: string;
  description: string;
  schedule: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  projectId?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Lambda ---

export interface LambdaEvent {
  httpMethod: string;
  path: string;
  headers?: Record<string, string> | null;
  body?: string | null;
  queryStringParameters?: Record<string, string> | null;
}

export interface LambdaResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}
