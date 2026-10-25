const fs = require('fs/promises');
const path = require('path');

async function cleanupExpiredContent(pool) {
  try {
    const [images] = await pool.query(
      `SELECT image_path FROM images
       WHERE expired_at IS NOT NULL
         AND expired_at <= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR)`
    );

    const [imageResult] = await pool.query(
      `DELETE FROM images
       WHERE expired_at IS NOT NULL
         AND expired_at <= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR)`
    );
    const [noteResult] = await pool.query(
      `DELETE FROM text_notes
       WHERE expired_at IS NOT NULL
         AND expired_at <= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR)`
    );
    const [voiceResult] = await pool.query(
      `DELETE FROM voice_notes
       WHERE expired_at IS NOT NULL
         AND expired_at <= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR)`
    );

    const uploadsDir = path.join(__dirname, 'uploads');
    await Promise.all(images.map(({ image_path }) =>
      fs.unlink(path.join(uploadsDir, path.basename(image_path))).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      })
    ));

    const removedCount = imageResult.affectedRows + noteResult.affectedRows + voiceResult.affectedRows;
    if (removedCount) console.log(`Cleaned up ${removedCount} expired shared item(s).`);
    return removedCount;
  } catch (error) {
    console.error('Expired content cleanup failed:', error);
    return 0;
  }
}

module.exports = cleanupExpiredContent;