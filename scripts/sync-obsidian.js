import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIGURATION - Update these paths for your setup
//const OBSIDIAN_VAULT_PATH = 'C:/path/to/your/obsidian/vault/notes';
const OBSIDIAN_VAULT_PATH = 'C:/Users/yasha/Documents/Primary-Vault';
const OUTPUT_PATH = path.join(__dirname, '../src/content/notes');
const IMAGES_OUTPUT_PATH = path.join(__dirname, '../public/assets/notes');

const FOLDER_MAPPINGS = {
  'Biology': 'biology',
  'Physics': 'physics',
  'Mathematics': 'mathematics',
  'Computational Biology': 'computational-biology',
  'Programming': 'programming',
  'Productivity': 'productivity',
  'Other Notes': 'uncategorized'
};


// Ensure output directories exist
if (!fs.existsSync(OUTPUT_PATH)) {
  fs.mkdirSync(OUTPUT_PATH, { recursive: true });
}
if (!fs.existsSync(IMAGES_OUTPUT_PATH)) {
  fs.mkdirSync(IMAGES_OUTPUT_PATH, { recursive: true });
}

// Recursively find all markdown files in a directory
function getAllMarkdownFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip hidden folders and system folders
      if (!file.startsWith('.') && file !== 'node_modules') {
        getAllMarkdownFiles(filePath, fileList);
      }
    } else if (file.endsWith('.md')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Check if file has website-folder property in frontmatter
function hasWebsiteFolder(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return false;
  
  const frontmatter = frontmatterMatch[1];
  return /website-folder:\s*["']?[\w-\/]+["']?/i.test(frontmatter);
}

function convertWikilinks(content) {
  // Convert [[Page Name]] to [Page Name](/notes/page-name)
  return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, link, displayText) => {
    const slug = link.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const text = displayText || link;
    return `[${text}](/notes/${slug})`;
  });
}

function convertImageEmbeds(content) {
  // Convert ![[image.png]] to ![image.png](/assets/notes/image.png)
  return content.replace(/!\[\[([^\]]+)\]\]/g, (match, image) => {
    return `![${image}](/assets/notes/${image})`;
  });
}

function convertCallouts(content) {
  // Convert Obsidian callouts to blockquotes
  const calloutRegex = /> \[!(\w+)\]\s*\n((?:> .*\n?)*)/g;
  return content.replace(calloutRegex, (match, type, contentLines) => {
    const cleanContent = contentLines.replace(/^> /gm, '');
    return `> **${type.charAt(0).toUpperCase() + type.slice(1)}:** ${cleanContent}`;
  });
}

function addFrontmatter(content, filename) {
  // Check if frontmatter already exists
  if (content.trim().startsWith('---')) {
    return content;
  }

  // Extract first heading as title if available
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : filename.replace('.md', '').replace(/-/g, ' ');

  // Extract first paragraph as description
  const descMatch = content.match(/\n\n([^#\n][^\n]+)\n/);
  const description = descMatch ? descMatch[1].substring(0, 150) : 'Note from Obsidian';

  const frontmatter = `---
title: "${title}"
description: "${description}"
date: ${new Date().toISOString().split('T')[0]}
tags: ["obsidian"]
---

`;
  return frontmatter + content;
}

function processNote(filePath) {
  const filename = path.basename(filePath);
  const outputPath = path.join(OUTPUT_PATH, filename);

  try {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Check if note has website-folder property
    if (!hasWebsiteFolder(content)) {
      console.log(`⊘ Skipped (no website-folder): ${filename}`);
      return false;
    }

    // Apply conversions
    content = convertWikilinks(content);
    content = convertImageEmbeds(content);
    content = convertCallouts(content);

    // Write processed content (don't add frontmatter if it already exists)
    fs.writeFileSync(outputPath, content);
    console.log(`✓ Processed: ${filename}`);
    return true;
  } catch (error) {
    console.error(`✗ Error processing ${filename}:`, error.message);
    return false;
  }
}

function copyImages() {
  const imagesPath = path.join(path.dirname(OBSIDIAN_VAULT_PATH), 'attachments');
  
  if (!fs.existsSync(imagesPath)) {
    console.log('ℹ No attachments folder found, skipping images');
    return;
  }

  const images = fs.readdirSync(imagesPath)
    .filter(f => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f));

  images.forEach(image => {
    try {
      fs.copyFileSync(
        path.join(imagesPath, image),
        path.join(IMAGES_OUTPUT_PATH, image)
      );
      console.log(`✓ Copied image: ${image}`);
    } catch (error) {
      console.error(`✗ Error copying ${image}:`, error.message);
    }
  });
}

function syncNotes() {
  console.log('🔄 Starting Obsidian notes sync...\n');
  console.log('📂 Searching for notes with "website-folder" property...\n');

  // Check if vault path exists
  if (!fs.existsSync(OBSIDIAN_VAULT_PATH)) {
    console.error(`❌ Obsidian vault path not found: ${OBSIDIAN_VAULT_PATH}`);
    console.log('Please update OBSIDIAN_VAULT_PATH in scripts/sync-obsidian.js');
    process.exit(1);
  }

  // Get all markdown files recursively
  const allFiles = getAllMarkdownFiles(OBSIDIAN_VAULT_PATH);
  console.log(`Found ${allFiles.length} total markdown files in vault\n`);

  // Process each note (only those with website-folder property)
  let processedCount = 0;
  let skippedCount = 0;
  
  allFiles.forEach(filePath => {
    const result = processNote(filePath);
    if (result) {
      processedCount++;
    } else {
      skippedCount++;
    }
  });

  // Copy images
  console.log('\n📁 Copying images...');
  copyImages();

  console.log('\n✨ Sync complete!');
  console.log(`\n📊 Summary:`);
  console.log(`   ✓ Processed: ${processedCount} notes`);
  console.log(`   ⊘ Skipped: ${skippedCount} notes (no website-folder property)`);
  console.log(`   📁 Output: ${OUTPUT_PATH}`);
}

// Run the sync
syncNotes();
