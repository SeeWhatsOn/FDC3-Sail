import { Socket } from 'socket.io';
import { ServerContext, FDC3Server } from '@finos/fdc3-sail-shared';

// DACP Handler context
export interface DACPHandlerContext {
  messagePort: MessagePort;
  serverContext: ServerContext<any>; // Generic context
  fdc3Server: FDC3Server; // Generic FDC3 server interface
  socket: Socket;
  connectionState: {
    authenticated: boolean;
    userId: string;
    socketType: undefined;
  };
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