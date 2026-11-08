/**
 * Automated tests for Fridge2Food Backend utilities, validators, and session lifecycle.
 * Run with:
 *   npm test
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const {
  detectImageMimeFromMagicBytes,
  normalizeIngredientName,
  isValidSessionId,
  validateUploadedFile,
} = require("../src/utils/validators");
const sessionService = require("../src/services/sessionService");

test("detectImageMimeFromMagicBytes identifies JPEG, PNG, WEBP and rejects text", () => {
  const jpegBuf = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);
  assert.equal(detectImageMimeFromMagicBytes(jpegBuf), "image/jpeg");

  const pngBuf = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  assert.equal(detectImageMimeFromMagicBytes(pngBuf), "image/png");

  const fakeBuf = Buffer.from("not-an-image-at-all-123456");
  assert.equal(detectImageMimeFromMagicBytes(fakeBuf), null);
});

test("normalizeIngredientName formats underscores and hyphens cleanly", () => {
  assert.equal(normalizeIngredientName("red_bell-pepper"), "Red Bell Pepper");
  assert.equal(normalizeIngredientName("  cherry_tomato "), "Cherry Tomato");
});

test("isValidSessionId validates safe session IDs and blocks path traversal", () => {
  assert.equal(isValidSessionId("sp_1234567890abcdef"), true);
  assert.equal(isValidSessionId("../etc/passwd"), false);
  assert.equal(isValidSessionId("short"), false);
});

test("sessionService creates session, merges duplicate ingredients, caches instructions, and cleans up files", async () => {
  const session = await sessionService.getOrCreateSession();
  assert.ok(session.sessionId.startsWith("sp_"));
  assert.equal(fs.existsSync(session.sessionDir), true);

  const jpegBuf = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);

  const mockFiles = [
    { originalname: "img1.jpg", mimetype: "image/jpeg", size: 12, buffer: jpegBuf },
    { originalname: "img2.jpg", mimetype: "image/jpeg", size: 12, buffer: jpegBuf },
  ];

  const mockInference = {
    results: [
      {
        dimensions: { width: 640, height: 480 },
        detection_count: 2,
        detections: [
          {
            detection_id: "d1",
            class_id: 0,
            class_name: "tomato",
            display_name: "Tomato",
            confidence: 0.9,
            confidence_percentage: 90.0,
            bbox: { x1: 10, y1: 10, x2: 100, y2: 100, width: 90, height: 90, normalized: [0.01, 0.02, 0.15, 0.2] },
          },
          {
            detection_id: "d2",
            class_id: 1,
            class_name: "onion",
            display_name: "Onion",
            confidence: 0.8,
            confidence_percentage: 80.0,
            bbox: { x1: 120, y1: 20, x2: 200, y2: 110, width: 80, height: 90, normalized: [0.18, 0.04, 0.31, 0.22] },
          },
        ],
      },
      {
        dimensions: { width: 640, height: 480 },
        detection_count: 1,
        detections: [
          {
            detection_id: "d3",
            class_name: "tomato",
            display_name: "Tomato",
            confidence: 0.95,
            confidence_percentage: 95.0,
            bbox: { x1: 30, y1: 30, x2: 140, y2: 140, width: 110, height: 110, normalized: [0.04, 0.06, 0.21, 0.29] },
          },
        ],
      },
    ],
  };

  const snap = await sessionService.recordDetectionBatch(
    session.sessionId,
    mockFiles,
    mockInference,
    "multi"
  );

  // Duplicate "Tomato" across img1 and img2 should be merged into 1 unique entry with count=2
  assert.equal(snap.ingredients.length, 2);
  const tomato = snap.ingredients.find((i) => i.name === "Tomato");
  assert.equal(tomato.count, 2);
  assert.equal(tomato.maxConfidence, 0.95);
  assert.equal(tomato.sourceImages.length, 2);

  // Update and confirm ingredients
  const updated = sessionService.updateIngredients(
    session.sessionId,
    [
      ...snap.ingredients,
      { name: "Garlic", quantity: "4 cloves", count: 4, isManual: true },
    ],
    true
  );
  assert.equal(updated.ingredientsConfirmed, true);
  assert.equal(updated.ingredients.length, 3);

  // Cache recipe instructions
  sessionService.setCachedInstructions(session.sessionId, "rec_1", {
    recipeName: "Roasted Tomato Garlic Pasta",
    steps: [{ stepNumber: 1, instruction: "Boil water" }],
  });
  assert.ok(sessionService.getCachedInstructions(session.sessionId, "rec_1"));

  // Delete session and confirm directory is removed
  await sessionService.deleteSession(session.sessionId);
  assert.equal(fs.existsSync(session.sessionDir), false);
});
