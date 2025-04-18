#!/usr/bin/env python3
"""
Real Estate News Aggregator using Google News RSS Feeds

This script demonstrates how to use Google News RSS feeds to fetch real estate news
using advanced search operators and feed types. It showcases:

1. Exact phrase matching for more relevant results
2. Location-specific real estate news
3. Time-filtered real estate news
4. Source-specific real estate news
5. Advanced search combinations
6. Categorized output

The script generates an HTML file with all the news articles organized by category.
"""

import feedparser
import time
import random
from datetime import datetime
import pytz
from dateutil import parser as dateparser
from urllib.parse import quote
import os
from bs4 import BeautifulSoup

# Constants
TEMPLATE_PATH = "template.html"  # Use existing template if available
OUTPUT_PATH = "real-estate-news.html"
MAX_ARTICLES_PER_FEED = 100  # Google News RSS limit

# Configuration
# Set to True to see more detailed output
DEBUG = False

# Define feed categories and their corresponding RSS URLs
RSS_FEEDS = {
    "General Real Estate News": {
        "Real Estate in Title": "https://news.google.com/rss/search?q=intitle:%22real+estate%22&hl=en-US&gl=US&ceid=US:en",
        "Housing Market in Title": "https://news.google.com/rss/search?q=intitle:%22housing+market%22&hl=en-US&gl=US&ceid=US:en",
        "Property Market in Title": "https://news.google.com/rss/search?q=intitle:property+intitle:market&hl=en-US&gl=US&ceid=US:en",
        "Recent Real Estate in Title": "https://news.google.com/rss/search?q=intitle:%22real+estate%22+when:7d&hl=en-US&gl=US&ceid=US:en"
    },
    "Bing News": {
        "Bing Real Estate": "https://www.bing.com/news/search?q=real+estate&format=rss&cc=US",
        "Bing Housing Market": "https://www.bing.com/news/search?q=housing+market&format=rss&cc=US",
        "Bing Property News": "https://www.bing.com/news/search?q=property+news&format=rss&cc=US",
        "Bing Mortgage News": "https://www.bing.com/news/search?q=mortgage+news&format=rss&cc=US"
    },
    "Commercial Real Estate": {
        "Commercial Real Estate in Title": "https://news.google.com/rss/search?q=intitle:%22commercial+real+estate%22&hl=en-US&gl=US&ceid=US:en",
        "Office Space in Title": "https://news.google.com/rss/search?q=intitle:%22office+space%22&hl=en-US&gl=US&ceid=US:en",
        "Retail Property in Title": "https://news.google.com/rss/search?q=intitle:%22retail+property%22+OR+intitle:%22retail+space%22&hl=en-US&gl=US&ceid=US:en",
        "Industrial Real Estate in Title": "https://news.google.com/rss/search?q=intitle:%22industrial+real+estate%22+OR+intitle:%22warehouse+space%22&hl=en-US&gl=US&ceid=US:en"
    },
    "Residential Real Estate": {
        "Home Sales in Title": "https://news.google.com/rss/search?q=intitle:%22home+sales%22+OR+intitle:%22house+prices%22&hl=en-US&gl=US&ceid=US:en",
        "Mortgage Rates in Title": "https://news.google.com/rss/search?q=intitle:%22mortgage+rates%22&hl=en-US&gl=US&ceid=US:en",
        "Rental Market in Title": "https://news.google.com/rss/search?q=intitle:%22rental+market%22+OR+intitle:%22apartment+rental%22&hl=en-US&gl=US&ceid=US:en",
        "Affordable Housing in Title": "https://news.google.com/rss/search?q=intitle:%22affordable+housing%22&hl=en-US&gl=US&ceid=US:en"
    },
    "Regional Real Estate": {
        "New York Real Estate in Title": "https://news.google.com/rss/search?q=intitle:%22new+york%22+intitle:%22real+estate%22&hl=en-US&gl=US&ceid=US:en",
        "California Housing in Title": "https://news.google.com/rss/search?q=intitle:california+(intitle:%22real+estate%22+OR+intitle:housing)&hl=en-US&gl=US&ceid=US:en",
        "Florida Property in Title": "https://news.google.com/rss/search?q=intitle:florida+(intitle:%22real+estate%22+OR+intitle:property)&hl=en-US&gl=US&ceid=US:en",
        "Texas Real Estate in Title": "https://news.google.com/rss/search?q=intitle:texas+intitle:%22real+estate%22&hl=en-US&gl=US&ceid=US:en"
    },
    "Real Estate Trends": {
        "Real Estate Technology in Title": "https://news.google.com/rss/search?q=intitle:%22real+estate%22+(intitle:technology+OR+intitle:proptech)&hl=en-US&gl=US&ceid=US:en",
        "Sustainable Housing in Title": "https://news.google.com/rss/search?q=(intitle:sustainable+OR+intitle:green)+(intitle:housing+OR+intitle:%22real+estate%22)&hl=en-US&gl=US&ceid=US:en",
        "Real Estate Investment in Title": "https://news.google.com/rss/search?q=intitle:%22real+estate+investment%22+OR+intitle:%22property+investment%22&hl=en-US&gl=US&ceid=US:en",
        "Market Analysis in Title": "https://news.google.com/rss/search?q=intitle:%22real+estate+market%22+(intitle:analysis+OR+intitle:forecast+OR+intitle:outlook)&hl=en-US&gl=US&ceid=US:en"
    },
    "Real Estate from Major Sources": {
        "WSJ Real Estate in Title": "https://news.google.com/rss/search?q=intitle:%22real+estate%22+inurl:wsj.com&hl=en-US&gl=US&ceid=US:en",
        "Bloomberg Property in Title": "https://news.google.com/rss/search?q=(intitle:%22real+estate%22+OR+intitle:property)+inurl:bloomberg.com&hl=en-US&gl=US&ceid=US:en",
        "Reuters Real Estate in Title": "https://news.google.com/rss/search?q=intitle:%22real+estate%22+inurl:reuters.com&hl=en-US&gl=US&ceid=US:en",
        "CNBC Housing in Title": "https://news.google.com/rss/search?q=(intitle:%22real+estate%22+OR+intitle:housing)+inurl:cnbc.com&hl=en-US&gl=US&ceid=US:en"
    }
}

