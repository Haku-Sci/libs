import { RemoteServiceException } from './remote-service.exception';

// Error format shared by every layer of a call: each layer keeps its own stack, and the error it
// received from the service it called is nested in `cause`. The logs service unwinds the chain.
export interface HakuError {
  service?: string;
  message: string;
  status?: number;
  /** The error's own code, when it has one (e.g. Node's ECONNREFUSED). */
  code?: string;
  stack?: string;
  cause?: HakuError;
}

// Builds a layer from a caught error; an error received from a TCP call becomes its cause.
// `service` may be left out when the caller stamps it (TCPService does so for the service it called).
export function toHakuError(error: any, service?: string): HakuError {
  return {
    service,
    message: error?.message ?? String(error),
    status: error?.getStatus?.() ?? error?.status ?? error?.statusCode,
    // A relayed error keeps its code in its own layer (cause), not lifted into this one.
    code: error?.code ?? (error instanceof RemoteServiceException ? undefined : error?.getResponse?.()?.code),
    stack: error?.stack,
    cause: error instanceof RemoteServiceException ? (error.getResponse() as HakuError) : undefined,
  };
}
