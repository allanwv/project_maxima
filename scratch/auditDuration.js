const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const xmlPath = path.join(__dirname, '../documentos/Planificacion Parques Chile v2.pod.xml');
const xmlString = fs.readFileSync(xmlPath, 'utf8');
const dom = new JSDOM("");
const parser = new dom.window.DOMParser();
const xmlDoc = parser.parseFromString(xmlString, "application/xml");

const projectNode = Array.from(xmlDoc.children).find(c => c.localName === 'Project');

function getChildNodeText(node, localName) {
  const children = Array.from(node.children);
  const child = children.find(c => c.localName === localName);
  return child && child.textContent ? child.textContent.trim() : null;
}

const minutesPerDay = getChildNodeText(projectNode, 'MinutesPerDay');
console.log('MinutesPerDay:', minutesPerDay);

const tasksNode = Array.from(projectNode.children).find(c => c.localName === 'Tasks');
const taskNodes = Array.from(tasksNode.children).filter(c => c.localName === 'Task');

console.log('--- Sample Tasks for Duration ---');
taskNodes.forEach(tNode => {
  const name = getChildNodeText(tNode, 'Name');
  const duration = getChildNodeText(tNode, 'Duration');
  const durationFormat = getChildNodeText(tNode, 'DurationFormat');
  const estimated = getChildNodeText(tNode, 'Estimated');
  
  if (['Operaciones Comerciales', 'Proyecto', 'Desarrollo Backend', 'Precontrato / Historial'].includes(name) || duration === 'PT471H0M0S') {
    console.log(`Task: ${name}`);
    console.log(`  Duration: ${duration}`);
    console.log(`  DurationFormat: ${durationFormat}`);
    console.log(`  Estimated: ${estimated}`);
  }
});
