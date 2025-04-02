const axios = require('axios');
const { humanKeywords, nonHumanKeywords, humanTextPatterns, nonHumanWikiCategories, KEYWORD_THRESHOLD_RATIO,IMAGE_SETTINGS } = require('../config/constants');
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
   * @param {number} [thumbnailSize=300] - גודל התמונה המבוקש
   * @returns {Promise<Object>} - אובייקט עם מידע על הדפים
   */
  async getPageInfo(pageIds, thumbnailSize = IMAGE_SETTINGS?.THUMBNAIL_SIZE || 300) {
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
                pithumbsize: thumbnailSize, // שימוש בפרמטר שהועבר
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
              pllimit: 30
            }
          });
        }, 3, 2000);
  
        if (!response.data.query || !response.data.query.pages || !response.data.query.pages[pageId]) {
          return false;
        }
  
        const page = response.data.query.pages[pageId];
        const extract = page.extract || '';
        const title = page.title || '';
        
        // 1. בדיקת קטגוריות שמעידות על ערכים שאינם אנשים
        if (page.categories) {
          const categoryTitles = page.categories.map(cat => cat.title || '');
          
          for (const nonHumanCategory of nonHumanWikiCategories) {
            if (categoryTitles.some(cat => cat.includes(nonHumanCategory))) {
              console.log(`Rejected by non-human category: ${title} in ${nonHumanCategory}`);
              return false;
            }
          }
        }
        
        // 2. בדיקת תוכן לפי מילות מפתח
        let nonHumanCount = 0;
        for (const keyword of nonHumanKeywords) {
          if (title.includes(keyword) || extract.includes(keyword)) {
            nonHumanCount++;
          }
        }
        
        // 3. חיפוש מילות מפתח אנושיות
        let humanCount = 0;
        
        // בדיקת תבניות טקסט חזקות לבני אדם
        for (const pattern of humanTextPatterns) {
          if (extract.includes(pattern)) {
            humanCount += 2; // מתן משקל כפול לתבניות חזקות
          }
        }
        
        // בדיקת מילות מפתח אנושיות רגילות
        for (const keyword of humanKeywords) {
          if (extract.includes(keyword)) {
            humanCount++;
          }
        }
        
        // 4. קבלת החלטה לפי היחס בין מילות מפתח לא-אנושיות לאנושיות
        if (humanCount === 0) {
          // אם אין בכלל מילות מפתח אנושיות, דחה את הערך
          console.log(`No human indicators for: ${title}`);
          return false;
        }
        
        const nonHumanRatio = nonHumanCount / (nonHumanCount + humanCount);
        
        if (nonHumanRatio > KEYWORD_THRESHOLD_RATIO) {
          console.log(`High non-human keyword ratio (${nonHumanRatio.toFixed(2)}) for: ${title}`);
          return false;
        }
        
        // 5. בדיקת קטגוריות אנושיות
        if (page.categories) {
          const categoryTitles = page.categories.map(cat => cat.title || '');
          const humanCategoryParts = [
            'אישים', 'אנשים', 'ילידי', 'פוליטיקאים', 'שחקנים', 'זמרים', 
            'סופרים', 'עיתונאים', 'רופאים', 'מדענים', 'אמנים'
          ];
          
          for (const part of humanCategoryParts) {
            if (categoryTitles.some(cat => cat.includes(part))) {
              console.log(`Confirmed human by category: ${title} has ${part}`);
              return true;
            }
          }
        }
        
        // 6. אם יש מספיק סימנים אנושיים, קבל את הערך
        if (humanCount >= 3) {
          console.log(`Accepted: ${title} has ${humanCount} human indicators`);
          return true;
        }
        
        // ברירת מחדל: אם הגענו לכאן, אין מספיק ראיות שזה אדם
        console.log(`Insufficient human evidence for: ${title}`);
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
  
  /**
 * פונקציה לחילוץ שנת לידה מתוך טקסט של ערך בוויקיפדיה
 * @param {string} extract - הטקסט של הערך
 * @returns {number|null} - שנת הלידה או null אם לא נמצאה
 */
extractBirthYear(extract) {
  if (!extract) return null;
  
  // תבניות נפוצות לשנת לידה בויקיפדיה העברית
  const patterns = [
    // נולד ב-1234 או נולדה ב-1234
    /נולד(?:ה)? ב[-–]?(\d{4})/i,
    // (1234-2345) - תבנית של שנת לידה ופטירה
    /\((\d{4})[-–](?:\d{4}|)\)/,
    // (נולד ב-1234) או (נולדה ב-1234)
    /\(נולד(?:ה)? ב[-–]?(\d{4})\)/i,
    // יליד/ילידת 1234
    /יליד(?:ת)? (?:שנת )?(\d{4})/i,
    // נולד/נולדה בשנת 1234
    /נולד(?:ה)? בשנת (\d{4})/i,
    // Xth בחודש Y, 1234 - תבנית תאריך מלא
    /\d{1,2} ב[א-ת]+ (\d{4})/,
    // בשנת 1234
    /בשנת (\d{4})/
  ];
  
  for (const pattern of patterns) {
    const match = extract.match(pattern);
    if (match && match[1]) {
      const year = parseInt(match[1]);
      // וידוא שהשנה הגיונית (בין 1700 ל-2023 למשל)
      if (year >= 1700 && year <= 2023) {
        return year;
      }
    }
  }
  
  return null;
}

/**
 * פונקציה משופרת לבדיקה האם הערך מתייחס לאדם שנולד משנה מסוימת
 * @param {number} pageId - מזהה הדף
 * @param {number} minYear - שנת לידה מינימלית לסינון (1850 כברירת מחדל)
 * @returns {Promise<{isHuman: boolean, birthYear: number|null}>} - האם הדף הוא על אדם והאם עומד בתנאי השנה
 */
async isHumanArticleWithBirthYear(pageId, minYear = 1850) {
  try {
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
          pllimit: 30
        }
      });
    }, 3, 2000);

    if (!response.data.query || !response.data.query.pages || !response.data.query.pages[pageId]) {
      return { isHuman: false, birthYear: null };
    }

    const page = response.data.query.pages[pageId];
    const extract = page.extract || '';
    const title = page.title || '';
    
    // בדיקה אם זה אדם
    const isHuman = await this.isHumanArticle(pageId);
    if (!isHuman) {
      return { isHuman: false, birthYear: null };
    }
    
    // חילוץ שנת הלידה
    const birthYear = this.extractBirthYear(extract);
    
    // בדיקה אם השנה מתאימה לדרישות
    if (birthYear && birthYear >= minYear) {
      console.log(`Found human with valid birth year: ${title} (${birthYear})`);
      return { isHuman: true, birthYear };
    }
    
    // אם זה אדם אבל השנה לא נמצאה או לא מתאימה
    if (!birthYear) {
      console.log(`Human article but birth year not found: ${title}`);
    } else {
      console.log(`Human born before minimum year: ${title} (${birthYear} < ${minYear})`);
    }
    
    return { isHuman, birthYear };
  } catch (error) {
    console.error(`Error checking article ${pageId}:`, error.message);
    return { isHuman: false, birthYear: null };
  }
}
}

module.exports = new WikipediaService();