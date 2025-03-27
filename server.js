// פונקציה לבדיקה האם הערך מתייחס לבן אדם - גרסה משופרת
async function isHumanArticle(pageId) {
  try {
    // שליפת תוכן הערך
    const response = await axios.get('https://he.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        pageids: pageId,
        prop: 'extracts|categories|links',
        exintro: true,
        explaintext: true,
        format: 'json',
        pllimit: 50 // לקבל עד 50 קישורים פנימיים בדף
      }
    });

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
        console.log(`Found strong human indicator "${indicator}" in article ${title}`);
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
        console.log(`Found biography pattern in article ${title}`);
        return true;
      }
    }
    
    // בדיקת כותרת
    // אם זה מקום, ארגון או מושג - לא בן אדם
    for (const keyword of nonHumanKeywords) {
      if (title.includes(keyword)) {
        console.log(`Found non-human keyword "${keyword}" in title: ${title}`);
        return false;
      }
    }
    
    // בדיקת קטגוריות ספציפיות המעידות על אנשים
    const humanCategories = [
      'קטגוריה:אישים', 'קטגוריה:אנשים', 'ילידי', 'נולדים',
      'קטגוריה:שחקנים', 'קטגוריה:זמרים', 'קטגוריה:פוליטיקאים',
      'קטגוריה:חברי כנסת', 'קטגוריה:שרים', 'קטגוריה:שופטים',
      'קטגוריה:עיתונאים', 'קטגוריה:סופרים', 'קטגוריה:אמנים',
      'קטגוריה:רופאים', 'קטגוריה:מדענים', 'קטגוריה:מנהלים',
      'קטגוריה:ספורטאים', 'קטגוריה:כדורגלנים', 'קטגוריה:מאמנים'
    ];
    
    // בדיקת קטגוריות
    if (page.categories) {
      const categoryTitles = page.categories.map(cat => cat.title || '');
      
      // חיפוש קטגוריות שמצביעות על אנשים
      for (const category of humanCategories) {
        const matchingCategories = categoryTitles.filter(cat => cat.includes(category));
        if (matchingCategories.length > 0) {
          console.log(`Found human category "${category}" in article ${title}`);
          return true;
        }
      }
      
      // חיפוש קטגוריות שמצביעות על דברים שאינם אנשים
      const nonPersonCategories = categoryTitles.filter(cat => 
        cat.includes('מבנים') || 
        cat.includes('מקומות') || 
        cat.includes('ארגונים') || 
        cat.includes('חברות') || 
        cat.includes('סרטים') ||
        cat.includes('אלבומים') ||
        cat.includes('ספרים') ||
        cat.includes('חמולות') ||
        cat.includes('משפחות') ||
        cat.includes('מוצרים') ||
        cat.includes('חבל ארץ') ||
        cat.includes('תופעות') ||
        cat.includes('מחלות')
      );
      
      if (nonPersonCategories.length > 0) {
        console.log(`Found non-human category in article ${title}: ${nonPersonCategories[0]}`);
        return false;
      }
    }
    
    // בדיקה אם קיימים קישורים פנימיים לערכים רלוונטיים לאנשים
    if (page.links) {
      const humanLinks = page.links.filter(link => 
        (link.title || '').includes('שנת לידה') ||
        (link.title || '').includes('מקום לידה') ||
        (link.title || '').includes('ביוגרפיה') ||
        (link.title || '').includes('קריירה') ||
        (link.title || '').includes('השכלה') ||
        (link.title || '').includes('חיים אישיים')
      );
      
      if (humanLinks.length > 0) {
        console.log(`Found human-related links in article ${title}`);
        return true;
      }
    }
    
    // בדיקת טקסט הפתיחה לזיהוי מילות מפתח
    for (const keyword of humanKeywords) {
      if (extract.includes(keyword)) {
        // חיזוק: וידוא שהמילה מופיעה בהקשר שמתאים לאדם
        const index = extract.indexOf(keyword);
        const surrounding = extract.substring(Math.max(0, index - 20), Math.min(extract.length, index + keyword.length + 20));
        
        // רשימת מילים שסביר שיופיעו ליד מילת המפתח אם מדובר באדם
        const humanContextWords = ['הוא', 'היא', 'את', 'נולד', 'גדל', 'למד', 'עבד', 'שימש', 'כיהן', 'פעל'];
        
        for (const contextWord of humanContextWords) {
          if (surrounding.includes(contextWord)) {
            console.log(`Found human keyword "${keyword}" with context "${contextWord}" in article ${title}`);
            return true;
          }
        }
      }
    }
    
    // בדיקת שימוש יתר במילים שמעידות על לא-אדם
    let nonHumanScore = 0;
    for (const keyword of nonHumanKeywords) {
      if (extract.includes(keyword)) {
        nonHumanScore++;
      }
    }
    
    if (nonHumanScore >= 3) {
      console.log(`High non-human score (${nonHumanScore}) for article ${title}`);
      return false;
    }
    
    // אם אין לנו מספיק מידע לקבוע באופן ודאי, נבדוק חלוקה לפסקאות
    // ביוגרפיות לרוב מכילות מספר פסקאות
    const paragraphs = extract.split('\n').filter(p => p.trim().length > 0);
    if (paragraphs.length >= 3) {
      console.log(`Article ${title} has ${paragraphs.length} paragraphs, likely a person`);
      return true;
    }
    
    // אם הגענו עד כאן ולא הצלחנו לקבוע, נשתמש בברירת מחדל שמחמירה
    console.log(`Unable to determine if article ${title} is about a human, defaulting to false`);
    return false;
  } catch (error) {
    console.error(`Error checking if article ${pageId} is about a human:`, error);
    return false;
  }
}// server.js
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// מאגרי שמות משפחה לצורך איתור דמויות - הרחבת הרשימות
const arabicLastNames = [
  'אבו-רביעה', 'טיבי', 'עודה', 'זחאלקה', 'ג׳בארין', 'מחאמיד', 'דראושה',
  'נאסר', 'חטיב', 'בשארה', 'עואד', 'זועבי', 'מנסור', 'חמדאן', 'חוסיין',
  'מסארווה', 'עאבד', 'חלאילה', 'עבאס', 'סעדי', 'סולימאן', 'ריאן',
  'עספור', 'מחאג׳נה', 'אבו גאנם', 'קעדאן', 'ג׳בארה', 'כנאנה', 'שאהין',
  'סלאח', 'חאג׳', 'מסארוה', 'דקה', 'תאיה', 'טאהא', 'יאסין', 'זיאדנה'
];

