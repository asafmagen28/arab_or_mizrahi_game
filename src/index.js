/**
 * נקודת כניסה ראשית לאפליקציה
 * מייבאת ומפעילה את קובץ השרת
 */

// מודדים זמן העלאה
console.time('Server startup time');

// הפעלת השרת
require('./server');

console.timeEnd('Server startup time');