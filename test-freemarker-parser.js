// Test script to evaluate freemarker-parser library
import freemarker from 'freemarker-parser';

// Test cases based on your existing FreeMarker patterns
const testCases = [
  {
    name: "Simple Variable",
    template: "${user.name}"
  },
  {
    name: "Simple Conditional",
    template: "<#if condition>Hello<#else>Goodbye</#if>"
  },
  {
    name: "Table Spanning Conditional (Your Problem Case)",
    template: `<table>
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
    name: "Complex Orphaned Table Elements (Your Edge Case)",
    template: `<table>
      <tr><td>Header</td></tr>
    </table>
    <#if purchaseType == 'new'>
      <p>New purchase</p>
    <#elseif purchaseType == 'renewal'>
      <tr><td>Renewal data</td></tr>
    </#if>`
  },
  {
    name: "Nested Conditionals",
    template: `<#if user.active>
      <#if user.premium>
        <span>Premium User</span>
      <#else>
        <span>Regular User</span>
      </#if>
    <#else>
      <span>Inactive</span>
    </#if>`
  },
  {
    name: "List Directive",
    template: `<#list items as item>
      <li>\${item.name}</li>
    </#list>`
  }
];

console.log('=== FreeMarker Parser Library Analysis ===\n');

const parser = new freemarker.Parser();

testCases.forEach((testCase, index) => {
  console.log(`\n--- Test Case ${index + 1}: ${testCase.name} ---`);
  console.log('Template:', testCase.template);
  
  try {
    const result = parser.parse(testCase.template, {
      parseLocation: true,
      useSquareTags: false
    });
    
    console.log('\n✅ Parsing successful!');
    console.log('AST Structure:');
    console.log(JSON.stringify(result.ast, null, 2));
    
    console.log('\nTokens:');
    result.tokens.forEach((token, i) => {
      console.log(`  ${i}: ${token.type} - "${token.text}" (${token.startLine}:${token.startColumn})`);
    });
    
    // Analyze AST for structural information
    analyzeAST(result.ast, testCase.name);
    
  } catch (error) {
    console.log('❌ Parsing failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
});

function analyzeAST(ast, testName) {
  console.log('\n🔍 AST Analysis:');
  
  const analysis = {
    conditionals: [],
    variables: [],
    htmlElements: [],
    textNodes: []
  };
  
  function traverse(node, depth = 0) {
    const indent = '  '.repeat(depth);
    
    if (node.type) {
      console.log(`${indent}${node.type}:`, node.value || node.condition || node.name || '(no value)');
      
      switch (node.type) {
        case 'if':
          analysis.conditionals.push({
            condition: node.condition,
            hasElse: !!node.elseContent,
            location: node.location
          });
          break;
        case 'interpolation':
          analysis.variables.push({
            expression: node.expression,
            location: node.location
          });
          break;
        case 'text':
          if (node.value && node.value.trim()) {
            analysis.textNodes.push(node.value.trim());
          }
          break;
      }
    }
    
    // Traverse children
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(child => traverse(child, depth + 1));
    }
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => traverse(child, depth + 1));
    }
    if (node.elseContent && Array.isArray(node.elseContent)) {
      node.elseContent.forEach(child => traverse(child, depth + 1));
    }
  }
  
  if (Array.isArray(ast)) {
    ast.forEach(node => traverse(node));
  } else {
    traverse(ast);
  }
  
  console.log('\n📊 Summary:');
  console.log(`  - Conditionals: ${analysis.conditionals.length}`);
  console.log(`  - Variables: ${analysis.variables.length}`);
  console.log(`  - Text nodes: ${analysis.textNodes.length}`);
  
  // Check for HTML content in text nodes
  const hasHTML = analysis.textNodes.some(text => 
    text.includes('<') && text.includes('>')
  );
  
  if (hasHTML) {
    console.log('  ⚠️  Contains HTML content in text nodes');
  }
}

console.log('\n=== Comparison with Current Regex Approach ===');
console.log('Current regex patterns used in your htmlUtils.ts:');
console.log('1. /\\$\\{[^}]+\\}|<#[^>]*>|<\\/#[^>]*>/g - General FreeMarker detection');
console.log('2. /<#if[\\s\\S]*?<\\/#if>/gi - Complete conditional blocks');
console.log('3. /<#(?:if\\s[^>]*|else|elseif\\s[^>]*|\\/#?\\w+(?:\\s[^>]*)?|\\w+(?:\\s[^>]*)?)>/gi - Individual tags');

console.log('\n=== Integration Recommendations ===');
console.log('Based on this analysis, here are potential integration strategies...');
