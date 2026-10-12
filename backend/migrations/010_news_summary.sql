-- RSS description, used as a fallback when the article page cannot be extracted (bot walls, JS-only sites).
ALTER TABLE news_items ADD COLUMN summary text;
