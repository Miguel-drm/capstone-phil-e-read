const fs = require('fs');

const content = fs.readFileSync('frontend/src/pages/teacher/ReadingSessionPage.tsx', 'utf8');
const lines = content.split('\n');

let braceCount = 0;
let inReactComponent = false;
let reactComponentStartLine = 0;

console.log('Analyzing React component structure...\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  // Detect React component start
  if (line.includes('const ReadingSessionPage: React.FC = () => {')) {
    inReactComponent = true;
    reactComponentStartLine = lineNum;
    braceCount = 1; // Start counting from the component opening brace
    console.log(`📍 React component starts at line ${lineNum}`);
    continue;
  }
  
  if (inReactComponent) {
    // Count braces
    for (const char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
    
    // Check if React component might be closed prematurely
    if (braceCount === 0 && lineNum < 5600) { // Component should end near line 5695
      console.log(`⚠️  React component CLOSED PREMATURELY at line ${lineNum}`);
      console.log(`   Line content: ${line.trim()}`);
      console.log(`   Next line: ${lines[i + 1]?.trim() || 'N/A'}`);
      console.log('');
      
      // Show context around this line
      for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
        const marker = j === i ? '>>> ' : '    ';
        console.log(`${marker}${j + 1}: ${lines[j]}`);
      }
      console.log('');
      break; // Stop after finding the first premature closure
    }
  }
}

console.log(`\nReact component analysis complete.`);