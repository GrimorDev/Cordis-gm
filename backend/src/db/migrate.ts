import { pool } from './pool';

const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(32)  UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url    TEXT,
    banner_url    TEXT,
    banner_color  VARCHAR(200) DEFAULT 'from-indigo-500 via-purple-500 to-pink-500',
    bio           TEXT,
    custom_status VARCHAR(128),
    status        VARCHAR(20)  DEFAULT 'offline'
                  CHECK (status IN ('online', 'idle', 'dnd', 'offline')),
    accent_color            VARCHAR(20)  DEFAULT 'indigo',
    compact_messages        BOOLEAN      DEFAULT FALSE,
    privacy_status_visible  BOOLEAN      DEFAULT TRUE,
    privacy_typing_visible  BOOLEAN      DEFAULT TRUE,
    privacy_read_receipts   BOOLEAN      DEFAULT FALSE,
    privacy_friend_requests BOOLEAN      DEFAULT TRUE,
    voice_noise_cancel      BOOLEAN      DEFAULT TRUE,
    font_size               VARCHAR(10)  DEFAULT 'normal',
    show_timestamps         BOOLEAN      DEFAULT FALSE,
    show_chat_avatars       BOOLEAN      DEFAULT TRUE,
    message_animations      BOOLEAN      DEFAULT TRUE,
    show_link_previews      BOOLEAN      DEFAULT TRUE,
    privacy_dm_from_strangers BOOLEAN    DEFAULT TRUE,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);

CREATE TABLE IF NOT EXISTS servers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url    TEXT,
    banner_url  TEXT,
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_servers_owner ON servers(owner_id);