const mizrahiLastNames = [
  'פרץ', 'אוחנה', 'ביטון', 'אבוטבול', 'אזולאי', 'אלמליח', 'חזן', 'אלקבץ',
  'מימון', 'בוזגלו', 'מכלוף', 'אוחיון', 'דהן', 'אברג׳יל', 'עמר', 'דרעי',
  'מועלם', 'תורג׳מן', 'אלבז', 'זגורי', 'מזרחי', 'חדד', 'בן שטרית',
  'אשכנזי', 'אמסלם', 'סויסה', 'אוזן', 'פינטו', 'גבאי', 'אטיאס', 'חביב',
  'לוי', 'מלכה', 'חמו', 'אלקיים', 'סבג', 'סבן', 'טולדנו', 'אוחיון', 'כהן', 'נחום'
];

// רשימת מילות מפתח לזיהוי ערכים של בני אדם
const humanKeywords = [
  'נולד', 'נולדה', 'פוליטיקאי', 'פוליטיקאית', 'שחקן', 'שחקנית',
  'זמר', 'זמרת', 'עיתונאי', 'עיתונאית', 'סופר', 'סופרת', 'מנהל', 'מנהלת',
  'חבר כנסת', 'חברת כנסת', 'ראש ממשלה', 'שר', 'שרה', 'שופט', 'שופטת',
  'פרופסור', 'דוקטור', 'רופא', 'רופאה', 'מדען', 'מדענית', 'אמן', 'אמנית',
  'יליד', 'ילידת', 'בוגר', 'בוגרת', 'פעיל', 'פעילה', 'ביוגרפיה'
];

