// Test script to demonstrate AST vs Regex FreeMarker processing integration
import { 
  extractFreemarkerTags, 
  extractFreemarkerTagsEnhanced,
  analyzeFreemarkerConditionals,
  parseTextWithFreemarkerEnhanced 
} from './src/DocumentEditorV2/utils/htmlUtils.js';

// Test cases based on your real-world scenarios
const testCases = [
  {
    name: "Simple Table Conditional (Well-structured)",
    html: `<table>
      <tr>
        <#if generalInsurance>
          <td>General Insurance Content</td>
        <#else>
          <td>No Insurance</td>
        </#if>
      </tr>
    </table>`
  },
  {
    name: "Orphaned Table Elements (Your Problem Case)",
    html: `<table>
      <tr><td>Header</td></tr>
    </table>
    <#if purchaseType == 'new'>
      <p>New purchase</p>
    <#elseif purchaseType == 'renewal'>
      <tr><td>Renewal data</td></tr>
    </#if>`
  },
  {
    name: "Complex Nested Conditionals",
    html: `<div>
      <#if user.active>
        <table>
          <#if user.premium>
            <tr><td>Premium Features</td></tr>
          <#else>
            <tr><td>Standard Features</td></tr>
          </#if>
        </table>
      <#else>
        <p>User inactive</p>
      </#if>
    </div>`
  },
  {
    name: "Mixed FreeMarker Elements",
    html: `<div>
      <h1>Welcome \${user.name}!</h1>
      <#list items as item>
        <p>\${item.title}</p>
      </#list>
      <#if showDetails>
        <table>
          <tr><td>Details here</td></tr>
        </table>
      </#if>
    </div>`
  }
];

console.log('=== FreeMarker Processing Integration Test ===\n');

async function runTests() {
  for (const [index, testCase] of testCases.entries()) {
    console.log(`\n--- Test Case ${index + 1}: ${testCase.name} ---`);
    console.log('Original HTML:');
    console.log(testCase.html);
    
    // Test 1: Current regex-based approach
    console.log('\n🔧 REGEX APPROACH (Current):');
    const regexStart = performance.now();
    const regexResult = extractFreemarkerTags(testCase.html);
    const regexTime = performance.now() - regexStart;
    console.log(`Processing time: ${regexTime.toFixed(2)}ms`);
    console.log('Processed HTML:', regexResult.substring(0, 200) + (regexResult.length > 200 ? '...' : ''));
    
    // Test 2: Enhanced AST-based approach
    console.log('\n🚀 AST APPROACH (Enhanced):');
    const astStart = performance.now();
    try {
      const astResult = await extractFreemarkerTagsEnhanced(testCase.html);
      const astTime = performance.now() - astStart;
      console.log(`Processing time: ${astTime.toFixed(2)}ms`);
      console.log('Processed HTML:', astResult.substring(0, 200) + (astResult.length > 200 ? '...' : ''));
      
      // Performance comparison
      const speedDiff = ((astTime - regexTime) / regexTime * 100).toFixed(1);
      console.log(`\n📊 Performance: AST is ${speedDiff}% ${speedDiff > 0 ? 'slower' : 'faster'} than regex`);
      
    } catch (error) {
      console.log('❌ AST processing failed:', error.message);
    }
    
    // Test 3: Conditional analysis comparison
    console.log('\n🔍 CONDITIONAL ANALYSIS:');
    try {
      const analysis = await analyzeFreemarkerConditionals(testCase.html);
      console.log(`Approach used: ${analysis.approach.toUpperCase()}`);
      console.log(`Blocks found: ${analysis.blocks.length}`);
      console.log(`Problematic blocks: ${analysis.hasProblematicBlocks ? 'YES' : 'NO'}`);
      
      if (analysis.approach === 'ast' && analysis.blocks.length > 0) {
        analysis.blocks.forEach((block, i) => {
          console.log(`  Block ${i + 1}: ${block.type} - ${block.hasOrphanedElements ? 'PROBLEMATIC' : 'SAFE'}`);
        });
      }
    } catch (error) {
      console.log('❌ Analysis failed:', error.message);
    }
    
    // Test 4: Text parsing comparison
    console.log('\n📝 TEXT PARSING:');
    try {
      const textSegments = await parseTextWithFreemarkerEnhanced(testCase.html);
      const freemarkerSegments = textSegments.filter(seg => seg.isFreemarker);
      const textSegmentsCount = textSegments.filter(seg => !seg.isFreemarker);
      
      console.log(`Total segments: ${textSegments.length}`);
      console.log(`FreeMarker segments: ${freemarkerSegments.length}`);
      console.log(`Text segments: ${textSegmentsCount.length}`);
      
      if (freemarkerSegments.length > 0) {
        console.log('FreeMarker elements found:');
        freemarkerSegments.forEach((seg, i) => {
          console.log(`  ${i + 1}: "${seg.content.substring(0, 50)}${seg.content.length > 50 ? '...' : ''}"`);
        });
      }
    } catch (error) {
      console.log('❌ Text parsing failed:', error.message);
    }
    
    console.log('\n' + '='.repeat(80));
  }
  
  console.log('\n=== INTEGRATION SUMMARY ===');
  console.log('✅ AST-based approach provides:');
  console.log('  - More accurate structural analysis');
  console.log('  - Better orphaned element detection');
  console.log('  - Semantic understanding of FreeMarker constructs');
  console.log('  - Automatic fallback to proven regex approach');
  console.log('');
  console.log('✅ Regex-based approach provides:');
  console.log('  - Faster processing for simple cases');
  console.log('  - Proven reliability with your existing templates');
  console.log('  - Lightweight operation');
  console.log('  - No external dependencies');
  console.log('');
  console.log('🎯 RECOMMENDATION: Use hybrid approach');
  console.log('  - AST for complex structural analysis');
  console.log('  - Regex for fast, simple processing');
  console.log('  - Automatic strategy selection based on complexity');
}

runTests().catch(console.error);
