const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const xmlPath = path.join(__dirname, '../documentos/Planificacion Parques Chile v2.pod.xml');
const xmlString = fs.readFileSync(xmlPath, 'utf8');

const dom = new JSDOM("");
const DOMParser = dom.window.DOMParser;
const parser = new DOMParser();
const xmlDoc = parser.parseFromString(xmlString, "application/xml");

const projectNode = Array.from(xmlDoc.children).find(c => c.localName === 'Project');
const tasksNode = Array.from(projectNode.children).find(c => c.localName === 'Tasks');
const taskNodes = Array.from(tasksNode.children).filter(c => c.localName === 'Task');

function getChildNodeText(node, localName) {
  const children = Array.from(node.children);
  const child = children.find(c => c.localName === localName);
  return child && child.textContent ? child.textContent.trim() : null;
}

let hasPercent = 0;
let missingPercent = 0;
const valueDistribution = {};
const nonZeroExamples = [];

taskNodes.forEach((tNode) => {
  const name = getChildNodeText(tNode, 'Name');
  const percentText = getChildNodeText(tNode, 'PercentComplete');
  
  if (percentText === null || percentText === undefined) {
    missingPercent++;
  } else {
    hasPercent++;
    const value = percentText;
    
    // Distribution
    if (!valueDistribution[value]) valueDistribution[value] = 0;
    valueDistribution[value]++;
    
    // Examples != 0
    if (value !== '0' && nonZeroExamples.length < 5) {
      nonZeroExamples.push({ name, percent: value });
    }
  }
});

console.log("=== Reporte de PercentComplete ===");
console.log(`Tareas CON <PercentComplete>: ${hasPercent}`);
console.log(`Tareas SIN <PercentComplete>: ${missingPercent}`);
console.log("\nDistribución de valores:");
for (const [val, count] of Object.entries(valueDistribution)) {
  console.log(`- Valor '${val}': ${count} tareas`);
}
console.log("\nEjemplos con avance > 0:");
nonZeroExamples.forEach(ex => {
  console.log(`- ${ex.name}: ${ex.percent}%`);
});
