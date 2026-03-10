import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
import markdownify
import re
import uuid
from datetime import datetime

import concurrent.futures

url_file = "all_urls.txt"
urls = []
if os.path.exists(url_file):
    with open(url_file, 'r') as f:
        urls = [line.strip() for line in f if line.strip()]
else:
    print(f"No {url_file} found.")
    exit(1)

def slugify(url):
    path = urlparse(url).path
    parts = path.split('/')
    filename = parts[-1]
    if filename.endswith('.html'):
        filename = filename[:-5]
    return f"{filename}.md"

def convert_url(url):
    # If the URL is an internal link to the starting gate, link to the local md file
    if "miamiherald.typepad.com/the-starting-gate" in url:
        # Extract the original path from the wayback url if needed
        # Typical wayback url format: http://web.archive.org/web/12345/http://original.url
        match = re.search(r'miamiherald\.typepad\.com/the-starting-gate/.*?(?:([^/]+\.html)|/?$)', url)
        if match and match.group(1):
             return match.group(1).replace('.html', '.md')
        else:
             return "index.md"
    # Strip Wayback Machine prefix for external links if present
    wayback_match = re.search(r'/web/\d+(?:im_)?/(https?://.*)', url)
    if wayback_match:
        return wayback_match.group(1)
        
    return url

os.makedirs("articles", exist_ok=True)
os.makedirs("public/images", exist_ok=True)

def process_url(url):
    filename = slugify(url)
    filepath = os.path.join("articles", filename)
    
    # Skip if already downloaded
    if os.path.exists(filepath):
        return
        
    try:
        response = requests.get(url, timeout=30)
        # Handle wayback machine transient errors mildly
        if response.status_code != 200: return
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract title
        title_element = soup.find('h3', class_='entry-header')
        title = title_element.get_text(strip=True) if title_element else "Untitled"
        
        # Extract body
        body_element = soup.find('div', class_='entry-body') or soup.find('div', class_='entry-content')
        if not body_element:
            print(f"Could not find entry body for {url}")
            return
            
        # Process links inside the body
        for a in body_element.find_all('a', href=True):
            a['href'] = convert_url(a['href'])
            
        for img in body_element.find_all('img', src=True):
            img_src = img['src']
            if img_src.startswith('//'):
                img_src = "http:" + img_src
                
            try:
                img_response = requests.get(img_src, stream=True, timeout=15)
                if img_response.status_code == 200:
                    parsed = urlparse(img_src)
                    filename = os.path.basename(parsed.path)
                    if not filename:
                        filename = f"image_{uuid.uuid4().hex[:8]}.jpg"
                    
                    _, ext = os.path.splitext(filename)
                    if not ext:
                        filename += ".jpg"
                        
                    filepath = os.path.join("public", "images", filename)
                    
                    if not os.path.exists(filepath):
                        with open(filepath, 'wb') as f:
                            for chunk in img_response.iter_content(chunk_size=8192):
                                f.write(chunk)
                                
                    # Update the src to point to the local file
                    # Since articles are in "articles/", the relative path is "../images/filename"
                    img['src'] = f"../images/{filename}"
                else:
                    print(f"Failed to download image (Status {img_response.status_code}): {img_src}")
            except Exception as e:
                print(f"Failed to download image {img_src}: {e}")
            
        # Convert body to markdown
        content_html = str(body_element)
        content_md = markdownify.markdownify(content_html, heading_style="ATX")
        
        
        # Clean up excessive newlines
        content_md = re.sub(r'\n{3,}', '\n\n', content_md).strip()
        
        # Extract date from wayback machine URL
        date_str = "March 2012"
        wayback_match = re.search(r'/web/(\d{4})(\d{2})(\d{2})\d+/', url)
        if wayback_match:
            year = int(wayback_match.group(1))
            month = int(wayback_match.group(2))
            day = int(wayback_match.group(3))
            date_str = datetime(year, month, day).strftime("%B %d, %Y")
            
        # Save to file
        filename = slugify(url)
        filepath = os.path.join("articles", filename)
        
        # Clean title for YAML frontmatter
        clean_title = title.replace('"', '\\"').replace('\n', ' ')
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("---\n")
            f.write(f"title: \"{clean_title}\"\n")
            f.write(f"date: \"{date_str}\"\n")
            f.write("---\n\n")
            f.write(f"# {title}\n\n")
            f.write(content_md)
            
    except Exception as e:
        print(f"Error on {url}: {e}")

print(f"Starting to download {len(urls)} articles...")
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    executor.map(process_url, urls)
    
print("Finished archiving.")
