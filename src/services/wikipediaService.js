const axios = require('axios');
const { humanKeywords, nonHumanKeywords } = require('../config/constants');
const ApiUtils = require('../utils/apiUtils');

// יצירת מופע axios עמיד יותר לשגיאות רשת
const robustAxios = ApiUtils.createRobustAxios({
  // הוספת user-agent לגיטימי
  headers: {
    'User-Agent': 'Arab-or-Mizrahi-Game/1.0 (Educational Project; contact@example.com) Node.js/16.0'
  }
});

/**
 * שירות לביצוע חיפושים בוויקיפדיה העברית
 */
class WikipediaService {
  constructor() {
    // מגביל את מספר הבקשות המקביל - הגדלה מ-2 ל-4
    this.concurrentRequestLimit = 4;
    this.requestQueue = [];
    this.activeRequests = 0;
    this.requestDelay = 800; // השהייה בין בקשות - הקטנה מ-1000 ל-800 מילישניות
  }

  /**
   * פונקציה להוספת בקשה לתור ועיבודה כשיש מקום
   * @param {Function} requestFn - פונקציה שמבצעת את הבקשה
   * @returns {Promise<any>} - תוצאת הבקשה
   */
  async queueRequest(requestFn) {
    return new Promise((resolve, reject) => {
      // הוספת הבקשה לתור
      this.requestQueue.push({
        fn: requestFn,
        resolve,
        reject
      });
      
      // ניסיון לעבד בקשות
      this.processQueue();
    });
  }

  /**
   * פונקציה לעיבוד התור
   */
  async processQueue() {
    // אם אין בקשות או שהגענו למגבלת הבקשות המקבילות, נצא
    if (this.requestQueue.length === 0 || this.activeRequests >= this.concurrentRequestLimit) {
      return;
    }

    // לקיחת הבקשה הבאה מהתור
    const request = this.requestQueue.shift();
    this.activeRequests++;

    try {
      // המתנה לפני ביצוע הבקשה (כדי להימנע מהצפת השרת)
      await ApiUtils.sleep(this.requestDelay);
      
      // ביצוע הבקשה
      const result = await request.fn();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests--;
      
      // עיבוד הבקשה הבאה
      setTimeout(() => this.processQueue(), this.requestDelay);
    }
  }

  /**
   * חיפוש דפים בקטגוריה בוויקיפדיה
   * @param {string} categoryName - שם הקטגוריה לחיפוש
   * @returns {Promise<Array>} - מערך של מזהי דפים
   */
  async fetchPagesInCategory(categoryName) {
    try {
      return await this.queueRequest(async () => {
        const response = await ApiUtils.withRetry(async () => {
          return await robustAxios.get('https://he.wikipedia.org/w/api.php', {
            params: {
              action: 'query',
              list: 'categorymembers',
              cmtitle: categoryName,
              cmlimit: 50, // הגדלה מ-20 ל-50
              cmnamespace: 0,
              format: 'json'
            }
          });
        }, 3, 2000); // הגדלת זמן ההמתנה בין ניסיונות

        if (response.data.query && response.data.query.categorymembers) {
          return response.data.query.categorymembers.map(page => page.pageid);
        }
        return [];
      });
    } catch (error) {
      console.error(`Error fetching category ${categoryName}:`, error.message);
      return [];
    }
  }

  /**
   * חיפוש דפים בויקיפדיה לפי מילת חיפוש
   * @param {string} searchTerm - מונח לחיפוש
   * @returns {Promise<Array>} - מערך של תוצאות חיפוש
   */
  async searchWikipedia(searchTerm) {
    try {
      return await this.queueRequest(async () => {
        const searchResponse = await ApiUtils.withRetry(async () => {
          return await robustAxios.get('https://he.wikipedia.org/w/api.php', {
            params: {
              action: 'query',
              list: 'search',
              srsearch: searchTerm,
              format: 'json',
              srlimit: 20, // הגדלה מ-5 ל-20
              srnamespace: 0
            }
          });
        }, 3, 2000);

        if (!searchResponse.data.query || !searchResponse.data.query.search) {
          return [];
        }

        return searchResponse.data.query.search
          .filter(result => result.title.includes(searchTerm))
          .map(result => result.pageid);
      });
    } catch (error) {
      console.error(`Error searching Wikipedia for ${searchTerm}:`, error.message);
      return [];
    }
  }

  /**
   * קבלת מידע על דפים כולל תמונות
   * @param {Array} pageIds - מערך של מזהי דפים
   * @param {number} thumbnailSize - גודל התמונה המבוקש בפיקסלים
   * @returns {Promise<Object>} - אובייקט עם מידע על הדפים
   */
  async getPageInfo(pageIds, thumbnailSize = 300) {
    try {
      if (pageIds.length === 0) {
        return {};
      }

      // חלוקת המזהים לקבוצות קטנות יותר - הגדלה מ-3 ל-5 דפים בכל קבוצה
      const pageIdGroups = this.chunkArray(pageIds, 5);
      let allPages = {};

      for (const group of pageIdGroups) {
        const result = await this.queueRequest(async () => {
          const response = await ApiUtils.withRetry(async () => {
            return await robustAxios.get('https://he.wikipedia.org/w/api.php', {
              params: {
                action: 'query',
                pageids: group.join('|'),
                prop: 'images|info|pageimages',
                inprop: 'url',
                pithumbsize: thumbnailSize,
                format: 'json'
              }
            });
          }, 3, 2000);

          return response.data.query.pages || {};
        });

        // מיזוג התוצאות
        allPages = { ...allPages, ...result };
      }

      return allPages;
    } catch (error) {
      console.error('Error getting page info:', error.message);
      return {};
    }
  }