// רשימת מילות מפתח שמעידות על ערך שאינו של בן אדם - הרחבה
const nonHumanKeywords = [
  'מושב', 'קיבוץ', 'עיר', 'כפר', 'יישוב', 'חברה', 'ארגון', 'מוסד',
  'בית ספר', 'אוניברסיטה', 'מכללה', 'מסעדה', 'חנות', 'מלון',
  'אתר', 'פארק', 'שמורה', 'בניין', 'אנציקלופדיה', 'מילון', 'ספר',
  'סרט', 'תוכנית', 'להקה', 'מפלגה', 'תיאטרון', 'מוזיאון',
  'חמולת', 'חמולה', 'משפחת', 'שבט', 'איבר', 'איבר גוף', 'חלק גוף',
  'מאכל', 'תבשיל', 'מוצר', 'כלי', 'מכשיר', 'אזור', 'מחוז', 'חג',
  'אירוע', 'פסטיבל', 'טורניר', 'מחלה', 'תסמונת', 'תופעה', 'מקצוע'
];

// קטגוריות ויקיפדיה לחיפוש נוסף - מתמקדות בקטגוריות של בני אדם
const wikiCategories = {
  'arab': [
    'קטגוריה:חברי_כנסת_ערבים',
    'קטגוריה:שחקני_כדורגל_ערבים_ישראלים',
    'קטגוריה:שחקנים_ערבים_ישראלים',
    'קטגוריה:עיתונאים_ערבים_ישראלים',
    'קטגוריה:אישים_ערבים_ישראלים',
    'קטגוריה:זמרים_ערבים_ישראלים',
    'קטגוריה:שופטים_ערבים_בישראל'
  ],
  'mizrahi': [
    'קטגוריה:יהודים_מזרחים',
    'קטגוריה:זמרים_מזרחיים',
    'קטגוריה:פוליטיקאים_מזרחים_בישראל',
    'קטגוריה:שחקנים_יהודים_מזרחים',
    'קטגוריה:מוזיקאים_מזרחיים',
    'קטגוריה:אישים_יהודים_מזרחים',
    'קטגוריה:אמנים_מזרחיים'
  ]
};

