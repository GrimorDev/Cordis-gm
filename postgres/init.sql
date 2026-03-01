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
    type        VARCHAR(10)  NOT NULL CHECK (type IN ('text', 'voice')),
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

ALTER TABLE servers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS banner_url  TEXT;

ALTER TABLE messages    ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE messages    ADD COLUMN IF NOT EXISTS reply_to_id    UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS reply_to_id    UUID REFERENCES dm_messages(id) ON DELETE SET NULL;
