import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { TwilioMediaStreamGateway } from './twilio/twilio-media-stream.gateway';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const frontendUrl =
    configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  // Add no-cache headers to all API responses to ensure fresh data
  app.use((req: any, res: any, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = Number(configService.get('PORT')) || 3001;
  await app.listen(port);

  // Initialize Twilio Media Stream WebSocket server
  const httpServer = app.getHttpServer();
  const mediaStreamGateway = app.get(TwilioMediaStreamGateway);
  mediaStreamGateway.initializeWebSocket(httpServer);
}
bootstrap();