// פונקציה לבדיקה אם התמונה היא של פנים אנושיות - גרסה משופרת
async function isLikelyHumanFace(imageUrl) {
  try {
    // בדיקה בסיסית - האם יש מילים בשם הקובץ שמעידות על אדם
    const lowercaseUrl = imageUrl.toLowerCase();
    
    // מילים שעשויות להצביע על תמונה שאינה של אדם
    const nonFaceKeywords = [
      'logo', 'symbol', 'map', 'diagram', 'לוגו', 'סמל', 'מפה', 'תרשים', 'flag', 'דגל',
      'icon', 'אייקון', 'building', 'בניין', 'house', 'בית', 'landscape', 'נוף',
      'document', 'מסמך', 'coat_of_arms', 'סמל_רשמי', 'emblem', 'אות', 'medal', 'מדליה',
      'banner', 'כרזה', 'sign', 'שלט', 'poster', 'כרזה', 'chart', 'טבלה', 'graph', 'גרף',
      'product', 'מוצר', 'book', 'ספר', 'location', 'מיקום', 'site', 'אתר', 'cover', 'כריכה',
      'food', 'מזון', 'dish', 'מאכל', 'device', 'מכשיר', 'tool', 'כלי', 'stamp', 'בול'
    ];
    
    for (const keyword of nonFaceKeywords) {
      if (lowercaseUrl.includes(keyword)) {
        console.log(`Rejected image with non-face keyword: ${keyword} in URL: ${imageUrl}`);
        return false;
      }
    }
    
    // בדיקת גודל ויחס של התמונה
    // אם URL מכיל מידע על ממדי התמונה
    const sizeMatcher = /\/(\d+)px-/;
    const match = imageUrl.match(sizeMatcher);
    
    if (match) {
      const size = parseInt(match[1]);
      // תמונות קטנות מדי לרוב אינן תמונות פנים טובות
      if (size < 100) {
        console.log(`Rejected small image (${size}px): ${imageUrl}`);
        return false;
      }
    }
    
    // מילים שעשויות להצביע על תמונת פנים או פורטרט
    const faceKeywords = [
      'portrait', 'face', 'headshot', 'profile', 'דיוקן', 'פנים', 'פורטרט', 'תמונת_פספורט',
      'official', 'רשמי', 'photo', 'צילום', 'press', 'עיתונות', 'closeup', 'תקריב',
      'politician', 'פוליטיקאי', 'actor', 'שחקן', 'actress', 'שחקנית', 'singer', 'זמר',
      'interview', 'ראיון', 'speaking', 'נואם', 'ceremony', 'טקס', 'conference', 'כנס',
      'candidate', 'מועמד', 'minister', 'שר', 'deputy', 'חבר_כנסת', 'parliament', 'כנסת',
      'professor', 'פרופסור', 'doctor', 'דוקטור', 'judge', 'שופט', 'lawyer', 'עורך_דין'
    ];
    
    for (const keyword of faceKeywords) {
      if (lowercaseUrl.includes(keyword)) {
        console.log(`Accepted image with face keyword: ${keyword} in URL: ${imageUrl}`);
        return true;
      }
    }
    
    // אם אין לנו מספיק מידע מהשם, נבדוק את הנתיב המלא
    // תמונות שיש בהן את שם האדם הן לרוב של האדם עצמו
    // בדיקה אם שם הקובץ כולל את שם האדם משם הערך
    const filenameRegex = /\/([^\/]+)\.(jpe?g|png)$/i;
    const filenameMatch = imageUrl.match(filenameRegex);
    
    if (filenameMatch) {
      const filename = filenameMatch[1].toLowerCase();
      
      // מילים שסביר שיופיעו בשם קובץ של אדם
      const commonHumanFilenameParts = ['interview', 'speaking', 'portrait', 'official', 'press', 'visit', 'meeting'];
      
      for (const part of commonHumanFilenameParts) {
        if (filename.includes(part)) {
          console.log(`Accepted image with human filename part: ${part} in URL: ${imageUrl}`);
          return true;
        }
      }
      
      // יש סוגי תמונות שלרוב אינן של האדם עצמו
      if (filename.includes('signature') || 
          filename.includes('autograph') || 
          filename.includes('חתימה') ||
          filename.includes('symbol') ||
          filename.includes('logo')) {
        console.log(`Rejected image with non-face filename part in URL: ${imageUrl}`);
        return false;
      }
    }
    
    // אם אין לנו מספיק מידע מהשם, נחזיר true כברירת מחדל
    // במקרה אמיתי, כאן היינו מפעילים אלגוריתם זיהוי פנים
    console.log(`No clear indicators for image, defaulting to accept: ${imageUrl}`);
    return true;
  } catch (error) {
    console.error('Error checking image for human face:', error);
    return true; // במקרה של ספק, נכליל את התמונה
  }
}

// שמירת תמונות היום במאגר זמני
let todaysImages = [];

// מאגר היסטורי של תמונות שכבר הוצגו (לשיפור גיוון)
let historicalImages = [];
const HISTORY_FILE_PATH = path.join(__dirname, 'historical-images.json');

// טעינת מאגר היסטורי אם קיים
try {
  if (fs.existsSync(HISTORY_FILE_PATH)) {
    const historyData = fs.readFileSync(HISTORY_FILE_PATH, 'utf8');
    historicalImages = JSON.parse(historyData);
    console.log(`Loaded ${historicalImages.length} historical images`);
  }
} catch (error) {
  console.error('Error loading historical images:', error);
  historicalImages = [];
}

// פונקציה לחיפוש דפים בקטגוריה בוויקיפדיה
async function fetchPagesInCategory(categoryName) {
  try {
    const response = await axios.get('https://he.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'categorymembers',
        cmtitle: categoryName,
        cmlimit: 50,
        cmnamespace: 0, // רק מאמרים, לא קטגוריות משנה
        format: 'json'
      }
    });

    if (response.data.query && response.data.query.categorymembers) {
      return response.data.query.categorymembers.map(page => page.pageid);
    }
    return [];
  } catch (error) {
    console.error(`Error fetching category ${categoryName}:`, error);
    return [];
  }
}