def debug_print(message):
    """Print debug messages if DEBUG is enabled."""
    if DEBUG:
        print(f"[DEBUG] {message}")

def fetch_feed(feed_url, feed_name, category):
    """Fetch and process a feed, with error handling."""
    print(f"Fetching: {feed_name} (Category: {category})")
    
    try:
        # Add a small delay to avoid hitting rate limits
        time.sleep(random.uniform(0.5, 1.5))
        
        # Parse the feed
        feed = feedparser.parse(feed_url)
        
        if hasattr(feed, 'status') and feed.status != 200:
            print(f"⚠️ Error: Received status code {feed.status} for {feed_name}")
            return []
        
        if not feed.entries:
            print(f"⚠️ No entries found in {feed_name}")
            return []
        
        # Process feed entries
        articles = []
        for entry in feed.entries:
            # Extract article information
            title = entry.title.strip()
            link = entry.link.strip()
            
            # Extract and parse publication date
            published_str = entry.get("published", "")
            try:
                published_dt = dateparser.parse(published_str)
                if published_dt and published_dt.tzinfo is None:
                    published_dt = pytz.timezone("US/Eastern").localize(published_dt)
            except Exception:
                published_dt = datetime.now(pytz.timezone("US/Eastern"))
            
            # Format the date for display
            published = published_dt.strftime("%Y-%m-%d %H:%M")
            
            # Add article to the list
            articles.append({
                "title": title,
                "link": link,
                "published": published,
                "datetime_obj": published_dt,
                "feed_name": feed_name,
                "category": category
            })
        
        print(f"✅ Successfully fetched {len(articles)} articles from {feed_name}")
        return articles
    
    except Exception as e:
        print(f"⚠️ Error fetching {feed_name}: {e}")
        return []

def remove_duplicates(articles):
    """Remove duplicate articles based on title and link."""
    seen = set()
    unique = []
    
    for article in articles:
        # Create a unique key using title and link
        key = f"{article['title'].lower()}|{article['link']}"
        
        if key not in seen:
            seen.add(key)
            unique.append(article)
    
    print(f"Removed {len(articles) - len(unique)} duplicate articles")
    return unique