CREATE TABLE IF NOT EXISTS server_members (
    server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    role_name  VARCHAR(50) DEFAULT 'Member',
    joined_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (server_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_server_members_user   ON server_members(user_id);
CREATE INDEX IF NOT EXISTS idx_server_members_server ON server_members(server_id);

CREATE TABLE IF NOT EXISTS server_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL,
    color       VARCHAR(20) DEFAULT '#5865f2',
    permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
    position    INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_roles_server ON server_roles(server_id);

CREATE TABLE IF NOT EXISTS member_roles (
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    role_id   UUID NOT NULL REFERENCES server_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (server_id, user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_member_roles_user ON member_roles(user_id, server_id);

CREATE TABLE IF NOT EXISTS channel_categories (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name      VARCHAR(100) NOT NULL,
    position  INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_categories_server ON channel_categories(server_id);

CREATE TABLE IF NOT EXISTS channels (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    category_id UUID REFERENCES channel_categories(id) ON DELETE SET NULL,
    name        VARCHAR(100) NOT NULL,
    type        VARCHAR(15)  NOT NULL CHECK (type IN ('text', 'voice', 'forum', 'announcement')),
    description TEXT,
    is_private  BOOLEAN DEFAULT FALSE,
    position    INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id  UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    content     TEXT NOT NULL,
    image_url   TEXT,
    pinned      BOOLEAN DEFAULT FALSE,
    locked      BOOLEAN DEFAULT FALSE,
    reply_count INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forum_posts_channel ON forum_posts(channel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS forum_replies (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id    UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
    author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON forum_replies(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_channels_server   ON channels(server_id);
CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category_id);

CREATE TABLE IF NOT EXISTS channel_role_access (
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    role_id    UUID NOT NULL REFERENCES server_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (channel_id, role_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id     UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    sender_id      UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    content        TEXT NOT NULL,
    edited         BOOLEAN     DEFAULT FALSE,
    reply_to_id    UUID REFERENCES messages(id) ON DELETE SET NULL,
    attachment_url TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_channel    ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender     ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

CREATE TABLE IF NOT EXISTS message_reactions (
    message_id UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    emoji      VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS dm_conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dm_participants (
    conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id)            ON DELETE CASCADE,
    PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_dm_participants_user ON dm_participants(user_id);

CREATE TABLE IF NOT EXISTS dm_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id)            ON DELETE CASCADE,
    content         TEXT NOT NULL,
    edited          BOOLEAN     DEFAULT FALSE,
    reply_to_id     UUID REFERENCES dm_messages(id) ON DELETE SET NULL,
    attachment_url  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dm_messages_conv    ON dm_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_created ON dm_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS friends (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       VARCHAR(20) DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friends_requester ON friends(requester_id);
CREATE INDEX IF NOT EXISTS idx_friends_addressee ON friends(addressee_id);

CREATE TABLE IF NOT EXISTS server_invites (
    code       VARCHAR(12) PRIMARY KEY,
    server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invites_server ON server_invites(server_id);

-- Add columns for existing deployments (idempotent via exception handling)
DO $$ BEGIN ALTER TABLE users       ADD COLUMN banner_url    TEXT;                                                          EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE servers     ADD COLUMN description   TEXT;                                                          EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE servers     ADD COLUMN banner_url    TEXT;                                                          EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE channels    ADD COLUMN is_private    BOOLEAN DEFAULT FALSE;                                         EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE messages    ADD COLUMN reply_to_id   UUID REFERENCES messages(id) ON DELETE SET NULL;               EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE messages    ADD COLUMN attachment_url TEXT;                                                         EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE dm_messages ADD COLUMN reply_to_id   UUID REFERENCES dm_messages(id) ON DELETE SET NULL;           EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE dm_messages ADD COLUMN attachment_url TEXT;                                                        EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN accent_color            VARCHAR(20)  DEFAULT 'indigo'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN compact_messages        BOOLEAN      DEFAULT FALSE;    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN privacy_status_visible  BOOLEAN      DEFAULT TRUE;     EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN privacy_typing_visible  BOOLEAN      DEFAULT TRUE;     EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN privacy_read_receipts   BOOLEAN      DEFAULT FALSE;    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN privacy_friend_requests BOOLEAN      DEFAULT TRUE;     EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN voice_noise_cancel        BOOLEAN      DEFAULT TRUE;     EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN font_size                 VARCHAR(10)  DEFAULT 'normal'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN show_timestamps           BOOLEAN      DEFAULT FALSE;    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN show_chat_avatars         BOOLEAN      DEFAULT TRUE;     EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN message_animations        BOOLEAN      DEFAULT TRUE;     EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN show_link_previews        BOOLEAN      DEFAULT TRUE;     EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN privacy_dm_from_strangers BOOLEAN      DEFAULT TRUE;     EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN avatar_effect            VARCHAR(20)  DEFAULT 'none';   EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE servers ADD COLUMN is_official            BOOLEAN      DEFAULT FALSE;    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE dm_messages ADD COLUMN is_system BOOLEAN DEFAULT FALSE;                   EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE dm_participants ADD COLUMN last_read_at TIMESTAMPTZ DEFAULT NULL;          EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS server_activity (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,
    username   VARCHAR(64),
    icon       VARCHAR(10) NOT NULL DEFAULT '📋',
    text       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_server_activity ON server_activity(server_id, created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN CREATE TRIGGER users_updated_at    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Email verification
DO $$ BEGIN ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
-- Existing users are auto-verified (they registered before this feature)
UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL OR email_verified = FALSE;

CREATE TABLE IF NOT EXISTS email_verifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      VARCHAR(255) NOT NULL,
    code       VARCHAR(20)  NOT NULL,
    used       BOOLEAN      DEFAULT FALSE,
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_verif_email ON email_verifications(email, created_at DESC);

-- Default role flag
DO $$ BEGIN ALTER TABLE server_roles ADD COLUMN is_default BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Private categories
DO $$ BEGIN ALTER TABLE channel_categories ADD COLUMN is_private BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS category_role_access (
    category_id UUID NOT NULL REFERENCES channel_categories(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES server_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (category_id, role_id)
);

-- Forum/announcement channel types (existing deployments)
DO $$ BEGIN
  ALTER TABLE channels ALTER COLUMN type TYPE VARCHAR(15);
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_type_check;
  ALTER TABLE channels ADD CONSTRAINT channels_type_check CHECK (type IN ('text', 'voice', 'forum', 'announcement'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS forum_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id  UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    content     TEXT NOT NULL,
    image_url   TEXT,
    pinned      BOOLEAN DEFAULT FALSE,
    locked      BOOLEAN DEFAULT FALSE,
    reply_count INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forum_posts_channel ON forum_posts(channel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS forum_replies (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id    UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
    author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON forum_replies(post_id, created_at);

-- Mentions/pings: !username in messages
CREATE TABLE IF NOT EXISTS message_mentions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id)  ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES channels(id)  ON DELETE CASCADE,
    server_id  UUID NOT NULL REFERENCES servers(id)   ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_mentions_user    ON message_mentions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_channel ON message_mentions(channel_id, user_id);

-- Ban system
CREATE TABLE IF NOT EXISTS server_bans (
    server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    banned_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    reason     TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (server_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_server_bans_server ON server_bans(server_id);

-- Channel & category ordering (drag-and-drop reorder)
DO $$ BEGIN ALTER TABLE channel_categories ADD COLUMN position INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE channels           ADD COLUMN position INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Slow mode per channel
DO $$ BEGIN ALTER TABLE channels ADD COLUMN slowmode_seconds INT DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Pinned messages in text channels
DO $$ BEGIN ALTER TABLE messages ADD COLUMN pinned BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Global badge system
DO $$ BEGIN ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS global_badges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) UNIQUE NOT NULL,
    label       VARCHAR(100) NOT NULL,
    color       VARCHAR(20) DEFAULT '#6366f1',
    icon        VARCHAR(10) DEFAULT '🔵',
    description TEXT,
    position    INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS user_badges (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id    UUID NOT NULL REFERENCES global_badges(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);

INSERT INTO global_badges (name, label, color, icon, description, position) VALUES
  ('developer', 'Developer', '#6366f1', '⚙️', 'Twórca i deweloper systemu Cordyn', 0),
  ('qa',        'QA',        '#f59e0b', '🔬', 'Tester i zapewnienie jakości',       1),
  ('admin',     'Admin',     '#ef4444', '🛡️', 'Administrator systemu',               2),
  ('moderator', 'Moderator', '#10b981', '🔨', 'Moderator społeczności',              3)
ON CONFLICT (name) DO NOTHING;

UPDATE users SET is_admin = TRUE WHERE username = 'Grimor';
INSERT INTO user_badges (user_id, badge_id)
  SELECT u.id, gb.id FROM users u, global_badges gb
  WHERE u.username = 'Grimor' AND gb.name = 'developer'
ON CONFLICT DO NOTHING;

-- ── User blocks (per-user blocking) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

-- ── Global platform bans (admin-issued) ──────────────────────────────
CREATE TABLE IF NOT EXISTS user_bans (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banned_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    reason       TEXT,
    ban_type     VARCHAR(20) NOT NULL DEFAULT 'permanent'
                 CHECK (ban_type IN ('permanent', 'temporary', 'ip')),
    banned_until TIMESTAMPTZ,
    ip_address   TEXT,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_bans_user ON user_bans(user_id, is_active);

-- ── User favorite games ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_favorite_games (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_name      VARCHAR(255) NOT NULL,
    game_cover_url TEXT,
    game_genre     VARCHAR(100),
    rawg_id        INT,
    display_order  INT DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_games_user ON user_favorite_games(user_id);

-- ── Spotify connection ────────────────────────────────────────────────
DO $$ BEGIN ALTER TABLE users ADD COLUMN spotify_access_token   TEXT;        EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN spotify_refresh_token  TEXT;        EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN spotify_token_expires  TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN spotify_user_id        VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN spotify_display_name   VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN spotify_show_on_profile BOOLEAN DEFAULT TRUE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ── Steam connection (OpenID — no OAuth tokens, just steam_id) ────────
DO $$ BEGIN ALTER TABLE users ADD COLUMN steam_id VARCHAR(64); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN steam_display_name VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN steam_avatar_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN steam_show_on_profile BOOLEAN DEFAULT TRUE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ── Twitch connection (OAuth 2.0) ─────────────────────────────────────
DO $$ BEGIN ALTER TABLE users ADD COLUMN twitch_user_id VARCHAR(64); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN twitch_login VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN twitch_display_name VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN twitch_access_token TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN twitch_refresh_token TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN twitch_token_expires TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN twitch_show_on_profile BOOLEAN DEFAULT TRUE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ── Two-Factor Authentication (2FA) ──────────────────────────────────────────
DO $$ BEGIN ALTER TABLE users ADD COLUMN totp_secret TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN totp_backup_codes TEXT[] DEFAULT ARRAY[]::TEXT[]; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN phone_number VARCHAR(30); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ── Custom server emojis ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS server_emojis (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name        VARCHAR(32) NOT NULL
                CHECK (name ~ '^[a-zA-Z0-9_]{2,32}$'),
    image_url   TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(server_id, name)
);

-- ── User notes (private) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_notes (
    noter_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    noted_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (noter_id, noted_id)
);

-- ── Polls ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS polls (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id     UUID REFERENCES messages(id) ON DELETE CASCADE,
    dm_message_id  UUID REFERENCES dm_messages(id) ON DELETE CASCADE,
    question       TEXT NOT NULL,
    options        JSONB NOT NULL,
    multi_vote     BOOLEAN DEFAULT false,
    ends_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id    UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_id  TEXT NOT NULL,
    voted_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (poll_id, user_id, option_id)
);

-- ── Server automations ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS server_automations (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id      UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name           VARCHAR(100) NOT NULL,
    enabled        BOOLEAN DEFAULT true,
    trigger_type   VARCHAR(32) NOT NULL,
    trigger_config JSONB DEFAULT '{}',
    actions        JSONB NOT NULL DEFAULT '[]',
    created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automations_server  ON server_automations(server_id);
CREATE INDEX IF NOT EXISTS idx_automations_trigger ON server_automations(server_id, trigger_type) WHERE enabled = true;

-- ── PWA push subscriptions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

-- ── Column migrations for existing deployments ────────────────────
DO $$ BEGIN ALTER TABLE servers     ADD COLUMN accent_color  VARCHAR(32) DEFAULT 'indigo';                                             EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE servers     ADD COLUMN banner_color  VARCHAR(64) DEFAULT 'from-indigo-600 via-violet-600 to-purple-700';       EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE dm_messages ADD COLUMN pinned        BOOLEAN     DEFAULT false;                                                 EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE messages    ADD COLUMN is_automated  BOOLEAN     DEFAULT false;                                                 EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE messages    ADD COLUMN system_name   TEXT;                                                                     EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE messages    ADD COLUMN system_avatar TEXT;                                                                     EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ── Channel read state (unread counts per user per channel) ───────────
CREATE TABLE IF NOT EXISTS channel_read_state (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id   UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_read_state_user ON channel_read_state(user_id);

-- ── Stored notifications (persists pings/mentions across sessions) ────
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         VARCHAR(32) NOT NULL,  -- 'mention' | 'everyone' | 'dm' | 'friend_request'
  message_id   UUID REFERENCES messages(id) ON DELETE CASCADE,
  channel_id   UUID REFERENCES channels(id) ON DELETE SET NULL,
  server_id    UUID REFERENCES servers(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content      TEXT,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ── Member warnings (moderation bot) ────────────────────────────────
CREATE TABLE IF NOT EXISTS member_warnings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    warned_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    reason     TEXT DEFAULT 'Brak powodu',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_warnings ON member_warnings(server_id, user_id, created_at DESC);

-- ── Bot system ─────────────────────────────────────────────────────
DO $$ BEGIN ALTER TABLE users ADD COLUMN is_bot BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS server_bots (
    server_id    UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    bot_id       VARCHAR(64) NOT NULL,
    channel_id   UUID REFERENCES channels(id) ON DELETE SET NULL,
    installed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (server_id, bot_id)
);
CREATE INDEX IF NOT EXISTS idx_server_bots_server ON server_bots(server_id);
DO $$ BEGIN ALTER TABLE servers ADD COLUMN bot_channel_id UUID REFERENCES channels(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Server tag system
CREATE TABLE IF NOT EXISTS server_tags (
    server_id   UUID PRIMARY KEY REFERENCES servers(id) ON DELETE CASCADE,
    tag         VARCHAR(4) NOT NULL CHECK (char_length(tag) BETWEEN 2 AND 4),
    color       VARCHAR(32),
    icon        VARCHAR(32),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN ALTER TABLE users ADD COLUMN active_tag_server_id UUID REFERENCES servers(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN theme_id VARCHAR(32) DEFAULT 'default'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
-- Tag color & icon for existing deployments
DO $$ BEGIN ALTER TABLE server_tags ADD COLUMN color VARCHAR(32); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE server_tags ADD COLUMN icon  VARCHAR(32); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
-- Preferred status persists across restarts
DO $$ BEGIN ALTER TABLE users ADD COLUMN preferred_status VARCHAR(20) DEFAULT 'online'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Storage tracking
DO $$ BEGIN ALTER TABLE users ADD COLUMN storage_used_bytes BIGINT DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN storage_quota_bytes BIGINT DEFAULT 52428800; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN is_premium BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Migracja URLi: przepisz stare pub-*.r2.dev URLs na /api/files/ proxy
UPDATE messages SET attachment_url = REPLACE(attachment_url, 'https://pub-3f56fb1df8af4fcbb4f843cebfe0bf42.r2.dev/', '/api/files/')
  WHERE attachment_url LIKE 'https://pub-3f56fb1df8af4fcbb4f843cebfe0bf42.r2.dev/%';
UPDATE dm_messages SET attachment_url = REPLACE(attachment_url, 'https://pub-3f56fb1df8af4fcbb4f843cebfe0bf42.r2.dev/', '/api/files/')
  WHERE attachment_url LIKE 'https://pub-3f56fb1df8af4fcbb4f843cebfe0bf42.r2.dev/%';
UPDATE attachments SET url = REPLACE(url, 'https://pub-3f56fb1df8af4fcbb4f843cebfe0bf42.r2.dev/', '/api/files/')
  WHERE url LIKE 'https://pub-3f56fb1df8af4fcbb4f843cebfe0bf42.r2.dev/%';

-- Attachments table (tracks files on R2 for quota + deletion)
CREATE TABLE IF NOT EXISTS attachments (
  id            SERIAL PRIMARY KEY,
  message_id    INT,
  dm_message_id INT,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  r2_key        TEXT NOT NULL,
  url           TEXT NOT NULL,
  file_size     BIGINT NOT NULL,
  mime_type     VARCHAR(128),
  original_name VARCHAR(255),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attachments_user    ON attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_r2key   ON attachments(r2_key);
CREATE INDEX IF NOT EXISTS idx_attachments_msg     ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_dm_msg  ON attachments(dm_message_id);
`;

const SEED_SQL = `
INSERT INTO users (username, email, password_hash, banner_color, bio, custom_status, status)
VALUES (
  'Grimor', 'grimor@cordis.app',
  '$2a$12$Cpy0VyndtconFOwaAeoeQuefj9MUopM4BLDw.c1FOUrD/BX5gzH1G',
  'from-violet-600 via-indigo-600 to-blue-600',
  'Cordis Developer – twórca systemu.', 'Building Cordis 🚀', 'offline'
) ON CONFLICT (username) DO NOTHING;
`;

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('Running database migrations...');
    await client.query(SCHEMA_SQL);
    await client.query(SEED_SQL);
    console.log('Migrations complete.');
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  } finally {
    client.release();
  }
}
