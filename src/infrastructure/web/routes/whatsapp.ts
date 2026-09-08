import { Router } from 'express';
import { twilioInboundSchema } from '../../../application/dtos/RequestDtos';
import { WhatsAppWebhookController } from '../controllers/WhatsAppWebhookController';
import { validateBody } from '../middleware/validate';

export const createWhatsAppRouter = (controller: WhatsAppWebhookController): Router => {
  const router = Router();
  router.post('/webhook', validateBody(twilioInboundSchema), controller.inbound);
  return router;
};
