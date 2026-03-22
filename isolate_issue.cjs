const fs = require('fs');

// Read the original file
const content = fs.readFileSync('frontend/src/pages/teacher/ReadingSessionPage.tsx', 'utf8');
const lines = content.split('\n');

// Find the React component start and end
let componentStart = -1;
let componentEnd = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const ReadingSessionPage: React.FC = () => {')) {
    componentStart = i;
  }
  if (lines[i].includes('export default ReadingSessionPage;')) {
    componentEnd = i;
    break;
  }
}

console.log(`Component found from line ${componentStart + 1} to ${componentEnd + 1}`);

// Create a minimal version by commenting out the large useEffect block
let modifiedLines = [...lines];

// Find and comment out the large useEffect block (around lines 3078-4117)
let inLargeUseEffect = false;
let useEffectStart = -1;
let useEffectEnd = -1;

for (let i = componentStart; i < componentEnd; i++) {
  const line = lines[i];
  
  // Look for the large useEffect that processes transcript
  if (line.includes('useEffect(() => {') && 
      i < lines.length - 10 && 
      lines[i + 5] && lines[i + 5].includes('transcript')) {
    useEffectStart = i;
    inLargeUseEffect = true;
    console.log(`Found large useEffect starting at line ${i + 1}`);
  }
  
  if (inLargeUseEffect && line.includes('}, [transcript, realWords, currentWordIndex]);')) {
    useEffectEnd = i;
    inLargeUseEffect = false;
    console.log(`Large useEffect ends at line ${i + 1}`);
    break;
  }
}

if (useEffectStart !== -1 && useEffectEnd !== -1) {
  console.log(`Commenting out lines ${useEffectStart + 1} to ${useEffectEnd + 1}`);
  
  // Comment out the large useEffect block
  for (let i = useEffectStart; i <= useEffectEnd; i++) {
    modifiedLines[i] = '  // ' + modifiedLines[i];
  }
  
  // Write the modified file
  fs.writeFileSync('frontend/src/pages/teacher/ReadingSessionPage.tsx.backup', content);
  fs.writeFileSync('frontend/src/pages/teacher/ReadingSessionPage.tsx', modifiedLines.join('\n'));
  
  console.log('✅ Created backup and modified file. Try building now.');
} else {
  console.log('❌ Could not find the large useEffect block');
}