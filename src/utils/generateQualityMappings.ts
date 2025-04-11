import * as fs from 'fs';
import * as path from 'path';
import { globSync } from 'glob';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import qualities from '../data/qualities.json' assert { type: 'json' };

export async function generateQualityMappings() {
  try {
    // Use glob to find all content files
    const contentFiles = globSync('src/content/en/**/*.mdx');
    
    const qualityMap = new Map();
    const allQualities = [...qualities.positive, ...qualities.negative, ...qualities.neutral];
    
    // Initialize map with empty arrays
    allQualities.forEach(quality => {
      qualityMap.set(quality, []);
    });
    
    // Process each content file
    contentFiles.forEach(filePath => {
      try {
        const content = readFileSync(filePath, 'utf8');
        const { data } = matter(content);
        
        if (!data.qualities) return;
        
        // Get collection from file path
        const pathParts = filePath.split('/');
        const collection = pathParts[pathParts.length - 2];
        
        const qualityList = data.qualities.split(',').map(q => q.trim());
        
        qualityList.forEach(quality => {
          if (qualityMap.has(quality)) {
            qualityMap.get(quality).push({
              id: data.slug,
              title: data.title,
              description: data.description || '',
              collection: collection 
            });
          }
        });
      } catch (err) {
        console.error(`Error processing file ${filePath}:`, err);
      }
    });
    
    // Convert to serializable object
    const qualityData = {};
    qualityMap.forEach((discourses, quality) => {
      qualityData[quality] = discourses;
    });
    
    // Write to file
    fs.writeFileSync(
      path.join(process.cwd(), 'src/data/qualityMappings.json'),
      JSON.stringify(qualityData, null, 2)
    );
    
    console.log('Quality mappings generated successfully');
  } catch (err) {
    console.error('Error generating quality mappings:', err);
  }
}

// Run the function when this module is the main module
generateQualityMappings().catch(console.error);