def extract_existing_articles():
    """Extract existing articles from the output HTML file if it exists."""
    if not os.path.exists(OUTPUT_PATH):
        return []
    
    existing_articles = []
    seen = set()
    
    try:
        with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        
        soup = BeautifulSoup(content, 'html.parser')
        news_items = soup.select('.news-item')
        
        for item in news_items:
            link_tag = item.find('a')
            if not link_tag:
                continue
                
            title = link_tag.text.strip()
            link = link_tag.get('href', '').strip()
            
            # Extract category and feed name
            category_tag = item.select_one('.category')
            feed_tag = item.select_one('.feed-name')
            
            category = category_tag.text.strip() if category_tag else "Unknown"
            feed_name = feed_tag.text.strip() if feed_tag else "Unknown"
            
            # Extract publication date
            published_tag = item.find('small')
            published_str = published_tag.text.strip() if published_tag else ""
            
            try:
                published_dt = dateparser.parse(published_str) if published_str else datetime.min
                if published_dt and published_dt.tzinfo is None:
                    published_dt = pytz.timezone("US/Eastern").localize(published_dt)
            except Exception:
                published_dt = datetime.min
            
            key = f"{title.lower()}|{link}"
            if key not in seen:
                seen.add(key)
                existing_articles.append({
                    "title": title,
                    "link": link,
                    "published": published_str,
                    "datetime_obj": published_dt,
                    "category": category,
                    "feed_name": feed_name
                })
        
        print(f"✅ Found {len(existing_articles)} existing articles")
        return existing_articles
    except Exception as e:
        print(f"⚠️ Warning: Could not extract existing articles: {e}")
        return []

def generate_news_html(articles_by_category):
    """Generate HTML content for the news articles in a single list."""
    html = f'<p class="last-updated">Last updated: {datetime.now(pytz.timezone("US/Eastern")).strftime("%Y-%m-%d %H:%M:%S %Z")}</p>\n'
    
    # Flatten all articles into a single list
    all_articles = []
    for category, feeds in articles_by_category.items():
        for feed_name, articles in feeds.items():
            for article in articles:
                all_articles.append(article)
    
    # Sort all articles by date (newest first)
    all_articles.sort(key=lambda x: x["datetime_obj"], reverse=True)
    
    # Create a single news list with all articles
    html += '<ul class="news-list">\n'
    
    for article in all_articles:
        html += f'''<li class="news-item">
            <a href="{article["link"]}" target="_blank">{article["title"]}</a>
            <div class="meta">
                <small>{article["published"]}</small>
                <span class="category" style="display:none;">{article["category"]}</span>
                <span class="feed-name" style="display:none;">{article["feed_name"]}</span>
            </div>
        </li>\n'''
    
    html += '</ul>\n'
    
    # No need to add JavaScript for search functionality as it's already in the template
    
    return html

