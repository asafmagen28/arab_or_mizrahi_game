/**
 * מודל המתאר תמונה במערכת
 */
class ImageModel {
    /**
     * יוצר מופע חדש של תמונה
     * @param {string} title - כותרת/שם האישיות
     * @param {string} imageUrl - כתובת URL של התמונה
     * @param {string} sourceUrl - כתובת URL של מקור התמונה (ויקיפדיה)
     * @param {string} group - קבוצה ('arab' או 'mizrahi')
     */
    constructor(title, imageUrl, sourceUrl, group) {
      this.title = title;
      this.imageUrl = imageUrl;
      this.sourceUrl = sourceUrl;
      this.group = group;
      this.id = `${title}_${Date.now()}`;
    }
  
    /**
     * יוצר אובייקט תמונה מאובייקט JSON
     * @param {Object} data - אובייקט נתונים של תמונה
     * @returns {ImageModel} - מופע של מודל תמונה
     */
    static fromJSON(data) {
      const image = new ImageModel(
        data.title,
        data.imageUrl,
        data.sourceUrl,
        data.group
      );
      
      // אם יש מזהה ספציפי, השתמש בו
      if (data.id) {
        image.id = data.id;
      }
      
      return image;
    }
  
    /**
     * המרת התמונה לאובייקט JSON
     * @returns {Object} - תצוגת JSON של התמונה
     */
    toJSON() {
      return {
        id: this.id,
        title: this.title,
        imageUrl: this.imageUrl,
        sourceUrl: this.sourceUrl,
        group: this.group
      };
    }
  }
  
  module.exports = ImageModel;