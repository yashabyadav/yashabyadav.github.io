import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Proper CSV parser that handles quoted fields and commas within quotes
function parseCSV(csvText) {
  const lines = [];
  let currentLine = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
      currentLine += char;
    } else if (char === '\n' && !insideQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  // Parse headers
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  // Parse rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] || '';
    }
    rows.push(obj);
  }

  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

// Function to transform movie data to the required format
function transformMovieData(rawData, apiKey = null) {
  return rawData.map(item => ({
    title: item.Title || '',
    reason: item.Genres || '',
    posterUrl: '', // Will be populated by API if key is provided
    color: '', // Will need to be filled in manually or via image analysis
    imdbRating: item['IMDb Rating'] || '',
    yourRating: item['Your Rating'] || '',
    year: item.Year || '',
    url: item.URL || '',
    imdbId: item.Const || '' // IMDb ID for poster fetching
  }));
}

// Function to fetch poster from OMDB API
async function fetchOmdbPoster(imdbId, apiKey) {
  if (!apiKey || !imdbId) return '';

  try {
    const response = await fetch(
      `https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}&type=movie`
    );
    const data = await response.json();
    return data.Poster && data.Poster !== 'N/A' ? data.Poster : '';
  } catch (error) {
    console.warn(`Failed to fetch poster for ${imdbId}:`, error.message);
    return '';
  }
}

// Main function
async function parseMediaCSV() {
  const inputDir = path.join(__dirname, '..', 'src', 'content', 'media_diet_page');
  const outputDir = path.join(__dirname, '..', 'src', 'content', 'media_diet_page');

  // Get API key from environment
  const apiKey = process.env.OMDB_API_KEY || null;

  if (!apiKey) {
    console.log('\n⚠️  OMDB_API_KEY not set. Posters will not be fetched.');
    console.log('To enable poster fetching:');
    console.log('  1. Get a free API key at https://www.omdbapi.com/apikey.aspx');
    console.log('  2. Create a .env file in the project root with: OMDB_API_KEY=your_key_here');
    console.log('  3. Or export it: export OMDB_API_KEY=your_key_here\n');
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Process fav_movies.csv
  const movieFile = path.join(inputDir, 'fav_movies.csv');
  if (fs.existsSync(movieFile)) {
    const csvText = fs.readFileSync(movieFile, 'utf-8');
    const rawData = parseCSV(csvText);
    let transformedData = transformMovieData(rawData, apiKey);

    // Fetch posters if API key is available
    if (apiKey) {
      console.log('Fetching posters from OMDB API...');
      for (let i = 0; i < transformedData.length; i++) {
        const item = transformedData[i];
        if (item.imdbId) {
          const poster = await fetchOmdbPoster(item.imdbId, apiKey);
          if (poster) {
            transformedData[i].posterUrl = poster;
            console.log(`  ✓ ${item.title}`);
          } else {
            console.log(`  ✗ ${item.title} (no poster found)`);
          }
          // Rate limit to avoid API throttling
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }

    const outputFile = path.join(outputDir, 'fav_movies.json');
    fs.writeFileSync(outputFile, JSON.stringify(transformedData, null, 2));
    console.log(`\n✓ Parsed fav_movies.csv → fav_movies.json (${transformedData.length} films)`);
  } else {
    console.log('✗ fav_movies.csv not found');
  }

  // Process fav_tv_shows.csv
  const tvShowFile = path.join(inputDir, 'fav_tv_shows.csv');
  if (fs.existsSync(tvShowFile)) {
    const csvText = fs.readFileSync(tvShowFile, 'utf-8');
    const rawData = parseCSV(csvText);
    let transformedData = transformMovieData(rawData, apiKey);

    // Fetch posters if API key is available
    if (apiKey) {
      console.log('Fetching posters from OMDB API...');
      for (let i = 0; i < transformedData.length; i++) {
        const item = transformedData[i];
        if (item.imdbId) {
          const poster = await fetchOmdbPoster(item.imdbId, apiKey);
          if (poster) {
            transformedData[i].posterUrl = poster;
            console.log(`  ✓ ${item.title}`);
          } else {
            console.log(`  ✗ ${item.title} (no poster found)`);
          }
          // Rate limit to avoid API throttling
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }
  const outputFileTv = path.join(outputDir, 'fav_tv_shows.json');
    fs.writeFileSync(outputFileTv, JSON.stringify(transformedData, null, 2));
    console.log(`\n✓ Parsed fav_tv_shows.csv → fav_tv_shows.json (${transformedData.length} shows)`);
  } else {
    console.log('✗ fav_tv_shows.csv not found');
  }
  // Process fav_video_games.csv
  const videoGameFile = path.join(inputDir, 'fav_video_games.csv');
  if (fs.existsSync(videoGameFile)) {
    const csvText = fs.readFileSync(videoGameFile, 'utf-8');
    const rawData = parseCSV(csvText);
    let transformedData = transformMovieData(rawData, apiKey);

    // Fetch posters if API key is available
    if (apiKey) {
      console.log('Fetching posters from OMDB API...');
      for (let i = 0; i < transformedData.length; i++) {
        const item = transformedData[i];
        if (item.imdbId) {
          const poster = await fetchOmdbPoster(item.imdbId, apiKey);
          if (poster) {
            transformedData[i].posterUrl = poster;
            console.log(`  ✓ ${item.title}`);
          } else {
            console.log(`  ✗ ${item.title} (no poster found)`);
          }
          // Rate limit to avoid API throttling
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }
  const outputFileVideoGames = path.join(outputDir, 'fav_video_games.json');
    fs.writeFileSync(outputFileVideoGames, JSON.stringify(transformedData, null, 2));
    console.log(`\n✓ Parsed fav_video_games.csv → fav_video_games.json (${transformedData.length} games)`);
  } else {
    console.log('✗ fav_video_games.csv not found');
  }
 
  

  // Add more media types as needed (TV shows, games, books)
  console.log('\nTo add more media types, create:');
  console.log('  - src/content/media_diet_page/fav_tv_shows.csv');
  console.log('  - src/content/media_diet_page/fav_games.csv');
  console.log('  - src/content/media_diet_page/fav_books.csv');
}

parseMediaCSV().catch(console.error);