def inject_into_template(news_html):
    """Inject the news HTML into the template or create a standalone HTML file."""
    try:
        template = None
        
        # Try to read the template file if it exists
        if os.path.exists(TEMPLATE_PATH):
            try:
                with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
                    template = f.read()
                
                # Check if the template has the placeholder
                if "<!-- NEWS_CONTENT_PLACEHOLDER -->" in template:
                    final_html = template.replace("<!-- NEWS_CONTENT_PLACEHOLDER -->", news_html)
                else:
                    # If no placeholder, create a simple wrapper around the content
                    final_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Real Estate News</title>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <style>
        body {{ font-family: Arial, sans-serif; padding: 20px; }}
        .news-list {{ padding-left: 0; list-style-type: none; }}
        .news-item {{ margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee; }}
        .meta {{ color: #666; font-size: 0.9em; margin-top: 5px; }}
        .category-section {{ margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #ddd; }}
        .feed-section {{ margin-bottom: 20px; }}
        .search-container {{ margin-bottom: 20px; }}
        .search-input {{ padding: 8px; width: 300px; border: 1px solid #ddd; border-radius: 4px; }}
        .search-results {{ margin-left: 10px; color: #666; }}
        .category-nav {{ margin-bottom: 30px; background-color: #f8f9fa; padding: 15px; border-radius: 5px; }}
        .category-nav ul {{ list-style-type: none; padding-left: 0; }}
        .category-nav li {{ display: inline-block; margin-right: 15px; }}
        .last-updated {{ color: #666; font-style: italic; padding-top: 35px; margin-bottom: 20px; }}
        h1, h2, h3 {{ color: #333; }}
        h1 {{ padding-top: 2px; }}
    </style>
</head>
<body>
    <div class="container">
        {news_html}
    </div>
</body>
</html>'''
            except Exception as e:
                print(f"⚠️ Error reading template file: {e}")
                template = None
        
        # If we couldn't use the template, create a standalone HTML file
        if template is None:
            final_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Real Estate News</title>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <style>
        body {{ font-family: Arial, sans-serif; padding: 20px; }}
        .news-list {{ padding-left: 0; list-style-type: none; }}
        .news-item {{ margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee; }}
        .meta {{ color: #666; font-size: 0.9em; margin-top: 5px; }}
        .category-section {{ margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #ddd; }}
        .feed-section {{ margin-bottom: 20px; }}
        .search-container {{ margin-bottom: 20px; }}
        .search-input {{ padding: 8px; width: 300px; border: 1px solid #ddd; border-radius: 4px; }}
        .search-results {{ margin-left: 10px; color: #666; }}
        .category-nav {{ margin-bottom: 30px; background-color: #f8f9fa; padding: 15px; border-radius: 5px; }}
        .category-nav ul {{ list-style-type: none; padding-left: 0; }}
        .category-nav li {{ display: inline-block; margin-right: 15px; }}
        .last-updated {{ color: #666; font-style: italic; margin-bottom: 20px; }}
        h1, h2, h3 {{ color: #333; }}
    </style>
</head>
<body>
    <div class="container">
        {news_html}
    </div>
</body>
</html>'''
        
        # Write the final HTML to the output file
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            f.write(final_html)
        
        print(f"✅ Successfully wrote output to {OUTPUT_PATH}")
        
    except Exception as e:
        print(f"⚠️ Error creating output file: {e}")

def main():
    """Main function to fetch real estate news and generate HTML output."""
    print("🔍 Fetching Real Estate News using Google News RSS Feeds...")
    
    # Get existing articles if available
    existing_articles = extract_existing_articles()
    print(f"✅ Found {len(existing_articles)} existing articles")
    
    # Dictionary to store all articles by category and feed (for organization)
    all_articles_by_category = {}
    
    # Track all articles for deduplication
    all_articles = []
    
    # Process each category and its feeds
    for category, feeds in RSS_FEEDS.items():
        print(f"\n📊 Processing category: {category}")
        
        category_articles = {}
        
        for feed_name, feed_url in feeds.items():
            # Fetch articles from this feed
            articles = fetch_feed(feed_url, feed_name, category)
            
            # Add to the overall list for deduplication
            all_articles.extend(articles)
            
            # Store in the category dictionary
            category_articles[feed_name] = articles
        
        # Store in the main dictionary
        all_articles_by_category[category] = category_articles
    
    # Combine with existing articles
    if existing_articles:
        print("\n🔄 Combining with existing articles...")
        all_articles.extend(existing_articles)
    
    # Sort all articles by date (newest first) before deduplication
    # This ensures that when removing duplicates, we keep the most recent version
    all_articles.sort(key=lambda x: x["datetime_obj"], reverse=True)
    
    # Remove duplicates
    unique_articles = remove_duplicates(all_articles)
    
    # Reorganize unique articles by category and feed
    organized_articles = {}
    
    for article in unique_articles:
        category = article["category"]
        feed_name = article["feed_name"]
        
        if category not in organized_articles:
            organized_articles[category] = {}
        
        if feed_name not in organized_articles[category]:
            organized_articles[category][feed_name] = []
        
        organized_articles[category][feed_name].append(article)
    
    # Generate HTML and update the file
    print("\n📝 Generating HTML output...")
    news_html = generate_news_html(organized_articles)
    inject_into_template(news_html)
    
    print("\n✅ Real Estate News aggregation complete!")
    print(f"📊 Total unique articles: {len(unique_articles)}")
    print(f"📄 Output saved to: {OUTPUT_PATH}")
    print("🌐 Open this file in your web browser to view the results")

if __name__ == "__main__":
    main()