// פונקציה לחיפוש תמונות בוויקיפדיה העברית
async function fetchImagesFromWikipedia(searchTerm, isCategory = false) {
  try {
    let pageIds = [];
    
    if (isCategory) {
      // אם זה חיפוש לפי קטגוריה
      pageIds = await fetchPagesInCategory(searchTerm);
    } else {
      // חיפוש רגיל לפי שם משפחה
      const searchResponse = await axios.get('https://he.wikipedia.org/w/api.php', {
        params: {
          action: 'query',
          list: 'search',
          srsearch: searchTerm,
          format: 'json',
          srlimit: 10,
          srnamespace: 0
        }
      });

      pageIds = searchResponse.data.query.search
        .filter(result => result.title.includes(searchTerm))
        .map(result => result.pageid);
    }

    if (pageIds.length === 0) {
      return [];
    }
    
    // בדיקה שהערכים הם על בני אדם
    const humanChecks = await Promise.all(pageIds.map(async id => ({
      id,
      isHuman: await isHumanArticle(id)
    })));
    
    // סינון רק ערכים על בני אדם
    const humanPageIds = humanChecks
      .filter(check => check.isHuman)
      .map(check => check.id);
      
    console.log(`Found ${humanPageIds.length} human pages out of ${pageIds.length} total for "${searchTerm}"`);
    
    if (humanPageIds.length === 0) {
      return [];
    }

    // קבלת מידע על הדפים כולל תמונות
    console.log(`Fetching images for ${humanPageIds.length} human pages`);
    const imageResponse = await axios.get('https://he.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        pageids: humanPageIds.join('|'),
        prop: 'images|info|pageimages',  // הוספת pageimages כדי לקבל את התמונה הראשית
        inprop: 'url',
        pithumbsize: 300,  // גודל התמונה הראשית
        format: 'json'
      }
    });
    
    // הדפסת פרטי התמונות הראשיות לכל דף
    if (imageResponse.data.query && imageResponse.data.query.pages) {
      Object.values(imageResponse.data.query.pages).forEach(page => {
        if (page.thumbnail) {
          console.log(`Main image for ${page.title}: ${page.thumbnail.source}`);
        } else {
          console.log(`No main image for ${page.title}`);
        }
      });
    }

    const results = [];

    // עיבוד התוצאות
    Object.values(imageResponse.data.query.pages).forEach(page => {
      // ננסה להשתמש בתמונה הראשית (thumbnail) אם קיימת
      if (page.thumbnail && page.thumbnail.source) {
        console.log(`Using main thumbnail for ${page.title}: ${page.thumbnail.source}`);
        
        // מחלצים את שם הקובץ מה-URL של התמונה הראשית
        const thumbnailUrl = page.thumbnail.source;
        const filenameMatch = thumbnailUrl.match(/\/([^\/]+)\/[^\/]+$/);
        
        if (filenameMatch) {
          // בניית שם הקובץ המלא (לפי תבנית ויקיפדיה)
          const filename = `${filenameMatch[1]}`;
          console.log(`Extracted filename: ${filename}`);
          
          results.push({
            pageId: page.pageid,
            title: page.title,
            url: page.fullurl,
            imageTitle: `File:${filename}`,
            directImageUrl: thumbnailUrl
          });
          return; // אם מצאנו תמונה ראשית, לא צריך להמשיך לחפש
        }
      }
      
      // אם אין תמונה ראשית, ננסה למצוא את התמונה הראשונה שמתאימה
      if (page.images && page.images.length > 0) {
        // הדפסת כל התמונות בדף לצורך בדיקה
        console.log(`All images in page ${page.title}:`);
        page.images.slice(0, 5).forEach((img, index) => {
          console.log(`  ${index}: ${img.title}`);
        });
        
        // קבלת התמונה הראשונה מהדף שהיא קובץ תמונה תקין
        const filteredImages = page.images
          .filter(img => img.title.match(/\.(jpg|jpeg|png)$/i) && !img.title.toLowerCase().includes('logo'));
        
        // הדפסת התמונות המסוננות
        console.log(`Filtered images in page ${page.title}:`);
        filteredImages.slice(0, 5).forEach((img, index) => {
          console.log(`  ${index}: ${img.title}`);
        });
        
        if (filteredImages.length > 0) {
          // לקיחת התמונה הראשונה
          const firstImageTitle = filteredImages[0].title;
          console.log(`Selected first image: ${firstImageTitle}`);
          
          results.push({
            pageId: page.pageid,
            title: page.title,
            url: page.fullurl,
            imageTitle: firstImageTitle
          });
        }
      }
    });

    // שליפת ה-URL של התמונות
    const imageDetailsPromises = results.map(async result => {
      try {
        // אם יש כבר URL ישיר לתמונה, משתמשים בו
        if (result.directImageUrl) {
          const imageUrl = result.directImageUrl;
          console.log(`Using direct image URL: ${imageUrl}`);
          
          // בדיקה אם התמונה היא של פנים אנושיות
          const isHumanFace = await isLikelyHumanFace(imageUrl);
          
          if (!isHumanFace) {
            console.log(`Skipping non-human face image: ${result.title} - ${imageUrl}`);
            return null;
          }
          
          // קביעת הקבוצה (ערבי או מזרחי) לפי הפרמטרים
          let group;
          if (isCategory) {
            // אם זה חיפוש לפי קטגוריה, הקבוצה נקבעת לפי הקטגוריה
            group = searchTerm.includes('ערבי') ? 'arab' : 'mizrahi';
          } else {
            // אחרת, לפי שם המשפחה
            group = searchTerm === 'מזרחי' ? 'mizrahi' : 
                     arabicLastNames.includes(searchTerm) ? 'arab' : 'mizrahi';
          }
          
          // יצירת אובייקט התמונה
          const imageObject = {
            title: result.title,
            imageUrl: imageUrl,
            sourceUrl: result.url,
            group: group,
            id: `${result.title}_${result.pageId}` // מזהה ייחודי לתמונה
          };
          
          // בדיקה אם התמונה כבר הופיעה בהיסטוריה
          const existsInHistory = historicalImages.some(img => img.id === imageObject.id);
          
          if (!existsInHistory) {
            return imageObject;
          }
          return null; // אם התמונה כבר הופיעה, דלג עליה
        }
        
        // אחרת, משתמשים בשליפה רגילה
        const imageDetailResponse = await axios.get('https://he.wikipedia.org/w/api.php', {
          params: {
            action: 'query',
            titles: result.imageTitle,
            prop: 'imageinfo',
            iiprop: 'url',
            format: 'json'
          }
        });

        const pages = imageDetailResponse.data.query.pages;
        const pageId = Object.keys(pages)[0];
        
        if (pages[pageId].imageinfo && pages[pageId].imageinfo.length > 0) {
          const imageUrl = pages[pageId].imageinfo[0].url;
          
          // בדיקה אם התמונה היא של פנים אנושיות
          const isHumanFace = await isLikelyHumanFace(imageUrl);
          
          if (!isHumanFace) {
            console.log(`Skipping non-human face image: ${result.title} - ${imageUrl}`);
            return null;
          }
          
          // קביעת הקבוצה (ערבי או מזרחי) לפי הפרמטרים
          let group;
          if (isCategory) {
            // אם זה חיפוש לפי קטגוריה, הקבוצה נקבעת לפי הקטגוריה
            group = searchTerm.includes('ערבי') ? 'arab' : 'mizrahi';
          } else {
            // אחרת, לפי שם המשפחה
            group = searchTerm === 'מזרחי' ? 'mizrahi' : 
                     arabicLastNames.includes(searchTerm) ? 'arab' : 'mizrahi';
          }
          
          // יצירת אובייקט התמונה
          const imageObject = {
            title: result.title,
            imageUrl: imageUrl,
            sourceUrl: result.url,
            group: group,
            id: `${result.title}_${pageId}` // מזהה ייחודי לתמונה
          };
          
          // בדיקה אם התמונה כבר הופיעה בהיסטוריה
          const existsInHistory = historicalImages.some(img => img.id === imageObject.id);
          
          if (!existsInHistory) {
            return imageObject;
          }
          return null; // אם התמונה כבר הופיעה, דלג עליה
        }
        return null;
      } catch (error) {
        console.error('Error getting image URL:', error);
        return null;
      }
    });

    return (await Promise.all(imageDetailsPromises)).filter(item => item !== null);
  } catch (error) {
    console.error(`Error fetching data for ${lastName}:`, error);
    return [];
  }
}

