-- Cordis Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ─────────────────────────────────────────────────────────────
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
    -- User preferences (stored server-side, not localStorage)
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
    avatar_effect           VARCHAR(20)  DEFAULT 'none',
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);

-- ── Servers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS servers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url    TEXT,
    banner_url  TEXT,
    is_official BOOLEAN      DEFAULT FALSE,
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servers_owner ON servers(owner_id);

-- ── Server Members ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS server_members (
    server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    role_name  VARCHAR(50) DEFAULT 'Member',
    joined_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_server_members_user   ON server_members(user_id);
CREATE INDEX IF NOT EXISTS idx_server_members_server ON server_members(server_id);

-- ── Channel Categories ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_categories (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name      VARCHAR(100) NOT NULL,
    position  INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_categories_server ON channel_categories(server_id);

-- ── Channels ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    category_id UUID REFERENCES channel_categories(id) ON DELETE SET NULL,
    name        VARCHAR(100) NOT NULL,
    type        VARCHAR(15)  NOT NULL CHECK (type IN ('text', 'voice', 'forum', 'announcement')),
    description TEXT,
    position    INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channels_server   ON channels(server_id);
CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category_id);

-- ── Messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    sender_id  UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    content    TEXT NOT NULL,
    edited     BOOLEAN     DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_channel    ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender     ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- ── Message Reactions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reactions (
    message_id UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    emoji      VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)
);

-- ── DM Conversations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dm_conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── DM Participants ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dm_participants (
    conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id)            ON DELETE CASCADE,
    last_read_at    TIMESTAMPTZ DEFAULT NULL,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_participants_user ON dm_participants(user_id);

-- ── DM Messages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dm_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id)            ON DELETE CASCADE,
    content         TEXT NOT NULL,
    edited          BOOLEAN     DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_messages_conv    ON dm_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_created ON dm_messages(created_at DESC);

-- ── Friends ───────────────────────────────────────────────────────────
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

-- ── Server Invites ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS server_invites (
    code       VARCHAR(12) PRIMARY KEY,
    server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_server ON server_invites(server_id);

-- ── Updated_at trigger ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Migrations (safe for existing databases) ──────────────────────────
-- Run ALTER TABLE ADD COLUMN IF NOT EXISTS so re-running init.sql on an
-- existing DB adds any missing columns without destroying data.

ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color            VARCHAR(20)  DEFAULT 'indigo';
ALTER TABLE users ADD COLUMN IF NOT EXISTS compact_messages        BOOLEAN      DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_status_visible  BOOLEAN      DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_typing_visible  BOOLEAN      DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_read_receipts   BOOLEAN      DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_friend_requests BOOLEAN      DEFAULT TRUE;

ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_noise_cancel        BOOLEAN     DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS font_size                 VARCHAR(10) DEFAULT 'normal';
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_timestamps           BOOLEAN     DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_chat_avatars         BOOLEAN     DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS message_animations        BOOLEAN     DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_link_previews        BOOLEAN     DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_dm_from_strangers BOOLEAN     DEFAULT TRUE;

ALTER TABLE servers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS banner_url  TEXT;

ALTER TABLE messages    ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE messages    ADD COLUMN IF NOT EXISTS reply_to_id    UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS reply_to_id    UUID REFERENCES dm_messages(id) ON DELETE SET NULL;
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS is_system      BOOLEAN DEFAULT FALSE;

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

-- ── Global Badge System ───────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

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

-- Seed default global badges
INSERT INTO global_badges (name, label, color, icon, description, position) VALUES
  ('developer', 'Developer', '#6366f1', '⚙️', 'Twórca i deweloper systemu Cordyn', 0),
  ('qa',        'QA',        '#f59e0b', '🔬', 'Tester i zapewnienie jakości',       1),
  ('admin',     'Admin',     '#ef4444', '🛡️', 'Administrator systemu',               2),
  ('moderator', 'Moderator', '#10b981', '🔨', 'Moderator społeczności',              3)
ON CONFLICT (name) DO NOTHING;

-- Bootstrap: Grimor becomes admin and gets the developer badge
UPDATE users SET is_admin = TRUE WHERE username = 'Grimor';
INSERT INTO user_badges (user_id, badge_id)
  SELECT u.id, gb.id FROM users u, global_badges gb
  WHERE u.username = 'Grimor' AND gb.name = 'developer'
ON CONFLICT DO NOTHING;

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

-- ── User notes (private, per-viewer) ──────────────────────────────
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
    options        JSONB NOT NULL,      -- [{id, text}]
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
    trigger_type   VARCHAR(32) NOT NULL
                   CHECK (trigger_type IN ('member_join','member_leave','role_assigned','message_contains')),
    trigger_config JSONB DEFAULT '{}',  -- {role_id?, keyword?}
    actions        JSONB NOT NULL DEFAULT '[]',
    created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automations_server ON server_automations(server_id);
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

-- ── Schema migrations for existing deployments ────────────────────
ALTER TABLE servers     ADD COLUMN IF NOT EXISTS accent_color  VARCHAR(32)  DEFAULT 'indigo';
ALTER TABLE servers     ADD COLUMN IF NOT EXISTS banner_color  VARCHAR(64)  DEFAULT 'from-indigo-600 via-violet-600 to-purple-700';
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS pinned        BOOLEAN      DEFAULT false;