  /**
   * קבלת פרטי תמונה מויקיפדיה
   * @param {string} imageTitle - כותרת התמונה
   * @returns {Promise<string|null>} - URL של התמונה או null אם לא נמצא
   */
  async getImageUrl(imageTitle) {
    try {
      return await this.queueRequest(async () => {
        const response = await ApiUtils.withRetry(async () => {
          return await robustAxios.get('https://he.wikipedia.org/w/api.php', {
            params: {
              action: 'query',
              titles: imageTitle,
              prop: 'imageinfo',
              iiprop: 'url',
              format: 'json'
            }
          });
        }, 3, 2000);

        const pages = response.data.query.pages;
        const pageId = Object.keys(pages)[0];
        
        if (pages[pageId].imageinfo && pages[pageId].imageinfo.length > 0) {
          return pages[pageId].imageinfo[0].url;
        }
        return null;
      });
    } catch (error) {
      console.error(`Error getting image URL for ${imageTitle}:`, error.message);
      return null;
    }
  }

  /**
   * בדיקה האם הערך מתייחס לבן אדם
   * @param {number} pageId - מזהה הדף
   * @returns {Promise<boolean>} - האם הדף הוא על אדם
   */
  async isHumanArticle(pageId) {
    try {
      return await this.queueRequest(async () => {
        // שליפת תוכן הערך
        const response = await ApiUtils.withRetry(async () => {
          return await robustAxios.get('https://he.wikipedia.org/w/api.php', {
            params: {
              action: 'query',
              pageids: pageId,
              prop: 'extracts|categories|links',
              exintro: true,
              explaintext: true,
              format: 'json',
              pllimit: 30 // הגדלה מ-20 ל-30
            }
          });
        }, 3, 2000);

        if (!response.data.query || !response.data.query.pages || !response.data.query.pages[pageId]) {
          return false;
        }

        const page = response.data.query.pages[pageId];
        const extract = page.extract || '';
        const title = page.title || '';
        
        // סימני זיהוי חזקים של אדם
        const strongHumanIndicators = [
          ' נולד ב', ' נולדה ב', 
          ' הוא איש ', ' היא אישה ',
          ' החל את הקריירה שלו', ' החלה את הקריירה שלה',
          ' בוגר ', ' בוגרת ',
          ' סיים את לימודיו', ' סיימה את לימודיה',
          ' התחתן ', ' התחתנה ',
          ' הוא בנו של ', ' היא בתו של ',
          ' אביו של ', ' אמו של ',
          ' הוא פוליטיקאי ', ' היא פוליטיקאית ',
          ' שיחק בסרט ', ' שיחקה בסרט ',
          ' הופיע בתוכנית ', ' הופיעה בתוכנית ',
          ' נפטר ', ' נפטרה ',
          ' התחנך ', ' התחנכה ',
          ' הצטרף ל', ' הצטרפה ל',
          ' גדל ב', ' גדלה ב'
        ];
        
        // בדיקה לסימנים חזקים של אדם בטקסט הפתיחה
        for (const indicator of strongHumanIndicators) {
          if (extract.includes(indicator)) {
            return true;
          }
        }
        
        // בדיקת תבניות ביוגרפיה נפוצות
        const biographyPatterns = [
          // תאריך לידה ופטירה
          /נולד\(ה\) ב.*\d{1,2} ב[א-ת]+ \d{4}/,
          // גיל
          /בן \d+ שנים/,
          /בת \d+ שנים/,
          // ילידי שנה
          /יליד(ת)? (שנת )?1\d{3}/,
          /יליד(ת)? (שנת )?20\d{2}/,
          // תאריך פטירה
          /נפטר\(ה\) ב.*\d{1,2} ב[א-ת]+ \d{4}/
        ];
        
        for (const pattern of biographyPatterns) {
          if (pattern.test(extract)) {
            return true;
          }
        }
        
        // בדיקה אם קיימות קטגוריות או קישורים מובהקים לאנשים
        if (page.categories) {
          // הרחבת רשימת הקטגוריות לזיהוי
          const humanCategories = [
            'אישים', 'אנשים', 'ילידי', 'פוליטיקאים', 'שחקנים', 'זמרים', 'סופרים',
            'אמנים', 'עיתונאים', 'רופאים', 'מדענים', 'מנהלים', 'חברי כנסת', 'שרים',
            'שופטים', 'עורכי דין', 'מוזיקאים', 'במאים', 'מנהיגים', 'רבנים'
          ];
          const categoryTitles = page.categories.map(cat => cat.title || '');
          
          for (const category of humanCategories) {
            if (categoryTitles.some(cat => cat.includes(category))) {
              return true;
            }
          }
        }
        
        // בדיקת טקסט הפתיחה לזיהוי מילות מפתח - הקלה בתנאים
        for (const keyword of humanKeywords) {
          if (extract.includes(keyword)) {
            return true;
          }
        }
        
        return false;
      });
    } catch (error) {
      console.error(`Error checking if article ${pageId} is about a human:`, error.message);
      return false;
    }
  }

  /**
   * פונקציית עזר לחלוקת מערך לקבוצות קטנות
   * @param {Array} array - המערך לחלוקה
   * @param {number} size - גודל כל קבוצה
   * @returns {Array} - מערך של מערכים
   */
  chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }
}

module.exports = new WikipediaService();