// פונקציה לחילול מאגר תמונות יומי
async function generateDailyImages() {
  console.log('Generating daily images...');
  
  const arabPromises = [];
  const mizrahiPromises = [];

  // חיפוש לפי שמות משפחה ערביים
  for (const lastName of arabicLastNames) {
    arabPromises.push(fetchImagesFromWikipedia(lastName));
  }

  // חיפוש לפי שמות משפחה מזרחיים
  for (const lastName of mizrahiLastNames) {
    mizrahiPromises.push(fetchImagesFromWikipedia(lastName));
  }
  
  // חיפוש לפי קטגוריות ויקיפדיה
  for (const category of wikiCategories.arab) {
    arabPromises.push(fetchImagesFromWikipedia(category, true));
  }
  
  for (const category of wikiCategories.mizrahi) {
    mizrahiPromises.push(fetchImagesFromWikipedia(category, true));
  }

  // איסוף כל תוצאות החיפוש
  const arabResults = (await Promise.all(arabPromises)).flat();
  const mizrahiResults = (await Promise.all(mizrahiPromises)).flat();
  
  console.log(`Found ${arabResults.length} Arab images and ${mizrahiResults.length} Mizrahi images`);

  // בחירת תמונות רנדומליות - כ-10 מכל קטגוריה
  const randomArabic = arabResults.sort(() => 0.5 - Math.random()).slice(0, 10);
  const randomMizrahi = mizrahiResults.sort(() => 0.5 - Math.random()).slice(0, 10);

  // ערבוב התמונות
  todaysImages = [...randomArabic, ...randomMizrahi].sort(() => 0.5 - Math.random());
  
  // עדכון המאגר ההיסטורי
  historicalImages = [...historicalImages, ...todaysImages];
  
  // שמירת רק 150 התמונות האחרונות בהיסטוריה כדי למנוע קובץ גדול מדי
  if (historicalImages.length > 10000) {
    historicalImages = historicalImages.slice(historicalImages.length - 1000);
  }
  
  // שמירת המאגר ההיסטורי
  fs.writeFileSync(
    HISTORY_FILE_PATH,
    JSON.stringify(historicalImages)
  );
  
  // שמירת התמונות במאגר קבוע (לדוג', בקובץ JSON)
  fs.writeFileSync(
    path.join(__dirname, 'public', 'daily-images.json'),
    JSON.stringify({ 
      date: new Date().toISOString().split('T')[0],
      images: todaysImages
    })
  );

  console.log(`Generated ${todaysImages.length} daily images`);
  return todaysImages;
}

// הפעלת החילול הראשוני עם הפעלת השרת
generateDailyImages().catch(err => console.error('Initial image generation failed:', err));

// תזמון חילול תמונות חדשות בכל יום בחצות
cron.schedule('0 0 * * *', () => {
  generateDailyImages().catch(err => console.error('Scheduled image generation failed:', err));
});

// API לקבלת התמונות היומיות
app.get('/api/daily-images', (req, res) => {
  if (todaysImages.length === 0) {
    return res.status(500).json({ error: 'No images available, try again later' });
  }
  res.json({ 
    date: new Date().toISOString().split('T')[0],
    images: todaysImages
  });
});

// תיעוד ניחושי המשתמשים
app.post('/api/log-guess', (req, res) => {
  const { imageId, guess, correct } = req.body;
  // כאן ניתן להוסיף לוגיקה לשמירת הניחושים במסד נתונים
  console.log(`User guessed ${guess} for image ${imageId}. Correct: ${correct}`);
  res.json({ success: true });
});

// הפעלת השרת
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});