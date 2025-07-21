// Copy the original file and replace just the Twitter ID function
import fs from 'fs';

// Read the original file
const originalContent = fs.readFileSync('/home/ubuntu/medical-research-agent/src/medical-core.ts', 'utf8');

// Find the start and end of the lookupTwitterId function
const functionStart = originalContent.indexOf('async function lookupTwitterId');
const functionEnd = originalContent.indexOf('\n}\n', functionStart) + 3;

// Extract the parts before and after the function
const beforeFunction = originalContent.substring(0, functionStart);
const afterFunction = originalContent.substring(functionEnd);

// New simplified function
const newFunction = `async function lookupTwitterId(username: string): Promise<string | null> {
  try {
    // Remove @ symbol if present
    const cleanUsername = username.replace('@', '');
    
    log(\`🔍 Looking up Twitter ID for @\${cleanUsername}...\`);
    
    // Simple, reliable search strategy
    const searchQuery = \`"\${cleanUsername}" site:twiteridfinder.com OR "\${cleanUsername}" twitter id\`;
    
    try {
      const searchResults = await googleSearch(searchQuery, 2);
      
      for (const result of searchResults) {
        const textToSearch = \`\${result.title} \${result.snippet}\`;
        
        // Simple pattern matching for Twitter IDs
        const idPatterns = [
          /ID[:\\s]*(\\d{10,20})/i,
          /(\\d{15,20})/,
          /@\\w+[:\\s]*(\\d{10,20})/i,
        ];
        
        for (const pattern of idPatterns) {
          const match = textToSearch.match(pattern);
          if (match && match[1] && /^\\d{10,20}$/.test(match[1])) {
            log(\`✅ Found Twitter ID: \${match[1]} for @\${cleanUsername}\`);
            return match[1];
          }
        }
      }
    } catch (searchError) {
      log(\`Search error for Twitter ID lookup:\`, searchError);
    }
    
    log(\`❌ Could not find Twitter ID for @\${cleanUsername}\`);
    return null;
    
  } catch (error) {
    log(\`❌ Error looking up Twitter ID for @\${username}:\`, error);
    return null;
  }
}`;

// Combine the parts
const newContent = beforeFunction + newFunction + afterFunction;

// Write the new file
fs.writeFileSync('/home/ubuntu/medical-research-agent/src/medical-core.ts', newContent);

console.log('✅ Twitter ID lookup function simplified and replaced');

