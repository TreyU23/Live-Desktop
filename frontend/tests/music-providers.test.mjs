import assert from "node:assert/strict";
import test from "node:test";
import {
  APPLE_MUSIC_STARTER,
  createDefaultMusicIntegration,
  migrateMusicIntegration,
  normalizeAppleMusicUrl,
  normalizeSpotifyUrl,
} from "../src/musicProviders.js";

test("creates provider-specific Apple Music embed links", () => {
  assert.equal(
    normalizeAppleMusicUrl("https://music.apple.com/us/album/example/123?i=456"),
    "https://embed.music.apple.com/us/album/example/123?i=456",
  );
  assert.throws(() => normalizeAppleMusicUrl("https://example.com/playlist/123"), /valid Apple Music/);
});

test("creates provider-specific Spotify embed links", () => {
  assert.equal(
    normalizeSpotifyUrl("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=share"),
    "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M",
  );
  assert.equal(
    normalizeSpotifyUrl("https://open.spotify.com/intl-de/embed/track/11dFghVXANMlKmJXsNCbNl"),
    "https://open.spotify.com/embed/track/11dFghVXANMlKmJXsNCbNl",
  );
  assert.throws(() => normalizeSpotifyUrl("https://spotify.example/track/123"), /open\.spotify\.com/);
});

test("migrates the original Apple-only storage without losing its link", () => {
  const legacy = { sourceUrl: "https://music.apple.com/us/album/example/123", embedUrl: "https://embed.music.apple.com/us/album/example/123" };
  const migrated = migrateMusicIntegration(legacy);
  assert.equal(migrated.provider, "apple");
  assert.deepEqual(migrated.connections.apple, legacy);
  assert.equal(migrated.connections.spotify.embedUrl, "");
});

test("keeps both provider links when the selected provider changes", () => {
  const saved = createDefaultMusicIntegration();
  saved.provider = "spotify";
  saved.connections.spotify = {
    sourceUrl: "https://open.spotify.com/album/123",
    embedUrl: "https://open.spotify.com/embed/album/123",
  };
  const migrated = migrateMusicIntegration(saved);
  assert.equal(migrated.provider, "spotify");
  assert.deepEqual(migrated.connections.apple, APPLE_MUSIC_STARTER);
  assert.equal(migrated.connections.spotify.embedUrl, "https://open.spotify.com/embed/album/123");
});

test("drops saved embed links that fail the provider allowlist", () => {
  const saved = createDefaultMusicIntegration();
  saved.provider = "spotify";
  saved.connections.apple = { sourceUrl: "https://music.apple.com/us/album/x/1", embedUrl: "https://evil.example/frame" };
  saved.connections.spotify = { sourceUrl: "javascript:alert(1)", embedUrl: "javascript:alert(1)" };
  const migrated = migrateMusicIntegration(saved);
  assert.deepEqual(migrated.connections.apple, APPLE_MUSIC_STARTER);
  assert.deepEqual(migrated.connections.spotify, { sourceUrl: "", embedUrl: "" });

  const legacy = migrateMusicIntegration({ sourceUrl: "https://music.apple.com/us/album/x/1", embedUrl: "http://embed.music.apple.com/us/album/x/1" });
  assert.deepEqual(legacy.connections.apple, APPLE_MUSIC_STARTER);
});

test("keeps a valid embed link but clears a tampered source link", () => {
  const saved = createDefaultMusicIntegration();
  saved.connections.spotify = { sourceUrl: "https://evil.example/", embedUrl: "https://open.spotify.com/embed/album/123" };
  const migrated = migrateMusicIntegration(saved);
  assert.deepEqual(migrated.connections.spotify, { sourceUrl: "", embedUrl: "https://open.spotify.com/embed/album/123" });
});
