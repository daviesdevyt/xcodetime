import fs from 'fs';
import path from 'path';

class Storage {
  constructor(storagePath) {
    this.dataPath = path.join(storagePath, 'xcodetime-data');
    this.ensureDirectoryExists(storagePath);
    this.ensureDirectoryExists(this.dataPath);
    this.todayFile = this.getTodayFileName();
    this.loadTodayData();
  }
  
  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
  
  getTodayFileName() {
    const now = new Date();
    return path.join(
      this.dataPath,
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`
    );
  }
  
  loadTodayData() {
    this.todayFile = this.getTodayFileName();
    
    try {
      if (fs.existsSync(this.todayFile)) {
        const data = fs.readFileSync(this.todayFile, 'utf8');
        this.todayData = JSON.parse(data);
      } else {
        this.initNewDayData();
      }
    } catch (error) {
      console.error('Error loading today\'s data:', error);
      this.initNewDayData();
    }
  }
  
  initNewDayData() {
    this.todayData = {
      date: new Date().toISOString().split('T')[0],
      totalSeconds: 0,
      languages: {},
      files: {},
      hourlyBreakdown: Array(24).fill(0),
      lastUpdated: new Date().toISOString()
    };
    this.saveTodayData();
  }
  
  saveTodayData() {
    try {
      this.todayData.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.todayFile, JSON.stringify(this.todayData, null, 2));
    } catch (error) {
      console.error('Error saving today\'s data:', error);
    }
  }
  
  recordActivity(seconds, language, extension, fileName) {
    // Check if the date has changed
    const currentDayFile = this.getTodayFileName();
    if (currentDayFile !== this.todayFile) {
      this.loadTodayData();
    }
    
    // Update total seconds
    this.todayData.totalSeconds += seconds;
    
    // Update language stats
    if (!this.todayData.languages[language]) {
      this.todayData.languages[language] = 0;
    }
    this.todayData.languages[language] += seconds;
    
    // Update file stats (just keep track of time per file)
    const fileKey = fileName.replace(/\\/g, '/').split('/').pop(); // Just the filename
    if (!this.todayData.files[fileKey]) {
      this.todayData.files[fileKey] = 0;
    }
    this.todayData.files[fileKey] += seconds;
    
    // Update hourly breakdown
    const hour = new Date().getHours();
    this.todayData.hourlyBreakdown[hour] += seconds;
    
    // Save updated data
    this.saveTodayData();
  }
  
  getTodayStats() {
    // Check if the date has changed
    const currentDayFile = this.getTodayFileName();
    if (currentDayFile !== this.todayFile) {
      this.loadTodayData();
    }
    
    return this.todayData;
  }
  
  getStats(days = 30) {
    const stats = {
      dailyData: [],
      totalSeconds: 0,
      languages: {},
      averagePerDay: 0,
      mostProductiveDay: { date: null, seconds: 0 },
      mostProductiveHour: { hour: null, seconds: 0 },
      hourlyBreakdown: Array(24).fill(0)
    };
    
    // Get today's data first
    const todayStats = this.getTodayStats();
    stats.dailyData.push(todayStats);
    
    // Get historical data (up to specified number of days)
    const files = this.getDataFiles();
    
    // Sort files by date (newest first) and take only what we need
    files.sort((a, b) => {
      const dateA = path.basename(a, '.json');
      const dateB = path.basename(b, '.json');
      return dateB.localeCompare(dateA);
    });
    
    // Skip today's file (we already added it) and take the next 'days-1'
    const filesToProcess = files.filter(file => {
      return path.basename(file) !== path.basename(this.todayFile);
    }).slice(0, days - 1);
    
    // Process each file
    for (const file of filesToProcess) {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        stats.dailyData.push(data);
      } catch (error) {
        console.error(`Error reading data file ${file}:`, error);
      }
    }
    
    // Calculate aggregate stats
    for (const day of stats.dailyData) {
      // Total time
      stats.totalSeconds += day.totalSeconds || 0;
      
      // Check for most productive day
      if ((day.totalSeconds || 0) > stats.mostProductiveDay.seconds) {
        stats.mostProductiveDay = {
          date: day.date,
          seconds: day.totalSeconds || 0
        };
      }
      
      // Aggregate language data
      for (const [lang, seconds] of Object.entries(day.languages || {})) {
        if (!stats.languages[lang]) {
          stats.languages[lang] = 0;
        }
        stats.languages[lang] += seconds;
      }
      
      // Aggregate hourly breakdown
      for (let hour = 0; hour < 24; hour++) {
        if (day.hourlyBreakdown && day.hourlyBreakdown[hour]) {
          stats.hourlyBreakdown[hour] += day.hourlyBreakdown[hour];
          
          // Check for most productive hour
          if (day.hourlyBreakdown[hour] > stats.mostProductiveHour.seconds) {
            stats.mostProductiveHour = {
              hour,
              seconds: day.hourlyBreakdown[hour]
            };
          }
        }
      }
    }
    
    // Calculate average per day
    stats.averagePerDay = stats.dailyData.length > 0 ? 
      stats.totalSeconds / stats.dailyData.length : 0;
    
    return stats;
  }
  
  getDataFiles() {
    try {
      const files = fs.readdirSync(this.dataPath)
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(this.dataPath, file));
      return files;
    } catch (error) {
      console.error('Error reading data directory:', error);
      return [];
    }
  }
  
  resetStats() {
    try {
      // Get all JSON files in the data directory
      const files = this.getDataFiles();
      // Delete each file
      for (const file of files) {
        fs.unlinkSync(file);
      }
      // Initialize new day data
      this.initNewDayData();
      return true;
    } catch (error) {
      console.error('Error resetting stats:', error);
      return false;
    }
  }
}

export default Storage;
