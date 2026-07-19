import fs from 'fs';
import * as cheerio from 'cheerio';
import { sleep, SCRAPED_FILE, ensureDataDir } from './utils.js';

const PROFILE_URL = 'https://www4.animeflv.net/perfil/PROW/siguiendo';

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return await res.text();
  } catch (err) {
    console.error(`Error fetching ${url}:`, err.message);
    return null;
  }
}

export async function runScrape() {
  ensureDataDir();
  console.log('Starting AnimeFLV profile scraper...');
  let page = 1;
  const animeList = [];

  while (true) {
    const url = `${PROFILE_URL}?page=${page}`;
    console.log(`Fetching page ${page}: ${url}`);
    const html = await fetchPage(url);
    if (!html) {
      console.log('Failed to fetch page. Stopping scrape.');
      break;
    }

    const $ = cheerio.load(html);
    const animeElements = $('ul.ListAnimes li');
    
    if (animeElements.length === 0) {
      console.log(`No anime elements found on page ${page}. Finished scraping.`);
      break;
    }

    console.log(`Found ${animeElements.length} anime entries on page ${page}.`);

    animeElements.each((i, el) => {
      const titleLink = $(el).find('h3.Title a');
      const title = titleLink.text().trim();
      const href = titleLink.attr('href');
      const slug = href ? href.replace(/^\/anime\//, '') : '';
      
      const typeSpan = $(el).find('.Image .Type');
      const type = typeSpan.text().trim() || 'Anime';
      
      const ratingDiv = $(el).find('.Image .Vts');
      const rating = ratingDiv.text().trim() || 'N/A';
      
      const descP = $(el).find('.Image .Description p');
      const description = descP.text().trim() || '';

      const coverImg = $(el).find('.Image figure img').attr('src');

      animeList.push({
        title,
        slug,
        href,
        type,
        rating,
        description,
        coverImg
      });
    });

    await sleep(1000);
    page++;
  }

  console.log(`Scraping complete. Scraped ${animeList.length} anime in total.`);
  fs.writeFileSync(SCRAPED_FILE, JSON.stringify(animeList, null, 2));
  console.log(`Saved scraped list to ${SCRAPED_FILE}`);
}
