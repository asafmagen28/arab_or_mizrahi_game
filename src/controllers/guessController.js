const dataService = require('../services/dataService');

/**
 * בקרה לניחושים - מטפלת בניחושי המשתמש
 */
class GuessController {
  /**
   * טיפול בבקשת POST לרישום ניחוש
   * @param {Object} req - אובייקט הבקשה
   * @param {Object} res - אובייקט התגובה
   */
  async logGuess(req, res) {
    try {
      const { imageId, guess, correct } = req.body;
      
      // בדיקת תקינות הנתונים
      if (!imageId || !guess || typeof correct !== 'boolean') {
        return res.status(400).json({ error: 'Invalid guess data' });
      }
      
      // שליחת הנתונים לשירות המידע לתיעוד
      await dataService.logGuess({ imageId, guess, correct });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error handling guess:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new GuessController();