import { Injectable, Logger } from '@nestjs/common';
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import * as fs from 'node:fs';
import * as path from 'node:path';

@Injectable()
export class FcmService {
  private readonly logger = new Logger('FcmService');
  private app: App | null = null;

  constructor() {
    try {
      const keyPath = path.resolve(process.cwd(), 'service-account.json');
      if (fs.existsSync(keyPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        this.app = initializeApp({
          credential: cert(serviceAccount),
        });
        this.logger.log('Firebase Admin SDK initialized successfully for FCM push notifications.');
      } else {
        this.logger.warn('service-account.json not found; FCM push notifications disabled.');
      }
    } catch (err: any) {
      this.logger.error(`Failed to initialize Firebase Admin SDK: ${err?.message}`);
    }
  }

  async sendPushNotification(params: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    if (!this.app || !params.token) return;

    try {
      const messaging = getMessaging(this.app);
      await messaging.send({
        token: params.token,
        notification: {
          title: params.title,
          body: params.body,
        },
        data: params.data ?? {},
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
            priority: 'high',
            visibility: 'public',
          },
        },
      });
      this.logger.log(`FCM push sent successfully to token ${params.token.slice(0, 12)}...`);
    } catch (err: any) {
      this.logger.warn(`Failed to send FCM push notification: ${err?.message}`);
    }
  }
}
