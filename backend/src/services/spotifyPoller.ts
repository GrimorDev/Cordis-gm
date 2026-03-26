import { query } from '../db/pool';
import { Server as SocketServer } from 'socket.io';

const CLIENT_ID     = (process.env.SPOTIFY_CLIENT_ID     || '').trim();
const CLIENT_SECRET = (process.env.SPOTIFY_CLIENT_SECRET || '').trim();

// Mirror of getValidAccessToken from routes/spotify.ts
async function getValidAccessToken(userId: string): Promise<string | null> {
  const { rows } = await query(
    `SELECT spotify_access_token, spotify_refresh_token, spotify_token_expires
     FROM users WHERE id=$1`, [userId]
  );
  if (!rows[0]?.spotify_access_token) return null;

  const expiry = rows[0].spotify_token_expires ? new Date(rows[0].spotify_token_expires) : null;
  if (!expiry || expiry > new Date(Date.now() + 60_000)) {
    return rows[0].spotify_access_token;
  }

  if (!rows[0].spotify_refresh_token) return null;
  try {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: rows[0].spotify_refresh_token,
    });
    const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!r.ok) return null;
    const data: any = await r.json();
    const newExpiry = new Date(Date.now() + data.expires_in * 1000);
    if (data.refresh_token) {
      await query(
        `UPDATE users SET spotify_access_token=$1, spotify_token_expires=$2, spotify_refresh_token=$3 WHERE id=$4`,
        [data.access_token, newExpiry, data.refresh_token, userId]
      );
    } else {
      await query(
        `UPDATE users SET spotify_access_token=$1, spotify_token_expires=$2 WHERE id=$3`,
        [data.access_token, newExpiry, userId]
      );
    }
    return data.access_token;
  } catch {
    return null;
  }
}

// Last known track per user — avoids redundant broadcasts when track hasn't changed
const lastTrackKey = new Map<string, string>();

async function pollOnce(io: SocketServer): Promise<void> {
  // Fetch all users with Spotify connected and visible
  const { rows: users } = await query(
    `SELECT id FROM users
     WHERE spotify_access_token IS NOT NULL AND spotify_show_on_profile IS NOT FALSE`
  );

  for (const { id: userId } of users) {
    try {
      const token = await getValidAccessToken(userId);
      if (!token) continue;

      const r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      let track: any = null;
      if (r.status !== 204 && r.ok) {
        const data: any = await r.json();
        if (data?.item && data.is_playing) {
          track = {
            name:         data.item.name,
            artists:      data.item.artists?.map((a: any) => a.name).join(', ') || '',
            album_cover:  data.item.album?.images?.[0]?.url || null,
            external_url: data.item.external_urls?.spotify || null,
            progress_ms:  data.progress_ms ?? null,
            duration_ms:  data.item.duration_ms ?? null,
          };
        }
      }

      // Skip broadcast if nothing changed (compare name+artists as fingerprint)
      const fingerprint = track ? `${track.name}|${track.artists}` : 'null';
      if (lastTrackKey.get(userId) === fingerprint) continue;
      lastTrackKey.set(userId, fingerprint);

      const progress_captured_at = Date.now();

      // Broadcast to all server rooms this user belongs to
      const { rows: serverRows } = await query(
        `SELECT server_id FROM server_members WHERE user_id = $1`, [userId]
      );
      for (const { server_id } of serverRows) {
        io.to(`server:${server_id}`).emit('friend_spotify_update', {
          user_id: userId, track, progress_captured_at,
        });
      }

      // Also broadcast to friends in DM context
      const { rows: friendRows } = await query(
        `SELECT CASE WHEN requester_id=$1 THEN addressee_id ELSE requester_id END AS friend_id
         FROM friends WHERE (requester_id=$1 OR addressee_id=$1) AND status='accepted'`,
        [userId]
      );
      for (const { friend_id } of friendRows) {
        io.to(`user:${friend_id}`).emit('friend_spotify_update', {
          user_id: userId, track, progress_captured_at,
        });
      }
    } catch {
      // Ignore individual user errors — don't block the rest of the poll
    }
  }
}

export function startSpotifyPoller(io: SocketServer): void {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log('[SpotifyPoller] Spotify not configured, skipping server-side polling');
    return;
  }

  const INTERVAL_MS = 30_000; // 30 seconds

  // Initial poll after a short delay to let DB/Redis finish initializing
  setTimeout(() => {
    pollOnce(io).catch(err => console.error('[SpotifyPoller] initial poll error:', err));
  }, 8_000);

  setInterval(() => {
    pollOnce(io).catch(err => console.error('[SpotifyPoller] poll error:', err));
  }, INTERVAL_MS);

  console.log(`[SpotifyPoller] Server-side Spotify polling started (every ${INTERVAL_MS / 1000}s)`);
}
