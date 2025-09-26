import { Socket } from 'socket.io';

// Minimal interfaces to avoid circular dependencies
// These match the full interfaces in @apps/sail-socket/src/types/sail-types.ts
export interface ServerContext<X = any> {
  createUUID(): string;
  post(message: object, instanceId: string): Promise<void>;
  open(appId: string): Promise<string>;
  setAppState(app: string, state: any): Promise<void>;
  setInstanceDetails(uuid: string, details: X): void;
  getInstanceDetails(uuid: string): X | undefined;
  getConnectedApps(): Promise<any[]>;
  getAllApps(): Promise<any[]>;
  isAppConnected(app: string): Promise<boolean>;
  log(message: string): void;
}

export interface FDC3Server {
  receive(message: object, from: string): Promise<void>;
  cleanup(instanceId: string): void;
}

import { AppInstanceRegistry } from '../state/AppInstanceRegistry';
import { IntentRegistry } from '../state/IntentRegistry';

// DACP Handler context
export interface DACPHandlerContext {
  messagePort: MessagePort;
  instanceId: string;
  appInstanceRegistry: AppInstanceRegistry;
  intentRegistry: IntentRegistry;
  serverContext: ServerContext<any>; // Generic context
  fdc3Server: FDC3Server; // Generic FDC3 server interface
}

// Log levels for structured logging
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

// Logging utility for DACP handlers
export const logger = {
  error: (message: string, ...args: unknown[]) => {
    console.error(`[DACP ${LogLevel.ERROR}] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[DACP ${LogLevel.WARN}] ${message}`, ...args);
  },
  info: (message: string, ...args: unknown[]) => {
    console.log(`[DACP ${LogLevel.INFO}] ${message}`, ...args);
  },
  debug: (message: string, ...args: unknown[]) => {
    if (process.env.DACP_DEBUG_MODE === 'true') {
      console.log(`[DACP ${LogLevel.DEBUG}] ${message}`, ...args);
    }
  },
};