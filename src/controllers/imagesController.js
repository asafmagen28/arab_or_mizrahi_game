const imageService = require('../services/imageService');

/**
 * בקרה לתמונות - מנהלת את ה-API הנוגע לתמונות
 */
class ImagesController {
  /**
   * טיפול בבקשת GET לקבלת התמונות היומיות
   * @param {Object} req - אובייקט הבקשה
   * @param {Object} res - אובייקט התגובה
   */
  getDailyImages(req, res) {
    const images = imageService.getDailyImages();
    
    if (images.length === 0) {
      return res.status(500).json({ error: 'No images available, try again later' });
    }
    
    res.json({ 
      date: new Date().toISOString().split('T')[0],
      images: images
    });
  }
}

module.exports = new ImagesController();