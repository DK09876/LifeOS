// Daily inspirational quotes - fetched from ZenQuotes API

export interface Quote {
  text: string;
  author: string;
}

// Fallback quotes in case API fails
const fallbackQuotes: Quote[] = [
  {
    text: "Some people thrive on huge, dramatic change. Some people prefer the slow and steady route. Do what's right for you.",
    author: "Julie Morgenstern"
  },
  {
    text: "The secret of getting ahead is getting started.",
    author: "Mark Twain"
  },
  {
    text: "Done is better than perfect.",
    author: "Sheryl Sandberg"
  },
  {
    text: "The way to get started is to quit talking and begin doing.",
    author: "Walt Disney"
  },
  {
    text: "It always seems impossible until it's done.",
    author: "Nelson Mandela"
  },
];

// Cache the quote for the day in localStorage
const QUOTE_CACHE_KEY = 'lifeos_daily_quote';
const QUOTE_DATE_KEY = 'lifeos_quote_date';

function getCachedQuote(): Quote | null {
  if (typeof window === 'undefined') return null;

  try {
    const cachedDate = localStorage.getItem(QUOTE_DATE_KEY);
    const today = new Date().toDateString();

    if (cachedDate === today) {
      const cached = localStorage.getItem(QUOTE_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    }
  } catch {
    // localStorage not available
  }
  return null;
}

function setCachedQuote(quote: Quote): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify(quote));
    localStorage.setItem(QUOTE_DATE_KEY, new Date().toDateString());
  } catch {
    // localStorage not available
  }
}

export async function fetchDailyQuote(): Promise<Quote> {
  // Check cache first
  const cached = getCachedQuote();
  if (cached) {
    return cached;
  }

  try {
    // ZenQuotes API - free, no auth required
    // Using CORS proxy since ZenQuotes doesn't support CORS
    const response = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://zenquotes.io/api/today'));

    if (!response.ok) {
      throw new Error('Failed to fetch quote');
    }

    const data = await response.json();

    if (data && data[0]) {
      const quote: Quote = {
        text: data[0].q,
        author: data[0].a
      };
      setCachedQuote(quote);
      return quote;
    }

    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Error fetching quote:', error);
    // Return a random fallback quote
    const index = new Date().getDate() % fallbackQuotes.length;
    return fallbackQuotes[index];
  }
}

// Synchronous version using fallback (for initial render)
export function getDailyQuote(): Quote {
  const cached = getCachedQuote();
  if (cached) {
    return cached;
  }
  const index = new Date().getDate() % fallbackQuotes.length;
  return fallbackQuotes[index];
}
