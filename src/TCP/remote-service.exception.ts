import { HttpException } from '@nestjs/common';

// Raised by TCPService.sendMessage when the called handler failed: its response is the HakuError the
// called service returned, and its stack points at the code that made the call.
export class RemoteServiceException extends HttpException { }
