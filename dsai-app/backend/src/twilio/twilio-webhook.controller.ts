import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Headers,
  Res,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { TwilioCallService } from './twilio-call.service';

interface TwilioVoiceWebhookBody {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  ApiVersion: string;
  ForwardedFrom?: string;
  CallerName?: string;
  ParentCallSid?: string;
  CallDuration?: string;
  RecordingUrl?: string;
  RecordingSid?: string;
  RecordingDuration?: string;
}

interface TwilioStatusCallbackBody {
  CallSid: string;
  AccountSid: string;
  CallStatus: string;
  CallDuration?: string;
  Timestamp?: string;
  SequenceNumber?: string;
}

@Controller('twilio/webhook')
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(private readonly twilioCallService: TwilioCallService) {}

  /**
   * Handle incoming voice call from Twilio
   * Twilio expects TwiML response in XML format
   */
  @Post('voice/:numberId')
  async handleVoiceWebhook(
    @Param('numberId') numberId: string,
    @Body() body: TwilioVoiceWebhookBody,
    @Query('callUuid') callUuidFromQuery: string | undefined,
    @Headers('x-twilio-signature') signature: string,
    @Res() res: Response,
  ) {
    this.logger.log(
      `Incoming call: ${body.CallSid} from ${body.From} to ${body.To}`,
    );
    this.logger.debug(`Call details: ${JSON.stringify(body)}`);

    try {
      // TODO: Verify Twilio signature in production
      // const isValid = await this.twilioCallService.verifyWebhookSignature(
      //   numberId,
      //   signature,
      //   `${process.env.PUBLIC_URL}/twilio/webhook/voice/${numberId}`,
      //   body as unknown as Record<string, string>,
      // );
      // if (!isValid) {
      //   this.logger.warn('Invalid Twilio signature');
      //   return res.status(HttpStatus.FORBIDDEN).send('Invalid signature');
      // }

      // Handle the inbound call and get TwiML
      const twiml = await this.twilioCallService.handleInboundCall(
        numberId,
        body.CallSid,
        body.From,
        body.To,
      );

      // Return TwiML response
      res.set('Content-Type', 'text/xml');
      return res.status(HttpStatus.OK).send(twiml);
    } catch (error) {
      this.logger.error('Error handling voice webhook', error);

      // Return error TwiML
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We're sorry, but we encountered an error. Please try again later.</Say>
  <Hangup />
</Response>`;

      res.set('Content-Type', 'text/xml');
      return res.status(HttpStatus.OK).send(errorTwiml);
    }
  }

  /**
   * Handle call status updates from Twilio
   */
  @Post('status/:numberId')
  async handleStatusCallback(
    @Param('numberId') numberId: string,
    @Body() body: TwilioStatusCallbackBody,
    @Headers('x-twilio-signature') signature: string,
  ) {
    this.logger.log(
      `Status callback: ${body.CallSid} -> ${body.CallStatus}`,
    );

    try {
      await this.twilioCallService.handleStatusCallback(
        numberId,
        body.CallSid,
        body.CallStatus,
        body.CallDuration,
      );

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Error handling status callback', error);
      // Still return OK to acknowledge receipt
      return { status: 'ok' };
    }
  }

  /**
   * Handle recording status callback
   */
  @Post('recording/:numberId')
  async handleRecordingCallback(
    @Param('numberId') numberId: string,
    @Body() body: TwilioVoiceWebhookBody,
    @Headers('x-twilio-signature') signature: string,
  ) {
    this.logger.log(
      `Recording callback: ${body.CallSid}, URL: ${body.RecordingUrl}`,
    );

    // TODO: Download and store recording
    // This would integrate with the RecordingsService

    return { status: 'ok' };
  }

  /**
   * Health check endpoint for Twilio webhook verification
   */
  @Get('health')
  healthCheck() {
    return { status: 'ok', service: 'twilio-webhook' };
  }
}
