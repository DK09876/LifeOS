// Daily inspirational quotes - fetched from ZenQuotes API

export interface Quote {
  text: string;
  author: string;
}

// Fallback quotes in case API fails
const fallbackQuotes: Quote[] = [
  {
    text: "The secret of getting ahead is getting started.",
    author: "Mark Twain"
  },
  {
    text: "It always seems impossible until it's done.",
    author: "Nelson Mandela"
  },
  {
    text: "The way to get started is to quit talking and begin doing.",
    author: "Walt Disney"
  },
  {
    text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill"
  },
  {
    text: "What you do today can improve all your tomorrows.",
    author: "Ralph Marston"
  },
  {
    text: "Don't watch the clock; do what it does. Keep going.",
    author: "Sam Levenson"
  },
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs"
  },
  {
    text: "Small daily improvements are the key to staggering long-term results.",
    author: "Robin Sharma"
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
    // Fetch from our own API route (avoids CORS issues)
    const response = await fetch('/api/quote');

    if (response.ok) {
      const data = await response.json();
      if (data.text && data.author) {
        const quote: Quote = {
          text: data.text,
          author: data.author
        };
        setCachedQuote(quote);
        return quote;
      }
    }
  } catch {
    // Silently fall through to fallback quotes
  }

  // Return a fallback quote based on the day
  const index = new Date().getDate() % fallbackQuotes.length;
  return fallbackQuotes[index];
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
