-- 1. Enable the random generation engine extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing structures to clear type dependencies
DROP TABLE IF EXISTS text_notes CASCADE;
DROP TABLE IF EXISTS images CASCADE;
DROP TABLE IF EXISTS voice_notes CASCADE;

-- 3. Rebuild Text Notes Table
CREATE TABLE text_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INT NOT NULL,
    recipient_id INT NOT NULL,
    note_content TEXT NOT NULL,
    allowed_views INT DEFAULT 1,
    current_views INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_note_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_note_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Rebuild Images Table
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INT NOT NULL,
    recipient_id INT NOT NULL,
    image_data BYTEA NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    allowed_views INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_image_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_image_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Rebuild Voice Notes (Audio) Table
CREATE TABLE voice_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INT NOT NULL,
    recipient_id INT NOT NULL,
    audio_data BYTEA NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    allowed_views INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_voice_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_voice_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 1. Master administrative background image skins catalog
CREATE TABLE IF NOT EXISTS platform_skins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    token_cost INT NOT NULL DEFAULT 10,
    image_data BYTEA NOT NULL, -- The actual uploaded background graphic binary
    mime_type VARCHAR(30) NOT NULL DEFAULT 'image/jpeg',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. User Inventory Link Table
CREATE TABLE IF NOT EXISTS user_skins (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    skin_id INT REFERENCES platform_skins(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, skin_id)
);

-- 3. Bind asset tracking structures directly to skin primary key entries
ALTER TABLE text_notes ADD COLUMN IF NOT EXISTS skin_id INT REFERENCES platform_skins(id) ON DELETE SET NULL;
ALTER TABLE voice_notes ADD COLUMN IF NOT EXISTS skin_id INT REFERENCES platform_skins(id) ON DELETE SET NULL;
-- 6. Add performance lookups for the new UUID keys
CREATE INDEX idx_text_notes_uuid ON text_notes(id);
CREATE INDEX idx_images_uuid ON images(id);
CREATE INDEX idx_voice_notes_uuid ON voice_notes(id);