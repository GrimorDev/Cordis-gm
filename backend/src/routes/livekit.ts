import { Router } from 'express';
import { AccessToken, VideoGrant } from 'livekit-server-sdk';
import { authMiddleware } from '../middleware/auth';
import { config } from '../config';

const router = Router();

/**
 * POST /api/livekit/token
 * Returns a short-lived LiveKit access token for the authenticated user.
 *
 * Body:
 *   roomName   — e.g. "channel:abc123" or "dm:user1-user2"
 *   canPublish — true if this client will be sending tracks (sharer); false for viewers
 *
 * The token embeds identity=userId and name=username so LiveKit
 * shows the correct display name in room analytics.
 */
router.post('/token', authMiddleware, async (req, res) => {
  try {
    const { roomName, canPublish = false } = req.body as {
      roomName?: string;
      canPublish?: boolean;
    };

    if (!roomName || typeof roomName !== 'string') {
      return res.status(400).json({ error: 'roomName is required' });
    }
    // Sanitise room name — only allow safe characters
    if (!/^[\w:\-\.]+$/.test(roomName)) {
      return res.status(400).json({ error: 'invalid roomName' });
    }

    const user = (req as any).user as { id: string | number; username: string };

    const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
      identity: String(user.id),
      name:     user.username,
      ttl:      '2h',
    });

    const grant: VideoGrant = {
      roomJoin:      true,
      room:          roomName,
      canPublish:    Boolean(canPublish),
      canSubscribe:  true,
      canPublishData: false,
    };
    at.addGrant(grant);

    const token = await at.toJwt();
    res.json({ token });
  } catch (err) {
    console.error('[LiveKit] token generation failed:', err);
    res.status(500).json({ error: 'Failed to generate LiveKit token' });
  }
});

export default router;
