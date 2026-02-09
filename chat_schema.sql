-- ═══════════════════════════════════════════════════════════════════════════
-- DIRECT MESSAGING SCHEMA
-- Campus Connect - Production-ready chat system
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: conversations
-- Purpose: Represents a chat between two users (one-to-one only)
-- Key Design: One row per user pair, no duplicates (enforced via CHECK)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    
    -- Participants (always user1_id < user2_id to prevent duplicates)
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Constraints
    CONSTRAINT unique_conversation UNIQUE (user1_id, user2_id),
    CONSTRAINT no_self_conversation CHECK (user1_id != user2_id),
    CONSTRAINT ordered_users CHECK (user1_id < user2_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: messages
-- Purpose: Individual messages within a conversation
-- Key Design: Stores sender/receiver explicitly for easy querying
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    
    -- Conversation reference
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Message metadata
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Message content
    content TEXT NOT NULL,
    
    -- Status tracking
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Constraints
    CONSTRAINT no_empty_message CHECK (LENGTH(TRIM(content)) > 0),
    CONSTRAINT no_self_message CHECK (sender_id != receiver_id)
);

-- Indexes for performance
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_unread ON messages(receiver_id, is_read) WHERE is_read = FALSE;

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGER: Update conversation.updated_at when new message is sent
-- Purpose: Keep track of last activity in conversation for sorting
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = NEW.created_at 
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_timestamp
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- ═══════════════════════════════════════════════════════════════════════════
-- COMMENTS FOR DOCUMENTATION
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE conversations IS 'One-to-one chat conversations between users. Stores user1_id < user2_id to prevent duplicates.';
COMMENT ON TABLE messages IS 'Individual messages within conversations. Tracks read status and timestamps.';
COMMENT ON CONSTRAINT ordered_users ON conversations IS 'Ensures user1_id < user2_id to prevent duplicate conversations';
COMMENT ON CONSTRAINT no_empty_message ON messages IS 'Prevents sending empty or whitespace-only messages';